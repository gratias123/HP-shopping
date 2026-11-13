import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ErrorState, Seo, Spinner } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/hooks';
import type { ReadinessReport, ReadinessStatus } from '../../lib/types';

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  ok: 'Prêt',
  warning: 'À vérifier',
  blocking: 'Bloquant',
};

export function AdminReadinessPage() {
  const { data, loading, error, reload } = useApi<ReadinessReport>('/api/admin/readiness');

  if (loading && !data) {
    return (
      <div className="page-loading">
        <Spinner label="Diagnostic de mise en production" />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState error={error ?? { message: 'Diagnostic indisponible.' }} onRetry={reload} />;
  }

  const blocking = data.checks.filter((check) => check.status === 'blocking').length;
  const warnings = data.checks.filter((check) => check.status === 'warning').length;

  return (
    <>
      <Seo title="Mise en production" />
      <div className={`readiness-summary readiness-summary--${data.status}`}>
        <div>
          <p className="eyebrow">Diagnostic</p>
          <h2>
            {data.status === 'ok'
              ? 'Aucun blocage détecté.'
              : data.status === 'blocking'
                ? `${blocking} point${blocking > 1 ? 's' : ''} bloquant${blocking > 1 ? 's' : ''} avant la mise en ligne.`
                : `${warnings} point${warnings > 1 ? 's' : ''} à vérifier.`}
          </h2>
          <p className="muted">Dernier contrôle : {formatDateTime(data.generatedAt)}</p>
        </div>
        <button type="button" className="btn btn--ghost btn--small" onClick={reload}>
          <Icon name="refresh" size={15} /> Relancer le contrôle
        </button>
      </div>

      <div className="readiness-list">
        {data.checks.map((check) => (
          <article key={check.id} className={`readiness-check readiness-check--${check.status}`}>
            <span className="readiness-check__dot" aria-hidden="true" />
            <div className="readiness-check__body">
              <div className="readiness-check__head">
                <h3>{check.label}</h3>
                <span className={`readiness-badge readiness-badge--${check.status}`}>{STATUS_LABEL[check.status]}</span>
              </div>
              <p>{check.detail}</p>
              {check.action ? (
                <Link to={check.action} className="link-small">
                  Corriger <Icon name="arrow-right" size={14} />
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <section className="admin-panel">
        <h2>Sauvegardes</h2>
        <p>
          Créez une sauvegarde avant chaque mise à jour et planifiez une tâche quotidienne. La commande vérifie
          l’intégrité SQLite et copie les médias téléversés.
        </p>
        <pre className="audit-details">npm run backup{'\n'}npm run backup:verify</pre>
        <p className="muted">
          Conservez les archives hors du serveur applicatif. La procédure de restauration est décrite dans
          <code> docs/PRODUCTION.md</code>.
        </p>
      </section>
    </>
  );
}
