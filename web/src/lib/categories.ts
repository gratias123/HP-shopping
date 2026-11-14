import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Category } from './types';

export interface CategoryGroup {
  category: Category;
  children: Category[];
}

export interface CategoryTree {
  /** Rayons (Homme, Femme, Sport…) avec leurs sous-catégories non vides. */
  groups: CategoryGroup[];
  /** Catégories de premier niveau sans sous-catégories (anciennes catégories à plat). */
  standalone: Category[];
}

/**
 * Construit l'arbre à partir de la liste à plat. Les sous-catégories vides sont
 * masquées côté vitrine : la structure est évolutive, l'administrateur peut en
 * ajouter, et elles n'apparaissent qu'une fois qu'elles contiennent des produits.
 */
export function buildCategoryTree(list: Category[]): CategoryTree {
  const published = list.filter((entry) => entry.published);
  const byParent = new Map<string, Category[]>();
  for (const entry of published) {
    if (!entry.parentId) continue;
    const siblings = byParent.get(entry.parentId) ?? [];
    siblings.push(entry);
    byParent.set(entry.parentId, siblings);
  }
  const bySort = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fr');
  const groups: CategoryGroup[] = [];
  const standalone: Category[] = [];
  for (const entry of published.filter((item) => !item.parentId).sort(bySort)) {
    const children = (byParent.get(entry.id) ?? []).sort(bySort);
    if (children.length > 0) groups.push({ category: entry, children: children.filter((child) => child.productCount > 0) });
    else if (entry.productCount > 0) standalone.push(entry);
  }
  return { groups, standalone };
}

let cache: { at: number; promise: Promise<Category[]> } | null = null;

function loadCategories(): Promise<Category[]> {
  if (!cache || Date.now() - cache.at > 60_000) {
    const promise = api
      .get<{ categories: Category[] }>('/api/categories')
      .then((response) => response.categories)
      .catch((error: unknown) => {
        cache = null;
        throw error;
      });
    cache = { at: Date.now(), promise };
  }
  return cache.promise;
}

/** Arbre de catégories partagé (en-tête, pied de page, boutique) avec un seul appel réseau. */
export function useCategoryTree(): CategoryTree & { all: Category[]; loaded: boolean } {
  const [all, setAll] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    loadCategories()
      .then((list) => {
        if (active) {
          setAll(list);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const tree = useMemo(() => buildCategoryTree(all), [all]);
  return { ...tree, all, loaded };
}
