import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import logoPet from "../assets/logopet.png";

export default function UsuarioCadastro() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    setLoading(true);
    try {
      await api.post("/api/auth/signup", { nome, email, senha, is_admin: isAdmin });
      setOkMsg("Usuário cadastrado com sucesso. Você já pode fazer login.");
      setNome("");
      setEmail("");
      setSenha("");
      setIsAdmin(false);
      setTimeout(() => navigate("/login"), 1500);
    } catch (e) {
      setErr(e.message || "Falha ao cadastrar usuário.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <img src={logoPet} alt="PET Saúde" style={styles.logo} />
          <div>
            <div style={styles.brandTitle}>PET Saúde</div>
            <div style={styles.brandSub}>Agendamento UBS</div>
          </div>
        </div>

        <h1 style={styles.h1}>Cadastro de usuário</h1>
        <p style={styles.h2}>Crie um usuário para utilizar o sistema.</p>

        {err ? <div style={styles.alertErr}>{err}</div> : null}
        {okMsg ? <div style={styles.alertOk}>{okMsg}</div> : null}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Nome</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              style={styles.input}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={styles.input}
              required
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
            />
            <span style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>
              Usuário administrador
            </span>
          </label>

          <button type="submit" disabled={loading} style={styles.primaryBtn}>
            {loading ? "Salvando..." : "Cadastrar"}
          </button>
        </form>

        <div style={styles.footer}>
          <span style={styles.footerText}>Já possui acesso?</span>
          <Link to="/login" style={styles.footerLink}>
            Voltar para login
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f3f8ff",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    background: "white",
    borderRadius: 20,
    border: "1px solid #dbeafe",
    boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
    padding: 20,
    boxSizing: "border-box",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  logo: { width: 48, height: 48, objectFit: "contain" },
  brandTitle: { fontSize: 14, fontWeight: 900, color: "#0f172a" },
  brandSub: { fontSize: 12, color: "#64748b" },

  h1: { fontSize: 20, fontWeight: 900, marginTop: 8, marginBottom: 4, color: "#0f172a" },
  h2: { fontSize: 13, color: "#475569", marginBottom: 12 },

  alertErr: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    fontSize: 13,
    marginBottom: 10,
  },
  alertOk: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid #bbf7d0",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 13,
    marginBottom: 10,
  },

  form: { display: "grid", gap: 10, marginTop: 4 },
  field: { display: "grid", gap: 6 },
  label: { fontSize: 12, fontWeight: 800, color: "#334155" },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    outline: "none",
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: 4,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },

  footer: {
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
  },
  footerText: { color: "#64748b" },
  footerLink: { color: "#1d4ed8", fontWeight: 800, textDecoration: "none" },
};
