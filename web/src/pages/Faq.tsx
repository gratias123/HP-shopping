import { Link } from 'react-router-dom';
import { Breadcrumbs, Seo } from '../components/ui';

const FAQ = [
  {
    question: 'Quels sont les délais de préparation et de livraison ?',
    answer:
      'Les commandes sont préparées sous 1 à 2 jours ouvrés. Les délais de transport dépendent du mode choisi et sont affichés au moment du paiement. Le statut est mis à jour dans la page de suivi dès l’expédition.',
  },
  {
    question: 'Quels moyens de paiement acceptez-vous ?',
    answer:
      'Le paiement à la réception est disponible lorsque l’option est activée par la boutique. Le paiement Mobile Money sera proposé dès qu’un prestataire compatible avec le Bénin sera configuré et validé côté serveur. Aucune donnée de paiement sensible n’est stockée sur le site.',
  },
  {
    question: 'Comment suivre ma commande ?',
    answer:
      'Rendez-vous sur la page « Suivi » avec votre référence de commande (format HP-XXXXXX) et l’adresse e-mail utilisée lors de l’achat. Si vous avez un compte, l’historique est aussi disponible dans votre espace client.',
  },
  {
    question: 'Puis-je modifier ou annuler ma commande ?',
    answer:
      'Tant que la commande n’est pas expédiée, contactez-nous au plus vite en indiquant sa référence. Une fois expédiée, notre politique de retour commerciale s’applique dans les 14 jours suivant la réception, sans préjudice des droits légaux applicables.',
  },
  {
    question: 'Comment choisir la bonne taille ?',
    answer:
      'Les tailles disponibles et leur stock sont indiqués sur chaque fiche produit. En cas de doute entre deux tailles, privilégiez la taille supérieure pour les coupes amples. Notre équipe peut vous conseiller par e-mail.',
  },
  {
    question: 'Les articles vus sur le site sont-ils réellement disponibles ?',
    answer:
      'Le catalogue livré avec cette démonstration contient des articles fictifs identifiés « DEMO ». Ils ne sont pas réellement en vente. Une fois le catalogue remplacé depuis l’administration, les fiches correspondent aux articles réellement proposés.',
  },
  {
    question: 'Comment sont protégées mes données ?',
    answer:
      'Les mots de passe sont stockés sous forme de condensat (scrypt), les sessions utilisent des cookies HTTP-only, et les opérations sensibles sont contrôlées côté serveur. Consultez la politique de confidentialité pour le détail.',
  },
];

export function FaqPage() {
  return (
    <>
      <Seo title="FAQ" description="Questions fréquentes sur les commandes, livraisons et retours." />
      <div className="page-shell narrow">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'FAQ' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Aide</p>
            <h1>Questions fréquentes</h1>
            <p className="page-heading__intro">
              Les réponses aux demandes les plus courantes. Pour tout le reste, <Link to="/contact">écrivez-nous</Link>.
            </p>
          </div>
        </header>
        <div className="faq">
          {FAQ.map((entry, index) => (
            <details key={entry.question} open={index === 0}>
              <summary>{entry.question}</summary>
              <p>{entry.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
