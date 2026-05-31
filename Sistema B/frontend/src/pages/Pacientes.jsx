import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, UserPlus, AlertCircle, Users } from "lucide-react";
import { pacienteService } from "../services/pacienteService";

function onlyDigits(v) { return String(v ?? "").replace(/\D+/g, ""); }
function clampDigits(v, max) { return onlyDigits(v).slice(0, max); }

function initialForm() {
  return { nome: "", cpf: "", cartao_sus: "", telefone: "", data_nascimento: "", municipio: "", endereco: "", nome_mae: "" };
}

export default function Pacientes() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm());
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((p) =>
      [p.nome, p.municipio, p.cartao_sus, p.telefone, p.cpf].some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [items, query]);

  async function load() {
    setLoading(true);
    setErr("");
    try { setItems(await pacienteService.list()); }
    catch (e) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      nome: p.nome ?? "", cpf: String(p.cpf ?? ""),
      cartao_sus: String(p.cartao_sus ?? ""), telefone: String(p.telefone ?? ""),
      data_nascimento: (p.data_nascimento ?? "").slice(0, 10),
      municipio: p.municipio ?? "", endereco: p.endereco ?? "", nome_mae: p.nome_mae ?? "",
    });
    setErr("");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function resetForm() { setForm(initialForm()); setEditingId(null); setErr(""); }

  async function removePaciente(p) {
    if (!window.confirm(`Excluir o paciente "${p.nome}"?\n\nSe houver agendamentos vinculados, a exclusão pode ser bloqueada.`)) return;
    setErr("");
    try {
      await pacienteService.remove(p.id);
      if (editingId === p.id) resetForm();
      await load();
    } catch (e) { setErr(String(e?.message || e)); }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    const payload = { ...form, cartao_sus: clampDigits(form.cartao_sus, 15), telefone: clampDigits(form.telefone, 11) };
    try {
      if (editingId) { await pacienteService.update(editingId, payload); }
      else { await pacienteService.create(payload); }
      resetForm();
      await load();
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cadastro e gerenciamento de pacientes da UBS</p>
        </div>
        <button onClick={resetForm} type="button" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-colors">
          <UserPlus className="w-4 h-4" />
          Novo paciente
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
            {editingId ? `Editando paciente #${editingId}` : "Novo paciente"}
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
            <Field label="Nome da mãe" value={form.nome_mae} onChange={(v) => setForm({ ...form, nome_mae: v })} required />
            <Field
              label="CPF (somente números)" value={form.cpf} inputMode="numeric" maxLength={11}
              onChange={(v) => setForm({ ...form, cpf: clampDigits(v, 11) })} required
            />
            <Field
              label="Cartão SUS — CNS (opcional)" value={form.cartao_sus} inputMode="numeric" maxLength={15}
              onChange={(v) => setForm({ ...form, cartao_sus: clampDigits(v, 15) })}
            />
            <Field
              label="Telefone (DDD + número)" value={form.telefone} inputMode="numeric" maxLength={11}
              onChange={(v) => setForm({ ...form, telefone: clampDigits(v, 11) })} required
            />
            <Field type="date" label="Data de nascimento" value={form.data_nascimento} onChange={(v) => setForm({ ...form, data_nascimento: v })} required />
            <Field label="Município" value={form.municipio} onChange={(v) => setForm({ ...form, municipio: v })} required />
            <Field label="Endereço completo" value={form.endereco} onChange={(v) => setForm({ ...form, endereco: v })} required full />
          </div>

          <div className="flex justify-end mt-5">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 transition-colors">
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar paciente"}
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
          placeholder="Buscar por nome, CPF, CNS, telefone ou município…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            {filtered.length} paciente{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                {["Nome", "CPF", "CNS", "Telefone", "Município", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum paciente encontrado.</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{p.nome}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.cpf}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.cartao_sus || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{p.telefone}</td>
                    <td className="px-4 py-3 text-slate-600">{p.municipio}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => startEdit(p)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-sky-200 text-sky-700 hover:bg-sky-50 transition-colors">
                          Editar
                        </button>
                        <button type="button" onClick={() => removePaciente(p)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
          Se a exclusão falhar, provavelmente existem agendamentos vinculados ao paciente.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", full, inputMode, maxLength, required }) {
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-slate-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
      />
    </label>
  );
}
