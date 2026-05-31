function isJsonEnvelopeString(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

export function ensureBundleObject(payload) {
  let data = payload;

  if (typeof data === "string") {
    if (!isJsonEnvelopeString(data)) {
      throw new Error("Bundle inválido: resposta recebida como texto não-JSON.");
    }
    data = JSON.parse(data);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Bundle inválido: esperado objeto JSON.");
  }
  if (data.resourceType !== "Bundle") {
    throw new Error("Payload inválido: resourceType deve ser 'Bundle'.");
  }

  return data;
}
