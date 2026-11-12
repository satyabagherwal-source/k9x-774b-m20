import { ValidationError, validateRouteRequest } from '../models/schema.mjs';

export class HeadlessApiRouter {
  constructor() {
    this.routes = new Map();
  }

  register(method, path, handler) {
    const key = `${String(method).toUpperCase()} ${path}`;
    this.routes.set(key, handler);
  }

  handle(req) {
    try {
      const validated = validateRouteRequest(req);
      const key = `${validated.method} ${validated.path}`;
      const handler = this.routes.get(key);
      if (!handler) {
        return {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
          body: { type: 'https://tools.ietf.org/html/rfc7807', title: 'Not Found', status: 404, detail: `No route matched ${key}` }
        };
      }
      const responseData = handler(validated);
      return { status: 200, headers: { 'Content-Type': 'application/json' }, body: responseData };
    } catch (err) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { type: 'https://tools.ietf.org/html/rfc7807', title: 'Bad Request', status: 400, detail: err.message }
      };
    }
  }
}
