import api from './api';

export const pacientesService = {
  // Listar todos os pacientes
  getAll: async () => {
    const response = await api.get('/pacientes');
    return response.data;
  },

  // Buscar paciente por ID
  getById: async (id) => {
    const response = await api.get(`/pacientes/${id}`);
    return response.data;
  },

  // Criar novo paciente
  create: async (pacienteData) => {
    const response = await api.post('/pacientes', pacienteData);
    return response.data;
  },

  // Atualizar paciente
  update: async (id, pacienteData) => {
    const response = await api.put(`/pacientes/${id}`, pacienteData);
    return response.data;
  },

  // Deletar paciente
  delete: async (id) => {
    const response = await api.delete(`/pacientes/${id}`);
    return response.data;
  },
};
