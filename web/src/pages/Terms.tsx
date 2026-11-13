import { Link } from 'react-router-dom';
import { LegalValue } from '../components/legal';
import { Breadcrumbs, Seo } from '../components/ui';
import { formatDate } from '../lib/format';
import { useSite } from '../lib/site';

export function TermsPage() {
  const { settings } = useSite();
  const legalAddress =
    settings.legalAddress ||
    [settings.storeAddress, settings.storeCity, settings.storeCountry].filter(Boolean).join(', ');

  return (
    <>
      <Seo title="Conditions générales de vente" />
      <div className="page-shell narrow">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'CGV' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Cadre juridique</p>
            <h1>Conditions générales de vente</h1>
            <p className="muted">
              Dernière mise à jour : {settings.legalUpdatedAt ? formatDate(settings.legalUpdatedAt) : 'à compléter par le vendeur avant mise en ligne.'}
            </p>
          </div>
        </header>

        <div className="prose">
          <div className="notice">
            <strong>À compléter avant publication.</strong> Les champs entre crochets doivent être renseignés par
            l’exploitant de la boutique (raison sociale, adresse, immatriculation, contact, autorité de réclamation).
            Ce document constitue une base de travail et ne remplace pas une validation juridique adaptée à votre
            activité et au droit béninois.
          </div>

          <h2>1. Identification du vendeur</h2>
          <p>
            La boutique {settings.storeName} est éditée par{' '}
            <LegalValue value={settings.legalName} fallback="[RAISON SOCIALE À COMPLÉTER]" />,{' '}
            <LegalValue value={settings.legalForm} fallback="[FORME JURIDIQUE À COMPLÉTER]" />, immatriculée sous le
            numéro RCCM <LegalValue value={settings.legalRccm} fallback="[NUMÉRO RCCM À COMPLÉTER]" /> et identifiée
            sous le numéro IFU <LegalValue value={settings.legalIfu} fallback="[NUMÉRO IFU À COMPLÉTER]" />, dont le
            siège social est situé <LegalValue value={legalAddress} fallback="[ADRESSE COMPLÈTE À COMPLÉTER]" />.
            Contact : <LegalValue value={settings.contactEmail} fallback="[E-MAIL À COMPLÉTER]" /> —{' '}
            <LegalValue value={settings.contactPhone} fallback="[TÉLÉPHONE À COMPLÉTER]" />
            {settings.whatsappNumber ? <> — WhatsApp : {settings.whatsappNumber}</> : null}. Numéro de TVA :{' '}
            <LegalValue value={settings.legalVatNumber} fallback="[À COMPLÉTER LE CAS ÉCHÉANT]" />.
          </p>

          <h2>2. Objet et champ d’application</h2>
          <p>
            Les présentes conditions régissent les ventes de vêtements, chaussures et accessoires conclues à distance
            via le site HP COLLECTION. Toute commande implique l’acceptation sans réserve des présentes conditions. Le
            client déclare être majeur et disposer de la capacité juridique nécessaire.
          </p>

          <h2>3. Produits et disponibilité</h2>
          <p>
            Les produits sont décrits avec la plus grande exactitude possible. Les photographies et visuels ont une
            valeur indicative ; les différences de rendu liées aux écrans ne peuvent engager la responsabilité du
            vendeur. Les offres sont valables dans la limite des stocks disponibles. En cas d’indisponibilité après
            commande, le client est informé et remboursé sans délai.
          </p>
          <p>
            Le catalogue livré avec cette installation contient des articles de démonstration, identifiés comme tels,
            qui ne sont pas proposés à la vente.
          </p>

          <h2>4. Prix</h2>
          <p>
            Les prix sont indiqués en francs CFA (XOF), toutes taxes comprises lorsqu’elles sont applicables, hors frais
            de livraison. Les frais de livraison sont affichés avant validation de la commande. Le vendeur se réserve
            le droit de modifier ses prix à tout moment, le prix applicable étant celui affiché au moment de la
            validation.
          </p>

          <h2>5. Commande</h2>
          <p>
            La commande est validée après acceptation des présentes conditions et confirmation du récapitulatif. La
            référence de commande est affichée immédiatement et permet le suivi en ligne. Le vendeur se réserve le
            droit de refuser une commande en cas de litige antérieur ou de suspicion de fraude.
          </p>

          <h2>6. Paiement</h2>
          <p>
            Les moyens de paiement proposés sont ceux affichés lors de la commande : paiement à la réception et, lorsque
            l’intégration est effectivement configurée, Mobile Money via un prestataire compatible avec le Bénin. Aucun
            paiement en ligne n’est déclaré réussi avant confirmation fiable du prestataire. Les données de paiement
            sensibles ne sont jamais stockées par la boutique. Les transactions en ligne sont traitées par le
            prestataire et soumises à ses conditions.
          </p>

          <h2>7. Livraison</h2>
          <p>
            Les zones desservies, modes, délais et frais sont précisés sur la page{' '}
            <Link to="/livraison">Livraison & retours</Link>. Les délais sont indicatifs. En cas de retard important,
            le client peut contacter le service client afin de trouver une solution. Les risques sont transférés au
            client à la remise du colis.
          </p>

          <h2>8. Retours et rétractation</h2>
          <p>
            La boutique applique une politique de retour commerciale de 14 jours à compter de la réception, sans
            préjudice des droits légaux applicables au Bénin. Le client doit informer le vendeur par e-mail ou via la
            page de contact. Les articles doivent être retournés non portés, non lavés, dans leur état d’origine. Les
            frais de retour sont à la charge du client sauf mention contraire ou erreur du vendeur. Le remboursement
            intervient après réception et contrôle du retour, sur le moyen de paiement d’origine.
          </p>
          <p>
            Les produits personnalisés, scellés ou pour des raisons d’hygiène (sous-vêtements, etc.) peuvent être
            exclus de cette politique lorsqu’une disposition légale ou une mention expresse le permet. Faites valider
            cette clause avant publication.
          </p>

          <h2>9. Garanties</h2>
          <p>
            Les produits bénéficient de la garantie légale de conformité et de la garantie contre les vices cachés,
            dans les conditions prévues par la loi. Pour mettre en œuvre une garantie, contactez le service client avec
            votre preuve d’achat.
          </p>

          <h2>10. Responsabilité</h2>
          <p>
            Le vendeur ne peut être tenu responsable des dommages résultant d’une mauvaise utilisation des produits,
            d’une indisponibilité temporaire du site ou d’un cas de force majeure. Les liens vers des sites tiers
            n’engagent pas la responsabilité du vendeur.
          </p>

          <h2>11. Données personnelles</h2>
          <p>
            Les données sont traitées conformément à la <Link to="/confidentialite">politique de confidentialité</Link>.
          </p>

          <h2>12. Réclamations et médiation</h2>
          <p>
            Toute réclamation doit être adressée à{' '}
            <LegalValue value={settings.contactEmail} fallback="[E-MAIL DU SERVICE CLIENT À COMPLÉTER]" />. À défaut de
            solution amiable, le client peut s’adresser à l’autorité ou à l’association de protection des
            consommateurs compétente au Bénin :{' '}
            <LegalValue
              value={settings.legalComplaintAuthority}
              fallback="[NOM ET COORDONNÉES DE L’AUTORITÉ À COMPLÉTER]"
            />
            . Aucune procédure de médiation ne doit être présentée comme agréée tant qu’elle n’a pas été effectivement
            mise en place.
          </p>

          <h2>13. Droit applicable</h2>
          <p>
            Les présentes conditions sont soumises au droit béninois. Les juridictions compétentes sont celles de
            Cotonou, sous réserve des règles protectrices applicables aux consommateurs. Faites valider cette clause
            par un conseil juridique avant publication.
          </p>
        </div>
      </div>
    </>
  );
}
