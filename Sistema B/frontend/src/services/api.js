const RAW_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const API_BASE = RAW_BASE.replace(/\/+$/, "");


function readToken() {
  if (typeof window === "undefined") return null;

  const v = localStorage.getItem("access_token");
  if (!v) return null;

  
  try {
    const obj = JSON.parse(v);
    return obj?.access_token || obj?.token || null;
  } catch {
    return v; 
  }
}


async function parseResponse(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // Suporta application/json, application/fhir+json e application/json+fhir.
  if (ct.includes("json")) {
    try {
      const parsed = await res.json();
      // Guarda defensiva: evita propagar JSON duplamente serializado.
      if (typeof parsed === "string") {
        const trimmed = parsed.trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            return JSON.parse(trimmed);
          } catch {
            return parsed;
          }
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }

  try {
    const text = await res.text();
    const trimmed = text.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return text;
      }
    }
    return text;
  } catch {
    return null;
  }
}


function buildErrorMessage(res, data) {
  if (data && typeof data === "object" && "detail" in data) {
    const d = data.detail;
    if (typeof d === "string") return d;
    try {
      return JSON.stringify(d);
    } catch {
      return `Erro ${res.status}`;
    }
  }

  if (typeof data === "string" && data.trim()) return data;
  return `Erro ${res.status}`;
}


async function request(path, { method = "GET", body, headers } = {}) {
  const token = readToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await parseResponse(res);

  
  if (res.status === 401) {
    localStorage.removeItem("access_token");
    // Removido o window.location.href para não recarregar a página e não causar 404
    throw new Error(buildErrorMessage(res, data));
  }

  if (!res.ok) {
    throw new Error(buildErrorMessage(res, data));
  }

  return data;
}

// API EXPORT

const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  del: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

export default api;
