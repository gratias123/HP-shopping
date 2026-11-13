import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (form.password !== form.confirm) {
      setFieldErrors({ confirm: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (!acceptTerms) {
      setError('Vous devez accepter les conditions générales de vente.');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        acceptTerms,
      });
      navigate(redirect || '/compte', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fields);
      } else {
        setError('Inscription impossible. Merci de réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Seo title="Créer un compte" />
      <div className="auth-layout">
        <div className="auth-layout__visual" aria-hidden="true">
          <img src="/media/editorial-vestiaire.svg" alt="" />
          <p>Votre vestiaire, vos favoris, votre suivi.</p>
        </div>
        <div className="auth-layout__form">
          <p className="eyebrow">Espace client</p>
          <h1>Créer un compte</h1>
          <p className="auth-layout__intro">
            Suivez vos commandes, conservez vos favoris et retrouvez vos adresses plus vite.
          </p>
          <form onSubmit={submit} className="stack-form" noValidate>
            <label className="field">
              <span>Nom complet</span>
              <input
                value={form.fullName}
                onChange={(event) => update('fullName', event.target.value)}
                required
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.fullName)}
              />
              {fieldErrors.fullName ? <em className="field-error">{fieldErrors.fullName}</em> : null}
            </label>
            <label className="field">
              <span>Adresse e-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                required
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email ? <em className="field-error">{fieldErrors.email}</em> : null}
            </label>
            <label className="field">
              <span>Téléphone (facultatif)</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone ? <em className="field-error">{fieldErrors.phone}</em> : null}
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Mot de passe</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                {fieldErrors.password ? <em className="field-error">{fieldErrors.password}</em> : null}
                <small>8 caractères minimum.</small>
              </label>
              <label className="field">
                <span>Confirmer</span>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(event) => update('confirm', event.target.value)}
                  required
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.confirm)}
                />
                {fieldErrors.confirm ? <em className="field-error">{fieldErrors.confirm}</em> : null}
              </label>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
              <span>
                J’accepte les <Link to="/cgv" target="_blank">conditions générales de vente</Link> et la{' '}
                <Link to="/confidentialite" target="_blank">politique de confidentialité</Link>.
              </span>
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
          <p className="auth-layout__switch">
            Déjà client ? <Link to={`/connexion${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>Se connecter</Link>
          </p>
        </div>
      </div>
    </>
  );
}
