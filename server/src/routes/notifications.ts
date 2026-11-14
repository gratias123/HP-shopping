import { Router } from 'express';
import { ApiError } from '../lib/errors.js';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationBelongsTo,
  unreadCount,
} from '../services/notifications.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const limit = Number(req.query.limit ?? 30);
    const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
    res.json({
      notifications: listNotifications(userId, { limit: Number.isFinite(limit) ? limit : 30, unreadOnly }),
      unreadCount: unreadCount(userId),
    });
  }),
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    res.json({ unreadCount: unreadCount(req.user!.id) });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const updated = markAllNotificationsRead(req.user!.id);
    res.json({ updated, unreadCount: 0 });
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const id = String(req.params.id);
    if (!notificationBelongsTo(userId, id)) throw ApiError.notFound('Notification introuvable.');
    markNotificationRead(userId, id);
    res.json({ ok: true, unreadCount: unreadCount(userId) });
  }),
);
