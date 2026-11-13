import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ErrorState, Seo, Spinner } from '../../components/ui';
import { api, ApiError, uploadImage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { useSite } from '../../lib/site';
import { useToast } from '../../lib/toast';
import type { SiteSettings } from '../../lib/types';

interface SettingsForm extends Omit<SiteSettings, 'freeShippingThresholdCents'> {
  freeShippingThreshold: string;
}

const EMPTY: SettingsForm = {
  storeName: 'HP COLLECTION',
  storeTagline: '',
  storeAddress: '',
  storeCity: 'Cotonou',
  storeCountry: 'Bénin',
  heroTitle: '',
  heroSubtitle: '',
  heroCtaLabel: '',
  heroCtaHref: '/boutique',
  heroImageUrl: '',
  announcement: '',
  contactEmail: '',
  contactPhone: '',
  whatsappNumber: '',
  instagramUrl: '',
  facebookUrl: '',
  tiktokUrl: '',
  legalName: '',
  legalForm: '',
  legalRccm: '',
  legalIfu: '',
  legalVatNumber: '',
  legalAddress: '',
  legalPublisher: '',
  legalComplaintAuthority: '',
  legalUpdatedAt: '',
  hostName: '',
  hostAddress: '',
  hostPhone: '',
  hostEmail: '',
  freeShippingThreshold: '',
  codEnabled: true,
  demoNotice: '',
};

export function AdminSettingsPage() {
  const { data, loading, error, reload } = useApi<{ settings: SiteSettings }>('/api/admin/settings');
  const { reload: reloadSite, store } = useSite();
  const toast = useToast();
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const loaded = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data?.settings || loaded.current) return;
    loaded.current = true;
    setForm({
      ...data.settings,
      freeShippingThreshold: String(data.settings.freeShippingThresholdCents / 100),
    });
  }, [data]);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await api.put('/api/admin/settings', {
        ...form,
        freeShippingThresholdCents: Math.round((Number.parseFloat(form.freeShippingThreshold.replace(',', '.')) || 0) * 100),
      });
      toast.push('Paramètres enregistrés.', 'success');
      await reloadSite();
      reload();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFormError(caught.message);
        setFieldErrors(caught.fields);
      } else {
        setFormError('Enregistrement impossible.');
      }
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      update('heroImageUrl', url);
      toast.push('Visuel téléversé.', 'success');
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Téléversement impossible.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading && !data) {
    return (
      <div className="page-loading">
        <Spinner label="Chargement des paramètres" />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState error={error ?? { message: 'Paramètres indisponibles.' }} onRetry={reload} />;
  }

  return (
    <>
      <Seo title="Paramètres" />
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
          {Object.keys(fieldErrors).length ? (
            <ul className="alert__list">
              {Object.entries(fieldErrors).map(([field, message]) => (
                <li key={field}>
                  <strong>{field}</strong> — {message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form className="admin-form" onSubmit={save}>
        <div className="admin-form__main">
          <section className="admin-panel">
            <h2>Identité & accueil</h2>
            <div className="form-grid">
              <label className="field">
                <span>Nom de la boutique</span>
                <input value={form.storeName} onChange={(event) => update('storeName', event.target.value)} maxLength={80} />
              </label>
              <label className="field">
                <span>Ville</span>
                <input value={form.storeCity} onChange={(event) => update('storeCity', event.target.value)} maxLength={80} />
              </label>
              <label className="field field--full">
                <span>Adresse de la boutique</span>
                <input
                  value={form.storeAddress}
                  onChange={(event) => update('storeAddress', event.target.value)}
                  maxLength={200}
                  placeholder="À compléter par l’exploitant"
                />
              </label>
              <label className="field">
                <span>Pays</span>
                <input value={form.storeCountry} onChange={(event) => update('storeCountry', event.target.value)} maxLength={80} />
              </label>
              <label className="field field--full">
                <span>Slogan</span>
                <input value={form.storeTagline} onChange={(event) => update('storeTagline', event.target.value)} maxLength={120} />
              </label>
              <label className="field field--full">
                <span>Titre principal</span>
                <input value={form.heroTitle} onChange={(event) => update('heroTitle', event.target.value)} maxLength={120} />
              </label>
              <label className="field field--full">
                <span>Sous-titre</span>
                <textarea rows={3} value={form.heroSubtitle} onChange={(event) => update('heroSubtitle', event.target.value)} maxLength={300} />
              </label>
              <label className="field">
                <span>Libellé du bouton</span>
                <input value={form.heroCtaLabel} onChange={(event) => update('heroCtaLabel', event.target.value)} maxLength={40} />
              </label>
              <label className="field">
                <span>Lien du bouton</span>
                <input value={form.heroCtaHref} onChange={(event) => update('heroCtaHref', event.target.value)} maxLength={200} />
              </label>
              <label className="field field--full">
                <span>Bandeau d’annonce</span>
                <input
                  value={form.announcement}
                  onChange={(event) => update('announcement', event.target.value)}
                  maxLength={160}
                  placeholder="Livraison offerte dès 50 000 FCFA — paiement à la réception"
                />
                <small>Affiché en haut du site. Laisser vide pour masquer.</small>
              </label>
              <label className="field field--full">
                <span>Mention catalogue de démonstration</span>
                <textarea
                  rows={3}
                  value={form.demoNotice}
                  onChange={(event) => update('demoNotice', event.target.value)}
                  maxLength={400}
                  placeholder="Les articles présentés sont fictifs (DEMO)…"
                />
                <small>Affichée sur l’accueil. À vider lorsque le catalogue réel est en place.</small>
              </label>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Visuel d’accueil</h2>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Icon name="upload" size={15} /> {uploading ? 'Envoi…' : 'Téléverser un visuel'}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(event) => void upload(event.target.files?.[0])} />
            </div>
            <div className="settings-hero">
              {form.heroImageUrl ? <img src={form.heroImageUrl} alt="" width="220" height="275" /> : null}
              <label className="field">
                <span>Adresse du visuel</span>
                <input
                  value={form.heroImageUrl}
                  onChange={(event) => update('heroImageUrl', event.target.value)}
                  placeholder="/media/hero-editorial.jpg ou https://…"
                />
                <small>Format conseillé : paysage 4:3, JPEG/PNG/WebP/AVIF, 5 Mo max.</small>
              </label>
            </div>
          </section>

          <section className="admin-panel">
            <h2>Contact & réseaux</h2>
            <div className="form-grid">
              <label className="field">
                <span>E-mail de contact</span>
                <input value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} maxLength={160} />
              </label>
              <label className="field">
                <span>Téléphone</span>
                <input value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} maxLength={40} />
              </label>
              <label className="field">
                <span>WhatsApp</span>
                <input
                  value={form.whatsappNumber}
                  onChange={(event) => update('whatsappNumber', event.target.value)}
                  maxLength={40}
                  placeholder="+229…"
                />
                <small>Format international, utilisé pour le lien WhatsApp.</small>
              </label>
              <label className="field">
                <span>Instagram (URL)</span>
                <input value={form.instagramUrl} onChange={(event) => update('instagramUrl', event.target.value)} maxLength={300} />
              </label>
              <label className="field">
                <span>Facebook (URL)</span>
                <input value={form.facebookUrl} onChange={(event) => update('facebookUrl', event.target.value)} maxLength={300} />
              </label>
              <label className="field">
                <span>TikTok (URL)</span>
                <input value={form.tiktokUrl} onChange={(event) => update('tiktokUrl', event.target.value)} maxLength={300} />
              </label>
            </div>
          </section>

          <section className="admin-panel">
            <h2>Identité légale & hébergement</h2>
            <div className="alert alert--warning">
              Les pages CGV, confidentialité et mentions légales reprennent ces informations. Tant qu’un champ est
              vide, la page publique affiche un repère <strong>[À COMPLÉTER]</strong> : aucune donnée légale n’est
              inventée. Faites valider les textes par un conseil juridique avant publication.
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Raison sociale</span>
                <input
                  value={form.legalName}
                  onChange={(event) => update('legalName', event.target.value)}
                  maxLength={160}
                  placeholder="Nom légal de l’entreprise"
                />
              </label>
              <label className="field">
                <span>Forme juridique</span>
                <input
                  value={form.legalForm}
                  onChange={(event) => update('legalForm', event.target.value)}
                  maxLength={80}
                  placeholder="Ex. SARL, entreprise individuelle…"
                />
              </label>
              <label className="field">
                <span>Numéro RCCM</span>
                <input
                  value={form.legalRccm}
                  onChange={(event) => update('legalRccm', event.target.value)}
                  maxLength={80}
                  placeholder="Immatriculation au registre du commerce"
                />
              </label>
              <label className="field">
                <span>Numéro IFU</span>
                <input
                  value={form.legalIfu}
                  onChange={(event) => update('legalIfu', event.target.value)}
                  maxLength={80}
                  placeholder="Identifiant fiscal unique"
                />
              </label>
              <label className="field">
                <span>Numéro de TVA</span>
                <input
                  value={form.legalVatNumber}
                  onChange={(event) => update('legalVatNumber', event.target.value)}
                  maxLength={80}
                  placeholder="Le cas échéant"
                />
              </label>
              <label className="field">
                <span>Directeur de publication</span>
                <input
                  value={form.legalPublisher}
                  onChange={(event) => update('legalPublisher', event.target.value)}
                  maxLength={160}
                  placeholder="Nom et qualité"
                />
              </label>
              <label className="field field--full">
                <span>Adresse légale complète</span>
                <input
                  value={form.legalAddress}
                  onChange={(event) => update('legalAddress', event.target.value)}
                  maxLength={300}
                  placeholder="Siège social, quartier, ville, pays"
                />
                <small>Laisser vide pour reprendre l’adresse de la boutique : {form.storeAddress || 'non renseignée'}.</small>
              </label>
              <label className="field field--full">
                <span>Autorité ou association de réclamation</span>
                <input
                  value={form.legalComplaintAuthority}
                  onChange={(event) => update('legalComplaintAuthority', event.target.value)}
                  maxLength={300}
                  placeholder="Coordonnées de l’autorité compétente au Bénin"
                />
              </label>
              <div className="field field--full">
                <span>Dernière mise à jour des informations légales</span>
                <p className="muted">
                  {form.legalUpdatedAt ? formatDateTime(form.legalUpdatedAt) : 'Non datée'} — calculée automatiquement
                  lors de la première modification de ces champs.
                </p>
              </div>
              <label className="field">
                <span>Hébergeur — nom</span>
                <input
                  value={form.hostName}
                  onChange={(event) => update('hostName', event.target.value)}
                  maxLength={160}
                  placeholder="Prestataire d’hébergement"
                />
              </label>
              <label className="field">
                <span>Hébergeur — téléphone</span>
                <input
                  value={form.hostPhone}
                  onChange={(event) => update('hostPhone', event.target.value)}
                  maxLength={40}
                />
              </label>
              <label className="field field--full">
                <span>Hébergeur — adresse</span>
                <input
                  value={form.hostAddress}
                  onChange={(event) => update('hostAddress', event.target.value)}
                  maxLength={300}
                />
              </label>
              <label className="field field--full">
                <span>Hébergeur — e-mail</span>
                <input
                  value={form.hostEmail}
                  onChange={(event) => update('hostEmail', event.target.value)}
                  maxLength={160}
                />
              </label>
            </div>
          </section>

          <section className="admin-panel">
            <h2>Commande & paiement</h2>
            <div className="form-grid">
              <label className="field">
                <span>Seuil de livraison offerte ({store.currency})</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.freeShippingThreshold}
                  onChange={(event) => update('freeShippingThreshold', event.target.value)}
                />
                <small>Utilisé dans les messages. Les modes de livraison peuvent avoir leur propre seuil.</small>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.codEnabled}
                  onChange={(event) => update('codEnabled', event.target.checked)}
                />
                Paiement à la réception activé
              </label>
            </div>
            <p className="alert alert--warning">
              Le paiement Mobile Money reste désactivé tant qu’un prestataire compatible avec le Bénin (par exemple
              FedaPay) n’est pas configuré côté serveur. Aucune clé de paiement ne se saisit dans cette page.
            </p>
          </section>
        </div>

        <aside className="admin-form__side">
          <section className="admin-panel">
            <h2>Enregistrement</h2>
            <p className="muted">
              Les paramètres sont appliqués immédiatement à la boutique et au tunnel de commande.
            </p>
            <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
            </button>
          </section>
        </aside>
      </form>
    </>
  );
}
