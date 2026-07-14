// =====================================================================
// Helpers
// =====================================================================
const titles = {
  visao: "Visão geral", pacientes: "Pacientes", profissionais: "Profissionais",
  agendamentos: "Agendamentos", duplicatas: "Duplicatas", qualidade: "Qualidade de dados",
  mpi: "Master Patient Index", bundle: "Bundle FHIR", criar: "Criar paciente", audit: "Audit log",
};

const sysLabel = { sistema_a: "A", sistema_b: "B" };

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}
function fmt(v) { return v == null || v === "" ? '<span class="muted">—</span>' : v; }
function fmtCode(v) { return v ? `<span class="code">${v}</span>` : fmt(null); }
function badgeOrigem(o) {
  if (!o) return "";
  const cls = o === "sistema_a" ? "badge-a" : "badge-b";
  return `<span class="badge ${cls} mono"><span class="dot"></span>${sysLabel[o] || o}</span>`;
}
function badgeStatus(st) {
  if (!st) return "";
  const map = {
    booked: "badge-info", pending: "badge-warn", arrived: "badge-info",
    fulfilled: "badge-ok", cancelled: "badge-err", noshow: "badge-err",
    "checked-in": "badge-info",
  };
  return `<span class="badge ${map[st] || "badge-neutral"}">${st}</span>`;
}
function setUpdated() {
  document.getElementById("last-update").textContent = new Date().toLocaleTimeString("pt-BR");
}
function reinitIcons() { if (window.lucide) lucide.createIcons(); }
function table(headers, rows) {
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.length
    ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}" class="empty-state">Sem resultados.</td></tr>`}</tbody>`;
  return thead + tbody;
}

// =====================================================================
// Nav
// =====================================================================
document.querySelectorAll(".nav-btn").forEach((b) => {
  b.addEventListener("click", () => activate(b.dataset.tab));
});
function activate(tab) {
  document.querySelectorAll(".nav-btn").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
  document.querySelectorAll(".section").forEach((s) => s.classList.toggle("hidden", s.dataset.section !== tab));
  document.getElementById("page-title").textContent = titles[tab] || tab;
  loaders[tab]?.();
}

// =====================================================================
// Visão geral
// =====================================================================
let chartTrafego = null;
async function loadVisao() {
  const [health, pac, prof, ag, dups, auditStats, audit] = await Promise.all([
    fetch("/ready").then(r => r.json()).catch(() => ({ sistema_a: "down", sistema_b: "down" })),
    api("/pacientes?_count=1"),
    api("/profissionais?_count=1"),
    api("/agendamentos?_count=1"),
    api("/duplicatas").catch(() => ({ totais: { pacientes: 0, profissionais: 0 } })),
    api("/audit/stats"),
    api("/audit?limit=50"),
  ]);

  const setPill = (id, txtId, up) => {
    const pill = document.getElementById(id);
    pill.classList.remove("up", "down");
    pill.classList.add(up ? "up" : "down");
    document.getElementById(txtId).textContent = up ? "online" : "offline";
  };
  setPill("sys-a-pill", "sys-a-text", health.sistema_a === "up");
  setPill("sys-b-pill", "sys-b-text", health.sistema_b === "up");
  document.getElementById("sys-a-url").textContent = (health.urls?.sistema_a || "").replace(/^https?:\/\//, "");
  document.getElementById("sys-b-url").textContent = (health.urls?.sistema_b || "").replace(/^https?:\/\//, "");

  document.getElementById("n-pacientes").textContent = pac.total;
  document.getElementById("n-prof").textContent = prof.total;
  document.getElementById("n-agend").textContent = ag.total;
  document.getElementById("n-dups").textContent = dups.totais.pacientes + dups.totais.profissionais;

  const total = auditStats.total ?? 0;
  const erros5xx = auditStats.erros_servidor ?? 0;
  const rej4xx = auditStats.rejeicoes_cliente ?? 0;
  const naoAutorizado = auditStats.nao_autorizado ?? 0;
  const taxaErro = auditStats.taxa_erro_servidor_pct ?? 0;
  const janela1h = auditStats.janela_1h || { requisicoes: 0, erros_servidor: 0, taxa_erro_pct: 0 };

  const erroCls = erros5xx ? "danger" : "vital";
  document.getElementById("ops-list").innerHTML = `
    <div class="ops-row">
      <div class="ops-key"><i data-lucide="activity" class="icon"></i> Requisições úteis</div>
      <div class="ops-val tabular">${total}</div>
    </div>
    <div class="ops-row">
      <div class="ops-key"><i data-lucide="alert-octagon" class="icon"></i> Taxa de erro (5xx)</div>
      <div class="ops-val tabular ${erroCls}">${taxaErro}%</div>
    </div>
    <div class="ops-row">
      <div class="ops-key"><i data-lucide="zap" class="icon"></i> Latência média</div>
      <div class="ops-val tabular">${auditStats.duracao_media_ms} <span class="muted text-xs">ms</span></div>
    </div>
    <div class="ops-row">
      <div class="ops-key"><i data-lucide="shield-off" class="icon"></i> Rejeições 4xx</div>
      <div class="ops-val tabular ${rej4xx ? "warn" : ""}" title="Inclui ${naoAutorizado} de 401/403">${rej4xx}</div>
    </div>
    <div class="ops-row">
      <div class="ops-key"><i data-lucide="clock" class="icon"></i> Última 1h</div>
      <div class="ops-val tabular">${janela1h.requisicoes} <span class="muted text-xs">req · ${janela1h.taxa_erro_pct}% erro</span></div>
    </div>`;

  const counts = {};
  audit.forEach(a => { counts[a.caminho] = (counts[a.caminho] || 0) + 1; });
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const ctx = document.getElementById("chart-trafego");
  if (chartTrafego) chartTrafego.destroy();
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim() || "#1E3A8A";
  const text3 = css.getPropertyValue("--text-3").trim() || "#94A3B8";
  const border = css.getPropertyValue("--border-soft").trim() || "rgba(203,213,225,0.32)";
  chartTrafego = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: accent,
        borderRadius: 6,
        maxBarThickness: 22,
      }],
    },
    options: {
      animation: { duration: 600, easing: "easeOutCubic" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1C1917",
          padding: 10,
          cornerRadius: 8,
          borderColor: "transparent",
          titleFont: { family: "Geist", size: 12, weight: "500" },
          bodyFont: { family: "Geist Mono", size: 11 },
        },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: border, drawBorder: false }, ticks: { color: text3, precision: 0, font: { family: "Geist Mono", size: 10 } } },
        x: { grid: { display: false }, ticks: { color: text3, font: { family: "Geist Mono", size: 9 } } },
      },
    },
  });
  setUpdated();
  reinitIcons();
}

// =====================================================================
// Pacientes
// =====================================================================
async function loadPacientes() {
  const q = new URLSearchParams({
    origem: document.getElementById("pac-origem").value,
    dedup: document.getElementById("pac-dedup").checked,
    _count: 200,
  });
  const name = document.getElementById("pac-name").value; if (name) q.set("name", name);
  const id = document.getElementById("pac-id").value; if (id) q.set("identifier", id);
  const data = await api(`/pacientes?${q}`);
  document.getElementById("pac-total").textContent = `${data.total} resultado(s)`;
  const rows = data.items.map(p => {
    const ident = p.cartao_sus || p.cpf || "";
    const nomeBtn = ident
      ? `<button class="name-link" data-detalhe-identifier="${ident}">${p.nome || "—"}</button>`
      : `<button class="name-link" data-detalhe-nome="${(p.nome || "").replace(/"/g, "&quot;")}">${p.nome || "—"}</button>`;
    return [
      fmtCode(p.id),
      badgeOrigem(p.origem),
      nomeBtn,
      fmtCode(p.cpf),
      fmtCode(p.cartao_sus),
      fmt(p.sexo),
      p.data_nascimento ? `<span class="mono">${p.data_nascimento}</span>` : fmt(null),
      fmt(p.telefone),
    ];
  });
  document.getElementById("pac-table").innerHTML = table(
    ["ID", "Origem", "Nome", "CPF", "CNS", "Sexo", "Nasc.", "Telefone"], rows
  );
  attachDetalheHandlers(document.getElementById("pac-table"));
  setUpdated();
  reinitIcons();
}
document.getElementById("pac-search").addEventListener("click", loadPacientes);

// =====================================================================
// Profissionais
// =====================================================================
async function loadProf() {
  const q = new URLSearchParams({
    origem: document.getElementById("prof-origem").value,
    dedup: document.getElementById("prof-dedup").checked,
    _count: 200,
  });
  const name = document.getElementById("prof-name").value; if (name) q.set("name", name);
  const id = document.getElementById("prof-id").value; if (id) q.set("identifier", id);
  const data = await api(`/profissionais?${q}`);
  document.getElementById("prof-total").textContent = `${data.total} resultado(s)`;
  const rows = data.items.map(p => {
    const ident = p.crm || "";
    const nomeBtn = ident
      ? `<button class="name-link" data-detalhe-prof-identifier="${ident}">${p.nome || "—"}</button>`
      : `<button class="name-link" data-detalhe-prof-nome="${(p.nome || "").replace(/"/g, "&quot;")}">${p.nome || "—"}</button>`;
    return [
      fmtCode(p.id),
      badgeOrigem(p.origem),
      nomeBtn,
      fmtCode(p.crm),
      fmt(p.especialidade),
      fmt(p.telefone),
      fmt(p.email),
    ];
  });
  document.getElementById("prof-table").innerHTML = table(
    ["ID", "Origem", "Nome", "CRM", "Especialidade", "Telefone", "E-mail"], rows
  );
  attachDetalheHandlers(document.getElementById("prof-table"));
  setUpdated();
  reinitIcons();
}
document.getElementById("prof-search").addEventListener("click", loadProf);

// =====================================================================
// Agendamentos
// =====================================================================
async function loadAg() {
  const q = new URLSearchParams({
    origem: document.getElementById("ag-origem").value,
    _count: 200,
  });
  const st = document.getElementById("ag-status").value; if (st) q.set("status", st);
  const ge = document.getElementById("ag-ge").value; if (ge) q.set("date_ge", ge);
  const le = document.getElementById("ag-le").value; if (le) q.set("date_le", le);
  const data = await api(`/agendamentos?${q}`);
  document.getElementById("ag-total").textContent = `${data.total} resultado(s)`;
  const rows = data.items.map(a => {
    const idBtn = a.id
      ? `<button class="name-link" data-detalhe-ag-id="${a.id}" data-detalhe-ag-origem="${a.origem}">${a.id}</button>`
      : `<span class="empty">sem-id</span>`;
    return [
      idBtn,
      badgeOrigem(a.origem),
      badgeStatus(a.status),
      a.inicio ? `<span class="mono">${a.inicio.replace("T", " ").slice(0, 16)}</span>` : fmt(null),
      fmt(a.tipo),
      `<strong style="font-weight:600;letter-spacing:-0.01em">${a.paciente || "—"}</strong>`,
      fmt(a.profissional),
      fmt(a.local),
    ];
  });
  document.getElementById("ag-table").innerHTML = table(
    ["ID", "Origem", "Status", "Início", "Tipo", "Paciente", "Profissional", "Local"], rows
  );
  attachDetalheHandlers(document.getElementById("ag-table"));
  setUpdated();
  reinitIcons();
}
document.getElementById("ag-search").addEventListener("click", loadAg);

// =====================================================================
// Duplicatas
// =====================================================================
async function loadDuplicatas() {
  const data = await api("/duplicatas");
  document.getElementById("dup-pac-count").textContent = data.totais.pacientes;
  document.getElementById("dup-prof-count").textContent = data.totais.profissionais;
  const renderDup = (lista) => {
    if (!lista.length) return `<div class="empty"><i data-lucide="check" class="icon"></i><div>Nenhuma duplicata detectada</div></div>`;
    return lista.map(d => {
      const ocor = d.ocorrencias.map(o =>
        `<div class="alert-row">${badgeOrigem(o.origem)} <span class="code">${o.id}</span> <span style="color:var(--text)">${o.nome}</span></div>`
      ).join("");
      return `<div class="dup-card">
        <div class="dup-card-head">
          <i data-lucide="git-merge" style="width:14px;height:14px"></i>
          <span class="ident">${d.identificador[0]}</span>
          <span class="code">${d.identificador[1]}</span>
        </div>
        ${ocor}
      </div>`;
    }).join("");
  };
  document.getElementById("dup-pac").innerHTML = renderDup(data.pacientes);
  document.getElementById("dup-prof").innerHTML = renderDup(data.profissionais);
  setUpdated();
  reinitIcons();
}

// =====================================================================
// Qualidade
// =====================================================================
async function loadQualidade() {
  const q = await api("/qualidade");
  const cats = [
    ["pacientes_sem_cns", "Pacientes sem CNS", "user-x"],
    ["pacientes_sem_cpf", "Pacientes sem CPF", "user-x"],
    ["profissionais_sem_crm", "Profissionais sem CRM", "stethoscope"],
    ["profissionais_crm_invalido", "CRM mal formado", "alert-triangle"],
    ["agendamentos_sem_local", "Agendamentos sem local", "map-pin-off"],
    ["agendamentos_status_invalido", "Status inválido", "alert-octagon"],
  ];
  const c = document.getElementById("qualidade-cards");
  c.innerHTML = cats.map(([key, label, icon], i) => {
    const lista = q[key] || [];
    const sev = lista.length === 0 ? "ok" : lista.length < 5 ? "warn" : "err";
    const items = lista.slice(0, 6).map(x =>
      `<div class="alert-row">${badgeOrigem(x.origem)} <span class="code">${x.id}</span> <span style="color:var(--text)">${x.nome || x.crm || x.status || ""}</span></div>`
    ).join("");
    const mais = lista.length > 6 ? `<div class="alert-more">+ ${lista.length - 6} outros</div>` : "";
    const empty = lista.length === 0 ? `<div class="alert-row muted">Nenhuma ocorrência.</div>` : "";
    return `<div class="alert alert-${sev} span-3" style="--i:${i}">
      <div class="alert-head">
        <div class="alert-title"><i data-lucide="${icon}" class="icon"></i> ${label}</div>
        <span class="badge badge-${sev === 'ok' ? 'ok' : sev === 'warn' ? 'warn' : 'err'}">${lista.length}</span>
      </div>
      ${items}${empty}${mais}
    </div>`;
  }).join("");
  setUpdated();
  reinitIcons();
}

// =====================================================================
// MPI
// =====================================================================
async function loadMpi() {
  const [pac, prof] = await Promise.all([api("/mpi/pacientes"), api("/mpi/profissionais")]);
  const renderP = (lista) => table(
    ["CNS", "CPF", "Nome", "ID em A", "ID em B"],
    lista.map(p => [
      fmtCode(p.cns), fmtCode(p.cpf),
      `<strong style="font-weight:600">${p.nome || "—"}</strong>`,
      fmtCode(p.sistema_a_id), fmtCode(p.sistema_b_id),
    ])
  );
  const renderR = (lista) => table(
    ["CRM", "Nome", "ID em A", "ID em B"],
    lista.map(p => [
      fmtCode(p.crm),
      `<strong style="font-weight:600">${p.nome || "—"}</strong>`,
      fmtCode(p.sistema_a_id), fmtCode(p.sistema_b_id),
    ])
  );
  document.getElementById("mpi-pac").innerHTML = pac.length
    ? `<table>${renderP(pac)}</table>`
    : `<div class="empty"><i data-lucide="database" class="icon"></i><div>Índice vazio — clique em Reconciliar</div></div>`;
  document.getElementById("mpi-prof").innerHTML = prof.length
    ? `<table>${renderR(prof)}</table>`
    : `<div class="empty"><i data-lucide="database" class="icon"></i><div>Índice vazio</div></div>`;
  setUpdated();
  reinitIcons();
}
document.getElementById("mpi-reconciliar").addEventListener("click", async () => {
  const msg = document.getElementById("mpi-msg");
  msg.textContent = "Reconciliando…";
  try {
    const r = await fetch("/mpi/reconciliar", { method: "POST" });
    const data = await r.json();
    msg.innerHTML = `<span class="badge badge-ok"><span class="dot"></span>${data.pacientes_indexados} pac · ${data.profissionais_indexados} prof</span>`;
    loadMpi();
  } catch (e) {
    msg.innerHTML = `<span class="badge badge-err">Falhou: ${e.message}</span>`;
  }
});

// =====================================================================
// Bundle
// =====================================================================
async function loadBundle() {
  const q = new URLSearchParams({
    origem: document.getElementById("bundle-origem").value,
    dedup: document.getElementById("bundle-dedup").checked,
  });
  document.getElementById("bundle-view").textContent = "Carregando…";
  const data = await api(`/fhir/bundle?${q}`);
  document.getElementById("bundle-view").textContent = JSON.stringify(data, null, 2);
  document.getElementById("bundle-info").textContent = `${data.total} entries · ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`;
  setUpdated();
}
document.getElementById("bundle-load").addEventListener("click", loadBundle);
document.getElementById("bundle-copy").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("bundle-view").textContent);
  const b = document.getElementById("bundle-copy");
  const orig = b.innerHTML;
  b.innerHTML = `<i data-lucide="check" class="icon"></i> Copiado`;
  reinitIcons();
  setTimeout(() => { b.innerHTML = orig; reinitIcons(); }, 1500);
});

// =====================================================================
// Dinâmica de Formulários
// =====================================================================
document.querySelectorAll(".sys-tabs").forEach(tabsContainer => {
  const tabs = tabsContainer.querySelectorAll(".sys-tab");
  const form = tabsContainer.closest("form");
  const input = form.querySelector(".destino-input");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const destino = tab.getAttribute("data-target-sys");
      input.value = destino;

      if (destino === "sistema_a") {
        form.querySelectorAll(".only-sys-a").forEach(el => el.classList.remove("hidden"));
        form.querySelectorAll(".only-sys-b").forEach(el => el.classList.add("hidden"));
      } else {
        form.querySelectorAll(".only-sys-b").forEach(el => el.classList.remove("hidden"));
        form.querySelectorAll(".only-sys-a").forEach(el => el.classList.add("hidden"));
      }
    });
  });

  // Dispara o evento de clique na aba ativa ao carregar a página
  const activeTab = tabsContainer.querySelector(".sys-tab.active");
  if (activeTab) activeTab.click();
});

function cleanFormData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  
  // Remover os campos que estão contidos em divs "hidden" (não pertencem ao sistema)
  form.querySelectorAll(".hidden input, .hidden select").forEach(el => {
    if (el.name) delete data[el.name];
  });
  
  Object.keys(data).forEach(k => { if (!data[k]) delete data[k]; });
  return data;
}

// =====================================================================
// Criar paciente
// =====================================================================
document.getElementById("form-criar").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const data = cleanFormData(form);
  const destino = data.destino; delete data.destino;
  
  const out = document.getElementById("criar-resultado");
  out.textContent = "Enviando…";
  try {
    const r = await fetch("/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sistema-Destino": destino },
      body: JSON.stringify(data),
    });
    const j = await r.json();
    out.textContent = JSON.stringify(j, null, 2);
  } catch (e) { out.textContent = "Erro: " + e.message; }
});

// =====================================================================
// Criar profissional
// =====================================================================
document.getElementById("form-criar-profissional").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const data = cleanFormData(form);
  const destino = data.destino; delete data.destino;
  
  // O backend do Sistema A espera o campo "crm" e "crm_uf", mas o frontend chamava de "conselho" e "registro_uf"
  if (destino === "sistema_a") {
    if (data.conselho) {
      data.crm = data.conselho;
      delete data.conselho;
    }
    if (data.registro_uf) {
      data.crm_uf = data.registro_uf;
      delete data.registro_uf;
    }
  }
  
  const out = document.getElementById("criar-prof-resultado");
  out.textContent = "Enviando…";
  try {
    const r = await fetch("/profissionais", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sistema-Destino": destino },
      body: JSON.stringify(data),
    });
    const j = await r.json();
    out.textContent = JSON.stringify(j, null, 2);
  } catch (e) { out.textContent = "Erro: " + e.message; }
});

// =====================================================================
// Criar agendamento
// =====================================================================
document.getElementById("form-criar-agendamento").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const data = cleanFormData(form);
  const destino = data.destino; delete data.destino;
  
  if (destino === "sistema_b") {
    // Sistema B usa Inteiros
    if (data.paciente_id) data.paciente_id = parseInt(data.paciente_id, 10);
    if (data.profissional_id) data.profissional_id = parseInt(data.profissional_id, 10);
    if (data.local_id) data.local_id = parseInt(data.local_id, 10);
    if (data.especialidade_id) data.especialidade_id = parseInt(data.especialidade_id, 10);
    
    // Sistema B usa status em português
    const statusMap = {
      "booked": "agendado",
      "pending": "agendado",
      "fulfilled": "atendido",
      "cancelled": "cancelado"
    };
    if (data.status && statusMap[data.status]) {
      data.status = statusMap[data.status];
    }
  }

  const out = document.getElementById("criar-ag-resultado");
  out.textContent = "Enviando…";
  try {
    const r = await fetch("/agendamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sistema-Destino": destino },
      body: JSON.stringify(data),
    });
    const j = await r.json();
    out.textContent = JSON.stringify(j, null, 2);
  } catch (e) { out.textContent = "Erro: " + e.message; }
});


// =====================================================================
// Analytics clínicos
// =====================================================================
const anlCharts = {};

function _cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function _palette() {
  return {
    accent: _cssVar("--accent", "#1E3A8A"),
    vital:  _cssVar("--vital",  "#15803D"),
    warn:   _cssVar("--warn",   "#B45309"),
    danger: _cssVar("--danger", "#B91C1C"),
    text3:  _cssVar("--text-3", "#94A3B8"),
    border: _cssVar("--border-soft", "rgba(203,213,225,0.32)"),
  };
}

function _statusColor(status, p) {
  if (["fulfilled", "arrived", "checked-in"].includes(status)) return p.vital;
  if (["cancelled", "entered-in-error"].includes(status)) return p.danger;
  if (status === "noshow") return p.warn;
  return p.accent;
}

function _destroyChart(key) {
  if (anlCharts[key]) { anlCharts[key].destroy(); delete anlCharts[key]; }
}

function _baseOpts(p) {
  return {
    animation: { duration: 500, easing: "easeOutCubic" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1C1917", padding: 10, cornerRadius: 8,
        titleFont: { family: "Geist", size: 12, weight: "500" },
        bodyFont: { family: "Geist Mono", size: 11 },
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: p.border, drawBorder: false }, ticks: { color: p.text3, precision: 0, font: { family: "Geist Mono", size: 10 } } },
      x: { grid: { display: false }, ticks: { color: p.text3, font: { family: "Geist Mono", size: 10 } } },
    },
  };
}

function _barHorizontal(canvasId, items, color) {
  const p = _palette();
  _destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  anlCharts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: items.map(i => i.rotulo.length > 28 ? i.rotulo.slice(0, 27) + "…" : i.rotulo),
      datasets: [{ data: items.map(i => i.total), backgroundColor: color, borderRadius: 4, maxBarThickness: 16 }],
    },
    options: { ..._baseOpts(p), indexAxis: "y" },
  });
}

function _barVertical(canvasId, labels, values, color) {
  const p = _palette();
  _destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  anlCharts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 4, maxBarThickness: 18 }] },
    options: _baseOpts(p),
  });
}

const statusPt = { booked: "Agendado", pending: "Pendente", arrived: "Em andamento", fulfilled: "Realizado", cancelled: "Cancelado", noshow: "Falta", "checked-in": "Check-in", "entered-in-error": "Erro" };
const txStatus = (s) => statusPt[s] || s;

async function loadAnalytics() {
  const q = new URLSearchParams({ origem: document.getElementById("anl-origem").value });
  const ge = document.getElementById("anl-ge").value; if (ge) q.set("date_ge", ge);
  const le = document.getElementById("anl-le").value; if (le) q.set("date_le", le);

  let data;
  try {
    data = await api(`/estatisticas/agendamentos?${q}`);
  } catch (e) {
    document.getElementById("anl-total").textContent = "Erro ao carregar";
    return;
  }

  const p = _palette();
  const total = data.total ?? 0;
  document.getElementById("anl-total").textContent = `${total} agendamento(s)`;
  document.getElementById("anl-kpi-total").textContent = total;
  document.getElementById("anl-kpi-realizado").textContent = `${data.status.taxa_realizado_pct}%`;
  document.getElementById("anl-kpi-cancelado").textContent = `${data.status.taxa_cancelamento_pct}%`;
  document.getElementById("anl-kpi-noshow").textContent = `${data.status.taxa_noshow_pct}%`;

  // ---- Distribuição por status (doughnut) ----
  _destroyChart("anl-chart-status");
  const statusItems = data.status.items;
  const ctxStatus = document.getElementById("anl-chart-status");
  anlCharts["anl-chart-status"] = new Chart(ctxStatus, {
    type: "doughnut",
    data: {
      labels: statusItems.map(s => txStatus(s.status)),
      datasets: [{
        data: statusItems.map(s => s.total),
        backgroundColor: statusItems.map(s => _statusColor(s.status, p)),
        borderWidth: 0,
      }],
    },
    options: {
      animation: { duration: 500 },
      cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { color: p.text3, font: { family: "Geist", size: 11 }, boxWidth: 10 } },
        tooltip: { backgroundColor: "#1C1917", padding: 10, cornerRadius: 8,
          callbacks: { label: (c) => {
            const item = statusItems[c.dataIndex];
            return ` ${txStatus(item.status)}: ${item.total} (${item.pct}%)`;
          }} },
      },
    },
  });

  // ---- Tendência 30d (line) ----
  _destroyChart("anl-chart-tendencia");
  const tend = data.tendencia_30d;
  const ctxTend = document.getElementById("anl-chart-tendencia");
  anlCharts["anl-chart-tendencia"] = new Chart(ctxTend, {
    type: "line",
    data: {
      labels: tend.map(t => t.data.slice(5)), // MM-DD
      datasets: [{
        data: tend.map(t => t.total),
        borderColor: p.accent, backgroundColor: p.accent + "20",
        tension: 0.3, fill: true, borderWidth: 2, pointRadius: 2,
      }],
    },
    options: _baseOpts(p),
  });

  // ---- Top profissionais / tipos / locais (horizontal bars) ----
  _barHorizontal("anl-chart-prof",  data.top_profissionais, p.accent);
  _barHorizontal("anl-chart-tipo",  data.top_tipos,         p.vital);
  _barHorizontal("anl-chart-local", data.top_locais,        p.warn);

  // ---- Dia da semana / hora do dia (vertical bars) ----
  _barVertical("anl-chart-dia",  data.por_dia_semana.map(d => d.dia),  data.por_dia_semana.map(d => d.total), p.accent);
  _barVertical("anl-chart-hora", data.por_hora_dia.map(d => `${d.hora}h`), data.por_hora_dia.map(d => d.total), p.vital);

  reinitIcons();
}

document.getElementById("anl-search").addEventListener("click", loadAnalytics);

// =====================================================================
// Audit
// =====================================================================
async function loadAudit() {
  const rows = await api("/audit?limit=200");
  document.getElementById("audit-table").innerHTML = table(
    ["Quando", "Método", "Caminho", "Status", "Duração", "Cliente"],
    rows.map(a => [
      `<span class="mono muted">${a.ts.replace("T", " ").slice(0, 19)}</span>`,
      `<span class="code">${a.metodo}</span>`,
      `<span class="code">${a.caminho}</span>`,
      a.status >= 500 ? `<span class="badge badge-err">${a.status}</span>`
      : a.status >= 400 ? `<span class="badge badge-warn">${a.status}</span>`
      : `<span class="badge badge-ok">${a.status}</span>`,
      `<span class="tabular mono">${a.duracao_ms} ms</span>`,
      a.cliente ? `<span class="mono muted">${a.cliente}</span>` : fmt(null),
    ])
  );
  setUpdated();
}

// =====================================================================
// Toast system
// =====================================================================
const toastContainer = document.getElementById("toast-container");
const toastIcons = { info: "info", vital: "check-circle-2", warn: "alert-triangle", danger: "x-circle" };

function toast({ title, text, variant = "info", duration = 4500 }) {
  const el = document.createElement("div");
  el.className = `toast toast-${variant}`;
  el.innerHTML = `
    <i data-lucide="${toastIcons[variant] || "info"}" class="toast-icon"></i>
    <div class="toast-body">
      <div class="toast-title">${title || ""}</div>
      ${text ? `<div class="toast-text">${text}</div>` : ""}
    </div>
    <button class="toast-close" aria-label="Fechar"><i data-lucide="x" style="width:14px;height:14px"></i></button>
  `;
  toastContainer.appendChild(el);
  reinitIcons();
  const close = () => {
    el.classList.add("exit");
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector(".toast-close").addEventListener("click", close);
  if (duration > 0) setTimeout(close, duration);
  return close;
}

// =====================================================================
// Health watcher — dispara toasts quando A/B muda de estado
// =====================================================================
let lastHealth = { sistema_a: null, sistema_b: null };
async function watchHealth() {
  try {
    const h = await api("/health");
    for (const sys of ["sistema_a", "sistema_b"]) {
      if (lastHealth[sys] !== null && lastHealth[sys] !== h[sys]) {
        if (h[sys] === "up") {
          toast({ variant: "vital", title: `${sys.toUpperCase()} voltou ao ar`, text: "Conexão restabelecida." });
        } else {
          toast({ variant: "danger", title: `${sys.toUpperCase()} ficou offline`, text: "Verifique o serviço.", duration: 8000 });
        }
      }
      lastHealth[sys] = h[sys];
    }
  } catch (_) { /* silencioso — não polui com toast a cada falha de rede */ }
}
setInterval(watchHealth, 15000);
watchHealth();

// =====================================================================
// Modal — detalhe do paciente
// =====================================================================
const overlay = document.getElementById("modal-overlay");
const modal = document.getElementById("modal");

function openModal() {
  overlay.classList.remove("hidden");
  modal.focus();
  document.body.style.overflow = "hidden";
}
function closeModal() {
  overlay.classList.add("hidden");
  document.body.style.overflow = "";
}
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
document.getElementById("modal-close").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.classList.contains("hidden")) closeModal(); });

function attachDetalheHandlers(container) {
  container.querySelectorAll("[data-detalhe-identifier], [data-detalhe-nome]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ident = btn.getAttribute("data-detalhe-identifier");
      const nome = btn.getAttribute("data-detalhe-nome");
      abrirDetalhePaciente({ identifier: ident, nome });
    });
  });
  container.querySelectorAll("[data-detalhe-prof-identifier], [data-detalhe-prof-nome]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ident = btn.getAttribute("data-detalhe-prof-identifier");
      const nome = btn.getAttribute("data-detalhe-prof-nome");
      abrirDetalheProfissional({ identifier: ident, nome });
    });
  });
  container.querySelectorAll("[data-detalhe-ag-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-detalhe-ag-id");
      const origem = btn.getAttribute("data-detalhe-ag-origem");
      abrirDetalheAgendamento({ id, origem });
    });
  });
}

async function abrirDetalhePaciente({ identifier, nome }) {
  const q = new URLSearchParams();
  if (identifier) q.set("identifier", identifier);
  else if (nome) q.set("nome", nome);

  document.getElementById("modal-title").textContent = "Carregando…";
  document.getElementById("modal-sub").innerHTML = "";
  document.getElementById("modal-body").innerHTML = `<div class="empty"><i data-lucide="loader" class="icon"></i><div>Buscando em A e B…</div></div>`;
  openModal();
  reinitIcons();

  let data;
  try {
    data = await api(`/pacientes/detalhe?${q}`);
  } catch (e) {
    document.getElementById("modal-title").textContent = "Erro";
    document.getElementById("modal-body").innerHTML = `<div class="alert alert-err"><div class="alert-title"><i data-lucide="x-circle" class="icon"></i> Falha ao carregar</div><div class="alert-row">${e.message}</div></div>`;
    reinitIcons();
    return;
  }

  renderDetalhe(data, "Patient");
}

async function abrirDetalheProfissional({ identifier, nome }) {
  const q = new URLSearchParams();
  if (identifier) q.set("identifier", identifier);
  else if (nome) q.set("nome", nome);

  document.getElementById("modal-title").textContent = "Carregando…";
  document.getElementById("modal-sub").innerHTML = "";
  document.getElementById("modal-body").innerHTML = `<div class="empty"><i data-lucide="loader" class="icon"></i><div>Buscando em A e B…</div></div>`;
  openModal();
  reinitIcons();

  let data;
  try {
    data = await api(`/profissionais/detalhe?${q}`);
  } catch (e) {
    document.getElementById("modal-title").textContent = "Erro";
    document.getElementById("modal-body").innerHTML = `<div class="alert alert-err"><div class="alert-title"><i data-lucide="x-circle" class="icon"></i> Falha ao carregar</div><div class="alert-row">${e.message}</div></div>`;
    reinitIcons();
    return;
  }
  renderDetalhe(data, "Practitioner");
}

async function abrirDetalheAgendamento({ id, origem }) {
  const q = new URLSearchParams();
  q.set("id", id);
  q.set("origem", origem);

  document.getElementById("modal-title").textContent = "Carregando…";
  document.getElementById("modal-sub").innerHTML = "";
  document.getElementById("modal-body").innerHTML = `<div class="empty"><i data-lucide="loader" class="icon"></i><div>Buscando agendamento…</div></div>`;
  openModal();
  reinitIcons();

  let data;
  try {
    data = await api(`/agendamentos/detalhe?${q}`);
  } catch (e) {
    document.getElementById("modal-title").textContent = "Erro";
    document.getElementById("modal-body").innerHTML = `<div class="alert alert-err"><div class="alert-title"><i data-lucide="x-circle" class="icon"></i> Falha ao carregar</div><div class="alert-row">${e.message}</div></div>`;
    reinitIcons();
    return;
  }
  renderDetalhe(data, "Appointment");
}

function renderDetalhe(data, tipo) {
  const v0 = data.versoes[0]?.resumo || {};
  const origensBadges = data.versoes.map(v => badgeOrigem(v.origem)).join(" ");
  
  let titulo = v0.nome || "Desconhecido";
  if (tipo === "Appointment") titulo = v0.tipo || "Agendamento";
  
  document.getElementById("modal-title").textContent = titulo;
  
  let tags = "";
  if (tipo === "Patient") {
      tags = `
        ${v0.cartao_sus ? `<span class="code">CNS · ${v0.cartao_sus}</span>` : ""}
        ${v0.cpf ? `<span class="code">CPF · ${v0.cpf}</span>` : ""}
      `;
  } else if (tipo === "Practitioner") {
      tags = `
        ${v0.crm ? `<span class="code">CRM · ${v0.crm}</span>` : ""}
        ${v0.especialidade ? `<span class="code">${v0.especialidade}</span>` : ""}
      `;
  } else if (tipo === "Appointment") {
      tags = `
        ${v0.status ? `<span class="code">Status · ${v0.status}</span>` : ""}
        ${v0.inicio ? `<span class="code">${v0.inicio.replace("T", " ").slice(0, 16)}</span>` : ""}
      `;
  }

  document.getElementById("modal-sub").innerHTML = `
    ${origensBadges}
    ${data.duplicado ? `<span class="badge badge-warn"><span class="dot"></span>duplicado</span>` : (data.versoes.length > 0 && tipo !== "Appointment" ? `<span class="badge">único</span>` : "")}
    ${tags}
  `;

  const body = document.getElementById("modal-body");
  const blocks = [];

  // — Diff section (só se duplicado)
  if (data.duplicado && data.diff.length) {
    const divs = ['<div class="diff-table">',
      '<div class="diff-head">Campo</div>',
      '<div class="diff-head">Sistema A</div>',
      '<div class="diff-head">Sistema B</div>',
    ];
    for (const d of data.diff) {
      const cls = d.igual ? "" : "diverge";
      const aHtml = d.a ? `${d.a}` : `<span class="empty">vazio</span>`;
      const bHtml = d.b ? `${d.b}` : `<span class="empty">vazio</span>`;
      divs.push(`<div class="diff-cell diff-row-label">${d.campo}</div>`);
      divs.push(`<div class="diff-cell ${cls} ${!d.a ? "empty" : ""}">${aHtml}</div>`);
      divs.push(`<div class="diff-cell ${cls} ${!d.b ? "empty" : ""}">${bHtml}</div>`);
    }
    divs.push("</div>");
    const divergentes = data.diff.filter(d => !d.igual).length;
    blocks.push(`
      <div class="modal-section">
        <h3><i data-lucide="git-compare" class="icon"></i> Comparação A vs B
          ${divergentes ? `<span class="badge badge-warn" style="margin-left:auto">${divergentes} divergência(s)</span>` : `<span class="badge badge-ok" style="margin-left:auto">tudo bate</span>`}
        </h3>
        ${divs.join("")}
      </div>
    `);
  }

  // — Timeline section
  if (data.agendamentos.length) {
    const statusVariant = (st) => {
      if (st === "fulfilled") return "vital";
      if (st === "cancelled" || st === "noshow") return "danger";
      if (st === "pending") return "warn";
      return "";
    };
    const items = data.agendamentos.map(ag => `
      <div class="timeline-item ${statusVariant(ag.status)}">
        <div class="timeline-when">${ag.inicio ? ag.inicio.replace("T", " · ").slice(0, 19) : "data desconhecida"}</div>
        <div class="timeline-card">
          <div class="timeline-main">
            <div class="timeline-title">${ag.tipo || "Consulta"}</div>
            <div class="timeline-meta">
              ${badgeOrigem(ag.origem)}
              ${badgeStatus(ag.status)}
              ${ag.profissional ? `<span><i data-lucide="stethoscope" style="width:11px;height:11px;vertical-align:-1px"></i> ${ag.profissional}</span>` : ""}
              ${ag.local ? `<span><i data-lucide="map-pin" style="width:11px;height:11px;vertical-align:-1px"></i> ${ag.local}</span>` : ""}
            </div>
          </div>
        </div>
      </div>
    `).join("");
    blocks.push(`
      <div class="modal-section">
        <h3><i data-lucide="calendar-clock" class="icon"></i> Linha do tempo
          <span class="badge" style="margin-left:auto">${data.agendamentos.length}</span>
        </h3>
        <div class="timeline">${items}</div>
      </div>
    `);
  } else {
    blocks.push(`
      <div class="modal-section">
        <h3><i data-lucide="calendar-clock" class="icon"></i> Linha do tempo</h3>
        <div class="empty"><i data-lucide="calendar-off" class="icon"></i><div>Sem agendamentos registrados</div></div>
      </div>
    `);
  }

  // — FHIR raw por versão
  for (const v of data.versoes) {
    blocks.push(`
      <div class="modal-section">
        <h3><i data-lucide="braces" class="icon"></i> FHIR ${tipo} · ${v.origem.toUpperCase()}</h3>
        <pre class="fhir-viewer">${JSON.stringify(v.fhir, null, 2)}</pre>
      </div>
    `);
  }

  body.innerHTML = blocks.join("");
  reinitIcons();
}

// =====================================================================
// Boot
// =====================================================================
const loaders = {
  visao: loadVisao, analytics: loadAnalytics, pacientes: loadPacientes, profissionais: loadProf,
  agendamentos: loadAg, duplicatas: loadDuplicatas, qualidade: loadQualidade,
  mpi: loadMpi, bundle: () => {}, criar: () => {}, audit: loadAudit,
};
function refreshActive() {
  const active = document.querySelector(".nav-btn.active")?.dataset.tab || "visao";
  loaders[active]?.();
}
document.getElementById("refresh-btn").addEventListener("click", refreshActive);

// ---------- Auto-refresh ----------
let autoTimer = null;
function setupAutoRefresh(ms) {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  if (ms > 0) autoTimer = setInterval(refreshActive, ms);
}
const arSelect = document.getElementById("autorefresh");
const savedAr = localStorage.getItem("interop:autorefresh");
if (savedAr !== null) arSelect.value = savedAr;
setupAutoRefresh(Number(arSelect.value));
arSelect.addEventListener("change", () => {
  localStorage.setItem("interop:autorefresh", arSelect.value);
  setupAutoRefresh(Number(arSelect.value));
});

// ---------- Theme toggle ----------
const root = document.documentElement;
const themeBtn = document.getElementById("theme-toggle");
function applyTheme(t) {
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  else root.removeAttribute("data-theme");
  // update icon
  const isDark = (t === "dark") || (!t && matchMedia("(prefers-color-scheme: dark)").matches);
  themeBtn.innerHTML = `<i data-lucide="${isDark ? "sun" : "moon"}" class="icon"></i>`;
  reinitIcons();
  // re-render chart with novas cores se tiver
  if (chartTrafego && document.querySelector(".nav-btn.active")?.dataset.tab === "visao") loadVisao();
}
const savedTheme = localStorage.getItem("interop:theme");
applyTheme(savedTheme);
themeBtn.addEventListener("click", () => {
  const cur = localStorage.getItem("interop:theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  localStorage.setItem("interop:theme", next);
  applyTheme(next);
});

// ---------- Export CSV ----------
function tableToCSV(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  return rows.map(tr =>
    Array.from(tr.querySelectorAll("th,td")).map(c => {
      const txt = (c.textContent || "").replace(/\s+/g, " ").trim();
      const safe = txt.replace(/"/g, '""');
      return /[",;\n]/.test(safe) ? `"${safe}"` : safe;
    }).join(";")
  ).join("\n");
}
function downloadFile(name, content, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿", content], { type: mime });   // BOM p/ Excel
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
document.querySelectorAll("[data-export]").forEach(btn => {
  btn.addEventListener("click", () => {
    const table = document.getElementById(btn.dataset.export);
    if (!table) return;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadFile(`${btn.dataset.filename}_${ts}.csv`, tableToCSV(table));
  });
});

activate("visao");
