import { Router } from 'express';
import { customerAddressSchema } from '../lib/validation.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from '../services/addresses.js';

export const addressesRouter = Router();

// Toutes les routes exigent une session : un utilisateur ne voit et ne modifie
// que les adresses rattachées à son propre compte.
addressesRouter.use(requireAuth);

addressesRouter.get('/', (req, res) => {
  res.json({ addresses: listAddresses(req.user!.id) });
});

addressesRouter.post('/', (req, res) => {
  const input = customerAddressSchema.parse(req.body);
  const address = createAddress(req.user!.id, input);
  res.status(201).json({ address });
});

addressesRouter.put('/:id', (req, res) => {
  const input = customerAddressSchema.parse(req.body);
  const address = updateAddress(req.user!.id, String(req.params.id), input);
  res.json({ address });
});

addressesRouter.post('/:id/default', (req, res) => {
  const address = setDefaultAddress(req.user!.id, String(req.params.id));
  res.json({ address });
});

addressesRouter.delete('/:id', (req, res) => {
  deleteAddress(req.user!.id, String(req.params.id));
  res.json({ ok: true });
});
