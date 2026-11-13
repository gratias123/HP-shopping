import { queryAll } from '../db/index.js';
import { formatMoney } from '../lib/money.js';
import { TextPdf } from '../lib/pdf.js';
import { dashboardStats, ORDER_STATUS_LABELS } from './orders.js';
import { getSettings } from './settings.js';

export interface OrderReportFilters {
  status?: string;
  q?: string;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Export CSV des commandes pour l'administration.
 *
 * Le point-virgule est utilisé pour l'ouverture directe dans les tableurs
 * francophones. Le BOM UTF-8 permet de conserver les accents.
 */
export function ordersCsv(filters: OrderReportFilters = {}): string {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filters.status && filters.status !== 'all') {
    clauses.push('o.status = ?');
    params.push(filters.status);
  }
  if (filters.q?.trim()) {
    clauses.push('(o.reference LIKE ? OR o.email LIKE ? OR o.shipping_first_name LIKE ? OR o.shipping_last_name LIKE ?)');
    const term = `%${filters.q.trim()}%`;
    params.push(term, term, term, term);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = queryAll<Record<string, unknown>>(
    `SELECT o.reference, o.created_at, o.status, o.payment_method, o.payment_status,
            o.currency, o.subtotal_cents, o.discount_cents, o.shipping_cents, o.total_cents,
            o.promo_code, o.email, o.phone, o.shipping_first_name, o.shipping_last_name,
            o.shipping_line1, o.shipping_line2, o.shipping_postal_code, o.shipping_city,
            o.shipping_country, o.shipping_method_label,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       ${where}
      ORDER BY o.created_at DESC
      LIMIT 5000`,
    params,
  );

  const header = [
    'reference',
    'date',
    'statut',
    'paiement',
    'statut_paiement',
    'devise',
    'sous_total',
    'remise',
    'livraison',
    'total',
    'code_promo',
    'email',
    'telephone',
    'prenom',
    'nom',
    'adresse',
    'complement',
    'code_postal',
    'ville',
    'pays',
    'mode_livraison',
    'articles',
  ];

  const lines = rows.map((row) => {
    const centsToAmount = (value: unknown) => (Number(value ?? 0) / 100).toFixed(row.currency === 'XOF' ? 0 : 2);
    return [
      row.reference,
      row.created_at,
      row.status,
      row.payment_method,
      row.payment_status,
      row.currency,
      centsToAmount(row.subtotal_cents),
      centsToAmount(row.discount_cents),
      centsToAmount(row.shipping_cents),
      centsToAmount(row.total_cents),
      row.promo_code,
      row.email,
      row.phone,
      row.shipping_first_name,
      row.shipping_last_name,
      row.shipping_line1,
      row.shipping_line2,
      row.shipping_postal_code,
      row.shipping_city,
      row.shipping_country,
      row.shipping_method_label,
      row.item_count,
    ]
      .map(csvCell)
      .join(';');
  });

  return `\uFEFF${header.join(';')}\r\n${lines.join('\r\n')}${lines.length ? '\r\n' : ''}`;
}

/**
 * Rapport de synthèse interne au format PDF.
 *
 * Il s'agit d'un document de pilotage, pas d'une facture : aucune donnée
 * fiscale, aucune numérotation légale et aucun montant inventé.
 */
export function buildSalesReportPdf(): Buffer {
  const settings = getSettings();
  const stats = dashboardStats();
  const pdf = new TextPdf();
  const generatedAt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date());
  const averageBasket = stats.orderCount > 0 ? Math.round(stats.revenueCents / stats.orderCount) : 0;
  const money = (cents: number) => formatMoney(cents, stats.currency);

  pdf.y = 790;
  pdf.text('Rapport de synthèse', pdf.left, pdf.y, { size: 20, bold: true });
  pdf.text(`${settings.storeName || 'HP COLLECTION'} · ${generatedAt}`, pdf.left, pdf.y - 22, {
    size: 9,
    color: '0.4 0.4 0.4',
  });
  pdf.rightText('Document interne — non fiscal', pdf.right, pdf.y, { size: 9, color: '0.4 0.4 0.4' });
  pdf.rule(pdf.y - 38);
  pdf.y -= 62;

  const kpis: Array<[string, string]> = [
    ["Chiffre d'affaires", money(stats.revenueCents)],
    ['Commandes comptabilisées', String(stats.orderCount)],
    ['Panier moyen', money(averageBasket)],
    ['CA sur 30 jours', money(stats.revenue30dCents)],
    ['Clients', String(stats.customerCount)],
    ['Alertes stock faible', String(stats.lowStockTotal)],
  ];

  const boxWidth = (pdf.contentWidth - 16) / 2;
  kpis.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = pdf.left + column * (boxWidth + 16);
    const y = pdf.y - row * 56;
    pdf.text(label, x, y, { size: 8, color: '0.45 0.45 0.45' });
    pdf.text(value, x, y - 20, { size: 13, bold: true });
  });
  pdf.y -= 150;

  pdf.text('Répartition des commandes', pdf.left, pdf.y, { size: 12, bold: true });
  pdf.y -= 20;
  const statusOrder = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  for (const status of statusOrder) {
    const count = stats.statusCounts[status] ?? 0;
    if (!count) continue;
    const label = ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status;
    pdf.text(label, pdf.left, pdf.y, { size: 9.5 });
    pdf.rightText(String(count), pdf.right, pdf.y, { size: 9.5, bold: true });
    pdf.y -= 16;
  }
  if (Object.values(stats.statusCounts).every((count) => !count)) {
    pdf.text('Aucune commande enregistrée.', pdf.left, pdf.y, { size: 9.5, color: '0.45 0.45 0.45' });
    pdf.y -= 16;
  }

  pdf.y -= 10;
  pdf.text('Meilleures ventes', pdf.left, pdf.y, { size: 12, bold: true });
  pdf.y -= 20;
  if (stats.topProducts.length === 0) {
    pdf.text('Aucune vente à afficher.', pdf.left, pdf.y, { size: 9.5, color: '0.45 0.45 0.45' });
    pdf.y -= 16;
  } else {
    pdf.text('Article', pdf.left, pdf.y, { size: 8, bold: true, color: '0.45 0.45 0.45' });
    pdf.rightText('Unités', 430, pdf.y, { size: 8, bold: true, color: '0.45 0.45 0.45' });
    pdf.rightText('CA', pdf.right, pdf.y, { size: 8, bold: true, color: '0.45 0.45 0.45' });
    pdf.rule(pdf.y - 6);
    pdf.y -= 20;
    for (const product of stats.topProducts) {
      pdf.ensureSpace(30);
      const name = product.name.length > 48 ? `${product.name.slice(0, 47)}…` : product.name;
      pdf.text(name, pdf.left, pdf.y, { size: 9.5 });
      pdf.text(product.reference, pdf.left, pdf.y - 11, { size: 8, color: '0.45 0.45 0.45' });
      pdf.rightText(String(product.units), 430, pdf.y, { size: 9.5 });
      pdf.rightText(money(product.revenueCents), pdf.right, pdf.y, { size: 9.5, bold: true });
      pdf.y -= 28;
    }
  }

  pdf.ensureSpace(60);
  pdf.rule();
  pdf.y -= 14;
  pdf.paragraph(
    'Rapport généré depuis les commandes non annulées et non remboursées. Les montants sont exprimés dans la devise de la boutique. Ce document est destiné au pilotage interne.',
    { size: 8, color: '0.45 0.45 0.45' },
  );

  return pdf.finish();
}
