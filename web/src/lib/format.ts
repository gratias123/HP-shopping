const currencyFormatter = new Map<string, Intl.NumberFormat>();

const xofFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatPrice(cents: number, currency = 'XOF'): string {
  if (currency.toUpperCase() === 'XOF') {
    return `${xofFormatter.format(cents / 100)} FCFA`;
  }
  let formatter = currencyFormatter.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatter.set(currency, formatter);
  }
  return formatter.format(cents / 100);
}

export function formatCentsCompact(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de confirmation',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

export const ORDER_STATUS_SHORT: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Paiement à la réception',
  paid: 'Payée',
  failed: 'Échec du paiement',
  refunded: 'Remboursée',
};

export function statusTone(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'delivered':
    case 'paid':
      return 'success';
    case 'shipped':
    case 'preparing':
    case 'confirmed':
      return 'info';
    case 'pending':
      return 'warning';
    case 'cancelled':
    case 'refunded':
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function discountPercent(priceCents: number, compareAtCents: number | null): number | null {
  if (!compareAtCents || compareAtCents <= priceCents) return null;
  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100);
}
