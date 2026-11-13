import { useState } from 'react';
import { Breadcrumbs, Seo } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useSite } from '../lib/site';

export function ContactPage() {
  const { settings } = useSite();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await api.post<{ message: string }>('/api/contact', form);
      setSuccess(data.message);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fields);
      } else {
        setError('Envoi impossible. Merci de réessayer.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Seo title="Contact" description="Contacter l’équipe HP COLLECTION." />
      <div className="page-shell narrow">
        <Breadcrumbs items={[{ label: 'Accueil', href: '/' }, { label: 'Contact' }]} />
        <header className="page-heading page-heading--compact">
          <div>
            <p className="eyebrow">Nous joindre</p>
            <h1>Une question, une précision ?</h1>
            <p className="page-heading__intro">
              Notre équipe répond sous 2 jours ouvrés. Pour une commande en cours, indiquez sa référence.
            </p>
          </div>
        </header>

        <div className="contact-layout">
          <form className="panel stack-form" onSubmit={submit} noValidate>
            <div className="form-grid">
              <label className="field">
                <span>Nom *</span>
                <input value={form.name} onChange={(event) => update('name', event.target.value)} required autoComplete="name" />
                {fieldErrors.name ? <em className="field-error">{fieldErrors.name}</em> : null}
              </label>
              <label className="field">
                <span>E-mail *</span>
                <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required autoComplete="email" />
                {fieldErrors.email ? <em className="field-error">{fieldErrors.email}</em> : null}
              </label>
            </div>
            <label className="field">
              <span>Sujet *</span>
              <input value={form.subject} onChange={(event) => update('subject', event.target.value)} required />
              {fieldErrors.subject ? <em className="field-error">{fieldErrors.subject}</em> : null}
            </label>
            <label className="field">
              <span>Message *</span>
              <textarea rows={7} value={form.message} onChange={(event) => update('message', event.target.value)} required maxLength={3000} />
              {fieldErrors.message ? <em className="field-error">{fieldErrors.message}</em> : null}
              <small>{form.message.length} / 3000 caractères.</small>
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {success ? <p className="form-success" role="status">{success}</p> : null}
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Envoi…' : 'Envoyer le message'}
            </button>
          </form>

          <aside className="contact-aside">
            <h2>Coordonnées</h2>
            <p>
              E-mail : <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
            </p>
            {settings.contactPhone ? <p>Téléphone : {settings.contactPhone}</p> : null}
            <p className="muted">
              Les messages sont enregistrés dans notre outil de support. Vos coordonnées ne sont utilisées que pour
              répondre à votre demande.
            </p>
            <h2>Avant de nous écrire</h2>
            <ul>
              <li>Suivi de commande : <a href="/suivi">page de suivi</a></li>
              <li>Retours et livraison : <a href="/livraison">informations livraison</a></li>
              <li>Questions fréquentes : <a href="/faq">FAQ</a></li>
            </ul>
          </aside>
        </div>
      </div>
    </>
  );
}
