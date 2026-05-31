import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  carregarCatalogos,
  carregarProfissionais,
  carregarSlots,
  criarAgendamento,
} from "../services/agendamentoService";
import { useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

function onlyDigits(v) {
  return String(v ?? "").replace(/\D+/g, "");
}
function clampDigits(v, maxLen) {
  return onlyDigits(v).slice(0, maxLen);
}
function isValidCNS15(v) {
  return onlyDigits(v).length === 15;
}
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Card({ title, subtitle, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.cardTitle}>{title}</div>
          {subtitle ? <div style={styles.cardSubtitle}>{subtitle}</div> : null}
        </div>
      </div>
      <div style={styles.cardBody}>{children}</div>
    </div>
  );
}

function Pill({ children, variant = "default" }) {
  const bg =
    variant === "ok" ? "#d1fae5" : variant === "warn" ? "#ffedd5" : "#eff6ff";
  const color =
    variant === "ok" ? "#065f46" : variant === "warn" ? "#9a3412" : "#1d4ed8";
  const border =
    variant === "ok" ? "#a7f3d0" : variant === "warn" ? "#fed7aa" : "#dbeafe";
  return (
    <span style={{ ...styles.pill, background: bg, color, borderColor: border }}>
      {children}
    </span>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div style={styles.toastWrap} onClick={onClose}>
      <div style={styles.toast}>
        <div style={styles.toastTitle}>{toast.title}</div>
        <div style={styles.toastMsg}>{toast.message}</div>
      </div>
    </div>
  );
}

function Accordion({ title, subtitle, open, onToggle, children }) {
  return (
    <div style={styles.accordionWrap}>
      <button
        type="button"
        style={{
          ...styles.accordionHeader,
          ...(open ? styles.accordionHeaderOpen : {}),
        }}
        onClick={onToggle}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 900 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ fontWeight: 900, opacity: 0.9 }}>{open ? "−" : "+"}</div>
      </button>
      {open ? <div style={styles.accordionBody}>{children}</div> : null}
    </div>
  );
}

export default function Agendamento() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [especialidades, setEspecialidades] = useState([]);
  const [locais, setLocais] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [profissionaisAll, setProfissionaisAll] = useState([]);

  const [step, setStep] = useState(1);

  const [cns, setCns] = useState("");
  const [buscandoCns, setBuscandoCns] = useState(false);
  const [paciente, setPaciente] = useState(null);

  const [especialidadeId, setEspecialidadeId] = useState("");
  const [profissionalId, setProfissionalId] = useState("");
  const [localId, setLocalId] = useState("");
  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()));
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [modalidade, setModalidade] = useState("PRESENCIAL");

  const [agendamentoCriado, setAgendamentoCriado] = useState(null);

  const [accEspecialidadesOpen, setAccEspecialidadesOpen] = useState(true);
  const [accProfissionaisOpen, setAccProfissionaisOpen] = useState(false);
  const [accLocaisOpen, setAccLocaisOpen] = useState(false);

  const [isNarrow, setIsNarrow] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth < 900 : false)
  );

  useEffect(() => {
    const onResize = () => {
      if (typeof window === "undefined") return;
      setIsNarrow(window.innerWidth < 900);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const especialidadeSelecionada = useMemo(
    () =>
      especialidades.find((e) => String(e.id) === String(especialidadeId)) ||
      null,
    [especialidades, especialidadeId]
  );

  const showToast = (title, message) => setToast({ title, message });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { especialidades, locais, profissionaisAll } =
          await carregarCatalogos();
        setEspecialidades(especialidades);
        setLocais(locais);
        setProfissionaisAll(profissionaisAll || []);
      } catch (e) {
        showToast(
          "Falha ao carregar catálogo",
          e.message || "Erro desconhecido"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!especialidadeId) {
      setProfissionais([]);
      setProfissionalId("");
      return;
    }
    (async () => {
      try {
        const res = await carregarProfissionais(especialidadeId);
        setProfissionais(res);
        setProfissionalId("");
      } catch (e) {
        showToast(
          "Falha ao carregar profissionais",
          e.message || "Erro desconhecido"
        );
      }
    })();
  }, [especialidadeId]);

  useEffect(() => {
    async function run() {
      if (!profissionalId || !dateStr) {
        setSlots([]);
        setSelectedSlot("");
        return;
      }
      try {
        const res = await carregarSlots(profissionalId, dateStr);
        setSlots(res.available || []);
        setSelectedSlot("");
      } catch (e) {
        showToast(
          "Falha ao carregar horários",
          e.message || "Erro desconhecido"
        );
      }
    }
    run();
  }, [profissionalId, dateStr]);

  useEffect(() => {
    if (!especialidadeSelecionada) return;
    if (
      !especialidadeSelecionada.permite_telemedicina &&
      modalidade === "TELEMEDICINA"
    ) {
      setModalidade("PRESENCIAL");
      showToast(
        "Modalidade ajustada",
        "A especialidade selecionada não permite telemedicina."
      );
    }
  }, [especialidadeSelecionada, modalidade]);

  const lastCnsTriedRef = useRef("");

  async function buscarPorCns() {
    const cnsDigits = onlyDigits(cns);

    if (!isValidCNS15(cnsDigits)) {
      showToast("Validação", "CNS deve ter exatamente 15 dígitos.");
      return;
    }

    if (lastCnsTriedRef.current === cnsDigits) return;
    lastCnsTriedRef.current = cnsDigits;

    setBuscandoCns(true);
    setPaciente(null);

    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;

      const res = await fetch(`${API_BASE}/api/pacientes/by-cns/${cnsDigits}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          showToast(
            "Paciente não encontrado",
            "Cadastre o paciente antes de agendar."
          );
          return;
        }
        let msg = `Erro ${res.status}`;
        try {
          const data = await res.json();
          if (data?.detail) {
            msg =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {}
        throw new Error(msg);
      }

      const p = await res.json();
      setPaciente(p);
      showToast(
        "Paciente encontrado",
        "Dados carregados. Continue para selecionar o atendimento."
      );
      setStep(2);
    } catch (e) {
      showToast("Falha ao buscar paciente", e.message || "Erro desconhecido");
    } finally {
      setBuscandoCns(false);
    }
  }

  function validateSelecao() {
    if (!especialidadeId) return "Selecione uma especialidade.";
    if (!profissionalId) return "Selecione um profissional.";
    if (!localId) return "Selecione um local.";
    if (!dateStr) return "Selecione uma data.";
    if (!selectedSlot) return "Selecione um horário disponível.";
    return null;
  }

  async function confirmarAgendamento() {
    if (!paciente?.id) {
      return showToast("Paciente inválido", "Faça a busca do CNS novamente.");
    }

    const errS = validateSelecao();
    if (errS) return showToast("Seleção incompleta", errS);

    try {
      setLoading(true);

      const payloadAg = {
        paciente_id: paciente.id,
        profissional_id: Number(profissionalId),
        especialidade_id: Number(especialidadeId),
        local_id: Number(localId),
        inicio: selectedSlot,
        modalidade,
        status: "agendado",
      };

      const ag = await criarAgendamento(payloadAg);
      setAgendamentoCriado(ag);
      setStep(3);
      showToast(
        "Agendamento confirmado",
        "Agendamento realizado com sucesso."
      );
    } catch (e) {
      showToast("Erro ao confirmar", e.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    setStep(1);
    setCns("");
    setPaciente(null);
    setAgendamentoCriado(null);
    setEspecialidadeId("");
    setProfissionalId("");
    setLocalId("");
    setSelectedSlot("");
    setSlots([]);
    setModalidade("PRESENCIAL");
    lastCnsTriedRef.current = "";
  }

  return (
    <div>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div style={styles.header}>
        <div>
          <div style={styles.h1}>Agendamento</div>
          <div style={styles.h2}>
            Identificação (CNS) → Seleção do atendimento → Confirmação
          </div>
        </div>

        <div style={styles.stepper}>
          <div
            style={{
              ...styles.step,
              ...(step === 1 ? styles.stepActive : {}),
            }}
          >
            1
          </div>
          <div style={styles.stepLine} />
          <div
            style={{
              ...styles.step,
              ...(step === 2 ? styles.stepActive : {}),
            }}
          >
            2
          </div>
          <div style={styles.stepLine} />
          <div
            style={{
              ...styles.step,
              ...(step === 3 ? styles.stepActive : {}),
            }}
          >
            3
          </div>
        </div>
      </div>

      {loading ? <div style={styles.loading}>Carregando...</div> : null}

      {step === 1 ? (
        <div style={styles.grid}>
          <div
            style={{
              ...styles.gridMain,
              gridColumn: isNarrow ? "span 12" : "span 8",
            }}
          >
            <Card
              title="Identificação do paciente"
              subtitle="Informe apenas o CNS para localizar o cadastro"
            >
              <div style={styles.formGridSingle}>
                <Field
                  label="Cartão SUS (CNS — 15 dígitos)"
                  value={cns}
                  onChange={(v) => setCns(clampDigits(v, 15))}
                  inputMode="numeric"
                  maxLength={15}
                  hint="Digite somente números (15 dígitos)."
                  placeholder="Digite o CNS"
                />
              </div>

              <div style={styles.actions}>
                <button
                  type="button"
                  style={styles.primaryBtn}
                  onClick={buscarPorCns}
                  disabled={buscandoCns}
                >
                  {buscandoCns ? "Buscando..." : "Continuar"}
                </button>

                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => navigate("/pacientes")}
                >
                  Cadastrar paciente
                </button>
              </div>

              <div style={styles.note}>
                Se o paciente não estiver cadastrado, use “Cadastrar paciente”.
              </div>
            </Card>
          </div>

          <div
            style={{
              ...styles.gridSide,
              gridColumn: isNarrow ? "span 12" : "span 4",
            }}
          >
            <Card
              title="Catálogo"
              subtitle="Dados carregados do sistema"
            >
              <div style={styles.kpiRow}>
                <Kpi
                  label="Especialidades"
                  value={especialidades.length}
                />
                <Kpi label="Locais" value={locais.length} />
                <Kpi
                  label="Profissionais"
                  value={profissionaisAll.length}
                />
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={styles.grid}>
          <div
            style={{
              ...styles.gridSide,
              gridColumn: isNarrow ? "span 12" : "span 4",
            }}
          >
            <Card
              title="Paciente"
              subtitle="Dados do cadastro (somente leitura)"
            >
              {!paciente ? (
                <div style={styles.note}>
                  Nenhum paciente carregado. Volte e busque pelo CNS.
                </div>
              ) : (
                <div style={styles.readonlyBox}>
                  <div style={styles.readRow}>
                    <span style={styles.readLabel}>Nome</span>
                    <span style={styles.readValue}>{paciente.nome}</span>
                  </div>
                  <div style={styles.readRow}>
                    <span style={styles.readLabel}>CNS</span>
                    <span style={styles.readValue}>
                      {paciente.cartao_sus}
                    </span>
                  </div>
                  <div style={styles.readRow}>
                    <span style={styles.readLabel}>Nascimento</span>
                    <span style={styles.readValue}>
                      {String(paciente.data_nascimento).slice(0, 10)}
                    </span>
                  </div>
                  <div style={styles.readRow}>
                    <span style={styles.readLabel}>Telefone</span>
                    <span style={styles.readValue}>
                      {paciente.telefone}
                    </span>
                  </div>
                  <div style={styles.readRow}>
                    <span style={styles.readLabel}>Município</span>
                    <span style={styles.readValue}>
                      {paciente.municipio}
                    </span>
                  </div>
                  <div style={styles.readRow}>
                    <span style={styles.readLabel}>Endereço</span>
                    <span style={styles.readValue}>
                      {paciente.endereco}
                    </span>
                  </div>
                  <div style={styles.readRow}>
                    <span style={styles.readLabel}>Nome da mãe</span>
                    <span style={styles.readValue}>
                      {paciente.nome_mae}
                    </span>
                  </div>
                </div>
              )}

              <div style={styles.actionsLeft}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => setStep(1)}
                >
                  Trocar CNS
                </button>
              </div>
            </Card>
          </div>

          <div
            style={{
              ...styles.gridMain,
              gridColumn: isNarrow ? "span 12" : "span 8",
            }}
          >
            <Card
              title="Seleção do atendimento"
              subtitle="Escolha especialidade, profissional, local, data e horário"
            >
              <Accordion
                title="Especialidade"
                subtitle={
                  especialidadeSelecionada
                    ? `Selecionada: ${especialidadeSelecionada.nome}`
                    : "Clique para escolher"
                }
                open={accEspecialidadesOpen}
                onToggle={() =>
                  setAccEspecialidadesOpen((v) => !v)
                }
              >
                <div style={styles.cardList}>
                  {especialidades.map((e) => (
                    <SelectableCard
                      key={e.id}
                      selected={
                        String(e.id) === String(especialidadeId)
                      }
                      title={e.nome}
                      subtitle={`Código: ${e.codigo}`}
                      right={
                        e.permite_telemedicina ? (
                          <Pill variant="ok">Telemedicina</Pill>
                        ) : (
                          <Pill variant="warn">
                            Somente presencial
                          </Pill>
                        )
                      }
                      onClick={() => {
                        setEspecialidadeId(String(e.id));
                        setAccEspecialidadesOpen(false);
                        setAccProfissionaisOpen(true);
                      }}
                    />
                  ))}
                </div>
              </Accordion>

              <Accordion
                title="Profissional"
                subtitle={
                  profissionalId
                    ? `Selecionado: ${
                        profissionais.find(
                          (p) =>
                            String(p.id) ===
                            String(profissionalId)
                        )?.nome ?? "—"
                      }`
                    : "Clique para escolher"
                }
                open={accProfissionaisOpen}
                onToggle={() => setAccProfissionaisOpen((v) => !v)}
              >
                {!especialidadeId ? (
                  <div style={styles.note}>
                    Selecione uma especialidade primeiro.
                  </div>
                ) : profissionais.length === 0 ? (
                  <div style={styles.note}>
                    Nenhum profissional para esta especialidade.
                  </div>
                ) : (
                  <div style={styles.cardList}>
                    {profissionais.map((p) => (
                      <SelectableCard
                        key={p.id}
                        selected={
                          String(p.id) === String(profissionalId)
                        }
                        title={p.nome}
                        subtitle={`ID: ${p.id}`}
                        onClick={() => {
                          setProfissionalId(String(p.id));
                          setAccProfissionaisOpen(false);
                          setAccLocaisOpen(true);
                        }}
                      />
                    ))}
                  </div>
                )}
              </Accordion>

              <Accordion
                title="Local"
                subtitle={
                  localId
                    ? `Selecionado: ${
                        locais.find(
                          (l) => String(l.id) === String(localId)
                        )?.nome ?? "—"
                      }`
                    : "Clique para escolher"
                }
                open={accLocaisOpen}
                onToggle={() => setAccLocaisOpen((v) => !v)}
              >
                <div style={styles.cardList}>
                  {locais.map((l) => (
                    <SelectableCard
                      key={l.id}
                      selected={
                        String(l.id) === String(localId)
                      }
                      title={l.nome}
                      subtitle={`${l.municipio} — ${l.endereco}`}
                      onClick={() => {
                        setLocalId(String(l.id));
                        setAccLocaisOpen(false);
                      }}
                    />
                  ))}
                </div>
              </Accordion>

              <div style={styles.sectionRow}>
                <div style={styles.col}>
                  <div style={styles.sectionTitle}>Data</div>
                  <input
                    style={styles.input}
                    type="date"
                    value={dateStr}
                    onChange={(e) =>
                      setDateStr(e.target.value)
                    }
                  />
                </div>

                <div style={styles.col}>
                  <div style={styles.sectionTitle}>Modalidade</div>
                  <div style={styles.modalRow}>
                    <label style={styles.radioLabel}>
                      <input
                        type="radio"
                        checked={modalidade === "PRESENCIAL"}
                        onChange={() =>
                          setModalidade("PRESENCIAL")
                        }
                      />
                      <span>Presencial</span>
                    </label>
                    <label style={styles.radioLabel}>
                      <input
                        type="radio"
                        checked={
                          modalidade === "TELEMEDICINA"
                        }
                        disabled={
                          !especialidadeSelecionada?.permite_telemedicina
                        }
                        onChange={() =>
                          setModalidade("TELEMEDICINA")
                        }
                      />
                      <span>Telemedicina</span>
                    </label>
                  </div>
                  {!especialidadeSelecionada?.permite_telemedicina ? (
                    <div style={styles.noteSmall}>
                      Telemedicina só está disponível se a
                      especialidade permitir.
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  Horários disponíveis
                </div>
                {!profissionalId ? (
                  <div style={styles.note}>
                    Selecione um profissional para listar
                    horários.
                  </div>
                ) : (
                  <div style={styles.slotGrid}>
                    {slots.length === 0 ? (
                      <div style={styles.note}>
                        Nenhum horário disponível.
                      </div>
                    ) : (
                      slots.map((s) => (
                        <button
                          type="button"
                          key={s}
                          style={{
                            ...styles.slotBtn,
                            ...(selectedSlot === s
                              ? styles.slotBtnActive
                              : {}),
                          }}
                          onClick={() =>
                            setSelectedSlot(s)
                          }
                        >
                          {new Date(s).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div style={styles.actions}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  style={styles.primaryBtn}
                  onClick={confirmarAgendamento}
                >
                  Confirmar
                </button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div style={styles.grid}>
          <div
            style={{
              ...styles.gridMain,
              gridColumn: isNarrow ? "span 12" : "span 8",
            }}
          >
            <Card
              title="Comprovante"
              subtitle="Agendamento confirmado"
            >
              {!agendamentoCriado ? (
                <div style={styles.note}>
                  Nenhum agendamento encontrado.
                </div>
              ) : (
                <div style={styles.comprovante}>
                  <div style={styles.kpiRow}>
                    <Kpi
                      label="Agendamento"
                      value={`#${agendamentoCriado.id}`}
                    />
                    <Kpi
                      label="Situação"
                      value={agendamentoCriado.status}
                    />
                    <Kpi
                      label="Modalidade"
                      value={agendamentoCriado.modalidade}
                    />
                  </div>

                  <div style={styles.readonlyBox}>
                    <div style={styles.readRow}>
                      <span style={styles.readLabel}>Início</span>
                      <span style={styles.readValue}>
                        {new Date(
                          agendamentoCriado.inicio
                        ).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div style={styles.readRow}>
                      <span style={styles.readLabel}>
                        Paciente
                      </span>
                      <span style={styles.readValue}>
                        #{agendamentoCriado.paciente_id}
                      </span>
                    </div>
                    <div style={styles.readRow}>
                      <span style={styles.readLabel}>
                        Profissional
                      </span>
                      <span style={styles.readValue}>
                        #{agendamentoCriado.profissional_id}
                      </span>
                    </div>
                    <div style={styles.readRow}>
                      <span style={styles.readLabel}>
                        Especialidade
                      </span>
                      <span style={styles.readValue}>
                        #{agendamentoCriado.especialidade_id}
                      </span>
                    </div>
                    <div style={styles.readRow}>
                      <span style={styles.readLabel}>Local</span>
                      <span style={styles.readValue}>
                        #{agendamentoCriado.local_id}
                      </span>
                    </div>
                  </div>

                  <div style={styles.actions}>
                    <a
                      style={styles.linkBtn}
                      href={`${API_BASE}/fhir/bundle/comprovante/${agendamentoCriado.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Comprovante do agendamento
                    </a>

                    <a
                      style={styles.linkBtn}
                      href={`${API_BASE}/fhir/appointment/${agendamentoCriado.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Detalhes do atendimento
                    </a>
                  </div>

                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={styles.secondaryBtn}
                      onClick={resetFlow}
                    >
                      Novo agendamento
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div
            style={{
              ...styles.gridSide,
              gridColumn: isNarrow ? "span 12" : "span 4",
            }}
          >
            <Card
              title="Ajuda"
              subtitle="Informações adicionais"
            >
              <div style={styles.note}>
                Você pode abrir o comprovante e os detalhes do
                atendimento pelos botões acima.
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  maxLength,
  hint,
  placeholder,
}) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input
        style={styles.input}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? (
        <div
          style={{
            fontSize: 11,
            color: "#475569",
            marginTop: 6,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function SelectableCard({ selected, title, subtitle, right, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...styles.selectCard,
        ...(selected ? styles.selectCardActive : {}),
      }}
      role="button"
      tabIndex={0}
    >
      <div>
        <div style={styles.selectTitle}>{title}</div>
        {subtitle ? (
          <div style={styles.selectSubtitle}>{subtitle}</div>
        ) : null}
      </div>
      <div>{right}</div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  h1: { fontSize: 22, fontWeight: 950, color: "#0f172a" },
  h2: {
    fontSize: 13,
    color: "#334155",
    marginTop: 6,
    maxWidth: 720,
  },

  stepper: { display: "flex", alignItems: "center", gap: 8 },
  step: {
    width: 32,
    height: 32,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#f0f9ff",
    border: "2px solid #bae6fd",
    color: "#0369a1",
    fontWeight: 700,
    fontSize: 13,
  },
  stepActive: {
    background: "#0369a1",
    borderColor: "#0369a1",
    color: "white",
  },
  stepLine: { width: 24, height: 2, background: "#bae6fd", borderRadius: 2 },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 16,
    alignItems: "start",
  },
  gridMain: { gridColumn: "span 8" },
  gridSide: { gridColumn: "span 4" },

  card: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  },
  cardHeader: { padding: "14px 16px 10px 16px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  cardSubtitle: { fontSize: 12, color: "#64748b", marginTop: 4 },
  cardBody: { padding: 16 },

  formGridSingle: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },

  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "#334155", fontWeight: 800 },
  input: {
    background: "white",
    color: "#0f172a",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
  },

  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 14,
    flexWrap: "wrap",
  },
  actionsLeft: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-start",
    marginTop: 14,
    flexWrap: "wrap",
  },
  primaryBtn: {
    background: "#0369a1",
    color: "white",
    border: "1px solid #0369a1",
    borderRadius: 10,
    padding: "9px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
  secondaryBtn: {
    background: "white",
    color: "#334155",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "9px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
  linkBtn: {
    background: "#f0f9ff",
    color: "#0369a1",
    border: "1px solid #bae6fd",
    borderRadius: 10,
    padding: "9px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    textDecoration: "none",
  },

  note: {
    fontSize: 12,
    color: "#334155",
    background: "#f8fbff",
    border: "1px dashed #bfdbfe",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  noteSmall: {
    fontSize: 12,
    color: "#334155",
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    background: "#f8fbff",
    border: "1px solid #dbeafe",
  },

  section: { marginTop: 12 },
  sectionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 12,
  },
  col: { minWidth: 0 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 950,
    marginBottom: 8,
    color: "#0f172a",
  },

  cardList: { display: "grid", gap: 10 },
  selectCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    cursor: "pointer",
  },
  selectCardActive: {
    borderColor: "#93c5fd",
    background: "#eff6ff",
  },
  selectTitle: { fontSize: 14, fontWeight: 900, color: "#0f172a" },
  selectSubtitle: {
    fontSize: 12,
    color: "#334155",
    marginTop: 4,
  },

  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 900,
  },

  slotGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  slotBtn: {
    background: "white",
    color: "#334155",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "7px 12px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  },
  slotBtnActive: {
    borderColor: "#0369a1",
    background: "#f0f9ff",
    color: "#0369a1",
  },

  modalRow: { display: "flex", gap: 14, flexWrap: "wrap" },
  radioLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13,
    color: "#0f172a",
  },

  kpiRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  kpi: {
    flex: "1 1 120px",
    border: "1px solid #dbeafe",
    borderRadius: 14,
    padding: 12,
    background: "#f8fbff",
  },
  kpiLabel: { fontSize: 12, color: "#334155", fontWeight: 800 },
  kpiValue: {
    fontSize: 18,
    fontWeight: 950,
    marginTop: 6,
    color: "#0f172a",
  },

  comprovante: { display: "grid", gap: 12 },
  loading: {
    color: "#334155",
    marginBottom: 10,
    fontWeight: 800,
  },

  toastWrap: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 9999,
    cursor: "pointer",
  },
  toast: {
    width: 340,
    background: "white",
    border: "1px solid #dbeafe",
    borderRadius: 14,
    padding: 12,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
  },
  toastMsg: {
    fontSize: 12,
    color: "#334155",
    marginTop: 6,
    lineHeight: 1.35,
  },

  accordionWrap: {
    border: "1px solid #dbeafe",
    borderRadius: 14,
    overflow: "hidden",
    background: "#f8fbff",
    marginTop: 10,
  },
  accordionHeader: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 12,
    background: "#f8fbff",
    border: "none",
    color: "#0f172a",
    cursor: "pointer",
  },
  accordionHeaderOpen: { background: "#eff6ff" },
  accordionBody: {
    padding: 12,
    borderTop: "1px solid #dbeafe",
    background: "white",
  },

  readonlyBox: {
    border: "1px solid #dbeafe",
    borderRadius: 14,
    padding: 12,
    background: "#f8fbff",
  },
  readRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid #eaf2ff",
  },
  readLabel: {
    fontSize: 12,
    color: "#334155",
    fontWeight: 900,
    minWidth: 110,
  },
  readValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 800,
    textAlign: "right",
  },
};
