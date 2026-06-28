import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';


import agendamentoController from './controllers/agendamento.controller.js';
import { apiKeyMiddleware } from './middlewares/apiKey.middleware.js';
import { sendError } from './utils/operationOutcome.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(apiKeyMiddleware);

// ============================================
// PACIENTES
// ============================================
app.get('/pacientes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('pacientes').select('*').order('nome');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao buscar pacientes', error.message);
  }
});

app.get('/pacientes/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao buscar paciente', error.message);
  }
});

app.post('/pacientes', async (req, res) => {
  try {
    const { nome, cartao_sus } = req.body;
    if (!nome || !cartao_sus) {
      return sendError(res, 400, 'required', 'Nome e Cartão SUS são obrigatórios.');
    }
    const { data, error } = await supabase.from('pacientes').insert([req.body]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao criar paciente', error.message);
  }
});

app.put('/pacientes/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pacientes')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao atualizar paciente', error.message);
  }
});

app.delete('/pacientes/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('pacientes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Paciente deletado com sucesso' });
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao deletar paciente', error.message);
  }
});

// ============================================
// ESPECIALIDADES (novo)
// ============================================
app.get('/especialidades', async (req, res) => {
  try {
    const { data, error } = await supabase.from('especialidades').select('*').order('nome');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao buscar especialidades', error.message);
  }
});

app.post('/especialidades', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return sendError(res, 400, 'required', 'Nome é obrigatório.');
    const { data, error } = await supabase.from('especialidades').insert([req.body]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao criar especialidade', error.message);
  }
});

// ============================================
// LOCAIS DE ATENDIMENTO (novo)
// ============================================
app.get('/locais', async (req, res) => {
  try {
    const { data, error } = await supabase.from('locais_atendimento').select('*').order('nome');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao buscar locais', error.message);
  }
});

app.post('/locais', async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return sendError(res, 400, 'required', 'Nome é obrigatório.');
    const { data, error } = await supabase.from('locais_atendimento').insert([req.body]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao criar local', error.message);
  }
});

// ============================================
// PROFISSIONAIS
// ============================================
app.get('/profissionais', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .order('nome');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao buscar profissionais', error.message);
  }
});

app.get('/profissionais/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao buscar profissional', error.message);
  }
});

app.post('/profissionais', async (req, res) => {
  try {
    const { nome, crm } = req.body;
    if (!nome || !crm) {
      return sendError(res, 400, 'required', 'Nome e CRM são obrigatórios.');
    }
    if (req.body.tipo_atendimento) {
      const permitidos = ['Presencial', 'Telemedicina', 'Presencial e Telemedicina'];
      if (!permitidos.includes(req.body.tipo_atendimento)) {
        return sendError(res, 400, 'value', 'Tipo de atendimento inválido.');
      }
    }
    const { data, error } = await supabase.from('profissionais').insert([req.body]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao criar profissional', error.message);
  }
});

app.put('/profissionais/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profissionais')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao atualizar profissional', error.message);
  }
});

app.delete('/profissionais/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('profissionais').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Profissional deletado com sucesso' });
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao deletar profissional', error.message);
  }
});

// ============================================
// AGENDAMENTOS
// ============================================
app.get('/agendamentos/:id/fhir', agendamentoController.getFhirBundle);
app.get('/fhir/bundle', agendamentoController.getFhirBundleTodos);

app.get('/agendamentos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        *,
        pacientes:paciente_id (id, nome, cartao_sus, cpf, telefone),
        profissionais:profissional_id (id, nome, crm, registro_uf, especialidade),
        local:local_id (id, nome, endereco, cnes)
      `)
      .order('data_agendamento', { ascending: true })
      .order('hora_agendamento', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao buscar agendamentos', error.message);
  }
});

app.post('/agendamentos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .insert([req.body])
      .select(`
        *,
        pacientes:paciente_id (id, nome, cartao_sus, cpf, telefone),
        profissionais:profissional_id (id, nome, crm, registro_uf, especialidade),
        local:local_id (id, nome)
      `)
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao criar agendamento', error.message);
  }
});

app.put('/agendamentos/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .update(req.body)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao atualizar agendamento', error.message);
  }
});

app.delete('/agendamentos/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('agendamentos').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Agendamento deletado com sucesso' });
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao deletar agendamento', error.message);
  }
});

app.get('/agendamentos/disponibilidade', async (req, res) => {
  try {
    const { profissional_id, data_agendamento, hora_agendamento } = req.query;
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('profissional_id', profissional_id)
      .eq('data_agendamento', data_agendamento)
      .eq('hora_agendamento', hora_agendamento);
    if (error) throw error;
    res.json({ disponivel: data.length === 0 });
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao verificar disponibilidade', error.message);
  }
});

app.patch('/agendamentos/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('agendamentos')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'exception', 'Erro ao atualizar status', error.message);
  }
});

// ============================================
// HEALTH
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API rodando', auth: process.env.API_KEY ? 'api-key' : 'none' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Conectado ao Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`🔐 Auth: ${process.env.API_KEY ? 'X-API-Key habilitada' : 'DESABILITADA (defina API_KEY no .env)'}`);
});
