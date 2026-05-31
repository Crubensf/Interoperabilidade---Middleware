import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Stethoscope, Calendar, MapPin, ClipboardList, CalendarClock,
  RefreshCw, TrendingUp, Award,
} from "lucide-react";
import { dashboardService } from "../services/dashboardService";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function minusDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtDt(iso) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit",
  });
}

const MODALITY_STYLE = {
  TELEMEDICINA: "bg-violet-50 text-violet-700 border border-violet-200",
  PRESENCIAL: "bg-sky-50 text-sky-700 border border-sky-200",
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [resumo, setResumo] = useState(null);
  const [proximos, setProximos] = useState([]);
  const [serie, setSerie] = useState([]);
  const [ranking, setRanking] = useState([]);

  const range = useMemo(
    () => ({ start: minusDaysISO(6), end: todayISO() }),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        dashboardService.resumo(),
        dashboardService.proximos(10),
        dashboardService.porDia(range),
        dashboardService.porEspecialidade({ start: minusDaysISO(29), end: todayISO(), limit: 8 }),
      ]);
      setResumo(r1);
      setProximos(r2);
      setSerie(r3);
      setRanking(r4);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const maxSerie = useMemo(() => Math.max(...serie.map((r) => r.total), 1), [serie]);
  const maxRanking = useMemo(() => Math.max(...ranking.map((r) => r.total), 1), [ranking]);

  const kpis = resumo
    ? [
        { label: "Pacientes", value: resumo.total_pacientes, icon: Users, color: "sky" },
        { label: "Profissionais", value: resumo.total_profissionais, icon: Stethoscope, color: "violet" },
        { label: "Especialidades", value: resumo.total_especialidades, icon: Award, color: "indigo" },
        { label: "Locais", value: resumo.total_locais, icon: MapPin, color: "teal" },
        { label: "Agendamentos", value: resumo.total_agendamentos, icon: ClipboardList, color: "blue" },
        { label: "Hoje", value: resumo.agendamentos_hoje, icon: CalendarClock, color: "emerald" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral do sistema de agendamento</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
          {err}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {loading && !resumo
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-24" />
            ))
          : kpis.map(({ label, value, icon: Icon, color }) => (
              <KpiCard key={label} label={label} value={value} Icon={Icon} color={color} />
            ))}
      </div>

      {/* Próximos agendamentos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-sky-50">
          <Calendar className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-800">Próximos agendamentos</h2>
          <span className="ml-auto text-xs text-slate-400">{proximos.length} registro(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left bg-slate-50">
                {["Data/Hora", "Paciente", "Especialidade", "Profissional", "Local", "Modalidade"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">Carregando…</td></tr>
              ) : proximos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">Nenhum agendamento futuro.</td></tr>
              ) : (
                proximos.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{fmtDt(a.inicio)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{a.paciente_nome}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.especialidade_nome}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.profissional_nome}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{a.local_nome}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${MODALITY_STYLE[a.modalidade] || "bg-slate-100 text-slate-600"}`}>
                        {a.modalidade === "TELEMEDICINA" ? "Telemedicina" : "Presencial"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Agendamentos por dia (barras CSS) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-sky-50">
            <TrendingUp className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-slate-800">Agendamentos — 7 dias</h2>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-7 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : serie.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sem dados no período.</p>
            ) : (
              <div className="space-y-2">
                {serie.map((r) => (
                  <div key={r.data} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">{fmtDate(r.data)}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${Math.max((r.total / maxSerie) * 100, r.total > 0 ? 8 : 0)}%` }}
                      >
                        {r.total > 0 && <span className="text-white text-xs font-bold">{r.total}</span>}
                      </div>
                    </div>
                    {r.total === 0 && <span className="text-xs text-slate-400">0</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ranking de especialidades */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-sky-50">
            <Award className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-slate-800">Especialidades mais buscadas — 30 dias</h2>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-7 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : ranking.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Sem dados no período.</p>
            ) : (
              <div className="space-y-2">
                {ranking.map((r, idx) => (
                  <div key={r.especialidade} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4 text-right flex-shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-700 truncate">{r.especialidade}</span>
                        <span className="text-xs font-bold text-slate-500 ml-2 flex-shrink-0">{r.total}</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${(r.total / maxRanking) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const COLOR_MAP = {
  sky: { bg: "bg-sky-50", icon: "text-sky-600", num: "text-sky-700" },
  violet: { bg: "bg-violet-50", icon: "text-violet-600", num: "text-violet-700" },
  indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", num: "text-indigo-700" },
  teal: { bg: "bg-teal-50", icon: "text-teal-600", num: "text-teal-700" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600", num: "text-blue-700" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", num: "text-emerald-700" },
};

function KpiCard({ label, value, Icon, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.sky;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
      <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${c.icon}`} />
      </div>
      <div>
        <p className={`text-2xl font-bold ${c.num}`}>{value ?? "—"}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
