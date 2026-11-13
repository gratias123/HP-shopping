import { Link } from 'react-router-dom';
import { useSite } from '../lib/site';
import { formatPrice } from '../lib/format';

const CATEGORY_LINKS = [
  { label: 'Ensembles & survêtements', slug: 'ensembles-jogging' },
  { label: 'Sneakers lifestyle', slug: 'sneakers' },
  { label: 'Basketball', slug: 'basketball' },
  { label: 'T-shirts & polos', slug: 'tshirts' },
  { label: 'Jeans & pantalons', slug: 'jeans-pantalons' },
  { label: 'Sweats & hoodies', slug: 'sweats-hoodies' },
  { label: 'Vestes & varsity', slug: 'vestes-streetwear' },
  { label: 'Accessoires', slug: 'accessoires' },
];

export function Footer() {
  const { settings, store } = useSite();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <span className="logo logo--footer">
            <span className="logo__mark">HP</span>
            <span className="logo__word">COLLECTION</span>
          </span>
          <p className="site-footer__tagline">{settings.storeTagline}</p>
          <p className="site-footer__about">
            Sélection streetwear, sneakers et accessoires. Des pièces choisies pour durer, une expérience simple du
            premier clic à la livraison.
          </p>
          <div className="site-footer__socials">
            {settings.instagramUrl ? (
              <a href={settings.instagramUrl} className="site-footer__social" rel="noreferrer noopener" target="_blank">
                Instagram
              </a>
            ) : null}
            {settings.facebookUrl ? (
              <a href={settings.facebookUrl} className="site-footer__social" rel="noreferrer noopener" target="_blank">
                Facebook
              </a>
            ) : null}
            {settings.tiktokUrl ? (
              <a href={settings.tiktokUrl} className="site-footer__social" rel="noreferrer noopener" target="_blank">
                TikTok
              </a>
            ) : null}
            {settings.whatsappNumber ? (
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`}
                className="site-footer__social"
                rel="noreferrer noopener"
                target="_blank"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>

        <nav className="site-footer__col" aria-label="Catégories">
          <h2>Boutique</h2>
          {CATEGORY_LINKS.map((category) => (
            <Link key={category.slug} to={`/categories/${category.slug}`}>
              {category.label}
            </Link>
          ))}
        </nav>

        <nav className="site-footer__col" aria-label="Aide">
          <h2>Aide</h2>
          <Link to="/livraison">Livraison & retours</Link>
          <Link to="/faq">Questions fréquentes</Link>
          <Link to="/suivi">Suivre ma commande</Link>
          <Link to="/contact">Nous contacter</Link>
          <Link to="/compte">Mon compte</Link>
        </nav>

        <div className="site-footer__col">
          <h2>Informations</h2>
          <Link to="/cgv">Conditions générales de vente</Link>
          <Link to="/confidentialite">Politique de confidentialité</Link>
          <Link to="/mentions-legales">Mentions légales</Link>
          <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          {settings.contactPhone ? <a href={`tel:${settings.contactPhone.replace(/\s/g, '')}`}>{settings.contactPhone}</a> : null}
          {settings.storeAddress ? (
            <p className="site-footer__address">
              {settings.storeAddress}
              <br />
              {settings.storeCity}, {settings.storeCountry}
            </p>
          ) : null}
          <p className="site-footer__shipping">
            Livraison offerte dès {formatPrice(settings.freeShippingThresholdCents, store.currency)} — conditions
            précisées au moment du paiement.
          </p>
        </div>
      </div>

      <div className="site-footer__legal">
        <p>© {year} {settings.storeName}. Tous droits réservés.</p>
        <p className="site-footer__payments">
          Paiement à la réception
          {store.mobileMoneyEnabled ? ' · Mobile Money' : ' · Mobile Money non configuré'}
        </p>
      </div>
    </footer>
  );
}
