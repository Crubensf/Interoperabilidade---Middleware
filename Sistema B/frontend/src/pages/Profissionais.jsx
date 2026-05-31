import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, UserPlus, AlertCircle, Stethoscope } from "lucide-react";
import api from "../services/api";

function initialForm() {
  return { nome: "", especialidade_id: "", crm: "", crm_uf: "", ativo: true };
}

export default function Profissionais() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm());
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((p) =>
      [p.nome, p.crm, p.crm_uf, especialidades.find((e) => e.id === p.especialidade_id)?.nome ?? ""].some(
        (v) => String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [items, query, especialidades]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [prof, esp] = await Promise.all([api.get("/api/profissionais"), api.get("/api/especialidades")]);
      setItems(Array.isArray(prof) ? prof : prof?.data ?? []);
      setEspecialidades(Array.isArray(esp) ? esp : esp?.data ?? []);
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({ nome: p.nome ?? "", especialidade_id: String(p.especialidade_id ?? ""), crm: p.crm ?? "", crm_uf: p.crm_uf ?? "", ativo: Boolean(p.ativo) });
    setErr("");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function resetForm() { setForm(initialForm()); setEditingId(null); setErr(""); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    const payload = { nome: form.nome, especialidade_id: Number(form.especialidade_id), crm: form.crm || null, crm_uf: form.crm_uf || null, ativo: Boolean(form.ativo) };
    try {
      if (editingId) { await api.put(`/api/profissionais/${editingId}`, payload); }
      else { await api.post("/api/profissionais", payload); }
      resetForm();
      await load();
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setSaving(false); }
  }

  async function removeProfissional(p) {
    if (!window.confirm(`Excluir o profissional "${p.nome}"?\n\nSe houver agendamentos vinculados, a exclusão pode ser bloqueada.`)) return;
    setErr("");
    try {
      await api.del(`/api/profissionais/${p.id}`);
      if (editingId === p.id) resetForm();
      await load();
    } catch (e) { setErr(String(e?.message || e)); }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Profissionais</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cadastro e gerenciamento de profissionais de saúde</p>
        </div>
        <button onClick={resetForm} type="button" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors">
          <UserPlus className="w-4 h-4" />
          Novo profissional
        </button>
      </div>

      {err && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}

      {/* Formulário */}
      <div ref={formRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-sky-50">
          <p className="text-sm font-semibold text-slate-800">
            {editingId ? `Editando profissional #${editingId}` : "Novo profissional"}
          </p>
          {editingId && (
            <button type="button" onClick={resetForm} disabled={saving} className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={submit} className="p-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome completo" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} required />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700">Especialidade<span className="text-red-400 ml-0.5">*</span></span>
              <select
                value={form.especialidade_id}
                onChange={(e) => setForm({ ...form, especialidade_id: e.target.value })}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition bg-white"
              >
                <option value="" disabled>Selecione…</option>
                {especialidades.map((e) => (
                  <option key={e.id} value={String(e.id)}>{e.nome}</option>
                ))}
              </select>
            </label>

            <Field label="CRM" value={form.crm} onChange={(v) => setForm({ ...form, crm: v })} />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-slate-700">UF do CRM</span>
              <input
                type="text"
                value={form.crm_uf}
                maxLength={2}
                onChange={(e) => setForm({ ...form, crm_uf: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition uppercase"
                placeholder="Ex: PI"
              />
            </label>

            <label className="flex items-center gap-3 sm:col-span-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
              />
              <span className="text-sm font-medium text-slate-700">Profissional ativo</span>
            </label>
          </div>

          <div className="flex justify-end mt-5">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 transition-colors">
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar profissional"}
            </button>
          </div>
        </form>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, CRM ou especialidade…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
          <Stethoscope className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            {filtered.length} profissional{filtered.length !== 1 ? "is" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                {["Nome", "Especialidade", "CRM", "Status", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhum profissional encontrado.</td></tr>
              ) : (
                filtered.map((p) => {
                  const espNome = especialidades.find((e) => e.id === p.especialidade_id)?.nome || `#${p.especialidade_id}`;
                  const crmStr = p.crm && p.crm_uf ? `${p.crm}-${p.crm_uf}` : p.crm || "—";
                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.nome}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{espNome}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{crmStr}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${p.ativo ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => startEdit(p)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors">
                            Editar
                          </button>
                          <button type="button" onClick={() => removeProfissional(p)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                            Excluir
                          </button>
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
          Se a exclusão falhar, provavelmente existem agendamentos vinculados ao profissional.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-xs font-semibold text-slate-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
      />
    </label>
  );
}
