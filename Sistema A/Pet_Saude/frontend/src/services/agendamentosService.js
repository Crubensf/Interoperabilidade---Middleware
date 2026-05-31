import api from './api';

export const agendamentosService = {
  // Listar todos os agendamentos
  getAll: async () => {
    const response = await api.get('/agendamentos');
    return response.data;
  },

  // Buscar agendamento por ID
  getById: async (id) => {
    const response = await api.get(`/agendamentos/${id}`);
    return response.data;
  },

  // Criar novo agendamento
  create: async (agendamentoData) => {
    const response = await api.post('/agendamentos', agendamentoData);
    return response.data;
  },

  // Atualizar agendamento
  update: async (id, agendamentoData) => {
    const response = await api.put(`/agendamentos/${id}`, agendamentoData);
    return response.data;
  },

  // Atualizar status do agendamento
  updateStatus: async (id, status) => {
    const response = await api.patch(`/agendamentos/${id}/status`, { status });
    return response.data;
  },

  // Verificar disponibilidade
  checkAvailability: async (profissionalId, dataAgendamento, horaAgendamento) => {
    const response = await api.get('/agendamentos/disponibilidade', {
      params: {
        profissional_id: profissionalId,
        data_agendamento: dataAgendamento,
        hora_agendamento: horaAgendamento,
      },
    });
    return response.data;
  },

  // Deletar agendamento
  delete: async (id) => {
    const response = await api.delete(`/agendamentos/${id}`);
    return response.data;
  },
};
