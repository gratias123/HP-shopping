import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/hooks';

interface StockMovement {
  id: string;
  sku: string;
  size: string;
  color: string;
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: 'initial' | 'order' | 'cancellation' | 'adjustment' | 'restock' | 'return';
  reference: string;
  note: string;
  actorLabel: string;
  createdAt: string;
}

const REASON_LABELS: Record<StockMovement['reason'], string> = {
  initial: 'Stock initial',
  order: 'Vente',
  cancellation: 'Annulation',
  adjustment: 'Ajustement',
  restock: 'Réassort',
  return: 'Retour',
};

export function StockHistory({ productId }: { productId: string }) {
  const { data, loading, error } = useApi<{ movements: StockMovement[] }>(
    `/api/admin/products/${productId}/stock-movements?limit=80`,
  );

  return (
    <section className="admin-panel">
      <div className="admin-panel__head">
        <h2>Historique des mouvements de stock</h2>
        <span className="muted">80 derniers mouvements</span>
      </div>
      {loading ? <p className="muted">Chargement de l’historique.</p> : null}
      {error ? <p className="form-error">Historique indisponible : {error.message}</p> : null}
      {!loading && !error && data?.movements.length === 0 ? (
        <p className="muted">Aucun mouvement enregistré pour ce produit.</p>
      ) : null}
      {data?.movements.length ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Variante</th>
                <th className="num">Mouvement</th>
                <th className="num">Avant</th>
                <th className="num">Après</th>
                <th>Motif</th>
                <th>Référence</th>
              </tr>
            </thead>
            <tbody>
              {data.movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDateTime(movement.createdAt)}</td>
                  <td>
                    <span className="mono">{movement.sku}</span>
                    <br />
                    <span className="muted">
                      {movement.size} · {movement.color}
                    </span>
                  </td>
                  <td className={`num ${movement.delta > 0 ? 'stock-up' : 'stock-down'}`}>
                    {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                  </td>
                  <td className="num">{movement.stockBefore}</td>
                  <td className="num">{movement.stockAfter}</td>
                  <td>
                    {REASON_LABELS[movement.reason]}
                    {movement.note ? (
                      <>
                        <br />
                        <span className="muted">{movement.note}</span>
                      </>
                    ) : null}
                    <br />
                    <span className="muted">{movement.actorLabel}</span>
                  </td>
                  <td className="mono">{movement.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="muted">
        Les ventes et annulations sont enregistrées automatiquement. Les modifications manuelles de stock sont
        conservées avec leur auteur.
      </p>
    </section>
  );
}
