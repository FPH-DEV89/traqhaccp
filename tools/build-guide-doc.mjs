#!/usr/bin/env node
/**
 * build-guide-doc.mjs — HTML AUTOPORTANT du guide utilisateur TraqHACCP, destiné à
 * l'import Google Docs (docs.push-guide-drive.py). Les captures sont embarquées en
 * base64 (data URI) : sans cela, Google Docs importe le texte SANS les images.
 *
 * Usage : node tools/build-guide-doc.mjs
 * Sortie : docs/.guide-doc.html (intermédiaire, non versionné)
 * Garde-fou : échec si une capture de docs/captures/ est absente.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const marked = require('./vendor/marked.min.cjs');

const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const MD = path.join(DOCS, 'GUIDE_UTILISATEUR.md');
const OUT = path.join(DOCS, '.guide-doc.html');

const MIME = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif', webp: 'webp' };

let md = fs.readFileSync(MD, 'utf8');
let html = marked.parse(md, { gfm: true, breaks: false });

const missing = [];
let inlined = 0;
html = html.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/g, (whole, pre, src, post) => {
  if (src.startsWith('data:')) return whole;
  const abs = path.resolve(DOCS, src);
  if (!fs.existsSync(abs)) {
    missing.push(src);
    return whole;
  }
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    missing.push(`${src} (extension non supportée)`);
    return whole;
  }
  const b64 = fs.readFileSync(abs).toString('base64');
  inlined += 1;
  return `<img${pre}src="data:image/${mime};base64,${b64}"${post}>`;
});

if (missing.length) {
  console.error(`ERREUR — captures manquantes ou illisibles :\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const doc = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>TraqHACCP — Guide utilisateur (v4.0-registre)</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; color: #101828; }
  h1 { font-size: 22pt; } h2 { font-size: 16pt; } h3 { font-size: 12pt; } h4 { font-size: 11pt; }
  code { font-family: "Courier New", monospace; font-size: 9.5pt; }
  table { border-collapse: collapse; } th, td { border: 1px solid #999; padding: 4px 7px; font-size: 10pt; }
  img { width: 620px; }
</style></head>
<body>
${html}
</body></html>`;

fs.writeFileSync(OUT, doc);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`HTML OK — ${inlined} capture(s) embarquée(s) · ${kb} Ko · ${path.relative(process.cwd(), OUT)}`);
