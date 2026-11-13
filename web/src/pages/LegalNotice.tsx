import { Link } from 'react-router-dom';
import { LegalValue } from '../components/legal';
import { Breadcrumbs, Seo } from '../components/ui';
import { formatDate } from '../lib/format';
import { useSite } from '../lib/site';

export function LegalNoticePage() {
  const { settings } = useSite();
  const legalAddress =
    settings.legalAddress ||
    [settings.storeAddress, settings.storeCity, settings.storeCountry].filter(Boolean).join(', ');

  return (
    <>
      <Seo title="Mentions légales" />
      <div className="page-shell narrow">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Mentions légales' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Informations légales</p>
            <h1>Mentions légales</h1>
            <p className="muted">
              {settings.legalUpdatedAt
                ? `Dernière mise à jour : ${formatDate(settings.legalUpdatedAt)}`
                : 'Document de base à compléter par l’exploitant avant publication.'}
            </p>
          </div>
        </header>

        <div className="prose">
          <div className="notice">
            <strong>À compléter avant publication.</strong> Les informations entre crochets sont renseignées depuis
            l’administration, dans « Paramètres → Identité légale & hébergement ». Aucune donnée d’entreprise n’est
            inventée par la boutique.
          </div>

          <h2>Éditeur du site</h2>
          <p>
            Le site {settings.storeName} est édité par{' '}
            <LegalValue value={settings.legalName} fallback="[RAISON SOCIALE À COMPLÉTER]" />,{' '}
            <LegalValue value={settings.legalForm} fallback="[FORME JURIDIQUE À COMPLÉTER]" />.
          </p>
          <p>
            Siège social : <LegalValue value={legalAddress} fallback="[ADRESSE COMPLÈTE À COMPLÉTER]" />.
            <br />
            RCCM : <LegalValue value={settings.legalRccm} fallback="[NUMÉRO RCCM À COMPLÉTER]" /> — IFU :{' '}
            <LegalValue value={settings.legalIfu} fallback="[NUMÉRO IFU À COMPLÉTER]" /> — TVA :{' '}
            <LegalValue value={settings.legalVatNumber} fallback="[À COMPLÉTER LE CAS ÉCHÉANT]" />.
          </p>
          <p>
            Contact : <LegalValue value={settings.contactEmail} fallback="[E-MAIL À COMPLÉTER]" /> —{' '}
            <LegalValue value={settings.contactPhone} fallback="[TÉLÉPHONE À COMPLÉTER]" />
            {settings.whatsappNumber ? <> — WhatsApp : {settings.whatsappNumber}</> : null}.
          </p>
          <p>
            Directeur de la publication :{' '}
            <LegalValue value={settings.legalPublisher} fallback="[NOM ET QUALITÉ À COMPLÉTER]" />.
          </p>

          <h2>Hébergement</h2>
          <p>
            Le site est hébergé par <LegalValue value={settings.hostName} fallback="[HÉBERGEUR À COMPLÉTER]" />.
            <br />
            Adresse : <LegalValue value={settings.hostAddress} fallback="[ADRESSE DE L’HÉBERGEUR À COMPLÉTER]" />.
            <br />
            Téléphone : <LegalValue value={settings.hostPhone} fallback="[TÉLÉPHONE DE L’HÉBERGEUR À COMPLÉTER]" /> —
            e-mail : <LegalValue value={settings.hostEmail} fallback="[E-MAIL DE L’HÉBERGEUR À COMPLÉTER]" />.
          </p>

          <h2>Activité</h2>
          <p>
            {settings.storeName} propose à la vente des vêtements, chaussures et accessoires. Les conditions de vente,
            de livraison et de retour sont précisées dans les{' '}
            <Link to="/cgv">conditions générales de vente</Link> et sur la page{' '}
            <Link to="/livraison">Livraison & retours</Link>.
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>
            L’ensemble des contenus du site (textes, éléments graphiques, photographies, marques et logos) est protégé
            par les droits de propriété intellectuelle applicables. Toute reproduction ou utilisation non autorisée est
            interdite. Les photographies de démonstration et leurs crédits sont documentés dans le fichier
            <code> web/public/media/CREDITS.md</code> du projet.
          </p>

          <h2>Données personnelles et cookies</h2>
          <p>
            Le traitement des données personnelles est décrit dans la{' '}
            <Link to="/confidentialite">politique de confidentialité</Link>. Le site n’utilise que les cookies et
            stockages strictement nécessaires à la session, à la sécurité des formulaires, au panier et aux favoris.
          </p>

          <h2>Réclamations</h2>
          <p>
            Pour toute réclamation, utilisez la <Link to="/contact">page de contact</Link> ou écrivez à{' '}
            <LegalValue value={settings.contactEmail} fallback="[E-MAIL DU SERVICE CLIENT À COMPLÉTER]" />. À défaut de
            solution amiable, le client peut s’adresser à l’autorité ou à l’association de protection des consommateurs
            compétente au Bénin :{' '}
            <LegalValue
              value={settings.legalComplaintAuthority}
              fallback="[NOM ET COORDONNÉES DE L’AUTORITÉ À COMPLÉTER]"
            />
            .
          </p>
        </div>
      </div>
    </>
  );
}
