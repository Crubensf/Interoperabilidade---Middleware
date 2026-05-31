import api from './api';

export const profissionaisService = {
  // Listar todos os profissionais
  getAll: async () => {
    const response = await api.get('/profissionais');
    return response.data;
  },

  // Buscar profissional por ID
  getById: async (id) => {
    const response = await api.get(`/profissionais/${id}`);
    return response.data;
  },

  // Criar novo profissional
  create: async (profissionalData) => {
    const response = await api.post('/profissionais', profissionalData);
    return response.data;
  },

  // Atualizar profissional
  update: async (id, profissionalData) => {
    const response = await api.put(`/profissionais/${id}`, profissionalData);
    return response.data;
  },

  // Deletar profissional
  delete: async (id) => {
    const response = await api.delete(`/profissionais/${id}`);
    return response.data;
  },
};
