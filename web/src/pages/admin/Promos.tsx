import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, Seo, Spinner, StatusBadge } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, formatPrice } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { useSite } from '../../lib/site';
import { useToast } from '../../lib/toast';
import type { Promo } from '../../lib/types';

interface PromoForm {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: string;
  minSubtotal: string;
  startsAt: string;
  endsAt: string;
  maxUses: string;
  maxUsesPerCustomer: string;
  active: boolean;
}

const EMPTY: PromoForm = {
  code: '',
  description: '',
  type: 'percent',
  value: '',
  minSubtotal: '',
  startsAt: '',
  endsAt: '',
  maxUses: '',
  maxUsesPerCustomer: '',
  active: true,
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function toIso(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function AdminPromosPage() {
  const { data, loading, error, reload } = useApi<{ promos: Promo[] }>('/api/admin/promos');
  const { store } = useSite();
  const toast = useToast();
  const [editing, setEditing] = useState<Promo | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setForm(EMPTY);
      return;
    }
    setForm({
      code: editing.code,
      description: editing.description,
      type: editing.type,
      value: editing.type === 'percent' ? String(editing.value / 100) : String(editing.value / 100),
      minSubtotal: editing.minSubtotalCents ? String(editing.minSubtotalCents / 100) : '',
      startsAt: toLocalInput(editing.startsAt),
      endsAt: toLocalInput(editing.endsAt),
      maxUses: editing.maxUses !== null ? String(editing.maxUses) : '',
      maxUsesPerCustomer: editing.maxUsesPerCustomer !== null ? String(editing.maxUsesPerCustomer) : '',
      active: editing.active,
    });
  }, [editing]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const valueNumber = Number.parseFloat(form.value.replace(',', '.'));
    if (!Number.isFinite(valueNumber) || valueNumber <= 0) {
      setFormError('Renseignez une valeur de remise valide.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        description: form.description,
        type: form.type,
        value: form.type === 'percent' ? Math.round(valueNumber * 100) : Math.round(valueNumber * 100),
        minSubtotalCents: Math.round((Number.parseFloat(form.minSubtotal.replace(',', '.')) || 0) * 100),
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
        maxUses: form.maxUses.trim() ? Number.parseInt(form.maxUses, 10) : null,
        maxUsesPerCustomer: form.maxUsesPerCustomer.trim() ? Number.parseInt(form.maxUsesPerCustomer, 10) : null,
        active: form.active,
      };
      if (editing) await api.put(`/api/admin/promos/${editing.id}`, payload);
      else await api.post('/api/admin/promos', payload);
      toast.push(editing ? 'Code mis à jour.' : 'Code créé.', 'success');
      setEditing(null);
      setForm(EMPTY);
      reload();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (promo: Promo) => {
    if (!window.confirm(`Désactiver le code « ${promo.code} » ?`)) return;
    try {
      await api.delete(`/api/admin/promos/${promo.id}`);
      toast.push('Code désactivé.', 'success');
      if (editing?.id === promo.id) setEditing(null);
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Action impossible.', 'error');
    }
  };

  return (
    <>
      <Seo title="Promotions" />
      <div className="admin-two-col">
        <section className="admin-panel">
          <header className="admin-panel__head">
            <h2>Codes promotionnels</h2>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              <Icon name="plus" size={15} /> Nouveau code
            </button>
          </header>
          {error ? <ErrorState error={error} onRetry={reload} /> : null}
          {loading && !data ? <Spinner label="Chargement des codes" /> : null}
          {data && data.promos.length === 0 ? (
            <EmptyState title="Aucun code" description="Créez un code de bienvenue ou une offre ponctuelle." />
          ) : null}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Remise</th>
                  <th>Conditions</th>
                  <th>Utilisations</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.promos.map((promo) => (
                  <tr key={promo.id} className={editing?.id === promo.id ? 'is-selected' : ''}>
                    <td>
                      <button type="button" className="link-button mono" onClick={() => setEditing(promo)}>
                        {promo.code}
                      </button>
                      {promo.description ? <small className="muted">{promo.description}</small> : null}
                    </td>
                    <td>
                      {promo.type === 'percent'
                        ? `${(promo.value / 100).toLocaleString('fr-FR')} %`
                        : formatPrice(promo.value, store.currency)}
                    </td>
                    <td>
                      {promo.minSubtotalCents > 0 ? (
                        <small>Dès {formatPrice(promo.minSubtotalCents, store.currency)}</small>
                      ) : (
                        <small className="muted">Sans minimum</small>
                      )}
                      {promo.startsAt || promo.endsAt ? (
                        <small className="muted">
                          {promo.startsAt ? `Du ${formatDateTime(promo.startsAt)}` : 'Dès maintenant'}
                          {promo.endsAt ? ` au ${formatDateTime(promo.endsAt)}` : ''}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {promo.usedCount}
                      {promo.maxUses !== null ? ` / ${promo.maxUses}` : ''}
                      {promo.maxUsesPerCustomer !== null ? (
                        <small className="muted">max {promo.maxUsesPerCustomer} / client</small>
                      ) : null}
                    </td>
                    <td>
                      <StatusBadge
                        status={promo.active ? 'published' : 'archived'}
                        label={promo.active ? 'Actif' : 'Inactif'}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(promo)}>
                          Modifier
                        </button>
                        {promo.active ? (
                          <button type="button" className="link-small link-small--danger" onClick={() => deactivate(promo)}>
                            Désactiver
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Les codes sont vérifiés côté serveur au moment du devis et de la commande. Un code désactivé n’est plus
            appliqué, même s’il est déjà saisi dans un panier.
          </p>
        </section>

        <section className="admin-panel">
          <h2>{editing ? 'Modifier le code' : 'Créer un code'}</h2>
          <form className="stack-form" onSubmit={save}>
            <label className="field">
              <span>Code *</span>
              <input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                required
                minLength={3}
                maxLength={40}
                placeholder="BIENVENUE10"
                className="mono"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                maxLength={200}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Type *</span>
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as 'percent' | 'fixed' }))}
                >
                  <option value="percent">Pourcentage</option>
                  <option value="fixed">Montant fixe</option>
                </select>
              </label>
              <label className="field">
                <span>{form.type === 'percent' ? 'Valeur (%) *' : `Valeur (${store.currency === 'XOF' ? 'FCFA' : store.currency}) *`}</span>
                <input
                  type="number"
                  min="0.01"
                  step={form.type === 'fixed' ? '1' : '0.01'}
                  value={form.value}
                  onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                  required
                />
              </label>
            </div>
            <label className="field">
              <span>Panier minimum ({store.currency === 'XOF' ? 'FCFA' : store.currency})</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.minSubtotal}
                onChange={(event) => setForm((current) => ({ ...current, minSubtotal: event.target.value }))}
                placeholder="0"
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Début</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Fin</span>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                />
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Utilisations max.</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={(event) => setForm((current) => ({ ...current, maxUses: event.target.value }))}
                  placeholder="Illimité"
                />
              </label>
              <label className="field">
                <span>Par client</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUsesPerCustomer}
                  onChange={(event) => setForm((current) => ({ ...current, maxUsesPerCustomer: event.target.value }))}
                  placeholder="Illimité"
                />
              </label>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              Code actif
            </label>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="admin-toolbar__actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le code'}
              </button>
              {editing ? (
                <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
