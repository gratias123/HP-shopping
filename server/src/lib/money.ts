import { config } from '../config.js';

const xofFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Formate un montant interne en centimes pour les messages serveur. */
export function formatMoney(cents: number, currency = config.currency): string {
  if (currency.toUpperCase() === 'XOF') {
    return `${xofFormatter.format(cents / 100)} FCFA`;
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}
