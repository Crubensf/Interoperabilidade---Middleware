import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Calendar,
  LayoutDashboard,
  ClipboardList,
  Users,
  Stethoscope,
  LogOut,
  Home,
} from "lucide-react";
import logoPet from "../assets/logopet.png";

export default function Header() {
  const navigate = useNavigate();
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  function handleLogout() {
    localStorage.removeItem("access_token");
    navigate("/login", { replace: true });
  }

  return (
    <header className="bg-white border-b border-sky-100 shadow-sm">
      {/* Barra superior: logo + logout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <img
            src={logoPet}
            alt="PET Saúde"
            className="w-10 h-10 object-contain flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-base font-bold text-sky-800 leading-tight truncate">
              PET Saúde
            </p>
            <p className="text-xs text-slate-500 leading-tight truncate">
              Sistema de Agendamento UBS
            </p>
          </div>
        </Link>

        {token && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        )}
      </div>

      {/* Barra de navegação */}
      {token && (
        <nav className="bg-sky-700 border-t border-sky-600">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 flex flex-wrap gap-0.5 py-1">
            <NavItem to="/" icon={Home}>Início</NavItem>
            <NavItem to="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
            <NavItem to="/agendamento" icon={Calendar}>Agendar</NavItem>
            <NavItem to="/agendamentos-crud" icon={ClipboardList}>Agendamentos</NavItem>
            <NavItem to="/pacientes" icon={Users}>Pacientes</NavItem>
            <NavItem to="/profissionais" icon={Stethoscope}>Profissionais</NavItem>
          </div>
        </nav>
      )}
    </header>
  );
}

function NavItem({ to, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white text-sky-700 shadow-sm"
            : "text-sky-100 hover:bg-sky-600 hover:text-white"
        }`
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="hidden md:inline">{children}</span>
    </NavLink>
  );
}
