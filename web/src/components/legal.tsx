import type { ReactNode } from 'react';

/**
 * Affiche une valeur légale sans jamais inventer de donnée : tant que
 * l’exploitant n’a pas renseigné le champ dans l’administration, le repère
 * visible [À COMPLÉTER] reste affiché.
 */
export function LegalValue({ value, fallback = '[À COMPLÉTER]' }: { value: string | null | undefined; fallback?: string }) {
  const text = (value ?? '').trim();
  return text ? <>{text}</> : <span className="legal-missing">{fallback}</span>;
}

export function LegalContact({
  email,
  phone,
  address,
}: {
  email: string;
  phone: string;
  address?: ReactNode;
}) {
  return (
    <>
      <LegalValue value={email} fallback="[E-MAIL À COMPLÉTER]" />
      {phone ? <> — {phone}</> : <> — [TÉLÉPHONE À COMPLÉTER]</>}
      {address ? <> — {address}</> : null}
    </>
  );
}
