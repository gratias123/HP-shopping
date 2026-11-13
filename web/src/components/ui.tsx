import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ORDER_STATUS_SHORT, statusTone } from '../lib/format';
import { Icon } from './Icon';

function setMeta(selector: string, content: string | undefined) {
  if (!content) return;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    if (selector.includes('property=')) {
      element.setAttribute('property', selector.split('property="')[1]?.split('"')[0] ?? '');
    } else {
      element.setAttribute('name', selector.split('name="')[1]?.split('"')[0] ?? '');
    }
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function Seo({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · HP COLLECTION` : 'HP COLLECTION — Streetwear, sneakers & accessoires';
    document.title = fullTitle;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', window.location.href);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }, [title, description]);
  return null;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge badge--${statusTone(status)}`}>{label ?? ORDER_STATUS_SHORT[status] ?? status}</span>;
}

export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-label={label}>
      <span className="spinner__ring" aria-hidden="true" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="error-state" role="alert">
      <h3>Impossible d’afficher cette page</h3>
      <p>{error.message}</p>
      {onRetry ? (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="breadcrumbs" aria-label="Fil d’Ariane">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href && index < items.length - 1 ? <a href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const windowed = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === pages || Math.abs(candidate - page) <= 1,
  );
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="pagination__nav" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <Icon name="arrow-left" size={16} /> <span>Précédent</span>
      </button>
      <ul>
        {windowed.map((candidate, index) => (
          <li key={candidate} className={index > 0 && candidate - windowed[index - 1] > 1 ? 'pagination__gap' : undefined}>
            {index > 0 && candidate - windowed[index - 1] > 1 ? <span aria-hidden="true">…</span> : null}
            <button
              type="button"
              className={candidate === page ? 'is-current' : undefined}
              aria-current={candidate === page ? 'page' : undefined}
              onClick={() => onChange(candidate)}
            >
              {candidate}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="pagination__nav" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        <span>Suivant</span> <Icon name="arrow-right" size={16} />
      </button>
    </nav>
  );
}

export function Price({
  priceCents,
  compareAtCents,
  currency,
  size = 'md',
}: {
  priceCents: number;
  compareAtCents?: number | null;
  currency: string;
  size?: 'md' | 'lg';
}) {
  return (
    <p className={`price ${size === 'lg' ? 'price--lg' : ''} ${compareAtCents ? 'price--sale' : ''}`}>
      <span className="price__current">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(priceCents / 100)}</span>
      {compareAtCents && compareAtCents > priceCents ? (
        <s className="price__compare">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(compareAtCents / 100)}</s>
      ) : null}
    </p>
  );
}

export function QuantityStepper({
  value,
  min = 1,
  max = 10,
  onChange,
  ariaLabel = 'Quantité',
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <div className="stepper" role="group" aria-label={ariaLabel}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Réduire la quantité">
        <Icon name="minus" size={14} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(parsed)) onChange(clamp(parsed));
        }}
        aria-label={ariaLabel}
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Augmenter la quantité">
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="product-card product-card--skeleton">
          <div className="skeleton skeleton--media" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {action}
    </header>
  );
}
