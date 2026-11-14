import { Router } from 'express';
import { execute } from '../db/index.js';
import { asyncHandler } from '../lib/http.js';
import { contactSchema } from '../lib/validation.js';
import { newId } from '../lib/ids.js';
import { rateLimit } from '../middleware/security.js';
import { notifyContactRequest } from '../services/notifications.js';

export const contactRouter = Router();

contactRouter.post(
  '/contact',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 5, scope: 'contact' }),
  asyncHandler(async (req, res) => {
    const input = contactSchema.parse(req.body);
    const messageId = newId();
    execute('INSERT INTO contact_messages (id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)', [
      messageId,
      input.name,
      input.email,
      input.subject,
      input.message,
    ]);
    notifyContactRequest({ id: messageId, name: input.name, subject: input.subject });
    res.status(201).json({
      ok: true,
      message: 'Votre message a bien été enregistré. Nous revenons vers vous sous 2 jours ouvrés.',
    });
  }),
);
