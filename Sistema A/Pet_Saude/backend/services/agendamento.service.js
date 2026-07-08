import { supabase } from '../supabase.js';
import {
  carregarLocaisPorIds,
  carregarProfissionaisEnriquecidosPorIds,
  listarLocaisDisponiveis,
  listarProfissionaisEnriquecidos,
  resolverLocalAgendamento,
} from '../utils/supabaseJoinFallback.js';

const CPF_SYSTEM = 'http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf';
const CNS_SYSTEM = 'http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns';
const CRM_SYSTEM = 'http://rnds.saude.gov.br/fhir/r4/NamingSystem/crm';
const IDENTIFIER_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0203';
const APPOINTMENT_STATUS_VALID = new Set([
  'proposed', 'pending', 'booked', 'arrived', 'fulfilled',
  'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist',
]);

const STATUS_MAP = {
  agendado: 'booked',
  confirmado: 'booked',
  pendente: 'pending',
  cancelado: 'cancelled',
  atendido: 'fulfilled',
  concluido: 'fulfilled',
  'concluído': 'fulfilled',
  realizado: 'fulfilled',
  em_andamento: 'arrived',
  faltou: 'noshow',
  noshow: 'noshow',
};

const GENDER_MAP = {
  m: 'male', masculino: 'male', male: 'male',
  f: 'female', feminino: 'female', female: 'female',
  o: 'other', outro: 'other', other: 'other',
};

class AgendamentoService {
  _mapearStatusFhir(statusBanco) {
    const k = (statusBanco || '').toLowerCase();
    return STATUS_MAP[k] || (APPOINTMENT_STATUS_VALID.has(k) ? k : 'booked');
  }

  _normalizarGender(sexo) {
    if (!sexo) return 'unknown';
    return GENDER_MAP[String(sexo).toLowerCase()] || 'unknown';
  }

  _crmUnificado(crm, uf) {
    if (!crm) return null;
    const apenasDigitos = String(crm).replace(/\D+/g, '');
    if (!apenasDigitos) return null;
    if (!uf) return apenasDigitos;
    return `${String(uf).toUpperCase()}${apenasDigitos}`;
  }

  _normalizarDataHora(agendamento) {
    if (!agendamento?.data_agendamento || !agendamento?.hora_agendamento) return null;
    return `${agendamento.data_agendamento}T${agendamento.hora_agendamento}-03:00`;
  }

  _formatarDataHoraOffset(data, offset = '-03:00') {
    const offsetMin = -3 * 60;
    const ajustada = new Date(data.getTime() + offsetMin * 60 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return (
      `${ajustada.getUTCFullYear()}-${p(ajustada.getUTCMonth() + 1)}-${p(ajustada.getUTCDate())}` +
      `T${p(ajustada.getUTCHours())}:${p(ajustada.getUTCMinutes())}:${p(ajustada.getUTCSeconds())}${offset}`
    );
  }

  _periodoAgendamento(agendamento) {
    const start = this._normalizarDataHora(agendamento);
    if (!start) return {};
    const inicio = new Date(start);
    if (Number.isNaN(inicio.getTime())) return {};
    const fim = new Date(inicio.getTime() + 30 * 60 * 1000);
    return { start, end: this._formatarDataHoraOffset(fim) };
  }

  _patientResource(paciente) {
    const identifier = [];
    if (paciente.cpf) {
      identifier.push({
        use: 'official',
        type: { coding: [{ system: IDENTIFIER_TYPE_SYSTEM, code: 'TAX', display: 'CPF' }] },
        system: CPF_SYSTEM,
        value: String(paciente.cpf).replace(/\D+/g, ''),
      });
    }
    if (paciente.cartao_sus) {
      identifier.push({
        use: 'official',
        type: { coding: [{ system: IDENTIFIER_TYPE_SYSTEM, code: 'NIIP', display: 'CNS' }] },
        system: CNS_SYSTEM,
        value: String(paciente.cartao_sus).replace(/\D+/g, ''),
      });
    }
    return {
      resourceType: 'Patient',
      id: paciente.id,
      identifier,
      name: [{ use: 'official', text: paciente.nome }],
      telecom: [
        ...(paciente.telefone ? [{ system: 'phone', value: paciente.telefone }] : []),
        ...(paciente.email ? [{ system: 'email', value: paciente.email }] : []),
      ],
      gender: this._normalizarGender(paciente.sexo),
      ...(paciente.data_nascimento ? { birthDate: paciente.data_nascimento } : {}),
      address: [{
        use: 'home',
        line: [paciente.logradouro || '', paciente.numero || '', paciente.complemento || ''].filter(Boolean),
        district: paciente.bairro || '',
        city: paciente.cidade || '',
        state: paciente.estado || '',
        postalCode: paciente.cep || '',
        country: 'BR',
      }],
      ...(paciente.nome_mae ? {
        extension: [{
          url: 'http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName',
          valueString: paciente.nome_mae,
        }],
      } : {}),
    };
  }

  _practitionerResource(profissional) {
    const crmValor = this._crmUnificado(profissional.crm, profissional.crm_uf || profissional.registro_uf);
    const identifier = crmValor ? [{
      use: 'official',
      type: { coding: [{ system: IDENTIFIER_TYPE_SYSTEM, code: 'PRN', display: 'CRM' }] },
      system: CRM_SYSTEM,
      value: crmValor,
    }] : [];

    const especialidadeNome = profissional.especialidade?.nome || profissional.especialidade;
    const especialidadeCodigo = profissional.especialidade?.codigo_cbo;

    return {
      resourceType: 'Practitioner',
      id: profissional.id,
      identifier,
      name: [{ text: profissional.nome }],
      telecom: [
        ...(profissional.telefone ? [{ system: 'phone', value: profissional.telefone }] : []),
        ...(profissional.email ? [{ system: 'email', value: profissional.email }] : []),
      ],
      ...(especialidadeNome ? {
        qualification: [{
          code: {
            ...(especialidadeCodigo ? {
              coding: [{ system: 'http://www.saude.gov.br/fhir/r4/CodeSystem/BRCBO', code: especialidadeCodigo, display: especialidadeNome }],
            } : {}),
            text: especialidadeNome,
          },
        }],
      } : {}),
    };
  }

  _locationResource(local) {
    return {
      resourceType: 'Location',
      id: local.id,
      status: local.ativo === false ? 'inactive' : 'active',
      name: local.nome,
      ...(local.endereco ? { address: { text: local.endereco, country: 'BR' } } : {}),
      ...(local.cnes ? {
        identifier: [{
          system: 'http://rnds.saude.gov.br/fhir/r4/NamingSystem/cnes',
          value: String(local.cnes),
        }],
      } : {}),
    };
  }

  _appointmentResource(agendamento, paciente, profissional, local) {
    return {
      resourceType: 'Appointment',
      id: agendamento.id,
      status: this._mapearStatusFhir(agendamento.status),
      ...(agendamento.tipo_atendimento ? {
        appointmentType: {
          coding: [{ display: agendamento.tipo_atendimento }],
          text: agendamento.tipo_atendimento,
        },
      } : {}),
      description: agendamento.observacoes || 'Atendimento agendado',
      ...this._periodoAgendamento(agendamento),
      participant: [
        { actor: { reference: `Patient/${paciente.id}`, display: paciente.nome }, status: 'accepted' },
        { actor: { reference: `Practitioner/${profissional.id}`, display: profissional.nome }, status: 'accepted' },
        ...(local ? [{ actor: { reference: `Location/${local.id}`, display: local.nome }, status: 'accepted' }] : []),
      ],
    };
  }

  async obterBundleFhir(agendamentoId) {
    const { data: ag, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('id', agendamentoId)
      .single();

    if (error) throw new Error(`Erro no banco de dados: ${error.message}`);
    if (!ag) return null;

    const [pacienteRes, profissionais, locais] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id', ag.paciente_id).single(),
      carregarProfissionaisEnriquecidosPorIds([ag.profissional_id]),
      carregarLocaisPorIds(ag.local_id ? [ag.local_id] : []),
    ]);

    if (pacienteRes.error) throw new Error(`Erro no banco de dados (paciente): ${pacienteRes.error.message}`);

    const paciente = pacienteRes.data;
    const profissional = profissionais[0] || null;
    const local = resolverLocalAgendamento(ag, new Map(locais.map((item) => [item.id, item])));
    if (!paciente || !profissional) {
      throw new Error('Agendamento sem paciente ou profissional associado.');
    }

    const entries = [
      { fullUrl: `Patient/${paciente.id}`, resource: this._patientResource(paciente) },
      { fullUrl: `Practitioner/${profissional.id}`, resource: this._practitionerResource(profissional) },
    ];
    if (local) entries.push({ fullUrl: `Location/${local.id}`, resource: this._locationResource(local) });
    entries.push({
      fullUrl: `Appointment/${ag.id}`,
      resource: this._appointmentResource(ag, paciente, profissional, local),
    });

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
  }

  async obterBundleFhirTodos() {
    const [pacRes, profissionais, locais, agRes] = await Promise.all([
      supabase.from('pacientes').select('*').order('nome'),
      listarProfissionaisEnriquecidos(),
      listarLocaisDisponiveis(),
      supabase
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: true })
        .order('hora_agendamento', { ascending: true }),
    ]);

    for (const [nome, r] of [['pacientes', pacRes], ['agendamentos', agRes]]) {
      if (r.error) throw new Error(`Erro no banco de dados (${nome}): ${r.error.message}`);
    }

    const pacientes = pacRes.data || [];
    const agendamentos = agRes.data || [];

    const pacientesMap = new Map(pacientes.map((p) => [p.id, p]));
    const profMap = new Map(profissionais.map((p) => [p.id, p]));
    const locMap = new Map(locais.map((l) => [l.id, l]));
    const locaisBundle = new Map(locais.map((l) => [l.id, l]));

    const entries = [];

    for (const p of pacientes) {
      entries.push({ fullUrl: `Patient/${p.id}`, resource: this._patientResource(p) });
    }
    for (const p of profissionais) {
      entries.push({ fullUrl: `Practitioner/${p.id}`, resource: this._practitionerResource(p) });
    }
    for (const ag of agendamentos) {
      const paciente = pacientesMap.get(ag.paciente_id);
      const profissional = profMap.get(ag.profissional_id);
      const local = resolverLocalAgendamento(ag, locMap);
      if (!paciente || !profissional) continue;
      if (local && !locaisBundle.has(local.id)) {
        locaisBundle.set(local.id, local);
      }
      entries.push({
        fullUrl: `Appointment/${ag.id}`,
        resource: this._appointmentResource(ag, paciente, profissional, local),
      });
    }
    for (const local of locaisBundle.values()) {
      entries.push({ fullUrl: `Location/${local.id}`, resource: this._locationResource(local) });
    }

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries,
    };
  }
}

export default new AgendamentoService();