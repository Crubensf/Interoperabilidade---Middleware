import { useEffect, useState } from "react";
import { CalendarX } from "lucide-react";
import api from "../services/api";

const STATUS_STYLE = {
  agendado: "bg-sky-50 text-sky-700 border border-sky-200",
  atendido: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelado: "bg-red-50 text-red-700 border border-red-200",
};

const STATUS_LABEL = {
  agendado: "Agendado",
  atendido: "Atendido",
  cancelado: "Cancelado",
};

export default function TabelaHoje() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/agendamentos/hoje")
      .then(setAgendamentos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!agendamentos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
        <CalendarX className="w-8 h-8" />
        <p className="text-sm">Nenhum agendamento para hoje.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left">
            <Th>Horário</Th>
            <Th>Paciente</Th>
            <Th>Profissional</Th>
            <Th>Especialidade</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {agendamentos.map((ag) => (
            <tr
              key={ag.id}
              className="border-b border-slate-100 hover:bg-sky-50 transition-colors"
            >
              <Td className="font-mono font-semibold text-slate-800">
                {new Date(ag.inicio).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Td>
              <Td className="font-medium text-slate-800">{ag.paciente_nome}</Td>
              <Td className="text-slate-600">{ag.profissional_nome}</Td>
              <Td className="text-slate-600">{ag.especialidade_nome}</Td>
              <Td>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                    STATUS_STYLE[ag.status] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {STATUS_LABEL[ag.status] || ag.status}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-3 text-slate-700 ${className}`}>{children}</td>;
}
