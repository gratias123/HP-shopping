import type { DatabaseSync } from 'node:sqlite';
import { queryAll, queryOne, transaction } from '../db/index.js';
import { ApiError } from '../lib/errors.js';
import { newId, nowIso } from '../lib/ids.js';
import type { CustomerAddressInput } from '../lib/validation.js';

const MAX_ADDRESSES_PER_USER = 10;

export interface CustomerAddressDto {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AddressRow {
  id: string;
  label: string;
  first_name: string;
  last_name: string;
  line1: string;
  line2: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function mapAddress(row: AddressRow): CustomerAddressDto {
  return {
    id: row.id,
    label: row.label,
    firstName: row.first_name,
    lastName: row.last_name,
    line1: row.line1,
    line2: row.line2,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    phone: row.phone,
    isDefault: Number(row.is_default) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findAddress(db: DatabaseSync, userId: string, id: string): AddressRow | undefined {
  return db.prepare('SELECT * FROM customer_addresses WHERE id = ? AND user_id = ?').get(id, userId) as
    | AddressRow
    | undefined;
}

function addressValues(input: CustomerAddressInput): string[] {
  return [
    input.label,
    input.firstName,
    input.lastName,
    input.line1,
    input.line2 ?? '',
    input.postalCode,
    input.city,
    input.country,
    input.phone,
  ];
}

export function listAddresses(userId: string): CustomerAddressDto[] {
  return queryAll<AddressRow>(
    `SELECT * FROM customer_addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, updated_at DESC, created_at DESC`,
    [userId],
  ).map(mapAddress);
}

export function createAddress(userId: string, input: CustomerAddressInput): CustomerAddressDto {
  return transaction((db) => {
    const count = Number(
      (db.prepare('SELECT COUNT(*) AS total FROM customer_addresses WHERE user_id = ?').get(userId) as { total: number })
        .total,
    );
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new ApiError(
        422,
        'address_limit',
        `Vous pouvez enregistrer au maximum ${MAX_ADDRESSES_PER_USER} adresses.`,
      );
    }
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) {
      db.prepare('UPDATE customer_addresses SET is_default = 0, updated_at = ? WHERE user_id = ?').run(
        nowIso(),
        userId,
      );
    }
    const id = newId();
    const now = nowIso();
    db.prepare(
      `INSERT INTO customer_addresses (
        id, user_id, label, first_name, last_name, line1, line2, postal_code, city, country, phone,
        is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, ...addressValues(input), makeDefault ? 1 : 0, now, now);
    return mapAddress(findAddress(db, userId, id)!);
  });
}

export function updateAddress(userId: string, id: string, input: CustomerAddressInput): CustomerAddressDto {
  return transaction((db) => {
    const existing = findAddress(db, userId, id);
    if (!existing) throw ApiError.notFound('Adresse introuvable.');
    const makeDefault = input.isDefault === true;
    const now = nowIso();
    if (makeDefault) {
      db.prepare('UPDATE customer_addresses SET is_default = 0, updated_at = ? WHERE user_id = ?').run(now, userId);
    }
    db.prepare(
      `UPDATE customer_addresses
          SET label = ?, first_name = ?, last_name = ?, line1 = ?, line2 = ?, postal_code = ?,
              city = ?, country = ?, phone = ?, is_default = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
    ).run(
      ...addressValues(input),
      makeDefault ? 1 : Number(existing.is_default),
      now,
      id,
      userId,
    );
    return mapAddress(findAddress(db, userId, id)!);
  });
}

export function deleteAddress(userId: string, id: string): void {
  transaction((db) => {
    const existing = findAddress(db, userId, id);
    if (!existing) throw ApiError.notFound('Adresse introuvable.');
    db.prepare('DELETE FROM customer_addresses WHERE id = ? AND user_id = ?').run(id, userId);
    if (Number(existing.is_default) === 1) {
      const replacement = db
        .prepare(
          `SELECT id FROM customer_addresses
            WHERE user_id = ?
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1`,
        )
        .get(userId) as { id: string } | undefined;
      if (replacement) {
        db.prepare('UPDATE customer_addresses SET is_default = 1, updated_at = ? WHERE id = ? AND user_id = ?').run(
          nowIso(),
          replacement.id,
          userId,
        );
      }
    }
  });
}

export function setDefaultAddress(userId: string, id: string): CustomerAddressDto {
  return transaction((db) => {
    const existing = findAddress(db, userId, id);
    if (!existing) throw ApiError.notFound('Adresse introuvable.');
    const now = nowIso();
    db.prepare('UPDATE customer_addresses SET is_default = 0, updated_at = ? WHERE user_id = ?').run(now, userId);
    db.prepare('UPDATE customer_addresses SET is_default = 1, updated_at = ? WHERE id = ? AND user_id = ?').run(
      now,
      id,
      userId,
    );
    return mapAddress(findAddress(db, userId, id)!);
  });
}
