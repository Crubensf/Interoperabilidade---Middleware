import api from "./api";

export const dashboardService = {
  async resumo() {
    return api.get("/api/dashboard/resumo");
  },

  async proximos(limit = 10) {
    return api.get(`/api/dashboard/proximos?limit=${limit}`);
  },

  async porDia({ start, end } = {}) {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);

    const qs = params.toString();
    return api.get(`/api/dashboard/agendamentos/por-dia${qs ? `?${qs}` : ""}`);
  },

  async porEspecialidade({ start, end, limit = 10 } = {}) {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    params.set("limit", String(limit));

    return api.get(`/api/dashboard/agendamentos/por-especialidade?${params.toString()}`);
  },
};
