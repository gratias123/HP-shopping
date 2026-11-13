import { formatMoney } from '../lib/money.js';
import { TextPdf } from '../lib/pdf.js';
import { getSettings } from './settings.js';
import type { OrderDto, PaymentStatus } from './orders.js';

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Échoué',
  refunded: 'Remboursé',
};

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

/**
 * Produit un reçu de commande PDF. Ce document n'est pas une facture fiscale :
 * il reprend les instantanés de commande et les coordonnées configurées dans
 * l'administration. Aucune numérotation fiscale n'est inventée.
 */
export function buildOrderReceipt(order: OrderDto): Buffer {
  const settings = getSettings();
  const pdf = new TextPdf();
  const sellerName = settings.storeName || 'HP COLLECTION';
  const sellerCity = [settings.storeCity, settings.storeCountry].filter(Boolean).join(', ');

  pdf.y = 790;
  pdf.text(sellerName, pdf.left, pdf.y, { size: 20, bold: true });
  pdf.text('Reçu de commande — document non fiscal', pdf.left, pdf.y - 22, {
    size: 9,
    color: '0.4 0.4 0.4',
  });
  pdf.rightText(order.reference, pdf.right, pdf.y, { size: 12, bold: true });
  pdf.rightText(formatDate(order.createdAt), pdf.right, pdf.y - 18, { size: 9, color: '0.4 0.4 0.4' });
  pdf.rule(pdf.y - 38);
  pdf.y -= 58;

  const clientName = `${order.shippingFirstName} ${order.shippingLastName}`.trim();
  const addressLines = [
    order.shippingLine1,
    order.shippingLine2,
    [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(' '),
    order.shippingCountry,
  ].filter(Boolean);

  const infoTop = pdf.y;
  pdf.text('CLIENT', pdf.left, infoTop, { size: 8, bold: true, color: '0.45 0.45 0.45' });
  let clientY = infoTop - 16;
  pdf.text(clientName || order.email, pdf.left, clientY, { size: 10, bold: true });
  clientY -= 14;
  for (const line of addressLines) {
    pdf.text(line, pdf.left, clientY, { size: 9 });
    clientY -= 12;
  }
  if (order.phone) {
    pdf.text(order.phone, pdf.left, clientY, { size: 9 });
    clientY -= 12;
  }
  pdf.text(order.email, pdf.left, clientY, { size: 9, color: '0.35 0.35 0.35' });

  const rightX = 330;
  pdf.text('LIVRAISON', rightX, infoTop, { size: 8, bold: true, color: '0.45 0.45 0.45' });
  pdf.text(order.shippingMethodLabel || 'Mode de livraison à confirmer', rightX, infoTop - 16, {
    size: 9.5,
    bold: true,
  });
  pdf.text(
    `Paiement : ${order.paymentMethod === 'cod' ? 'à la livraison' : 'Mobile Money'}`,
    rightX,
    infoTop - 32,
    { size: 9 },
  );
  pdf.text(`Statut paiement : ${PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}`, rightX, infoTop - 46, {
    size: 9,
  });
  pdf.text(`Statut commande : ${order.statusLabel}`, rightX, infoTop - 60, { size: 9 });

  pdf.y = Math.min(clientY, infoTop - 78) - 18;

  const drawTableHeader = () => {
    const y = pdf.y;
    pdf.text('ARTICLE', pdf.left, y, { size: 8, bold: true, color: '0.45 0.45 0.45' });
    pdf.rightText('QTÉ', 390, y, { size: 8, bold: true, color: '0.45 0.45 0.45' });
    pdf.rightText('PRIX UNIT.', 475, y, { size: 8, bold: true, color: '0.45 0.45 0.45' });
    pdf.rightText('TOTAL', pdf.right, y, { size: 8, bold: true, color: '0.45 0.45 0.45' });
    pdf.rule(y - 6);
    pdf.y = y - 22;
  };

  drawTableHeader();

  for (const item of order.items) {
    if (pdf.ensureSpace(50)) drawTableHeader();
    const y = pdf.y;
    pdf.text(truncate(item.productName, 44), pdf.left, y, { size: 9.5, bold: true });
    pdf.text(
      [item.productReference, item.variantSize, item.variantColor].filter(Boolean).join(' · '),
      pdf.left,
      y - 12,
      { size: 8, color: '0.4 0.4 0.4' },
    );
    pdf.rightText(String(item.quantity), 390, y, { size: 9.5 });
    pdf.rightText(formatMoney(item.unitPriceCents, order.currency), 475, y, { size: 9 });
    pdf.rightText(formatMoney(item.lineTotalCents, order.currency), pdf.right, y, { size: 9.5, bold: true });
    pdf.y = y - 30;
  }

  pdf.ensureSpace(150);
  pdf.rule(pdf.y + 6);
  pdf.y -= 6;

  const totalRow = (label: string, value: string, bold = false) => {
    const y = pdf.y;
    pdf.text(label, 360, y, { size: bold ? 10 : 9, bold, color: bold ? '0.1 0.1 0.1' : '0.35 0.35 0.35' });
    pdf.rightText(value, pdf.right, y, { size: bold ? 11 : 9, bold });
    pdf.y = y - (bold ? 20 : 15);
  };

  totalRow('Sous-total', formatMoney(order.subtotalCents, order.currency));
  if (order.discountCents > 0) {
    totalRow(order.promoCode ? `Remise (${order.promoCode})` : 'Remise', `-${formatMoney(order.discountCents, order.currency)}`);
  }
  totalRow('Livraison', order.shippingCents > 0 ? formatMoney(order.shippingCents, order.currency) : 'Offerte');
  totalRow('TOTAL', formatMoney(order.totalCents, order.currency), true);

  if (order.customerNote) {
    pdf.y -= 4;
    pdf.text('Note du client', pdf.left, pdf.y, { size: 9, bold: true });
    pdf.y -= 13;
    pdf.paragraph(order.customerNote, { size: 8.5, color: '0.35 0.35 0.35', width: pdf.contentWidth });
  }

  pdf.ensureSpace(70);
  pdf.rule();
  pdf.y -= 14;
  const sellerLine = [sellerName, settings.storeAddress, sellerCity].filter(Boolean).join(' · ');
  if (sellerLine) {
    pdf.paragraph(sellerLine, { size: 8, color: '0.4 0.4 0.4' });
  }
  const contactLine = [settings.contactPhone, settings.contactEmail, settings.whatsappNumber ? `WhatsApp ${settings.whatsappNumber}` : '']
    .filter(Boolean)
    .join(' · ');
  if (contactLine) {
    pdf.paragraph(contactLine, { size: 8, color: '0.4 0.4 0.4' });
  }
  pdf.paragraph(
    'Document non fiscal généré depuis la boutique. Il reprend les informations figées au moment de la commande. Conservez-le avec votre référence de commande.',
    { size: 7.5, color: '0.5 0.5 0.5' },
  );

  return pdf.finish();
}
