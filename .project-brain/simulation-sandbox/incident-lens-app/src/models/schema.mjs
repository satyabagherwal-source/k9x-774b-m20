export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function validateRouteRequest(req) {
  if (!req || typeof req !== 'object') throw new ValidationError('Request must be a non-null object.');
  if (!req.path || typeof req.path !== 'string' || !req.path.startsWith('/')) {
    throw new ValidationError("Request requires a valid path starting with '/'.");
  }
  const method = String(req.method || 'GET').toUpperCase();
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  if (!validMethods.includes(method)) throw new ValidationError('Unsupported HTTP method: ' + method);
  return { path: req.path.trim(), method, headers: req.headers || {}, body: req.body || null };
}
