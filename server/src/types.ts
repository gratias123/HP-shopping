import type { SessionUser } from './lib/auth.js';

declare global {
  namespace Express {
    interface Request {
      user: SessionUser | null;
      csrfToken: string;
    }
  }
}

export {};
