import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ErrorState, Seo, Spinner, StatusBadge } from '../../components/ui';
import { api, ApiError, uploadImage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useToast } from '../../lib/toast';
import type { Category } from '../../lib/types';

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  parentId: string;
  sortOrder: number;
  published: boolean;
}

const EMPTY: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  imageAlt: '',
  parentId: '',
  sortOrder: 0,
  published: false,
};

export function AdminCategoriesPage() {
  const { data, loading, error, reload } = useApi<{ categories: Category[] }>('/api/admin/categories');
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setForm(EMPTY);
      return;
    }
    setForm({
      name: editing.name,
      slug: editing.slug,
      description: editing.description,
      imageUrl: editing.imageUrl ?? '',
      imageAlt: editing.imageAlt ?? '',
      parentId: editing.parentId ?? '',
      sortOrder: editing.sortOrder,
      published: editing.published,
    });
  }, [editing]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setForm((current) => ({ ...current, imageUrl: url }));
      toast.push('Image téléversée.', 'success');
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Téléversement impossible.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description,
        imageUrl: form.imageUrl,
        imageAlt: form.imageAlt,
        parentId: form.parentId || null,
        sortOrder: form.sortOrder,
        published: form.published,
      };
      if (editing) await api.put(`/api/admin/categories/${editing.id}`, payload);
      else await api.post('/api/admin/categories', payload);
      toast.push(editing ? 'Catégorie mise à jour.' : 'Catégorie créée.', 'success');
      setEditing(null);
      setForm(EMPTY);
      reload();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: Category) => {
    if (!window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) return;
    try {
      await api.delete(`/api/admin/categories/${category.id}`);
      toast.push('Catégorie supprimée.', 'success');
      if (editing?.id === category.id) setEditing(null);
      reload();
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Suppression impossible.', 'error');
    }
  };

  return (
    <>
      <Seo title="Catégories" />
      <div className="admin-two-col">
        <section className="admin-panel">
          <header className="admin-panel__head">
            <h2>Catégories</h2>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              <Icon name="plus" size={15} /> Nouvelle catégorie
            </button>
          </header>
          {error ? <ErrorState error={error} onRetry={reload} /> : null}
          {loading && !data ? <Spinner /> : null}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Produits</th>
                  <th>Ordre</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.categories.map((category) => (
                  <tr key={category.id} className={editing?.id === category.id ? 'is-selected' : ''}>
                    <td>
                      <div className="table-product">
                        <span className="table-product__media table-product__media--square">
                          {category.imageUrl ? <img src={category.imageUrl} alt="" width="48" height="48" /> : null}
                        </span>
                        <span>
                          <button type="button" className="link-button" onClick={() => setEditing(category)}>
                            {category.name}
                          </button>
                          <small className="mono">/{category.slug}</small>
                        </span>
                      </div>
                    </td>
                    <td className="num">{category.productCount}</td>
                    <td className="num">{category.sortOrder}</td>
                    <td>
                      <StatusBadge
                        status={category.published ? 'published' : 'draft'}
                        label={category.published ? 'Publiée' : 'Brouillon'}
                      />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(category)}>
                          Modifier
                        </button>
                        <button type="button" className="link-small link-small--danger" onClick={() => remove(category)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Seules les catégories publiées et leurs produits publiés sont visibles sur la boutique. Une catégorie
            contenant des produits ne peut pas être supprimée.
          </p>
        </section>

        <section className="admin-panel">
          <h2>{editing ? 'Modifier la catégorie' : 'Ajouter une catégorie'}</h2>
          <form className="stack-form" onSubmit={save}>
            <label className="field">
              <span>Nom *</span>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="field">
              <span>Identifiant URL</span>
              <input
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="Généré depuis le nom"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                maxLength={2000}
              />
            </label>
            <label className="field">
              <span>Catégorie parente</span>
              <select
                value={form.parentId}
                onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
              >
                <option value="">Aucune</option>
                {data?.categories
                  .filter((category) => category.id !== editing?.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="field">
              <span>Image</span>
              {form.imageUrl ? (
                <div className="category-preview">
                  <img src={form.imageUrl} alt="" width="120" height="80" />
                  <button type="button" className="link-small" onClick={() => setForm((current) => ({ ...current, imageUrl: '' }))}>
                    Retirer
                  </button>
                </div>
              ) : null}
              <div className="admin-toolbar__actions">
                <input
                  value={form.imageUrl}
                  onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                  placeholder="/media/… ou https://…"
                />
                <button type="button" className="btn btn--ghost btn--small" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '…' : 'Téléverser'}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(event) => void upload(event.target.files?.[0])} />
              </div>
            </div>
            <label className="field">
              <span>Texte alternatif de l’image</span>
              <input value={form.imageAlt} onChange={(event) => setForm((current) => ({ ...current, imageAlt: event.target.value }))} maxLength={160} />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Ordre d’affichage</span>
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number.parseInt(event.target.value, 10) || 0 }))}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))}
                />
                Catégorie publiée
              </label>
            </div>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div className="admin-toolbar__actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la catégorie'}
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
