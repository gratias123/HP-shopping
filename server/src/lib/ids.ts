import crypto from 'node:crypto';

export function newId(): string {
  return crypto.randomUUID();
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function orderReference(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const byte of bytes) suffix += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return `HP-${suffix}`;
}

export function isOrderReference(value: string): boolean {
  return /^HP-[A-Z0-9]{6}$/.test(value);
}

export function productReference(prefix = 'HP'): string {
  const bytes = crypto.randomBytes(3);
  let suffix = '';
  for (const byte of bytes) suffix += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return `${prefix}-${suffix}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
