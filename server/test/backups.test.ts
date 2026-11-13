import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test, { after, before } from 'node:test';
import { createBackup, listBackups, pruneBackups, verifyBackup } from '../src/services/backups.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-backup-test-'));
const databasePath = path.join(root, 'source.sqlite');
const uploadDir = path.join(root, 'uploads');
const backupDir = path.join(root, 'backups');
let backupDirectory = '';

before(() => {
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, 'produit.jpg'), Buffer.from('image-test'));
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE orders (id TEXT PRIMARY KEY, total INTEGER NOT NULL);
    INSERT INTO users (id, email) VALUES ('u1', 'client@example.com');
    INSERT INTO products (id, name) VALUES ('p1', 'Produit test');
    INSERT INTO orders (id, total) VALUES ('o1', 150000);
  `);
  db.close();
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('une sauvegarde copie la base, les médias et reste vérifiable', () => {
  const backup = createBackup({ databasePath, uploadDir, backupDir, label: 'test' });
  backupDirectory = backup.directory;

  assert.equal(backup.manifest?.uploadsCopied, true);
  assert.equal(backup.manifest?.uploadsFiles, 1);
  assert.ok(fs.existsSync(path.join(backup.directory, 'database.sqlite')));
  assert.ok(fs.existsSync(path.join(backup.directory, 'uploads', 'produit.jpg')));
  assert.ok(fs.existsSync(path.join(backup.directory, 'manifest.json')));

  const verified = verifyBackup(backup.directory);
  assert.equal(verified.ok, true);
  assert.equal(verified.integrity, 'ok');
  assert.equal(verified.counts.users, 1);
  assert.equal(verified.counts.products, 1);
  assert.equal(verified.counts.orders, 1);
});

test('la purge ne supprime que les lots au-delà de la rétention et du minimum', () => {
  assert.equal(listBackups(backupDir).length, 1);
  const removed = pruneBackups(backupDir, {
    retentionDays: 0,
    keep: 0,
    now: new Date(Date.now() + 1000),
  });
  assert.equal(removed.length, 1);
  assert.equal(removed[0], backupDirectory);
  assert.equal(listBackups(backupDir).length, 0);
});
