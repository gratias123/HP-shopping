import { config } from '../../config.js';
import { initDatabase, closeDatabase } from '../index.js';
import { seedDatabase } from './index.js';

initDatabase(config.databasePath);
const result = seedDatabase();
closeDatabase();

if (result.seeded) {
  console.info(
    `Catalogue de démonstration créé : ${result.products} produits, 8 catégories, zones et tarifs de livraison, code promo BIENVENUE10.`,
  );
  console.info('Les articles sont fictifs (références DEMO-*) et signalés comme tels sur la boutique.');
} else {
  console.info('Le catalogue a déjà été initialisé : aucune donnée de démonstration ajoutée.');
}
