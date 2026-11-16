import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductGrid } from '../components/ProductCard';
import { Icon } from '../components/Icon';
import { ErrorState, SectionHeading, SkeletonGrid } from '../components/ui';
import { useApi } from '../lib/hooks';
import { useSite } from '../lib/site';
import { formatPrice } from '../lib/format';
import type { HomePayload } from '../lib/types';
import { Seo } from '../components/ui';


interface Slide {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: { label: string; href: string };
  image: string;
  alt: string;
  contain?: boolean;
  caption: string;
  product?: boolean;
}

function HeroSlider({ payload, currency }: { payload: HomePayload | null; currency: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const settings = payload?.settings;
  const slides: Slide[] = [
    {
      eyebrow: `HP COLLECTION — ${settings?.storeTagline ?? 'Ton style. Tes règles.'}`,
      title: settings?.heroTitle ?? 'Le vestiaire urbain, sans compromis.',
      subtitle:
        settings?.heroSubtitle ?? 'Streetwear, sneakers et accessoires sélectionnés pour composer un style qui vous ressemble.',
      cta: { label: settings?.heroCtaLabel || 'Découvrir la collection', href: settings?.heroCtaHref || '/boutique' },
      image: settings?.heroImageUrl || '/media/hero-hp-collection.jpg',
      alt: 'Mannequin portant un ensemble rouge HP COLLECTION',
      caption: 'Vol. 01',
    },
  ];
  const seen = new Set<string>();
  const picks = [...(payload?.featured ?? []), ...(payload?.newArrivals ?? []), ...(payload?.sale ?? [])].filter((item) => {
    if (!item.image || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  picks.slice(0, 7).forEach((item) => {
    slides.push({
      eyebrow: item.onSale ? 'Promotion' : item.collection || item.category.name,
      title: item.name,
      subtitle: item.shortDescription,
      cta: { label: 'Choisir et commander', href: `/produit/${item.slug}` },
      image: item.image!.url,
      alt: item.image!.alt,
      contain: false,
      caption: item.onSale
        ? `${formatPrice(item.effectivePriceCents, currency)} (au lieu de ${formatPrice(item.priceCents, currency)})`
        : formatPrice(item.effectivePriceCents, currency),
      product: true,
    });
  });
  const count = slides.length;
  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => window.clearInterval(timer);
  }, [paused, count]);
  const slide = slides[index % count];

  return (
    <div
      className="hero-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <section className="hero" key={index} aria-roledescription="carrousel" aria-label={`Diapositive ${(index % count) + 1} sur ${count}`}>
        <div className="hero__copy">
          <p className="eyebrow">{slide.eyebrow}</p>
          <h1>{slide.title}</h1>
          <p className="hero__subtitle">{slide.subtitle}</p>
          <div className="hero__actions">
            <Link to={slide.cta.href} className="btn btn--primary">
              {slide.cta.label}
              <Icon name="arrow-right" size={18} />
            </Link>
            <Link to="/boutique" className="btn btn--text">
              Toute la boutique
            </Link>
          </div>
          <ul className="hero__facts">
            <li>
              <Icon name="truck" size={18} />
              Livraison offerte dès {formatPrice(settings?.freeShippingThresholdCents ?? 5_000_000, currency)}
            </li>
            <li>
              <Icon name="shield" size={18} />
              Paiement à la réception disponible
            </li>
          </ul>
        </div>
        <div className={`hero__media ${slide.contain ? 'hero__media--contain' : ''}`}>
          {slide.product ? (
            <Link to={slide.cta.href} aria-label={`Voir ${slide.title}`} className="hero__media-link">
              <img src={slide.image} alt={slide.alt} width="1000" height="750" />
            </Link>
          ) : (
            <img src={slide.image} alt={slide.alt} width="1000" height="750" />
          )}
          <div className="hero__caption">
            <span>{slide.product ? 'Prix' : 'Sélection'}</span>
            <strong>{slide.caption}</strong>
          </div>
        </div>
      </section>
      {count > 1 ? (
        <div className="hero-nav">
          <button type="button" className="hero-arrow" aria-label="Diapositive précédente" onClick={() => setIndex((index + count - 1) % count)}>
            <Icon name="arrow-left" size={18} />
          </button>
          <button type="button" className="hero-arrow" aria-label="Diapositive suivante" onClick={() => setIndex((index + 1) % count)}>
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
      ) : null}
      {count > 1 ? (
        <div className="hero-dots" role="tablist" aria-label="Choisir une diapositive">
          {slides.map((entry, position) => (
            <button
              key={entry.title}
              type="button"
              role="tab"
              aria-selected={position === index % count}
              aria-label={`Diapositive ${position + 1} : ${entry.title}`}
              className={position === index % count ? 'is-active' : ''}
              onClick={() => setIndex(position)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HomePage() {
  const { data, loading, error, reload } = useApi<HomePayload>('/api/home');
  const { store } = useSite();
  const currency = store.currency;
  const payload = data;

  return (
    <>
      <Seo
        title="Streetwear, sneakers & accessoires"
        description="HP COLLECTION — sélection streetwear, sneakers et accessoires. Ton style. Tes règles."
      />

      <HeroSlider payload={payload} currency={currency} />

      {payload?.settings.demoNotice ? (
        <div className="demo-notice" role="note">
          <strong>Catalogue de démonstration.</strong> <span>{payload.settings.demoNotice}</span>
        </div>
      ) : null}

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      <section className="section section--categories">
        <SectionHeading
          eyebrow="Rayons"
          title="Composer le vestiaire"
          action={
            <Link to="/boutique" className="link-arrow">
              Toute la boutique <Icon name="arrow-right" size={16} />
            </Link>
          }
        />
        {loading && !payload ? (
          <div className="category-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="category-tile skeleton skeleton--tile" />
            ))}
          </div>
        ) : (
          <div className="category-grid">
            {(payload?.groups.length ? payload.groups : payload?.categories.slice(0, 6) ?? []).map((category, index) => {
              const fallback =
                category.slug === 'mode-homme'
                  ? payload?.sections.homme[0]?.image
                  : category.slug === 'mode-femme'
                    ? payload?.sections.femme[0]?.image
                    : category.slug === 'sport-streetwear'
                      ? payload?.sections.sneakers[0]?.image
                      : null;
              const image = category.imageUrl ? { url: category.imageUrl, alt: category.imageAlt || category.name } : fallback;
              const soon = category.productCount === 0;
              return (
                <Link
                  key={category.id}
                  to={`/categories/${category.slug}`}
                  className={`category-tile ${index === 0 ? 'category-tile--wide' : ''}`}
                >
                  {image ? (
                    <img src={image.url} alt={image.alt} loading="lazy" />
                  ) : (
                    <span className="category-tile__placeholder" aria-hidden="true" />
                  )}
                  <span className="category-tile__body">
                    <span className="category-tile__name">{category.name}</span>
                    <span className="category-tile__count">
                      {soon ? 'Bientôt disponible' : `${category.productCount} ${category.productCount > 1 ? 'articles' : 'article'}`}
                    </span>
                    <Icon name="arrow-right" size={18} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Nouveautés"
          title="Dernières arrivées"
          action={
            <Link to="/boutique?sort=newest" className="link-arrow">
              Voir les nouveautés <Icon name="arrow-right" size={16} />
            </Link>
          }
        />
        {loading && !payload ? (
          <SkeletonGrid count={4} />
        ) : payload?.newArrivals.length ? (
          <ProductGrid products={payload.newArrivals} currency={currency} />
        ) : (
          <p className="muted">Les prochaines pièces seront publiées très bientôt.</p>
        )}
      </section>


      {([
        { key: 'homme', eyebrow: 'Rayon', title: 'Mode homme', href: '/boutique?gender=homme', items: payload?.sections.homme ?? [] },
        { key: 'femme', eyebrow: 'Rayon', title: 'Mode femme', href: '/boutique?gender=femme', items: payload?.sections.femme ?? [] },
        { key: 'sneakers', eyebrow: 'Rayon', title: 'Sneakers & basketball', href: '/boutique?category=sneakers', items: payload?.sections.sneakers ?? [] },
      ] as const).map((block) =>
        payload ? (
          <section key={block.key} className="section">
            <SectionHeading
              eyebrow={block.eyebrow}
              title={block.title}
              action={
                block.items.length ? (
                  <Link to={block.href} className="link-arrow">
                    Voir tout <Icon name="arrow-right" size={16} />
                  </Link>
                ) : undefined
              }
            />
            {block.items.length ? (
              <ProductGrid products={block.items} currency={currency} />
            ) : (
              <p className="muted empty-soon">La sélection {block.title.toLowerCase()} arrive bientôt.</p>
            )}
          </section>
        ) : null,
      )}

      {payload?.collections.length ? (
        <section className="section">
          <SectionHeading eyebrow="Collections" title="Collections sélectionnées" />
          <div className="collection-row">
            {payload.collections.map((entry) => (
              <Link key={entry.name} to={`/boutique?collection=${encodeURIComponent(entry.name)}`} className="collection-card">
                {entry.imageUrl ? <img src={entry.imageUrl} alt={entry.imageAlt || entry.name} loading="lazy" /> : null}
                <span className="collection-card__name">{entry.name}</span>
                <span className="collection-card__count">{entry.productCount} articles</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="editorial">
        <div className="editorial__media">
          <img src="/media/editorial-vestiaire.svg" alt="Composition éditoriale du vestiaire HP COLLECTION" loading="lazy" />
        </div>
        <div className="editorial__copy">
          <p className="eyebrow">Le vestiaire</p>
          <h2>Des pièces qui se portent, se superposent, se gardent.</h2>
          <p>
            Nous privilégions les coupes nettes, les matières robustes et les couleurs faciles à associer. Une
            sélection resserrée, pensée pour composer une silhouette cohérente plutôt qu’accumuler les tendances.
          </p>
          <Link to="/boutique" className="btn btn--ghost">
            Explorer la sélection
          </Link>
        </div>
      </section>

      {payload?.bestSellers.length ? (
        <section className="section">
          <SectionHeading eyebrow="Selon les commandes" title="Les plus demandés" />
          <ProductGrid products={payload.bestSellers} currency={currency} />
        </section>
      ) : null}

      {payload?.sale.length ? (
        <section className="section section--sale">
          <SectionHeading
            eyebrow="Promotions en cours"
            title="Sélection à prix réduit"
            action={
              <Link to="/boutique?onSale=true" className="link-arrow">
                Toutes les promotions <Icon name="arrow-right" size={16} />
              </Link>
            }
          />
          <ProductGrid products={payload.sale} currency={currency} />
        </section>
      ) : null}

      <section className="service-strip" aria-label="Services">
        <div>
          <Icon name="truck" size={22} />
          <h3>Livraison suivie</h3>
          <p>Expédition sous 1 à 2 jours ouvrés, suivi disponible en ligne avec votre référence.</p>
        </div>
        <div>
          <Icon name="shield" size={22} />
          <h3>Paiement sécurisé</h3>
          <p>Paiement à la réception disponible. Aucune donnée bancaire n’est stockée.</p>
        </div>
        <div>
          <Icon name="return" size={22} />
          <h3>Retours simples</h3>
          <p>14 jours pour changer d’avis, selon les conditions générales de vente.</p>
        </div>
      </section>
    </>
  );
}
