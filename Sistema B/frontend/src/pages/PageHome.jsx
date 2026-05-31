import { UserPlus, ClipboardList, CalendarPlus, Settings2, Calendar } from "lucide-react";
import Card from "../components/Card";
import TabelaHoje from "../components/TabelaHoje";
import InfoCard from "../components/InfoCard";

export default function PageHome() {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Banner de boas-vindas */}
      <div className="bg-gradient-to-r from-sky-700 to-sky-600 rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">
            Bem-vindo ao Sistema de Agendamento UBS
          </h1>
          <p className="text-sky-200 text-sm mt-1 capitalize">{hoje}</p>
        </div>
        <div className="bg-white/10 rounded-lg px-4 py-2 text-center text-sm text-sky-100 font-medium backdrop-blur-sm flex-shrink-0">
          PET-Saúde · Atenção Básica
        </div>
      </div>

      {/* Agendamentos de hoje */}
      <InfoCard title="Agendamentos de hoje" icon={Calendar} accent>
        <TabelaHoje />
      </InfoCard>

      {/* Ações rápidas */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Agendamentos
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card
            title="Agendar consulta"
            description="Realizar um novo agendamento para um paciente cadastrado."
            icon={CalendarPlus}
            to="/agendamento"
          />
          <Card
            title="Gerenciar agendamentos"
            description="Consultar, editar, cancelar e exportar agendamentos existentes."
            icon={Settings2}
            to="/agendamentos-crud"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Cadastros
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card
            title="Gerenciar pacientes"
            description="Cadastrar e atualizar os dados de cidadãos atendidos pela UBS."
            icon={UserPlus}
            to="/pacientes"
          />
          <Card
            title="Gerenciar profissionais"
            description="Cadastrar e atualizar os profissionais de saúde da unidade."
            icon={ClipboardList}
            to="/profissionais"
          />
        </div>
      </div>
    </div>
  );
}
