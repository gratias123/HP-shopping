/**
 * Persistance durable pour les hébergements à disque éphémère (Render gratuit).
 *
 * La base SQLite et les images envoyées depuis l'administration sont copiées
 * dans une base Supabase (via des fonctions RPC protégées par un secret) :
 * - au démarrage, si le disque est vide (pas de marqueur), la copie est restaurée ;
 * - après chaque modification, un instantané est envoyé (regroupé, ~5 s) ;
 * - à l'arrêt (SIGTERM), un dernier instantané est envoyé.
 * Désactivé si PERSIST_SUPABASE_URL / PERSIST_SUPABASE_KEY / PERSIST_SECRET sont absents.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

const url = (process.env.PERSIST_SUPABASE_URL ?? '').replace(/\/$/, '');
const key = process.env.PERSIST_SUPABASE_KEY ?? '';
const secret = process.env.PERSIST_SECRET ?? '';

export const persistenceEnabled = (): boolean => !config.isTest && Boolean(url && key && secret);

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${fn} : HTTP ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

const markerPath = () => path.join(path.dirname(config.databasePath), '.persist-restored');
const log = (message: string) => console.info(`[persistance] ${message}`);

/** À appeler avant l'ouverture de la base. */
export async function restoreIfNeeded(): Promise<void> {
  if (!persistenceEnabled()) return;
  if (fs.existsSync(markerPath())) return;
  try {
    const snapshot = await rpc<string | null>('hp_snapshot_get', { p_secret: secret });
    const dir = path.dirname(config.databasePath);
    fs.mkdirSync(dir, { recursive: true });
    if (snapshot) {
      for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${config.databasePath}${suffix}`, { force: true });
      fs.writeFileSync(config.databasePath, Buffer.from(snapshot, 'base64'));
      log(`base restaurée (${(snapshot.length * 0.75 / 1024).toFixed(0)} Ko).`);
    } else {
      log('aucune sauvegarde distante : la base actuelle sera la première.');
      markDirtyAfterBoot = true;
    }
    const files = await rpc<Array<{ name: string }>>('hp_media_list', { p_secret: secret });
    fs.mkdirSync(config.uploadDir, { recursive: true });
    for (const { name } of files ?? []) {
      if (!/^[\w.-]+$/.test(name) || fs.existsSync(path.join(config.uploadDir, name))) continue;
      const rows = await rpc<Array<{ mime: string; data: string }>>('hp_media_get', { p_secret: secret, p_name: name });
      if (rows?.[0]) fs.writeFileSync(path.join(config.uploadDir, name), Buffer.from(rows[0].data, 'base64'));
    }
    if ((files ?? []).length) log(`${files.length} image(s) restaurée(s).`);
    fs.writeFileSync(markerPath(), new Date().toISOString());
  } catch (error) {
    console.error('[persistance] restauration impossible :', (error as Error).message);
  }
}

let markDirtyAfterBoot = false;
let dirty = false;
let timer: NodeJS.Timeout | null = null;
let running: Promise<void> | null = null;

export async function pushSnapshot(): Promise<void> {
  if (!persistenceEnabled()) return;
  if (running) return running;
  running = (async () => {
    const { getDb } = await import('../db/index.js');
    const tmp = path.join(path.dirname(config.databasePath), `.snapshot-${process.pid}.sqlite`);
    try {
      fs.rmSync(tmp, { force: true });
      getDb().exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
      const data = fs.readFileSync(tmp).toString('base64');
      await rpc('hp_snapshot_put', { p_secret: secret, p_data: data });
      dirty = false;
    } catch (error) {
      console.error('[persistance] sauvegarde échouée :', (error as Error).message);
    } finally {
      fs.rmSync(tmp, { force: true });
      running = null;
    }
  })();
  return running;
}

export function scheduleSnapshot(): void {
  if (!persistenceEnabled()) return;
  dirty = true;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void pushSnapshot();
  }, 5000);
  timer.unref();
}

export async function pushMedia(name: string, mime: string, buffer: Buffer): Promise<void> {
  if (!persistenceEnabled()) return;
  try {
    await rpc('hp_media_put', { p_secret: secret, p_name: name, p_mime: mime, p_data: buffer.toString('base64') });
  } catch (error) {
    console.error('[persistance] image non sauvegardée :', (error as Error).message);
  }
}

/** Middleware : toute requête d'écriture réussie déclenche un instantané. */
export function persistOnWrite(req: Request, res: Response, next: NextFunction): void {
  if (persistenceEnabled() && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode < 400) scheduleSnapshot();
    });
  }
  next();
}

export async function startPersistence(): Promise<void> {
  if (!persistenceEnabled()) return;
  if (markDirtyAfterBoot) scheduleSnapshot();
  // Garde le projet Supabase actif (les projets gratuits se mettent en pause après 7 jours sans activité).
  const ping = () => void fetch(`${url}/rest/v1/rpc/hp_ping`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => undefined);
  ping();
  setInterval(ping, 6 * 3600 * 1000).unref();
}

export async function flushOnShutdown(): Promise<void> {
  if (!persistenceEnabled() || !dirty) return;
  if (timer) clearTimeout(timer);
  await Promise.race([pushSnapshot(), new Promise((resolve) => setTimeout(resolve, 4000))]);
}
