import { Link } from 'react-router-dom';
import { Seo } from '../components/ui';

export function NotFoundPage() {
  return (
    <>
      <Seo title="Page introuvable" />
      <div className="page-shell page-404">
        <p className="eyebrow">Erreur 404</p>
        <h1>Cette page n’existe pas.</h1>
        <p>Le lien est peut-être obsolète, ou l’article a été retiré du catalogue.</p>
        <div className="page-404__actions">
          <Link to="/" className="btn btn--primary">
            Retour à l’accueil
          </Link>
          <Link to="/boutique" className="btn btn--ghost">
            Voir la boutique
          </Link>
        </div>
      </div>
    </>
  );
}
