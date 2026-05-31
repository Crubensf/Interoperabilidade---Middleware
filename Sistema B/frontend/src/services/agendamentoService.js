
import api from "./api";

function onlyDigits(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

export async function carregarCatalogos() {
  const [especialidadesRes, locaisRes, profissionaisRes] = await Promise.all([
    api.get("/api/especialidades"),
    api.get("/api/locais"),
    api.get("/api/profissionais"),
  ]);

  return {
  especialidades: especialidadesRes,
  locais: locaisRes,
  profissionaisAll: profissionaisRes,
};
}

export async function carregarProfissionais(especialidadeId) {

  const all = await api.get("/api/profissionais");


  const id = Number(especialidadeId);
  if (!Number.isFinite(id)) return all;

  return all.filter((p) => Number(p.especialidade_id) === id);
}

export async function carregarSlots(profissionalId, dateStr) {

  const params = new URLSearchParams({
    profissional_id: String(profissionalId),
    date: String(dateStr),
  });

  return await api.get(`/api/slots?${params.toString()}`);

}

export async function cadastrarPaciente(paciente) {
  const payload = {
    ...paciente,
    cartao_sus: onlyDigits(paciente.cartao_sus),
    telefone: onlyDigits(paciente.telefone),
  };

  return await api.post("/api/pacientes", payload);
}

export async function criarAgendamento(payload) {
  return await api.post("/api/agendamentos", payload);
}
