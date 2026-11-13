import { LegalValue } from '../components/legal';
import { Breadcrumbs, Seo } from '../components/ui';
import { formatDate } from '../lib/format';
import { useSite } from '../lib/site';

export function PrivacyPage() {
  const { settings } = useSite();
  const legalAddress =
    settings.legalAddress ||
    [settings.storeAddress, settings.storeCity, settings.storeCountry].filter(Boolean).join(', ');

  return (
    <>
      <Seo title="Politique de confidentialité" />
      <div className="page-shell narrow">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Confidentialité' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Vos données</p>
            <h1>Politique de confidentialité</h1>
            <p className="muted">
              {settings.legalUpdatedAt
                ? `Dernière mise à jour : ${formatDate(settings.legalUpdatedAt)}`
                : 'Document de base à compléter par le responsable de traitement.'}
            </p>
          </div>
        </header>

        <div className="prose">
          <div className="notice">
            <strong>À compléter.</strong> Identité et coordonnées du responsable de traitement, durées de conservation,
            sous-traitants (hébergement, paiement, e-mail) et coordonnées du délégué à la protection des données le cas
            échéant. Ce document doit être adapté au droit béninois, notamment à la loi n° 2017-20 portant code du
            numérique, et validé avant la mise en production.
          </div>

          <h2>Responsable du traitement</h2>
          <p>
            Le responsable du traitement est{' '}
            <LegalValue value={settings.legalName} fallback="[RAISON SOCIALE À COMPLÉTER]" />, dont l’adresse est{' '}
            <LegalValue value={legalAddress} fallback="[ADRESSE À COMPLÉTER]" />, joignable à l’adresse{' '}
            <LegalValue value={settings.contactEmail} fallback="[E-MAIL À COMPLÉTER]" />. Aucun délégué à la protection
            des données n’a été désigné à ce stade, sauf mention contraire.
          </p>

          <h2>Données collectées</h2>
          <ul>
            <li>
              <strong>Compte client :</strong> nom, adresse e-mail, mot de passe (stocké sous forme de condensat
              scrypt), téléphone facultatif.
            </li>
            <li>
              <strong>Commandes :</strong> coordonnées de livraison, contenu de la commande, montants, statut, échanges
              de support. Les données de paiement sensibles ne sont jamais stockées par la boutique ; un éventuel
              prestataire Mobile Money traite ces informations sous sa propre responsabilité.
            </li>
            <li>
              <strong>Navigation :</strong> panier et favoris conservés localement dans votre navigateur ; cookies
              strictement nécessaires à la session et à la protection contre la falsification de requête (CSRF).
            </li>
            <li>
              <strong>Contact :</strong> nom, e-mail, sujet et message envoyés via le formulaire.
            </li>
          </ul>

          <h2>Finalités et bases légales</h2>
          <p>
            Les données sont utilisées pour exécuter vos commandes (exécution du contrat), gérer votre compte et notre
            relation client (intérêt légitime), respecter nos obligations comptables et légales (obligation légale), et
            assurer la sécurité du site (intérêt légitime). Aucune prospection commerciale n’est réalisée sans votre
            consentement préalable.
          </p>

          <h2>Durées de conservation</h2>
          <p>
            Les données de compte sont conservées tant que le compte est actif, puis supprimées ou anonymisées après une
            période d’inactivité raisonnable. Les pièces comptables et factures sont conservées pendant la durée légale
            applicable. Les messages de contact sont conservés le temps nécessaire au traitement de la demande.
            [PRÉCISER LES DURÉES EXACTES.]
          </p>

          <h2>Destinataires et sous-traitants</h2>
          <p>
            Les données sont accessibles aux personnes habilitées de la boutique et, dans la limite nécessaire, aux
            prestataires suivants : hébergement{' '}
            <LegalValue value={settings.hostName} fallback="[PRESTATAIRE D’HÉBERGEMENT À COMPLÉTER]" />, transporteur,
            prestataire de paiement [NOM, LE CAS ÉCHÉANT], service d’e-mailing [LE CAS ÉCHÉANT]. Tout prestataire agit
            sur instruction et présente des garanties appropriées.
          </p>

          <h2>Transferts hors du Bénin</h2>
          <p>
            Si un prestataire est situé hors du Bénin, le transfert doit être encadré par des garanties appropriées et
            conforme à la réglementation applicable. [PRÉCISER LES PAYS ET GARANTIES LE CAS ÉCHÉANT.]
          </p>

          <h2>Vos droits</h2>
          <p>
            Vous disposez des droits prévus par la réglementation applicable, notamment l’accès, la rectification,
            l’effacement, la limitation et l’opposition. Vous pouvez exercer ces droits en écrivant à{' '}
            <LegalValue value={settings.contactEmail} fallback="[E-MAIL À COMPLÉTER]" />. Vous pouvez également
            introduire une réclamation auprès de l’Autorité de protection
            des données personnelles (APDP) du Bénin ou de l’autorité compétente.
          </p>

          <h2>Sécurité</h2>
          <p>
            La boutique met en œuvre des mesures techniques et organisationnelles adaptées : mots de passe hachés avec
            scrypt, sessions signées et cookies HTTP-only, jetons CSRF, contrôle des autorisations côté serveur, accès
            administrateur restreint, validation des fichiers téléversés et journalisation des opérations sensibles.
          </p>

          <h2>Cookies et stockage local</h2>
          <p>
            Le site utilise un cookie de session indispensable à l’authentification, un cookie CSRF de sécurité, ainsi
            que le stockage local du navigateur pour le panier et les favoris. Aucun cookie publicitaire ou de mesure
            d’audience tiers n’est déposé par défaut.
          </p>
        </div>
      </div>
    </>
  );
}
