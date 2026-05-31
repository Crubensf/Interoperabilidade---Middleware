import React, { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, AlertCircle, FileJson, FileText } from "lucide-react";
import api from "../services/api";
import { ensureBundleObject } from "../utils/fhirBundle";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

const STATUS_STYLE = {
  agendado: "bg-sky-50 text-sky-700 border border-sky-200",
  atendido: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelado: "bg-red-50 text-red-600 border border-red-200",
};
const STATUS_LABEL = { agendado: "Agendado", atendido: "Atendido", cancelado: "Cancelado" };

const MODALITY_STYLE = {
  TELEMEDICINA: "bg-violet-50 text-violet-700 border border-violet-200",
  PRESENCIAL: "bg-slate-50 text-slate-600 border border-slate-200",
};

function fmtDt(iso) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toInputDateTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AgendamentosCRUD() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [locais, setLocais] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ paciente_id: "", profissional_id: "", especialidade_id: "", local_id: "", inicio: "", modalidade: "PRESENCIAL", status: "agendado" });
  const [saving, setSaving] = useState(false);

  const maps = useMemo(() => ({
    mPac: new Map(pacientes.map((p) => [String(p.id), p])),
    mProf: new Map(profissionais.map((p) => [String(p.id), p])),
    mEsp: new Map(especialidades.map((e) => [String(e.id), e])),
    mLoc: new Map(locais.map((l) => [String(l.id), l])),
  }), [pacientes, profissionais, especialidades, locais]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) => {
      const pac = maps.mPac.get(String(a.paciente_id))?.nome || "";
      const prof = maps.mProf.get(String(a.profissional_id))?.nome || "";
      const esp = maps.mEsp.get(String(a.especialidade_id))?.nome || "";
      const loc = maps.mLoc.get(String(a.local_id))?.nome || "";
      return [a.id, a.modalidade, a.status, a.inicio, pac, prof, esp, loc].some(
        (x) => String(x ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, maps]);

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const [agRes, pacRes, profRes, espRes, locRes] = await Promise.all([
        api.get("/api/agendamentos"), api.get("/api/pacientes"), api.get("/api/profissionais"),
        api.get("/api/especialidades"), api.get("/api/locais"),
      ]);
      setItems(agRes || []);
      setPacientes(pacRes || []);
      setProfissionais(profRes || []);
      setEspecialidades(espRes || []);
      setLocais(locRes || []);
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  function startEdit(a) {
    setEditing(a);
    setForm({
      paciente_id: String(a.paciente_id ?? ""), profissional_id: String(a.profissional_id ?? ""),
      especialidade_id: String(a.especialidade_id ?? ""), local_id: String(a.local_id ?? ""),
      inicio: toInputDateTime(a.inicio), modalidade: a.modalidade ?? "PRESENCIAL", status: a.status ?? "agendado",
    });
    setErr("");
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ paciente_id: "", profissional_id: "", especialidade_id: "", local_id: "", inicio: "", modalidade: "PRESENCIAL", status: "agendado" });
  }

  function setF(key, value) { setForm((s) => ({ ...s, [key]: value })); }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setErr("");
    try {
      await api.put(`/api/agendamentos/${editing.id}`, {
        paciente_id: Number(form.paciente_id), profissional_id: Number(form.profissional_id),
        especialidade_id: Number(form.especialidade_id), local_id: Number(form.local_id),
        inicio: new Date(form.inicio).toISOString(), modalidade: form.modalidade, status: form.status,
      });
      cancelEdit();
      await loadAll();
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!window.confirm("Remover este agendamento? Essa ação não pode ser desfeita.")) return;
    try { await api.del(`/api/agendamentos/${id}`); await loadAll(); }
    catch (e) { setErr(String(e?.message || e)); }
  }

  async function cancelarPorStatus(a) {
    if (!window.confirm("Cancelar este agendamento?")) return;
    try { await api.put(`/api/agendamentos/${a.id}`, { status: "cancelado" }); await loadAll(); }
    catch (e) { setErr(String(e?.message || e)); }
  }

  async function baixarBundleJson(id) {
    try {
      setErr("");
      const bundle = await api.get(`/fhir/bundle/agendamento/${id}`);
      const content = JSON.stringify(ensureBundleObject(bundle), null, 2);
      const blob = new Blob([content], { type: "application/fhir+json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `bundle_agendamento_${id}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErr(String(e?.message || e)); }
  }

  async function baixarBundleGeralJson() {
    try {
      setErr("");
      const bundle = await api.get("/fhir/bundle/geral/transaction");
      const content = JSON.stringify(ensureBundleObject(bundle), null, 2);
      const blob = new Blob([content], { type: "application/fhir+json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "bundle_geral_validador.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErr(String(e?.message || e)); }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gestão de agendamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Editar, cancelar e exportar agendamentos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={baixarBundleGeralJson} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <FileJson className="w-4 h-4" /> Bundle JSON
          </button>
          <button onClick={() => window.open(`${API_BASE}/fhir/bundle/geral/pdf`, "_blank")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <FileText className="w-4 h-4" /> Bundle PDF
          </button>
          <button onClick={loadAll} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Carregando…" : "Recarregar"}
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      {/* Formulário de edição */}
      {editing && (
        <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-sky-100 bg-sky-50">
            <p className="text-sm font-semibold text-sky-800">Editando agendamento #{editing.id}</p>
            <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-800 transition-colors">Cancelar</button>
          </div>
          <div className="p-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField label="Paciente" value={form.paciente_id} onChange={(v) => setF("paciente_id", v)} options={pacientes.map((p) => ({ value: String(p.id), label: `${p.nome} (#${p.id})` }))} />
              <SelectField label="Especialidade" value={form.especialidade_id} onChange={(v) => setF("especialidade_id", v)} options={especialidades.map((e) => ({ value: String(e.id), label: e.nome }))} />
              <SelectField label="Profissional" value={form.profissional_id} onChange={(v) => setF("profissional_id", v)} options={profissionais.map((p) => ({ value: String(p.id), label: p.nome }))} />
              <SelectField label="Local" value={form.local_id} onChange={(v) => setF("local_id", v)} options={locais.map((l) => ({ value: String(l.id), label: `${l.nome} — ${l.municipio}` }))} />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700">Início</span>
                <input type="datetime-local" value={form.inicio} onChange={(e) => setF("inicio", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 transition" />
              </label>
              <SelectField label="Modalidade" value={form.modalidade} onChange={(v) => setF("modalidade", v)} options={[{ value: "PRESENCIAL", label: "Presencial" }, { value: "TELEMEDICINA", label: "Telemedicina" }]} />
              <SelectField label="Situação" value={form.status} onChange={(v) => setF("status", v)} options={[{ value: "agendado", label: "Agendado" }, { value: "cancelado", label: "Cancelado" }, { value: "atendido", label: "Atendido" }]} />
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={cancelEdit} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 transition-colors">
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por paciente, profissional, especialidade, local, status…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{filtered.length} agendamento{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
            <thead>
              <tr className="bg-slate-50 text-left">
                {["ID", "Data/Hora", "Paciente", "Especialidade", "Profissional", "Local", "Modalidade", "Status", "Ações"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Nenhum agendamento encontrado.</td></tr>
              ) : (
                filtered.map((a) => {
                  const pac = maps.mPac.get(String(a.paciente_id))?.nome || `#${a.paciente_id}`;
                  const esp = maps.mEsp.get(String(a.especialidade_id))?.nome || `#${a.especialidade_id}`;
                  const prof = maps.mProf.get(String(a.profissional_id))?.nome || `#${a.profissional_id}`;
                  const loc = maps.mLoc.get(String(a.local_id))?.nome || `#${a.local_id}`;
                  return (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                      <td className="px-3 py-3 text-xs font-mono text-slate-400">#{a.id}</td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{fmtDt(a.inicio)}</td>
                      <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">{pac}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{esp}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{prof}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{loc}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${MODALITY_STYLE[a.modalidade] || "bg-slate-100 text-slate-600"}`}>
                          {a.modalidade === "TELEMEDICINA" ? "Telemedicina" : "Presencial"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[a.status] || "bg-slate-100 text-slate-600"}`}>
                          {STATUS_LABEL[a.status] || a.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ActionBtn onClick={() => startEdit(a)} variant="default">Editar</ActionBtn>
                          {a.status !== "cancelado" && (
                            <ActionBtn onClick={() => cancelarPorStatus(a)} variant="warn">Cancelar</ActionBtn>
                          )}
                          <ActionBtn onClick={() => remove(a.id)} variant="danger">Remover</ActionBtn>
                          <ActionBtn onClick={() => baixarBundleJson(a.id)} variant="info">JSON</ActionBtn>
                          <ActionBtn onClick={() => window.open(`${API_BASE}/fhir/bundle/comprovante/${a.id}`, "_blank")} variant="pdf">PDF</ActionBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
          "Cancelar" altera o status para cancelado. "Remover" exclui permanentemente o registro.
        </p>
      </div>
    </div>
  );
}

const ACTION_STYLES = {
  default: "border-slate-200 text-slate-700 hover:bg-slate-50",
  warn: "border-amber-200 text-amber-700 hover:bg-amber-50",
  danger: "border-red-200 text-red-600 hover:bg-red-50",
  info: "border-sky-200 text-sky-700 hover:bg-sky-50",
  pdf: "border-slate-200 text-slate-600 hover:bg-slate-50",
};

function ActionBtn({ onClick, variant = "default", children }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${ACTION_STYLES[variant]}`}
    >
      {children}
    </button>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 transition bg-white"
      >
        <option value="" disabled>Selecione…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
