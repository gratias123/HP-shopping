import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { ErrorState, Seo, Spinner, StatusBadge } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { useSite } from '../../lib/site';
import { useToast } from '../../lib/toast';
import type { ShippingZone } from '../../lib/types';

interface ZoneForm {
  id?: string;
  name: string;
  countries: string;
  active: boolean;
  sortOrder: number;
}

interface MethodForm {
  id?: string;
  zoneId: string;
  name: string;
  description: string;
  price: string;
  freeOver: string;
  minDays: string;
  maxDays: string;
  active: boolean;
  sortOrder: number;
}

const EMPTY_ZONE: ZoneForm = { name: '', countries: 'BJ', active: true, sortOrder: 0 };
const EMPTY_METHOD: MethodForm = {
  zoneId: '',
  name: '',
  description: '',
  price: '',
  freeOver: '',
  minDays: '',
  maxDays: '',
  active: true,
  sortOrder: 0,
};

export function AdminShippingPage() {
  const { data, loading, error, reload } = useApi<{ zones: ShippingZone[] }>('/api/admin/shipping');
  const { store } = useSite();
  const toast = useToast();
  const [zoneForm, setZoneForm] = useState<ZoneForm | null>(null);
  const [methodForm, setMethodForm] = useState<MethodForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const startZone = (zone?: ShippingZone) => {
    setMethodForm(null);
    setFormError(null);
    setZoneForm(
      zone
        ? { id: zone.id, name: zone.name, countries: zone.countries.join(', '), active: zone.active, sortOrder: zone.sortOrder }
        : EMPTY_ZONE,
    );
  };

  const startMethod = (zoneId: string, method?: ShippingZone['methods'][number]) => {
    setZoneForm(null);
    setFormError(null);
    setMethodForm(
      method
        ? {
            id: method.id,
            zoneId,
            name: method.name,
            description: method.description,
            price: String(method.priceCents / 100),
            freeOver: method.freeOverCents !== null ? String(method.freeOverCents / 100) : '',
            minDays: method.minDays !== null ? String(method.minDays) : '',
            maxDays: method.maxDays !== null ? String(method.maxDays) : '',
            active: method.active,
            sortOrder: method.sortOrder,
          }
        : { ...EMPTY_METHOD, zoneId },
    );
  };

  const saveZone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!zoneForm) return;
    setFormError(null);
    const countries = zoneForm.countries
      .split(/[,\s]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => /^[A-Z]{2}$/.test(code));
    if (!countries.length) {
      setFormError('Indiquez au moins un code pays ISO à deux lettres (ex. BJ).');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: zoneForm.name, countries, active: zoneForm.active, sortOrder: zoneForm.sortOrder };
      if (zoneForm.id) await api.put(`/api/admin/shipping/zones/${zoneForm.id}`, payload);
      else await api.post('/api/admin/shipping/zones', payload);
      toast.push(zoneForm.id ? 'Zone mise à jour.' : 'Zone créée.', 'success');
      setZoneForm(null);
      reload();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const saveMethod = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!methodForm) return;
    setFormError(null);
    const priceCents = Math.round((Number.parseFloat(methodForm.price.replace(',', '.')) || -1) * 100);
    if (priceCents < 0) {
      setFormError('Indiquez un tarif valide.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        zoneId: methodForm.zoneId,
        name: methodForm.name,
        description: methodForm.description,
        priceCents,
        freeOverCents: methodForm.freeOver.trim()
          ? Math.round((Number.parseFloat(methodForm.freeOver.replace(',', '.')) || 0) * 100)
          : null,
        minDays: methodForm.minDays.trim() ? Number.parseInt(methodForm.minDays, 10) : null,
        maxDays: methodForm.maxDays.trim() ? Number.parseInt(methodForm.maxDays, 10) : null,
        active: methodForm.active,
        sortOrder: methodForm.sortOrder,
      };
      if (methodForm.id) await api.put(`/api/admin/shipping/methods/${methodForm.id}`, payload);
      else await api.post('/api/admin/shipping/methods', payload);
      toast.push(methodForm.id ? 'Mode mis à jour.' : 'Mode créé.', 'success');
      setMethodForm(null);
      reload();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const removeZone = async (zone: ShippingZone) => {
    if (!window.confirm(`Supprimer la zone « ${zone.name} » et tous ses modes de livraison ?`)) return;
    try {
      await api.delete(`/api/admin/shipping/zones/${zone.id}`);
      toast.push('Zone supprimée.', 'success');
      if (zoneForm?.id === zone.id) setZoneForm(null);
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Suppression impossible.', 'error');
    }
  };

  const removeMethod = async (method: ShippingZone['methods'][number]) => {
    if (!window.confirm(`Supprimer le mode « ${method.name} » ?`)) return;
    try {
      await api.delete(`/api/admin/shipping/methods/${method.id}`);
      toast.push('Mode supprimé.', 'success');
      if (methodForm?.id === method.id) setMethodForm(null);
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Suppression impossible.', 'error');
    }
  };

  return (
    <>
      <Seo title="Livraison" />
      <div className="admin-two-col admin-two-col--wide">
        <div className="stack">
          <div className="admin-toolbar">
            <h2 className="admin-toolbar__title">Zones & tarifs</h2>
            <button type="button" className="btn btn--primary btn--small" onClick={() => startZone()}>
              <Icon name="plus" size={15} /> Nouvelle zone
            </button>
          </div>

          {error ? <ErrorState error={error} onRetry={reload} /> : null}
          {loading && !data ? <Spinner label="Chargement des zones" /> : null}

          {data?.zones.map((zone) => (
            <section key={zone.id} className="admin-panel shipping-zone">
              <header className="admin-panel__head">
                <div>
                  <h3>{zone.name}</h3>
                  <p className="muted">
                    {zone.countries.join(' · ')} — ordre {zone.sortOrder} —{' '}
                    <StatusBadge status={zone.active ? 'published' : 'archived'} label={zone.active ? 'Active' : 'Inactive'} />
                  </p>
                </div>
                <div className="table-actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startZone(zone)}>
                    Modifier la zone
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startMethod(zone.id)}>
                    <Icon name="plus" size={14} /> Mode
                  </button>
                  <button type="button" className="link-small link-small--danger" onClick={() => removeZone(zone)}>
                    Supprimer
                  </button>
                </div>
              </header>
              {zone.methods.length === 0 ? (
                <p className="muted">Aucun mode de livraison : les clients de cette zone ne pourront pas commander.</p>
              ) : (
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Mode</th>
                        <th className="num">Tarif</th>
                        <th className="num">Offert dès</th>
                        <th>Délai</th>
                        <th>Statut</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {zone.methods.map((method) => (
                        <tr key={method.id}>
                          <td>
                            {method.name}
                            {method.description ? <small className="muted">{method.description}</small> : null}
                          </td>
                          <td className="num">
                            {method.priceCents === 0 ? 'Offerte' : formatPrice(method.priceCents, store.currency)}
                          </td>
                          <td className="num">
                            {method.freeOverCents !== null ? formatPrice(method.freeOverCents, store.currency) : '—'}
                          </td>
                          <td>
                            {method.minDays !== null && method.maxDays !== null
                              ? `${method.minDays}–${method.maxDays} j`
                              : '—'}
                          </td>
                          <td>
                            <StatusBadge status={method.active ? 'published' : 'archived'} label={method.active ? 'Actif' : 'Inactif'} />
                          </td>
                          <td>
                            <div className="table-actions">
                              <button type="button" className="link-small" onClick={() => startMethod(zone.id, method)}>
                                Modifier
                              </button>
                              <button type="button" className="link-small link-small--danger" onClick={() => removeMethod(method)}>
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          <p className="muted">
            Les tarifs sont appliqués côté serveur au moment du devis et de la commande. Le seuil de livraison offerte
            défini sur un mode prévaut ; le seuil global de la boutique est utilisé dans les messages marketing.
          </p>
        </div>

        <aside>
          {zoneForm ? (
            <section className="admin-panel">
              <h2>{zoneForm.id ? 'Modifier la zone' : 'Nouvelle zone'}</h2>
              <form className="stack-form" onSubmit={saveZone}>
                <label className="field">
                  <span>Nom *</span>
                  <input
                    value={zoneForm.name}
                    onChange={(event) => setZoneForm((current) => (current ? { ...current, name: event.target.value } : current))}
                    required
                    placeholder="Bénin"
                  />
                </label>
                <label className="field">
                  <span>Pays desservis *</span>
                  <input
                    value={zoneForm.countries}
                    onChange={(event) => setZoneForm((current) => (current ? { ...current, countries: event.target.value } : current))}
                    required
                    placeholder="BJ"
                  />
                  <small>Codes ISO à deux lettres, séparés par des virgules.</small>
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Ordre</span>
                    <input
                      type="number"
                      min="0"
                      value={zoneForm.sortOrder}
                      onChange={(event) =>
                        setZoneForm((current) =>
                          current ? { ...current, sortOrder: Number.parseInt(event.target.value, 10) || 0 } : current,
                        )
                      }
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={zoneForm.active}
                      onChange={(event) =>
                        setZoneForm((current) => (current ? { ...current, active: event.target.checked } : current))
                      }
                    />
                    Zone active
                  </label>
                </div>
                {formError ? <p className="form-error">{formError}</p> : null}
                <div className="admin-toolbar__actions">
                  <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setZoneForm(null)}>
                    Annuler
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {methodForm ? (
            <section className="admin-panel">
              <h2>{methodForm.id ? 'Modifier le mode' : 'Nouveau mode de livraison'}</h2>
              <form className="stack-form" onSubmit={saveMethod}>
                <label className="field">
                  <span>Zone *</span>
                  <select
                    value={methodForm.zoneId}
                    onChange={(event) => setMethodForm((current) => (current ? { ...current, zoneId: event.target.value } : current))}
                    required
                  >
                    {data?.zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Nom *</span>
                  <input
                    value={methodForm.name}
                    onChange={(event) => setMethodForm((current) => (current ? { ...current, name: event.target.value } : current))}
                    required
                    placeholder="Livraison standard"
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <input
                    value={methodForm.description}
                    onChange={(event) =>
                      setMethodForm((current) => (current ? { ...current, description: event.target.value } : current))
                    }
                    maxLength={200}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Tarif ({store.currency}) *</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={methodForm.price}
                      onChange={(event) =>
                        setMethodForm((current) => (current ? { ...current, price: event.target.value } : current))
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Offert dès ({store.currency})</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={methodForm.freeOver}
                      onChange={(event) =>
                        setMethodForm((current) => (current ? { ...current, freeOver: event.target.value } : current))
                      }
                      placeholder="Aucun seuil"
                    />
                  </label>
                  <label className="field">
                    <span>Délai min. (jours)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={methodForm.minDays}
                      onChange={(event) =>
                        setMethodForm((current) => (current ? { ...current, minDays: event.target.value } : current))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Délai max. (jours)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={methodForm.maxDays}
                      onChange={(event) =>
                        setMethodForm((current) => (current ? { ...current, maxDays: event.target.value } : current))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Ordre</span>
                    <input
                      type="number"
                      min="0"
                      value={methodForm.sortOrder}
                      onChange={(event) =>
                        setMethodForm((current) =>
                          current ? { ...current, sortOrder: Number.parseInt(event.target.value, 10) || 0 } : current,
                        )
                      }
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={methodForm.active}
                      onChange={(event) =>
                        setMethodForm((current) => (current ? { ...current, active: event.target.checked } : current))
                      }
                    />
                    Mode actif
                  </label>
                </div>
                {formError ? <p className="form-error">{formError}</p> : null}
                <div className="admin-toolbar__actions">
                  <button type="submit" className="btn btn--primary" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setMethodForm(null)}>
                    Annuler
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {!zoneForm && !methodForm ? (
            <section className="admin-panel admin-panel--muted">
              <h2>Configurer la livraison</h2>
              <p className="muted">
                Sélectionnez une zone ou un mode à modifier, ou créez une nouvelle zone. Sans mode actif, le tunnel de
                commande bloquera la validation pour le pays concerné.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
