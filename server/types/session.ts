import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
    expiresAt?: string;
    csrfToken?: string;
  }
}

export {};