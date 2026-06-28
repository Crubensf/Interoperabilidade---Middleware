// Popula o mock_db.json com dados de demonstração.
// Uso: node seed.js
// Idempotente — pula registros que já existem (por cartao_sus / crm / nome).

import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'mock_db.json');

const ESPECIALIDADES = [
  { nome: 'Clínico Geral', codigo_cbo: '225125' },
  { nome: 'Cardiologia', codigo_cbo: '225130' },
  { nome: 'Pediatria', codigo_cbo: '225124' },
  { nome: 'Dermatologia', codigo_cbo: '225135' },
];

const LOCAIS = [
  { nome: 'Clínica Central', endereco: 'Av. Sete de Setembro, 500 - Picos', cnes: '1234567' },
  { nome: 'UPA Norte', endereco: 'Rua dos Andradas, 100 - Picos', cnes: '7654321' },
];

const PACIENTES = [
  { nome: 'Maria Oliveira',  cartao_sus: '700000000000101', cpf: '12345678901', telefone: '89999990001', data_nascimento: '1985-03-12', sexo: 'F' },
  { nome: 'João Santos',     cartao_sus: '700000000000102', cpf: '12345678902', telefone: '89999990002', data_nascimento: '1992-07-04', sexo: 'M' },
  { nome: 'Ana Souza',       cartao_sus: '700000000000103', cpf: '12345678903', telefone: '89999990003', data_nascimento: '1978-11-22', sexo: 'F' },
  // Mesmo CNS do Caio do Sistema B — para exercitar a dedup cross-sistema:
  { nome: 'Caio R Feitosa',  cartao_sus: '222222222222222', cpf: '00000000004', telefone: '89981248316', data_nascimento: '2001-02-02', sexo: 'M' },
];

const PROFISSIONAIS = [
  { nome: 'Dra. Beatriz Lima',    crm: '12345', crm_uf: 'PI', especialidade: 'Clínico Geral', tipo_atendimento: 'Presencial e Telemedicina', telefone: '89988880001' },
  { nome: 'Dr. Henrique Alves',   crm: '23456', crm_uf: 'PI', especialidade: 'Cardiologia',   tipo_atendimento: 'Presencial', telefone: '89988880002' },
  { nome: 'Dra. Luana Pires',     crm: '34567', crm_uf: 'PI', especialidade: 'Pediatria',     tipo_atendimento: 'Presencial', telefone: '89988880003' },
];

function load() {
  if (!fs.existsSync(DB_FILE)) {
    return { pacientes: [], especialidades: [], locais_atendimento: [], profissionais: [], agendamentos: [] };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nextId(arr) {
  return arr.length ? Math.max(...arr.map(x => Number(x.id) || 0)) + 1 : 1;
}

function upsert(arr, key, novo) {
  const ja = arr.find(x => x[key] && x[key] === novo[key]);
  if (ja) return { item: ja, criado: false };
  const item = { id: nextId(arr), ...novo };
  arr.push(item);
  return { item, criado: true };
}

function seed() {
  const db = load();
  db.pacientes ??= [];
  db.especialidades ??= [];
  db.locais_atendimento ??= [];
  db.profissionais ??= [];
  db.agendamentos ??= [];

  let novos = { especialidades: 0, locais: 0, pacientes: 0, profissionais: 0, agendamentos: 0 };

  for (const esp of ESPECIALIDADES) {
    const { criado } = upsert(db.especialidades, 'nome', esp);
    if (criado) novos.especialidades++;
  }

  for (const loc of LOCAIS) {
    const { criado } = upsert(db.locais_atendimento, 'nome', loc);
    if (criado) novos.locais++;
  }

  for (const p of PACIENTES) {
    const { criado } = upsert(db.pacientes, 'cartao_sus', p);
    if (criado) novos.pacientes++;
  }

  for (const prof of PROFISSIONAIS) {
    const esp = db.especialidades.find(e => e.nome === prof.especialidade);
    const payload = { ...prof, especialidade_id: esp?.id ?? null };
    delete payload.especialidade;
    const { criado } = upsert(db.profissionais, 'crm', payload);
    if (criado) novos.profissionais++;
  }

  // Um agendamento de exemplo (só se ainda não houver nenhum)
  if (db.agendamentos.length === 0) {
    const paciente = db.pacientes.find(p => p.cartao_sus === '700000000000101');
    const profissional = db.profissionais.find(p => p.crm === '12345');
    const local = db.locais_atendimento[0];
    if (paciente && profissional && local) {
      db.agendamentos.push({
        id: 1,
        paciente_id: paciente.id,
        profissional_id: profissional.id,
        local_id: local.id,
        data_agendamento: '2026-07-15',
        hora_agendamento: '10:00',
        status: 'agendado',
        observacoes: 'Consulta de rotina (seed demo).',
      });
      novos.agendamentos++;
    }
  }

  save(db);

  console.log('Seed do Sistema A concluído. Inseridos:');
  for (const [k, v] of Object.entries(novos)) console.log(`  ${k}: ${v}`);
  if (Object.values(novos).every(n => n === 0)) {
    console.log('  (nada novo — dados já presentes)');
  }
}

seed();
