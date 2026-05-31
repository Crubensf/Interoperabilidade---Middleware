import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, AlertCircle } from "lucide-react";
import api from "../services/api";
import logoPet from "../assets/logopet.png";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const data = await api.post("/api/auth/login", { email, senha });

      const token =
        data?.access_token ||
        data?.token ||
        data?.accessToken ||
        data?.jwt ||
        data?.data?.access_token ||
        data?.data?.token;

      if (!token || typeof token !== "string") {
        throw new Error("Login não retornou token. Tente novamente.");
      }

      localStorage.setItem("access_token", token);
      localStorage.removeItem("token");

      navigate("/", { replace: true });
    } catch (e) {
      setErr(e?.message || "Falha ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-sky-100 shadow-xl p-8">
          {/* Marca */}
          <div className="flex items-center gap-3 mb-8">
            <img src={logoPet} alt="PET Saúde" className="w-12 h-12 object-contain" />
            <div>
              <p className="font-bold text-sky-800 leading-tight">PET Saúde</p>
              <p className="text-xs text-slate-500 leading-tight">Agendamento UBS</p>
            </div>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-1">Entrar</h1>
          <p className="text-sm text-slate-500 mb-6">
            Acesse com suas credenciais institucionais.
          </p>

          {err && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
                required
                autoComplete="email"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-60 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Ainda não tem acesso?{" "}
            <Link to="/cadastro-usuario" className="text-sky-600 font-semibold hover:underline">
              Cadastrar usuário
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Sistema de Agendamento UBS · PET-Saúde
        </p>
      </div>
    </div>
  );
}
