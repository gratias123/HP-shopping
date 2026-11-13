export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

async function fetchCsrf(): Promise<string> {
  const response = await fetch('/api/auth/csrf', { credentials: 'include', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new ApiError(response.status, 'csrf_unavailable', 'Impossible d’initialiser la session sécurisée.');
  const data = (await response.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

function ensureCsrf(): Promise<string> {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (!csrfPromise) {
    csrfPromise = fetchCsrf().finally(() => {
      csrfPromise = null;
    });
  }
  return csrfPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const mutating = method !== 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (mutating) {
    headers['x-csrf-token'] = await ensureCsrf();
    headers['Content-Type'] = 'application/json';
  }

  const send = () =>
    fetch(path, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

  let response = await send();

  // Jeton CSRF expiré : on le régénère et on rejoue une seule fois.
  if (mutating && response.status === 403) {
    const cloned = await response.clone().json().catch(() => null);
    if (cloned?.error?.code === 'csrf_invalid') {
      csrfToken = null;
      headers['x-csrf-token'] = await ensureCsrf();
      response = await send();
    }
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'request_failed',
      error?.message ?? 'Une erreur est survenue. Merci de réessayer.',
      error?.fields ?? {},
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export async function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const send = async (token: string) =>
    fetch('/api/admin/uploads', {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      credentials: 'include',
      body: form,
    });

  let token = await ensureCsrf();
  let response = await send(token);
  if (response.status === 403) {
    const cloned = await response.clone().json().catch(() => null);
    if (cloned?.error?.code === 'csrf_invalid') {
      csrfToken = null;
      token = await ensureCsrf();
      response = await send(token);
    }
  }
  const payload = (await response.json().catch(() => null)) as
    | { url?: string; error?: { message?: string } }
    | null;
  if (!response.ok || !payload?.url) {
    throw new ApiError(response.status, 'upload_failed', payload?.error?.message ?? 'Téléversement impossible.');
  }
  return { url: payload.url };
}

export function queryString(params: Record<string, string | number | boolean | undefined | null | string[]>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
