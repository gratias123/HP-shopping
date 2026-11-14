import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ErrorState, Seo, Spinner } from '../../components/ui';
import { api, ApiError, uploadImage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useToast } from '../../lib/toast';
import { StockHistory } from './StockHistory';
import type { Category, CollectionSummary, ProductDetail } from '../../lib/types';

interface VariantRow {
  key: string;
  id?: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  isActive: boolean;
}

interface ImageRow {
  key: string;
  url: string;
  alt: string;
}

interface FormState {
  name: string;
  reference: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  composition: string;
  care: string;
  price: string;
  salePrice: string;
  saleStarts: string;
  saleEnds: string;
  status: 'draft' | 'published' | 'archived';
  isFeatured: boolean;
  gender: 'homme' | 'femme' | 'mixte';
  collection: string;
  lowStockAlert: string;
  images: ImageRow[];
  variants: VariantRow[];
}

const EMPTY: FormState = {
  name: '',
  reference: '',
  slug: '',
  categoryId: '',
  shortDescription: '',
  description: '',
  composition: '',
  care: '',
  price: '',
  salePrice: '',
  saleStarts: '',
  saleEnds: '',
  status: 'draft',
  isFeatured: false,
  gender: 'mixte',
  collection: '',
  lowStockAlert: '',
  images: [],
  variants: [{ key: crypto.randomUUID(), sku: '', size: '', color: 'Noir', colorHex: '#171717', stock: 0, isActive: true }],
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toCents(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function AdminProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const categories = useApi<{ categories: Category[] }>('/api/admin/categories');
  const collections = useApi<{ collections: CollectionSummary[] }>('/api/collections');
  const categoryOptions = useMemo(() => {
    const list = categories.data?.categories ?? [];
    const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fr'));
    return sorted
      .filter((entry) => !entry.parentId)
      .map((parent) => ({ parent, children: sorted.filter((entry) => entry.parentId === parent.id) }));
  }, [categories.data]);
  const product = useApi<{ product: ProductDetail }>(id ? `/api/admin/products/${id}` : null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const loaded = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!product.data?.product) return;
    if (loaded.current === product.data.product.id) return;
    loaded.current = product.data.product.id;
    const source = product.data.product;
    setForm({
      name: source.name,
      reference: source.reference,
      slug: source.slug,
      categoryId: source.category.id ?? '',
      shortDescription: source.shortDescription,
      description: source.description,
      composition: source.composition ?? '',
      care: source.care ?? '',
      price: String(source.priceCents / 100),
      salePrice: source.salePriceCents ? String(source.salePriceCents / 100) : '',
      saleStarts: toLocalInput(source.saleStartsAt),
      saleEnds: toLocalInput(source.saleEndsAtRaw),
      status: source.status as FormState['status'],
      isFeatured: source.isFeatured,
      gender: source.gender ?? 'mixte',
      collection: source.collection ?? '',
      lowStockAlert: source.lowStockAlert !== null ? String(source.lowStockAlert) : '',
      images: source.images.map((image) => ({ key: image.id ?? crypto.randomUUID(), url: image.url, alt: image.alt })),
      variants: source.variants.map((variant) => ({
        key: variant.id,
        id: variant.id,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        colorHex: variant.colorHex ?? '',
        stock: variant.stock,
        isActive: variant.isActive,
      })),
    });
  }, [product.data]);

  useEffect(() => {
    if (!form.categoryId && categories.data?.categories[0]) {
      setForm((current) => ({ ...current, categoryId: categories.data!.categories[0].id }));
    }
  }, [categories.data, form.categoryId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateVariant = (key: string, patch: Partial<VariantRow>) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)),
    }));
  };

  const addVariant = () => {
    setForm((current) => ({
      ...current,
      variants: [
        ...current.variants,
        { key: crypto.randomUUID(), sku: '', size: '', color: 'Noir', colorHex: '#171717', stock: 0, isActive: true },
      ],
    }));
  };

  const removeVariant = (key: string) => {
    setForm((current) => ({ ...current, variants: current.variants.filter((variant) => variant.key !== key) }));
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const { url } = await uploadImage(file);
        setForm((current) => ({
          ...current,
          images: [...current.images, { key: crypto.randomUUID(), url, alt: current.name }],
        }));
      }
      toast.push('Image(s) ajoutée(s).', 'success');
    } catch (caught) {
      toast.push(caught instanceof ApiError ? caught.message : 'Téléversement impossible.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addImageUrl = () => {
    const url = window.prompt('Adresse de l’image (https://… ou /media/…)');
    if (!url) return;
    setForm((current) => ({ ...current, images: [...current.images, { key: crypto.randomUUID(), url, alt: current.name }] }));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      const images = [...current.images];
      const target = index + direction;
      if (target < 0 || target >= images.length) return current;
      const [moved] = images.splice(index, 1);
      images.splice(target, 0, moved);
      return { ...current, images };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const priceCents = toCents(form.price);
    if (priceCents === null) {
      setError('Renseignez un prix de vente valide.');
      return;
    }
    const salePriceCents = form.salePrice.trim() ? toCents(form.salePrice) : null;
    if (form.salePrice.trim() && salePriceCents === null) {
      setError('Le prix promotionnel est invalide.');
      return;
    }
    if (salePriceCents !== null && salePriceCents >= priceCents) {
      setError('Le prix promotionnel doit être inférieur au prix de vente.');
      return;
    }
    if (!form.variants.length) {
      setError('Ajoutez au moins une variante.');
      return;
    }
    const payload = {
      name: form.name,
      reference: form.reference || undefined,
      slug: form.slug || undefined,
      categoryId: form.categoryId,
      shortDescription: form.shortDescription,
      description: form.description,
      composition: form.composition,
      care: form.care,
      priceCents,
      salePriceCents,
      saleStartsAt: toIso(form.saleStarts) ?? '',
      saleEndsAt: toIso(form.saleEnds) ?? '',
      status: form.status,
      isFeatured: form.isFeatured,
      gender: form.gender,
      collection: form.collection.trim(),
      lowStockAlert: form.lowStockAlert.trim() ? Number.parseInt(form.lowStockAlert, 10) : null,
      images: form.images.map((image, index) => ({ url: image.url, alt: image.alt, sortOrder: index })),
      variants: form.variants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        sku: variant.sku.trim() || `HP-${(form.reference || form.name).slice(0, 8).replace(/\s+/g, '').toUpperCase()}-${variant.size || 'TU'}-${variant.color.slice(0, 3).toUpperCase()}`,
        size: variant.size,
        color: variant.color,
        colorHex: variant.colorHex || null,
        stock: Number.isFinite(variant.stock) ? variant.stock : 0,
        isActive: variant.isActive,
      })),
    };
    setSaving(true);
    try {
      if (isEdit && id) {
        await api.put(`/api/admin/products/${id}`, payload);
        toast.push('Produit enregistré.', 'success');
      } else {
        await api.post('/api/admin/products', payload);
        toast.push('Produit créé.', 'success');
      }
      navigate('/admin/produits');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.fields);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError('Enregistrement impossible.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && product.loading && !product.data) {
    return (
      <div className="page-loading">
        <Spinner label="Chargement du produit" />
      </div>
    );
  }
  if (isEdit && product.error) {
    return <ErrorState error={product.error} onRetry={product.reload} />;
  }

  const totalStock = form.variants.reduce((sum, variant) => sum + (Number.isFinite(variant.stock) ? variant.stock : 0), 0);

  return (
    <>
      <Seo title={isEdit ? 'Modifier un produit' : 'Nouveau produit'} />
      <div className="admin-page-head">
        <Link to="/admin/produits" className="link-small">
          <Icon name="arrow-left" size={15} /> Retour aux produits
        </Link>
        <div className="admin-page-head__actions">
          <span className="muted">Stock total : {totalStock}</span>
          <button type="submit" form="product-form" className="btn btn--primary btn--small" disabled={saving}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le produit'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
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

      <form id="product-form" className="admin-form" onSubmit={submit} noValidate>
        <div className="admin-form__main">
          <section className="admin-panel">
            <h2>Informations générales</h2>
            <div className="form-grid">
              <label className="field field--full">
                <span>Nom du produit *</span>
                <input value={form.name} onChange={(event) => update('name', event.target.value)} required maxLength={120} />
              </label>
              <label className="field">
                <span>Référence</span>
                <input
                  value={form.reference}
                  onChange={(event) => update('reference', event.target.value.toUpperCase())}
                  maxLength={40}
                  placeholder="Générée automatiquement"
                />
                <small>Identifiant unique affiché sur la fiche produit.</small>
              </label>
              <label className="field">
                <span>Catégorie *</span>
                <select value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)} required>
                  <option value="">Sélectionner…</option>
                  {categoryOptions.map((entry) =>
                    entry.children.length > 0 ? (
                      <optgroup key={entry.parent.id} label={entry.parent.name}>
                        {entry.children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                            {child.published ? '' : ' (non publiée)'}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <option key={entry.parent.id} value={entry.parent.id}>
                        {entry.parent.name}
                        {entry.parent.published ? '' : ' (non publiée)'}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="field">
                <span>Public concerné</span>
                <select value={form.gender} onChange={(event) => update('gender', event.target.value as FormState['gender'])}>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                  <option value="mixte">Mixte</option>
                </select>
              </label>
              <label className="field">
                <span>Collection</span>
                <input
                  value={form.collection}
                  onChange={(event) => update('collection', event.target.value)}
                  list="collection-suggestions"
                  maxLength={80}
                  placeholder="Ex. Essentiels urbains"
                />
                <datalist id="collection-suggestions">
                  {(collections.data?.collections ?? []).map((entry) => (
                    <option key={entry.name} value={entry.name} />
                  ))}
                </datalist>
                <small>Facultatif. Les articles d’une même collection sont regroupés sur la boutique.</small>
              </label>
              <label className="field field--full">
                <span>Accroche courte</span>
                <input
                  value={form.shortDescription}
                  onChange={(event) => update('shortDescription', event.target.value)}
                  maxLength={300}
                  placeholder="Matière, coupe, détail marquant…"
                />
              </label>
              <label className="field field--full">
                <span>Description détaillée</span>
                <textarea rows={8} value={form.description} onChange={(event) => update('description', event.target.value)} maxLength={8000} />
              </label>
              <label className="field">
                <span>Composition</span>
                <textarea rows={3} value={form.composition} onChange={(event) => update('composition', event.target.value)} maxLength={500} />
              </label>
              <label className="field">
                <span>Entretien</span>
                <textarea rows={3} value={form.care} onChange={(event) => update('care', event.target.value)} maxLength={500} />
              </label>
            </div>
          </section>

          <section className="admin-panel">
            <h2>Prix & promotion</h2>
            <div className="form-grid">
              <label className="field">
                <span>Prix de vente (FCFA) *</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(event) => update('price', event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Prix promotionnel (FCFA)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.salePrice}
                  onChange={(event) => update('salePrice', event.target.value)}
                  placeholder="Facultatif"
                />
              </label>
              <label className="field">
                <span>Début de la promotion</span>
                <input type="datetime-local" value={form.saleStarts} onChange={(event) => update('saleStarts', event.target.value)} />
                <small>Laisser vide pour démarrer immédiatement.</small>
              </label>
              <label className="field">
                <span>Fin de la promotion</span>
                <input type="datetime-local" value={form.saleEnds} onChange={(event) => update('saleEnds', event.target.value)} />
                <small>Laisser vide pour une durée illimitée.</small>
              </label>
              <label className="field">
                <span>Seuil d’alerte de stock</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.lowStockAlert}
                  onChange={(event) => update('lowStockAlert', event.target.value)}
                  placeholder="Seuil global"
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) => update('isFeatured', event.target.checked)}
                />
                Mettre en avant sur l’accueil
              </label>
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Images</h2>
              <div className="admin-toolbar__actions">
                <button type="button" className="btn btn--ghost btn--small" onClick={addImageUrl}>
                  Ajouter une URL
                </button>
                <button type="button" className="btn btn--primary btn--small" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Icon name="upload" size={16} /> {uploading ? 'Envoi…' : 'Téléverser'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  hidden
                  onChange={(event) => void addImages(event.target.files)}
                />
              </div>
            </div>
            {form.images.length === 0 ? (
              <p className="muted">Aucune image. Ajoutez au moins un visuel produit (JPEG, PNG, WebP ou AVIF, 5 Mo max).</p>
            ) : (
              <ul className="image-list">
                {form.images.map((image, index) => (
                  <li key={image.key}>
                    <img src={image.url} alt="" width="90" height="112" />
                    <div className="image-list__fields">
                      <label className="field">
                        <span>Texte alternatif</span>
                        <input
                          value={image.alt}
                          onChange={(event) =>
                            update(
                              'images',
                              form.images.map((entry) => (entry.key === image.key ? { ...entry, alt: event.target.value } : entry)),
                            )
                          }
                          maxLength={160}
                        />
                      </label>
                      <p className="mono muted image-list__url">{image.url}</p>
                    </div>
                    <div className="image-list__actions">
                      <button type="button" className="icon-button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label="Monter l’image">
                        <Icon name="arrow-left" size={14} style={{ transform: 'rotate(90deg)' }} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => moveImage(index, 1)}
                        disabled={index === form.images.length - 1}
                        aria-label="Descendre l’image"
                      >
                        <Icon name="arrow-right" size={14} style={{ transform: 'rotate(90deg)' }} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => update('images', form.images.filter((entry) => entry.key !== image.key))}
                        aria-label="Supprimer l’image"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-panel">
            <div className="admin-panel__head">
              <h2>Variantes & stock</h2>
              <button type="button" className="btn btn--ghost btn--small" onClick={addVariant}>
                <Icon name="plus" size={15} /> Ajouter une variante
              </button>
            </div>
            <div className="table-wrap">
              <table className="admin-table admin-table--variants">
                <thead>
                  <tr>
                    <th>Taille</th>
                    <th>Couleur</th>
                    <th>Hex</th>
                    <th>SKU</th>
                    <th className="num">Stock</th>
                    <th>Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.variants.map((variant) => (
                    <tr key={variant.key}>
                      <td>
                        <input
                          value={variant.size}
                          onChange={(event) => updateVariant(variant.key, { size: event.target.value })}
                          placeholder="M"
                          aria-label="Taille"
                        />
                      </td>
                      <td>
                        <input
                          value={variant.color}
                          onChange={(event) => updateVariant(variant.key, { color: event.target.value })}
                          placeholder="Noir"
                          aria-label="Couleur"
                        />
                      </td>
                      <td>
                        <input
                          type="color"
                          value={variant.colorHex || '#777D86'}
                          onChange={(event) => updateVariant(variant.key, { colorHex: event.target.value })}
                          aria-label="Couleur hexadécimale"
                        />
                      </td>
                      <td>
                        <input
                          value={variant.sku}
                          onChange={(event) => updateVariant(variant.key, { sku: event.target.value.toUpperCase() })}
                          placeholder="Auto"
                          aria-label="SKU"
                          className="mono"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={variant.stock}
                          onChange={(event) => updateVariant(variant.key, { stock: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })}
                          aria-label="Stock"
                          className="input-num"
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={variant.isActive}
                          onChange={(event) => updateVariant(variant.key, { isActive: event.target.checked })}
                          aria-label="Variante active"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => removeVariant(variant.key)}
                          aria-label="Supprimer la variante"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              Chaque combinaison taille / couleur possède son propre stock. Le stock est décrémenté à la commande et
              restauré en cas d’annulation.
            </p>
          </section>

          {isEdit && id ? <StockHistory productId={id} /> : null}
        </div>

        <aside className="admin-form__side">
          <section className="admin-panel">
            <h2>Publication</h2>
            <label className="field">
              <span>Statut</span>
              <select value={form.status} onChange={(event) => update('status', event.target.value as FormState['status'])}>
                <option value="draft">Brouillon</option>
                <option value="published">Publié</option>
                <option value="archived">Archivé</option>
              </select>
            </label>
            <label className="field">
              <span>Identifiant URL (slug)</span>
              <input
                value={form.slug}
                onChange={(event) => update('slug', event.target.value)}
                placeholder="Généré depuis le nom"
                maxLength={80}
              />
            </label>
            <p className="muted">
              Un produit publié doit appartenir à une catégorie publiée. Les modifications de prix et de stock sont
              appliquées immédiatement après enregistrement.
            </p>
            <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {isEdit ? (
              <Link to={`/produit/${form.slug}`} target="_blank" className="btn btn--ghost btn--full">
                Voir sur le site
              </Link>
            ) : null}
          </section>

          {isEdit ? (
            <section className="admin-panel admin-panel--muted">
              <h2>Archivage</h2>
              <p className="muted">
                Un produit archivé n’est plus visible ni commandable, mais les commandes passées conservent leurs
                informations.
              </p>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={async () => {
                  if (!id || !window.confirm('Archiver ce produit ?')) return;
                  try {
                    await api.patch(`/api/admin/products/${id}/status`, { status: 'archived' });
                    update('status', 'archived');
                    toast.push('Produit archivé.', 'success');
                  } catch (caught) {
                    toast.push(caught instanceof ApiError ? caught.message : 'Action impossible.', 'error');
                  }
                }}
              >
                Archiver le produit
              </button>
            </section>
          ) : null}
        </aside>
      </form>
    </>
  );
}
