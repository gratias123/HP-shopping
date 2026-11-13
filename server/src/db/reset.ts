import fs from 'node:fs';
import { config } from '../config.js';
import { initDatabase, closeDatabase } from '../db/index.js';

const confirmed = process.argv.includes('--yes');
if (!confirmed) {
  console.error('Cette commande supprime la base locale et toutes ses données.');
  console.error(`Fichier concerné : ${config.databasePath}`);
  console.error('Relancez avec --yes pour confirmer.');
  process.exit(1);
}

for (const suffix of ['', '-wal', '-shm']) {
  const file = `${config.databasePath}${suffix}`;
  if (fs.existsSync(file)) fs.rmSync(file);
}
initDatabase(config.databasePath);
closeDatabase();
console.info('Base locale réinitialisée (schéma recréé, catalogue vide).');
console.info('Lancez `npm run seed` pour installer le catalogue de démonstration.');
