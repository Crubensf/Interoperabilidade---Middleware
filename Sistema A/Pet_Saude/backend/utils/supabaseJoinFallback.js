import { supabase } from '../supabase.js';

function ensureQueryOk(label, result) {
  if (result.error) {
    throw new Error(`Erro no banco de dados (${label}): ${result.error.message}`);
  }
  return result.data || [];
}

function idsUnicos(ids = []) {
  return [...new Set(ids.filter(Boolean))];
}

function mapById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

function isMissingTableError(error, tableName) {
  return String(error?.message || '').includes(`Could not find the table 'public.${tableName}' in the schema cache`);
}

function slugify(value) {
  const slug = String(value || 'sem-local')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'sem-local';
}

function criarLocalLegado(nome) {
  if (!nome) return null;
  return {
    id: `legacy-local-${slugify(nome)}`,
    nome,
    endereco: null,
    cnes: null,
    ativo: true,
  };
}

export async function listarEspecialidadesDisponiveis() {
  const result = await supabase.from('especialidades').select('id, nome, codigo_cbo').order('nome');
  if (result.error) {
    if (isMissingTableError(result.error, 'especialidades')) return [];
    throw new Error(`Erro no banco de dados (especialidades): ${result.error.message}`);
  }
  return result.data || [];
}

export async function listarLocaisDisponiveis() {
  const result = await supabase.from('locais_atendimento').select('id, nome, endereco, cnes, ativo').order('nome');
  if (result.error) {
    if (isMissingTableError(result.error, 'locais_atendimento')) return [];
    throw new Error(`Erro no banco de dados (locais_atendimento): ${result.error.message}`);
  }
  return result.data || [];
}

export function anexarEspecialidades(profissionais = [], especialidades = []) {
  const especialidadesMap = mapById(especialidades);

  return profissionais.map((profissional) => ({
    ...profissional,
    crm_uf: profissional.crm_uf || profissional.registro_uf || null,
    especialidade: profissional.especialidade_id
      ? (especialidadesMap.get(profissional.especialidade_id) || profissional.especialidade || null)
      : (profissional.especialidade || null),
  }));
}

export async function listarProfissionaisEnriquecidos() {
  const [profissionaisRes, especialidadesRes] = await Promise.all([
    supabase.from('profissionais').select('*').order('nome'),
    listarEspecialidadesDisponiveis(),
  ]);

  const profissionais = ensureQueryOk('profissionais', profissionaisRes);
  const especialidades = especialidadesRes;

  return anexarEspecialidades(profissionais, especialidades);
}

export async function carregarProfissionaisEnriquecidosPorIds(ids = []) {
  const idsValidos = idsUnicos(ids);
  if (idsValidos.length === 0) return [];

  const [profissionaisRes, especialidadesRes] = await Promise.all([
    supabase.from('profissionais').select('*').in('id', idsValidos),
    listarEspecialidadesDisponiveis(),
  ]);

  const profissionais = ensureQueryOk('profissionais', profissionaisRes);
  const especialidades = especialidadesRes;

  return anexarEspecialidades(profissionais, especialidades);
}

export async function obterProfissionalEnriquecido(id) {
  const [profissionalRes, especialidadesRes] = await Promise.all([
    supabase.from('profissionais').select('*').eq('id', id).single(),
    listarEspecialidadesDisponiveis(),
  ]);

  if (profissionalRes.error) {
    throw new Error(`Erro no banco de dados (profissionais): ${profissionalRes.error.message}`);
  }

  const especialidades = especialidadesRes;
  const [profissional] = anexarEspecialidades([profissionalRes.data], especialidades);
  return profissional || null;
}

export async function carregarLocaisPorIds(ids = []) {
  const idsValidos = idsUnicos(ids);
  if (idsValidos.length === 0) return [];

  const result = await supabase
    .from('locais_atendimento')
    .select('id, nome, endereco, cnes, ativo')
    .in('id', idsValidos);

  if (result.error) {
    if (isMissingTableError(result.error, 'locais_atendimento')) return [];
    throw new Error(`Erro no banco de dados (locais_atendimento): ${result.error.message}`);
  }

  return result.data || [];
}

export function resolverLocalAgendamento(agendamento, locaisMap = new Map()) {
  if (!agendamento) return null;

  if (agendamento.local_id && locaisMap.has(agendamento.local_id)) {
    return locaisMap.get(agendamento.local_id);
  }

  return criarLocalLegado(agendamento.local_atendimento);
}

export async function listarAgendamentosDetalhados() {
  const [agendamentosRes, pacientesRes, locais, profissionais] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*')
      .order('data_agendamento', { ascending: true })
      .order('hora_agendamento', { ascending: true }),
    supabase.from('pacientes').select('id, nome, cartao_sus, cpf, telefone'),
    listarLocaisDisponiveis(),
    listarProfissionaisEnriquecidos(),
  ]);

  const agendamentos = ensureQueryOk('agendamentos', agendamentosRes);
  const pacientes = ensureQueryOk('pacientes', pacientesRes);

  const pacientesMap = mapById(pacientes);
  const profissionaisMap = mapById(profissionais);
  const locaisMap = mapById(locais);

  return agendamentos.map((agendamento) => ({
    ...agendamento,
    pacientes: pacientesMap.get(agendamento.paciente_id) || null,
    profissionais: profissionaisMap.get(agendamento.profissional_id) || null,
    local: resolverLocalAgendamento(agendamento, locaisMap),
  }));
}
