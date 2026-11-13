import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useSite } from '../lib/site';
import { useToast } from '../lib/toast';
import type { CustomerAddress } from '../lib/types';

const regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });

interface Draft {
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
}

function emptyDraft(country: string): Draft {
  return {
    label: '',
    firstName: '',
    lastName: '',
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country,
    phone: '',
  };
}

export function AddressBook() {
  const { store } = useSite();
  const toast = useToast();
  const countries = useApi<{ countries: string[] }>('/api/shipping/countries');
  const { data, loading, error, reload } = useApi<{ addresses: CustomerAddress[] }>('/api/addresses');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(store.country || 'BJ'));
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const addresses = data?.addresses ?? [];

  const update = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const startNew = () => {
    setDraft(emptyDraft(store.country || 'BJ'));
    setFormError(null);
    setEditing('new');
  };

  const startEdit = (address: CustomerAddress) => {
    setDraft({
      label: address.label,
      firstName: address.firstName,
      lastName: address.lastName,
      line1: address.line1,
      line2: address.line2,
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
      phone: address.phone,
    });
    setFormError(null);
    setEditing(address.id);
  };

  const cancel = () => {
    setEditing(null);
    setFormError(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        await api.post('/api/addresses', draft);
        toast.push('Adresse ajoutée à votre carnet.', 'success');
      } else if (editing) {
        await api.put(`/api/addresses/${editing}`, draft);
        toast.push('Adresse mise à jour.', 'success');
      }
      setEditing(null);
      reload();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (address: CustomerAddress) => {
    setBusy(true);
    try {
      await api.post(`/api/addresses/${address.id}/default`, {});
      toast.push('Adresse définie par défaut.', 'success');
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Mise à jour impossible.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (address: CustomerAddress) => {
    const name = address.label || `${address.firstName} ${address.lastName}`;
    if (!window.confirm(`Supprimer l’adresse « ${name} » ?`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/addresses/${address.id}`);
      toast.push('Adresse supprimée.', 'success');
      if (editing === address.id) setEditing(null);
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Suppression impossible.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="address-book">
      <header className="account__heading address-book__heading">
        <div>
          <h2>Mes adresses</h2>
          <p className="muted">Retrouvez vos adresses de livraison et réutilisez-les au moment de commander.</p>
        </div>
        {!editing ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={startNew}>
            <Icon name="plus" size={15} /> Ajouter une adresse
          </button>
        ) : null}
      </header>

      {loading ? <p className="muted">Chargement des adresses…</p> : null}
      {error ? <p className="form-error">{error.message}</p> : null}

      {!loading && !error && addresses.length === 0 && !editing ? (
        <div className="empty-state address-book__empty">
          <h3>Aucune adresse enregistrée</h3>
          <p>Ajoutez une adresse pour gagner du temps lors de votre prochaine commande.</p>
          <button type="button" className="btn btn--primary" onClick={startNew}>
            Enregistrer une adresse
          </button>
        </div>
      ) : null}

      {addresses.length ? (
        <div className="address-grid">
          {addresses.map((address) => (
            <article key={address.id} className={`address-card ${address.isDefault ? 'is-default' : ''}`}>
              <div className="address-card__head">
                <strong>{address.label || `${address.firstName} ${address.lastName}`}</strong>
                {address.isDefault ? <span className="address-card__badge">Par défaut</span> : null}
              </div>
              <p className="address-card__body">
                {address.firstName} {address.lastName}
                <br />
                {address.line1}
                {address.line2 ? (
                  <>
                    <br />
                    {address.line2}
                  </>
                ) : null}
                <br />
                {address.postalCode} {address.city}
                <br />
                {regionNames.of(address.country) ?? address.country}
              </p>
              <p className="address-card__phone">{address.phone}</p>
              <div className="address-card__actions">
                {!address.isDefault ? (
                  <button type="button" className="link-small" onClick={() => setDefault(address)} disabled={busy}>
                    Définir par défaut
                  </button>
                ) : null}
                <button type="button" className="link-small" onClick={() => startEdit(address)} disabled={busy}>
                  Modifier
                </button>
                <button
                  type="button"
                  className="link-small link-small--danger"
                  onClick={() => remove(address)}
                  disabled={busy}
                >
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {editing ? (
        <form className="panel address-form stack-form" onSubmit={save}>
          <h3>{editing === 'new' ? 'Nouvelle adresse' : 'Modifier l’adresse'}</h3>
          <div className="form-grid">
            <label className="field field--full">
              <span>Libellé (facultatif)</span>
              <input
                value={draft.label}
                onChange={(event) => update('label', event.target.value)}
                placeholder="Ex. Maison, Bureau"
                maxLength={40}
              />
            </label>
            <label className="field">
              <span>Prénom *</span>
              <input
                value={draft.firstName}
                onChange={(event) => update('firstName', event.target.value)}
                autoComplete="given-name"
                required
              />
            </label>
            <label className="field">
              <span>Nom *</span>
              <input
                value={draft.lastName}
                onChange={(event) => update('lastName', event.target.value)}
                autoComplete="family-name"
                required
              />
            </label>
            <label className="field field--full">
              <span>Adresse *</span>
              <input
                value={draft.line1}
                onChange={(event) => update('line1', event.target.value)}
                autoComplete="address-line1"
                required
              />
            </label>
            <label className="field field--full">
              <span>Complément d’adresse</span>
              <input
                value={draft.line2}
                onChange={(event) => update('line2', event.target.value)}
                autoComplete="address-line2"
              />
            </label>
            <label className="field">
              <span>Quartier / zone *</span>
              <input
                value={draft.postalCode}
                onChange={(event) => update('postalCode', event.target.value)}
                placeholder="Ex. Akpakpa, Fidjrossè…"
                required
              />
            </label>
            <label className="field">
              <span>Ville *</span>
              <input
                value={draft.city}
                onChange={(event) => update('city', event.target.value)}
                autoComplete="address-level2"
                required
              />
            </label>
            <label className="field">
              <span>Pays *</span>
              <select value={draft.country} onChange={(event) => update('country', event.target.value)}>
                {(countries.data?.countries ?? [store.country || 'BJ']).map((code) => (
                  <option key={code} value={code}>
                    {regionNames.of(code) ?? code}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Téléphone *</span>
              <input
                type="tel"
                value={draft.phone}
                onChange={(event) => update('phone', event.target.value)}
                autoComplete="tel"
                required
              />
            </label>
          </div>
          {formError ? <p className="form-error">{formError}</p> : null}
          <div className="address-form__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer l’adresse'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={cancel} disabled={busy}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
