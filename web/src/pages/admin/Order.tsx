import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { OrderItems, OrderMeta, OrderTimeline, OrderTotals } from '../../components/OrderView';
import { ErrorState, Seo, Spinner, StatusBadge } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, ORDER_STATUS_LABELS } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import { useToast } from '../../lib/toast';
import type { Order, OrderStatus } from '../../lib/types';

export function AdminOrderPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ order: Order }>(id ? `/api/admin/orders/${id}` : null);
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [internalNote, setInternalNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="page-loading">
        <Spinner label="Chargement de la commande" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <ErrorState error={error ?? { message: 'Commande introuvable.' }} onRetry={reload} />
        <p>
          <Link to="/admin/commandes" className="btn btn--ghost">
            Retour aux commandes
          </Link>
        </p>
      </div>
    );
  }

  const order = data.order;
  const noteValue = internalNote ?? order.internalNote ?? '';
  const destructive = nextStatus === 'cancelled' || nextStatus === 'refunded';

  const changeStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nextStatus) return;
    if (
      destructive &&
      !window.confirm(
        nextStatus === 'cancelled'
          ? 'Annuler cette commande ? Le stock sera restauré (une seule fois).'
          : 'Marquer cette commande comme remboursée ? Cette action est définitive.',
      )
    ) {
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const result = await api.patch<{ order: Order }>(`/api/admin/orders/${order.id}/status`, {
        status: nextStatus,
        note: note.trim(),
      });
      toast.push(`Statut mis à jour : ${ORDER_STATUS_LABELS[nextStatus]}.`, 'success');
      setNextStatus('');
      setNote('');
      reload();
      void result;
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'Mise à jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  const saveInternalNote = async () => {
    setNoteSaving(true);
    try {
      await api.patch(`/api/admin/orders/${order.id}/note`, { internalNote: noteValue });
      toast.push('Note interne enregistrée.', 'success');
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Enregistrement impossible.', 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <>
      <Seo title={`Commande ${order.reference}`} />
      <div className="admin-page-head">
        <Link to="/admin/commandes" className="link-small">
          <Icon name="arrow-left" size={15} /> Retour aux commandes
        </Link>
        <div className="admin-page-head__actions">
          <StatusBadge status={order.status} label={order.statusLabel} />
          <StatusBadge
            status={order.paymentStatus}
            label={order.paymentStatus === 'pending' ? 'Paiement en attente' : order.paymentStatus === 'paid' ? 'Payée' : order.paymentStatus}
          />
        </div>
      </div>

      <div className="admin-order-head">
        <div>
          <p className="eyebrow">Commande</p>
          <h2 className="mono">{order.reference}</h2>
          <p className="muted">
            Créée le {formatDateTime(order.createdAt)} · Dernière mise à jour le {formatDateTime(order.updatedAt)}
          </p>
        </div>
        <div className="admin-order-head__total">
          <span>Total</span>
          <strong>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: order.currency }).format(order.totalCents / 100)}</strong>
          <a className="link-small" href={`/api/admin/orders/${order.id}/receipt.pdf`} download>
            Reçu PDF
          </a>
        </div>
      </div>

      <div className="admin-columns">
        <section className="admin-panel">
          <h2>Articles</h2>
          <OrderItems order={order} currency={order.currency} />
          <OrderTotals order={order} currency={order.currency} />
          {order.customerNote ? (
            <p className="order-customer-note">
              <strong>Note du client :</strong> {order.customerNote}
            </p>
          ) : null}
        </section>

        <div>
          <section className="admin-panel">
            <h2>Faire évoluer la commande</h2>
            {order.allowedTransitions.length === 0 ? (
              <p className="muted">Aucune transition disponible depuis le statut actuel.</p>
            ) : (
              <form className="stack-form" onSubmit={changeStatus}>
                <label className="field">
                  <span>Nouveau statut</span>
                  <select
                    value={nextStatus}
                    onChange={(event) => {
                      setNextStatus(event.target.value as OrderStatus | '');
                      setActionError(null);
                    }}
                  >
                    <option value="">Choisir une transition…</option>
                    {order.allowedTransitions.map((status) => (
                      <option key={status} value={status}>
                        {ORDER_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Note d’historique (facultatif)</span>
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={300}
                    placeholder="Ex. Colis remis au transporteur"
                  />
                </label>
                {destructive ? (
                  <p className="alert alert--warning">
                    {nextStatus === 'cancelled'
                      ? 'L’annulation restaure le stock des variantes (une seule fois) et ne peut pas être annulée.'
                      : 'Le remboursement marque le paiement comme remboursé. Vérifiez d’abord le remboursement réel.'}
                  </p>
                ) : null}
                {actionError ? <p className="form-error">{actionError}</p> : null}
                <button type="submit" className="btn btn--primary" disabled={!nextStatus || saving}>
                  {saving ? 'Mise à jour…' : 'Mettre à jour le statut'}
                </button>
              </form>
            )}
          </section>

          <section className="admin-panel">
            <h2>Note interne</h2>
            <label className="field">
              <span>Visible uniquement par l’équipe</span>
              <textarea
                rows={4}
                maxLength={1000}
                value={noteValue}
                onChange={(event) => setInternalNote(event.target.value)}
              />
            </label>
            <button type="button" className="btn btn--ghost btn--small" onClick={saveInternalNote} disabled={noteSaving}>
              {noteSaving ? 'Enregistrement…' : 'Enregistrer la note'}
            </button>
          </section>
        </div>
      </div>

      <div className="admin-columns">
        <section className="admin-panel">
          <h2>Livraison & paiement</h2>
          <OrderMeta order={order} />
        </section>
        <section className="admin-panel">
          <h2>Historique</h2>
          <OrderTimeline order={order} />
          {order.payments.length ? (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Prestataire</th>
                    <th>Statut</th>
                    <th className="num">Montant</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.provider}</td>
                      <td>{payment.status}</td>
                      <td className="num">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: order.currency }).format(
                          payment.amountCents / 100,
                        )}
                      </td>
                      <td>{formatDateTime(payment.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
