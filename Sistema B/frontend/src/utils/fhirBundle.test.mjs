import test from "node:test";
import assert from "node:assert/strict";

import { ensureBundleObject } from "./fhirBundle.js";

test("accepts bundle object and keeps object type", () => {
  const payload = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [],
  };

  const out = ensureBundleObject(payload);
  assert.equal(typeof out, "object");
  assert.notEqual(typeof out, "string");
  assert.equal(out.resourceType, "Bundle");
});

test("parses JSON string bundle into object", () => {
  const payload =
    "{\"resourceType\":\"Bundle\",\"type\":\"transaction\",\"entry\":[]}";

  const out = ensureBundleObject(payload);
  assert.equal(typeof out, "object");
  assert.notEqual(typeof out, "string");
  assert.equal(out.resourceType, "Bundle");
});

test("fails when payload is non-JSON text", () => {
  assert.throws(() => ensureBundleObject("html-error-page"), /Bundle inválido/);
});
