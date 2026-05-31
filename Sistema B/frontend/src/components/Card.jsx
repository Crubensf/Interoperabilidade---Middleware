import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Card({ title, description, icon: Icon, to, disabled }) {
  const content = (
    <div
      className={`group flex flex-col gap-4 p-6 rounded-xl border transition-all ${
        disabled
          ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-60"
          : "bg-white border-slate-200 hover:border-sky-300 hover:shadow-md cursor-pointer"
      }`}
    >
      {Icon && (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${disabled ? "bg-slate-200" : "bg-sky-50 group-hover:bg-sky-100 transition-colors"}`}>
          <Icon className={`w-5 h-5 ${disabled ? "text-slate-400" : "text-sky-600"}`} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>

      {!disabled && (
        <div className="flex items-center gap-1 text-xs font-semibold text-sky-600 group-hover:gap-2 transition-all">
          Acessar
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );

  return disabled ? content : <Link to={to}>{content}</Link>;
}
