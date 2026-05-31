import api from "./api";

export const pacienteService = {
  async list() {
    return api.get("/api/pacientes");
  },

  async get(id) {
    return api.get(`/api/pacientes/${id}`);
  },

  async getByCns(cns) {
    return api.get(`/api/pacientes/by-cns/${cns}`);
  },

  async create(payload) {
    return api.post("/api/pacientes", payload);
  },

  async update(id, payload) {
    return api.put(`/api/pacientes/${id}`, payload);
  },

  async remove(id) {
  return api.del(`/api/pacientes/${id}`);
},
};
