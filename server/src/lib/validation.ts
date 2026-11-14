import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Adresse e-mail invalide.')
  .max(160, 'Adresse e-mail trop longue.')
  .email('Adresse e-mail invalide.');

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.');

export const phoneSchema = z
  .string()
  .trim()
  .max(30, 'Numéro de téléphone trop long.')
  .regex(/^[0-9+().\s-]*$/, 'Numéro de téléphone invalide.')
  .optional()
  .or(z.literal(''));

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Indiquez votre nom.').max(80),
  phone: phoneSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions générales de vente." }) }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.').max(128),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(60),
  lastName: z.string().trim().min(1, 'Nom requis.').max(60),
  line1: z.string().trim().min(4, 'Adresse trop courte.').max(120),
  line2: z.string().trim().max(120).optional().default(''),
  postalCode: z.string().trim().min(2, 'Code postal requis.').max(20),
  city: z.string().trim().min(2, 'Ville requise.').max(80),
  country: z.string().trim().toUpperCase().length(2, 'Pays invalide (code ISO 2 lettres).'),
  phone: z.string().trim().min(6, 'Téléphone requis pour la livraison.').max(30),
});

export const customerAddressSchema = addressSchema.extend({
  label: z.string().trim().max(40, 'Libellé trop long.').default(''),
  isDefault: z.boolean().default(false),
});

export const cartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
});

export const quoteSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Votre panier est vide.').max(40),
  promoCode: z.string().trim().max(40).optional().or(z.literal('')),
  shippingMethodId: z.string().uuid().nullable().optional(),
  country: z.string().trim().toUpperCase().length(2).optional(),
  email: emailSchema.optional(),
});

export const createOrderSchema = quoteSchema.extend({
  address: addressSchema,
  email: emailSchema.optional(),
  paymentMethod: z.enum(['cod', 'mobile_money']),
  customerNote: z.string().trim().max(500).optional().or(z.literal('')),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les conditions générales de vente.' }) }),
});

const isoDateNullable = z
  .string()
  .trim()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : null));

export const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^(https?:\/\/[^\s]+|\/[^\s]*)$/i, 'Adresse d’image invalide (URL http(s) ou chemin local).');

export const productImageSchema = z.object({
  url: imageUrlSchema,
  alt: z.string().trim().max(160).default(''),
  sortOrder: z.number().int().min(0).max(99).default(0),
});

export const variantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(2).max(60),
  size: z.string().trim().min(1).max(30),
  color: z.string().trim().min(1).max(40),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale invalide.')
    .nullable()
    .optional()
    .or(z.literal('')),
  stock: z.number().int().min(0).max(100000),
  isActive: z.boolean().default(true),
});

export const productSchema = z.object({
  reference: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(2, 'Nom requis.').max(120),
  slug: z.string().trim().max(80).optional(),
  categoryId: z.string().uuid('Catégorie requise.'),
  shortDescription: z.string().trim().max(300).default(''),
  description: z.string().trim().max(8000).default(''),
  composition: z.string().trim().max(500).optional().or(z.literal('')),
  care: z.string().trim().max(500).optional().or(z.literal('')),
  priceCents: z.number().int().min(0).max(10_000_000),
  salePriceCents: z.number().int().min(1).max(10_000_000).nullable().optional(),
  saleStartsAt: isoDateNullable,
  saleEndsAt: isoDateNullable,
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  isFeatured: z.boolean().default(false),
  gender: z.enum(['homme', 'femme', 'mixte']).default('mixte'),
  collection: z.string().trim().max(80).optional().or(z.literal('')),
  lowStockAlert: z.number().int().min(0).max(100000).nullable().optional(),
  images: z.array(productImageSchema).max(10).default([]),
  variants: z.array(variantSchema).min(1, 'Ajoutez au moins une variante (taille / couleur).').max(120),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).default(''),
  imageUrl: imageUrlSchema.optional().or(z.literal('')),
  imageAlt: z.string().trim().max(160).optional().or(z.literal('')),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  published: z.boolean().default(false),
});

export const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Code trop court.')
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, 'Lettres, chiffres, tirets et underscores uniquement.'),
  description: z.string().trim().max(200).default(''),
  type: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1),
  minSubtotalCents: z.number().int().min(0).default(0),
  startsAt: isoDateNullable,
  endsAt: isoDateNullable,
  maxUses: z.number().int().min(1).nullable().optional(),
  maxUsesPerCustomer: z.number().int().min(1).nullable().optional(),
  active: z.boolean().default(true),
});

export const shippingZoneSchema = z.object({
  name: z.string().trim().min(2).max(80),
  countries: z
    .array(z.string().trim().toUpperCase().length(2))
    .min(1, 'Sélectionnez au moins un pays.')
    .max(60),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const shippingMethodSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).default(''),
  priceCents: z.number().int().min(0).max(1_000_000),
  freeOverCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  minDays: z.number().int().min(0).max(60).nullable().optional(),
  maxDays: z.number().int().min(0).max(90).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(20, 'Votre message doit contenir au moins 20 caractères.').max(3000),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(80).default('HP COLLECTION'),
  storeTagline: z.string().trim().max(120),
  storeAddress: z.string().trim().max(200).default(''),
  storeCity: z.string().trim().max(80).default('Cotonou'),
  storeCountry: z.string().trim().max(80).default('Bénin'),
  heroTitle: z.string().trim().max(120),
  heroSubtitle: z.string().trim().max(300),
  heroCtaLabel: z.string().trim().max(40),
  heroCtaHref: z.string().trim().max(200),
  heroImageUrl: imageUrlSchema,
  announcement: z.string().trim().max(160),
  contactEmail: z.string().trim().max(160),
  contactPhone: z.string().trim().max(40),
  whatsappNumber: z.string().trim().max(40).default(''),
  instagramUrl: z.string().trim().max(300),
  facebookUrl: z.string().trim().max(300).default(''),
  tiktokUrl: z.string().trim().max(300).default(''),
  legalName: z.string().trim().max(160).default(''),
  legalForm: z.string().trim().max(80).default(''),
  legalRccm: z.string().trim().max(80).default(''),
  legalIfu: z.string().trim().max(80).default(''),
  legalVatNumber: z.string().trim().max(80).default(''),
  legalAddress: z.string().trim().max(300).default(''),
  legalPublisher: z.string().trim().max(160).default(''),
  legalComplaintAuthority: z.string().trim().max(300).default(''),
  legalUpdatedAt: z.string().trim().max(40).default(''),
  hostName: z.string().trim().max(160).default(''),
  hostAddress: z.string().trim().max(300).default(''),
  hostPhone: z.string().trim().max(40).default(''),
  hostEmail: z.string().trim().max(160).default(''),
  freeShippingThresholdCents: z.number().int().min(0).max(10_000_000),
  codEnabled: z.boolean(),
  demoNotice: z.string().trim().max(400).default(''),
});

export const trackingSchema = z.object({
  reference: z.string().trim().toUpperCase().max(20),
  email: emailSchema,
});

export type ProductInput = z.infer<typeof productSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type PromoCodeInput = z.infer<typeof promoCodeSchema>;
export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>;
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
