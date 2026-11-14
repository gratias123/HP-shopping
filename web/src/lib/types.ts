export interface ProductImage {
  id?: string;
  url: string;
  alt: string;
  sortOrder?: number;
}

export interface ProductCard {
  id: string;
  reference: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceCents: number;
  effectivePriceCents: number;
  compareAtCents: number | null;
  onSale: boolean;
  saleEndsAt: string | null;
  status: string;
  isFeatured: boolean;
  category: { id?: string; name: string; slug: string };
  image: { url: string; alt: string } | null;
  stockTotal: number;
  sizes?: string[];
  colors?: string[];
  unitsSold?: number;
  gender: 'homme' | 'femme' | 'mixte';
  collection: string | null;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  stock: number;
  isActive: boolean;
}

export interface ProductDetail extends ProductCard {
  description: string;
  composition: string | null;
  care: string | null;
  salePriceCents: number | null;
  saleStartsAt: string | null;
  saleEndsAtRaw: string | null;
  lowStockAlert: number | null;
  images: ProductImage[];
  variants: ProductVariant[];
  categoryPublished: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  parentId: string | null;
  sortOrder: number;
  published: boolean;
  productCount: number;
}

export interface SiteSettings {
  storeName: string;
  storeTagline: string;
  storeAddress: string;
  storeCity: string;
  storeCountry: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroImageUrl: string;
  announcement: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  legalName: string;
  legalForm: string;
  legalRccm: string;
  legalIfu: string;
  legalVatNumber: string;
  legalAddress: string;
  legalPublisher: string;
  legalComplaintAuthority: string;
  legalUpdatedAt: string;
  hostName: string;
  hostAddress: string;
  hostPhone: string;
  hostEmail: string;
  freeShippingThresholdCents: number;
  codEnabled: boolean;
  demoNotice: string;
}

export interface StoreConfig {
  currency: string;
  country: string;
  mobileMoneyEnabled: boolean;
  lowStockThreshold: number;
}

export interface CollectionSummary {
  name: string;
  productCount: number;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface HomePayload {
  settings: SiteSettings;
  newArrivals: ProductCard[];
  featured: ProductCard[];
  sale: ProductCard[];
  categories: Category[];
  groups: Category[];
  sections: { homme: ProductCard[]; femme: ProductCard[]; sneakers: ProductCard[] };
  collections: CollectionSummary[];
  bestSellers: ProductCard[];
}

export interface ProductsResponse {
  items: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export interface Facets {
  sizes: string[];
  colors: Array<{ name: string; hex: string | null }>;
  priceMinCents: number;
  priceMaxCents: number;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  reference: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  availableStock: number;
}

export interface Quote {
  lines: QuoteLine[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number | null;
  totalCents: number | null;
  promo: { code: string; description: string; discountCents: number } | null;
  shipping: { methodId: string; label: string; priceCents: number } | null;
  currency: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderItem {
  id: string;
  productName: string;
  productReference: string;
  variantSize: string;
  variantColor: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  productSlug?: string;
}

export interface OrderHistoryEntry {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string;
  actorLabel: string;
  createdAt: string;
}

export interface Order {
  id: string;
  reference: string;
  status: OrderStatus;
  statusLabel: string;
  allowedTransitions: OrderStatus[];
  paymentMethod: 'cod' | 'mobile_money';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  promoCode: string | null;
  email: string;
  phone: string;
  shippingFirstName: string;
  shippingLastName: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingCountry: string;
  shippingMethodLabel: string;
  customerNote: string;
  internalNote?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  history: OrderHistoryEntry[];
  payments: Array<{ id: string; provider: string; status: string; amountCents: number; createdAt: string }>;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  permissions: string[];
  isAdmin: boolean;
}

export interface CustomerAddress {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingMethod {
  id: string;
  zoneId: string;
  zoneName: string;
  name: string;
  description: string;
  priceCents: number;
  basePriceCents: number;
  freeOverCents: number | null;
  minDays: number | null;
  maxDays: number | null;
}

export interface AdminProductSummary extends ProductCard {
  statusCounts?: Record<string, number>;
}

export interface AdminOrderSummary {
  id: string;
  reference: string;
  email: string;
  customerName: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: string;
  totalCents: number;
  itemCount: number;
  createdAt: string;
}

export interface AdminDashboard {
  revenueCents: number;
  orderCount: number;
  revenue30dCents: number;
  statusCounts: Record<string, number>;
  recentOrders: AdminOrderSummary[];
  topProducts: Array<{ name: string; reference: string; units: number; revenueCents: number }>;
  lowStock: Array<{
    id: string;
    sku: string;
    size: string;
    color: string;
    stock: number;
    productName: string;
    productId: string;
    productSlug: string;
    threshold: number;
  }>;
  lowStockTotal: number;
  customerCount: number;
  newMessages: number;
  currency: string;
}

export interface Promo {
  id: string;
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotalCents: number;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  usedCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  active: boolean;
  sortOrder: number;
  methods: Array<{
    id: string;
    zoneId: string;
    name: string;
    description: string;
    priceCents: number;
    freeOverCents: number | null;
    minDays: number | null;
    maxDays: number | null;
    active: boolean;
    sortOrder: number;
  }>;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'staff' | 'admin';
  status: 'active' | 'disabled';
  orderCount: number;
  createdAt: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorEmail: string;
  actorName: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export type ReadinessStatus = 'ok' | 'warning' | 'blocking';

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  action?: string;
}

export interface ReadinessReport {
  status: ReadinessStatus;
  checks: ReadinessCheck[];
  generatedAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  entity: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}
