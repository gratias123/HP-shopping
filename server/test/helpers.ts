import { once } from 'node:events';
import type { Server } from 'node:http';
import { closeDatabase, initDatabase } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed/index.js';
import { createApp } from '../src/app.js';

process.env.NODE_ENV = 'test';

interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

/**
 * Petit client HTTP avec jar de cookies et jeton CSRF, suffisant pour tester
 * le parcours réel (cookies httpOnly + double soumission).
 */
export class TestClient {
  private readonly baseUrl: string;
  private readonly cookies = new Map<string, string>();
  csrfToken = '';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  private storeCookies(response: Response): void {
    const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    for (const entry of setCookies) {
      const [pair] = entry.split(';');
      const index = pair.indexOf('=');
      if (index <= 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1);
      if (/max-age=0/i.test(entry)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async init(): Promise<void> {
    const response = await this.request<{ csrfToken: string }>('GET', '/api/auth/csrf');
    this.csrfToken = response.data.csrfToken;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options: { csrf?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.cookies.size) headers.cookie = this.cookieHeader();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && options.csrf !== false) {
      headers['x-csrf-token'] = this.csrfToken;
      headers['content-type'] = 'application/json';
    } else if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    this.storeCookies(response);
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: response.status, data: data as T, headers: response.headers };
  }
}

export interface TestContext {
  client: TestClient;
  baseUrl: string;
  stop: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  process.env.NODE_ENV = 'test';
  initDatabase(':memory:');
  seedDatabase();
  const app = createApp();
  const server: Server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  const client = new TestClient(baseUrl);
  await client.init();

  return {
    client,
    baseUrl,
    stop: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      closeDatabase();
    },
  };
}

export interface ProductDetailResponse {
  product: {
    id: string;
    slug: string;
    name: string;
    reference: string;
    priceCents: number;
    effectivePriceCents: number;
    status: string;
    variants: Array<{ id: string; size: string; color: string; stock: number; isActive: boolean }>;
    images: Array<{ url: string; alt: string }>;
  };
}

export interface ShippingMethodsResponse {
  country: string;
  methods: Array<{ id: string; name: string; priceCents: number; zoneName: string }>;
  freeShippingThresholdCents: number;
}

export const DEMO_EMAIL = 'demo.client@example.com';
export const DEMO_PASSWORD = 'MotDePasse123!';
