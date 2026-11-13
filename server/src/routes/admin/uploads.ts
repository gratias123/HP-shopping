import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../../config.js';
import { ApiError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';

export const adminUploadsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 4 },
});

type ImageKind = { ext: 'jpg' | 'png' | 'webp' | 'avif'; mime: string };

/** Détection du type réel par signature binaire (on ne fait pas confiance au client). */
function detectImage(buffer: Buffer): ImageKind | null {
  if (buffer.length < 16) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return { ext: 'avif', mime: 'image/avif' };
  }
  return null;
}

adminUploadsRouter.post(
  '/',
  requirePermission('catalog:write'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Aucun fichier reçu.');
    const detected = detectImage(req.file.buffer);
    if (!detected) {
      throw new ApiError(422, 'invalid_image', 'Format d’image non pris en charge (JPEG, PNG, WebP ou AVIF).');
    }
    const declared = String(req.file.mimetype).toLowerCase();
    const declaredOk = declared === detected.mime || (detected.ext === 'jpg' && declared === 'image/jpg');
    if (!declaredOk) {
      throw new ApiError(422, 'mime_mismatch', 'Le type déclaré du fichier ne correspond pas à son contenu.');
    }
    await fs.mkdir(config.uploadDir, { recursive: true });
    const filename = `${crypto.randomUUID()}.${detected.ext}`;
    const target = path.join(config.uploadDir, filename);
    await fs.writeFile(target, req.file.buffer, { mode: 0o644, flag: 'wx' });
    res.status(201).json({ url: `/uploads/${filename}`, mime: detected.mime, size: req.file.size });
  }),
);
