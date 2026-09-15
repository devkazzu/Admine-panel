/**
 * Typed API client. All requests are same-origin with cookies; mutations carry
 * the anti-CSRF header the server requires. No secrets ever live here.
 */
import type { ListResponse } from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { path: string[]; message: string }[];

  constructor(status: number, message: string, code = 'error', details?: { path: string[]; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Map zod issues to a {field: message} record for form display. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) {
      const key = d.path[0] ?? '_';
      if (!out[key]) out[key] = d.message;
    }
    return out;
  }
}

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null;
}

function buildQuery(query?: QueryParams): string {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

async function request<T>(path: string, options: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const { method = 'GET', body, form } = options;
  const headers: Record<string, string> = { 'X-Requested-With': 'fetch' };
  let payload: BodyInit | undefined;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });

  if (res.status === 204) return undefined as T;

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('rjnx:unauthorized'));
    }
    const err = json?.error;
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.code ?? 'error', err?.details);
  }
  return (json?.data ?? json) as T;
}

export const api = {
  get: <T>(path: string, query?: QueryParams) => request<T>(`${path}${buildQuery(query)}`),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
  list: <T>(path: string, query?: QueryParams) => request<ListResponse<T>>(`${path}${buildQuery(query)}`),
};
