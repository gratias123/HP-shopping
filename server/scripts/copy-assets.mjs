// Copie les fichiers SQL non compilés par TypeScript vers dist/.
// Nécessaire pour que `npm start` applique les migrations en production.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const source = path.join(serverRoot, 'src', 'db', 'migrations');
const destination = path.join(serverRoot, 'dist', 'db', 'migrations');

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.info(`[build] migrations SQL copiées vers ${path.relative(serverRoot, destination)}`);
