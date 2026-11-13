import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  reference: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPriceCents: number;
  maxStock: number;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotalCents: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  replaceLine: (variantId: string, line: Omit<CartLine, 'quantity'>) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'hp_cart_v1';

function readStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is CartLine => Boolean(entry) && typeof (entry as CartLine).variantId === 'string')
      .map((entry) => ({
        ...entry,
        quantity: Math.max(1, Math.min(10, Number(entry.quantity) || 1)),
        unitPriceCents: Number(entry.unitPriceCents) || 0,
        maxStock: Number(entry.maxStock) || 0,
      }))
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStorage);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Stockage plein ou indisponible : le panier reste utilisable en mémoire.
    }
  }, [lines]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [isOpen]);

  const addItem = useCallback((line: Omit<CartLine, 'quantity'>, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((entry) => entry.variantId === line.variantId);
      if (existing) {
        const max = Math.max(1, Math.min(existing.maxStock || 10, 10));
        return current.map((entry) =>
          entry.variantId === line.variantId
            ? { ...entry, ...line, quantity: Math.min(max, entry.quantity + quantity) }
            : entry,
        );
      }
      const max = Math.max(1, Math.min(line.maxStock || 10, 10));
      return [...current, { ...line, quantity: Math.min(max, quantity) }];
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((current) =>
      current.map((entry) => {
        if (entry.variantId !== variantId) return entry;
        const max = Math.max(1, Math.min(entry.maxStock || 10, 10));
        return { ...entry, quantity: Math.max(1, Math.min(max, quantity)) };
      }),
    );
  }, []);

  const replaceLine = useCallback((variantId: string, line: Omit<CartLine, 'quantity'>) => {
    setLines((current) =>
      current.map((entry) => (entry.variantId === variantId ? { ...entry, ...line } : entry)),
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setLines((current) => current.filter((entry) => entry.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
    return {
      lines,
      itemCount,
      subtotalCents,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      updateQuantity,
      replaceLine,
      removeItem,
      clear,
    };
  }, [lines, isOpen, addItem, updateQuantity, replaceLine, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart doit être utilisé dans CartProvider.');
  return context;
}
