import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { execute, queryOne } from '../src/db/index.js';
import { syncDemoProducts } from '../src/db/seed/index.js';
import { createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await createTestContext();
});
after(async () => {
  await ctx.stop();
});

const count = () => Number(queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM products')?.n ?? 0);

test('les nouveaux articles de démonstration sont ajoutés une seule fois, sans recréer ceux supprimés', () => {
  const total = count();
  assert.equal(syncDemoProducts(), 0, 'première synchro : tout est déjà présent');

  // Simule un article ajouté dans une version ultérieure du code.
  const ledger = JSON.parse(queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'seed_ledger'")!.value) as string[];
  const removed = ledger.pop()!;
  execute('DELETE FROM products WHERE slug = ?', [removed]);
  execute("UPDATE settings SET value = ? WHERE key = 'seed_ledger'", [JSON.stringify(ledger)]);
  assert.equal(syncDemoProducts(), 1);
  assert.equal(count(), total);
  assert.equal(syncDemoProducts(), 0, 'idempotent');

  // Un article supprimé par l'administrateur ne revient pas.
  execute('DELETE FROM products WHERE slug = ?', [removed]);
  assert.equal(syncDemoProducts(), 0);
  assert.equal(count(), total - 1);
});
