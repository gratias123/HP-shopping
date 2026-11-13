import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      navigate(redirect || (user.isAdmin ? '/admin' : '/compte'), { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Connexion impossible. Merci de réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Seo title="Connexion" />
      <div className="auth-layout">
        <div className="auth-layout__visual" aria-hidden="true">
          <img src="/media/hero-editorial.svg" alt="" />
          <p>Ton style. Tes règles.</p>
        </div>
        <div className="auth-layout__form">
          <p className="eyebrow">Espace client</p>
          <h1>Connexion</h1>
          <p className="auth-layout__intro">
            Retrouvez vos commandes, vos favoris et vos informations de livraison.
          </p>
          <form onSubmit={submit} className="stack-form">
            <label className="field">
              <span>Adresse e-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="field">
              <span>Mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                minLength={1}
              />
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
          <p className="auth-layout__switch">
            Nouveau chez HP COLLECTION ? <Link to={`/inscription${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>Créer un compte</Link>
          </p>
          <p className="auth-layout__legal muted">
            Vos identifiants sont transmis de manière sécurisée. Les sessions sont protégées par un cookie HTTP-only.
          </p>
        </div>
      </div>
    </>
  );
}
