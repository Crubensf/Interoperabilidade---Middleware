import { operationOutcome } from '../utils/operationOutcome.js';

const PUBLIC_PATHS = new Set(['/health', '/']);

export function apiKeyMiddleware(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();

  const expected = process.env.API_KEY;
  if (!expected) return next();

  const provided = req.header('x-api-key');
  if (provided && provided === expected) return next();

  return res
    .status(401)
    .type('application/fhir+json')
    .json(operationOutcome('error', 'security', 'API key ausente ou inválida.'));
}
