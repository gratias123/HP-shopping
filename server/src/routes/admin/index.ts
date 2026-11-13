import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { dashboardStats } from '../../services/orders.js';
import { buildReadinessReport } from '../../services/readiness.js';
import { adminAuditRouter } from './audit.js';
import { adminCatalogRouter } from './catalog.js';
import { adminCommerceRouter } from './commerce.js';
import { adminOrdersRouter } from './orders.js';
import { adminUploadsRouter } from './uploads.js';

export const adminRouter = Router();

// Toute l'administration exige une session valide, puis une permission précise
// sur chaque route (voir middleware/auth.ts).
adminRouter.use(requireAuth);

adminRouter.get('/dashboard', requirePermission('orders:read'), (_req, res) => {
  res.json(dashboardStats());
});

adminRouter.get('/readiness', requirePermission('settings:write'), (_req, res) => {
  res.json(buildReadinessReport());
});

adminRouter.use(adminAuditRouter);
adminRouter.use(adminCatalogRouter);
adminRouter.use(adminOrdersRouter);
adminRouter.use(adminCommerceRouter);
adminRouter.use('/uploads', adminUploadsRouter);
