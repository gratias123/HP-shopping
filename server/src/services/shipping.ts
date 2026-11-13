import { queryAll, queryOne } from '../db/index.js';
import { ApiError } from '../lib/errors.js';

export interface ShippingMethodDto {
  id: string;
  zoneId: string;
  zoneName: string;
  name: string;
  description: string;
  priceCents: number;
  basePriceCents: number;
  freeOverCents: number | null;
  minDays: number | null;
  maxDays: number | null;
}

function mapMethod(row: Record<string, unknown>, subtotalCents: number): ShippingMethodDto {
  const basePriceCents = Number(row.price_cents);
  const freeOverCents = (row.free_over_cents as number | null) ?? null;
  const priceCents = freeOverCents !== null && subtotalCents >= freeOverCents ? 0 : basePriceCents;
  return {
    id: String(row.id),
    zoneId: String(row.zone_id),
    zoneName: String(row.zone_name),
    name: String(row.name),
    description: String(row.description ?? ''),
    priceCents,
    basePriceCents,
    freeOverCents,
    minDays: (row.min_days as number | null) ?? null,
    maxDays: (row.max_days as number | null) ?? null,
  };
}

export function listShippingOptions(country: string, subtotalCents: number): ShippingMethodDto[] {
  const rows = queryAll<Record<string, unknown>>(
    `SELECT m.*, z.name AS zone_name, z.countries
       FROM shipping_methods m JOIN shipping_zones z ON z.id = m.zone_id
      WHERE m.active = 1 AND z.active = 1
      ORDER BY z.sort_order, m.sort_order, m.price_cents`,
  );
  const normalized = country.trim().toUpperCase();
  return rows
    .filter((row) =>
      String(row.countries)
        .split(',')
        .map((code) => code.trim().toUpperCase())
        .includes(normalized),
    )
    .map((row) => mapMethod(row, subtotalCents));
}

export function resolveShipping(
  methodId: string,
  country: string,
  subtotalCents: number,
): { methodId: string; zoneId: string; label: string; priceCents: number } {
  const row = queryOne<Record<string, unknown>>(
    `SELECT m.*, z.name AS zone_name, z.countries
       FROM shipping_methods m JOIN shipping_zones z ON z.id = m.zone_id
      WHERE m.id = ? AND m.active = 1 AND z.active = 1`,
    [methodId],
  );
  if (!row) throw new ApiError(422, 'shipping_unavailable', "Ce mode de livraison n'est plus disponible.");
  const countries = String(row.countries)
    .split(',')
    .map((code) => code.trim().toUpperCase());
  if (!countries.includes(country.trim().toUpperCase())) {
    throw new ApiError(422, 'shipping_country', "Ce mode de livraison n'est pas disponible pour ce pays.");
  }
  const method = mapMethod(row, subtotalCents);
  const days = method.minDays !== null && method.maxDays !== null ? ` — ${method.minDays} à ${method.maxDays} jours ouvrés` : '';
  return {
    methodId: method.id,
    zoneId: method.zoneId,
    label: `${method.zoneName} · ${method.name}${days}`,
    priceCents: method.priceCents,
  };
}

export function listActiveCountries(): string[] {
  const rows = queryAll<{ countries: string }>('SELECT countries FROM shipping_zones WHERE active = 1');
  const codes = new Set<string>();
  for (const row of rows) {
    for (const code of String(row.countries).split(',')) {
      const normalized = code.trim().toUpperCase();
      if (normalized) codes.add(normalized);
    }
  }
  return [...codes].sort();
}

export function listZonesWithMethods() {
  const zones = queryAll<Record<string, unknown>>('SELECT * FROM shipping_zones ORDER BY sort_order, name');
  const methods = queryAll<Record<string, unknown>>('SELECT * FROM shipping_methods ORDER BY sort_order, name');
  return zones.map((zone) => ({
    id: String(zone.id),
    name: String(zone.name),
    countries: String(zone.countries)
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean),
    active: Number(zone.active) === 1,
    sortOrder: Number(zone.sort_order),
    methods: methods
      .filter((method) => method.zone_id === zone.id)
      .map((method) => ({
        id: String(method.id),
        zoneId: String(method.zone_id),
        name: String(method.name),
        description: String(method.description ?? ''),
        priceCents: Number(method.price_cents),
        freeOverCents: (method.free_over_cents as number | null) ?? null,
        minDays: (method.min_days as number | null) ?? null,
        maxDays: (method.max_days as number | null) ?? null,
        active: Number(method.active) === 1,
        sortOrder: Number(method.sort_order),
      })),
  }));
}
