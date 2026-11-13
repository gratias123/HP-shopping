import { Link } from 'react-router-dom';
import { Breadcrumbs, Seo } from '../components/ui';

export function ShippingPage() {
  return (
    <>
      <Seo title="Livraison & retours" />
      <div className="page-shell narrow">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Livraison & retours' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Informations pratiques</p>
            <h1>Livraison & retours</h1>
          </div>
        </header>

        <div className="prose">
          <h2>Zones desservies</h2>
          <p>
            La boutique livre au Bénin. Les zones, modes, tarifs et délais réellement activés sont configurés par
            l’administrateur et affichés à l’étape « Livraison » du paiement. Les tarifs de démonstration doivent être
            remplacés par les conditions réelles de la boutique avant publication.
          </p>

          <h2>Frais et délais</h2>
          <p>
            Les frais de livraison sont calculés automatiquement selon la destination et le mode choisi. Ils sont
            indiqués avant la validation de la commande, sans surprise. La livraison standard est offerte au-delà d’un
            montant minimum précisé sur le site ; ce seuil peut évoluer et reste celui affiché au moment de l’achat.
          </p>
          <p>
            Les commandes sont préparées sous 1 à 2 jours ouvrés. Les délais de transport sont indicatifs et courent à
            partir de l’expédition.
          </p>

          <h2>Suivi</h2>
          <p>
            Dès l’expédition, le statut de votre commande est mis à jour. Vous pouvez le consulter depuis{' '}
            <Link to="/suivi">la page de suivi</Link> avec votre référence et votre e-mail, ou depuis votre compte.
          </p>

          <h2>Retours et rétractation</h2>
          <p>
            Nous appliquons une politique de retour commerciale de 14 jours à compter de la réception, sans préjudice
            des droits légaux applicables. Les articles doivent être non portés, non lavés et dans leur état et
            emballage d’origine. Les frais de retour sont à la charge du client, sauf disposition légale contraire ou
            erreur de notre part. Cette politique doit être validée par l’exploitant avant publication.
          </p>
          <p>
            Pour initier un retour, écrivez-nous via la <Link to="/contact">page de contact</Link> en indiquant votre
            référence de commande et l’article concerné. Le remboursement intervient après réception et contrôle du
            retour, sur le moyen de paiement d’origine.
          </p>

          <h2>Articles endommagés ou erreur</h2>
          <p>
            Vérifiez votre colis à la réception. En cas de produit endommagé ou d’erreur de préparation, contactez-nous
            sous 48 heures avec des photos et votre référence de commande afin que nous trouvions une solution
            rapidement.
          </p>

          <h2>Douane et taxes</h2>
          <p>
            Les livraisons sont proposées au Bénin. Si une expédition internationale est activée ultérieurement,
            d’éventuels droits ou taxes locales pourront s’appliquer à la réception ; ils ne seraient pas inclus dans le
            prix payé à la boutique.
          </p>
        </div>
      </div>
    </>
  );
}
