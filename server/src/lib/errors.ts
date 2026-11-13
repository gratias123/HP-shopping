export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, code = 'bad_request', details?: unknown) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Authentification requise.') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'Accès refusé.') {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'Ressource introuvable.') {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message: string, code = 'conflict', details?: unknown) {
    return new ApiError(409, code, message, details);
  }

  static tooManyRequests(message = 'Trop de requêtes, réessayez dans un instant.') {
    return new ApiError(429, 'rate_limited', message);
  }
}
