/**
 * Helpers para retornar erros como recurso FHIR OperationOutcome.
 * https://www.hl7.org/fhir/R4/operationoutcome.html
 */

export function operationOutcome(severity, code, diagnostics, details) {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity,
        code,
        diagnostics,
        ...(details ? { details: { text: details } } : {}),
      },
    ],
  };
}

export function sendError(res, status, code, message, details) {
  return res
    .status(status)
    .type('application/fhir+json')
    .json(operationOutcome('error', code, message, details));
}
