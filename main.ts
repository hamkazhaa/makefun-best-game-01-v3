// Harbour Line — the entry program. It copies game/ and screenshots/
// into the output directory and writes dossier.json with the kit's
// buildDossier, exactly as the scorer re-runs it. Node 22, standard
// library only, no network, deterministic: two runs write the same bytes.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, dereference: false });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const gameFiles = JSON.parse(readFileSync(join(outDir, 'dossier.json'), 'utf8')) as { text?: string };
const textBytes = Buffer.byteLength(gameFiles.text ?? '', 'utf8');
console.log(`Harbour Line handed in: dossier ${dossier.length} bytes, text ${textBytes} bytes`);
