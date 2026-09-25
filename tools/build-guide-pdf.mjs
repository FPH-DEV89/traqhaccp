#!/usr/bin/env node
/**
 * build-guide-pdf.mjs — Génère le PDF client-ready du guide utilisateur TraqHACCP
 * depuis docs/GUIDE_UTILISATEUR.md (source de vérité du guide, en Markdown).
 *
 * Usage : npm run guide:pdf   (ou `node tools/build-guide-pdf.mjs`)
 *
 * Prérequis : playwright + chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/data/.pw-browsers).
 * Sorties   : docs/.guide-print.html (intermédiaire, non versionné) et docs/GUIDE_UTILISATEUR.pdf.
 * Garde-fou : le build ÉCHOUE si une capture de docs/captures/ ne se charge pas — un guide
 *             avec une image cassée n'atteint jamais le client.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/data/node_modules/playwright'));
}

const marked = require('./vendor/marked.min.cjs');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const MD = path.join(ROOT, 'GUIDE_UTILISATEUR.md');
const OUT_HTML = path.join(ROOT, '.guide-print.html');
const OUT_PDF = path.join(ROOT, 'GUIDE_UTILISATEUR.pdf');

let md = fs.readFileSync(MD, 'utf8');

// Page de garde : on retire l'en-tête d'origine (repris dans la couverture stylée).
md = md.replace(/^# TraqHACCP — Guide utilisateur[\s\S]*?---\n\n---\n/, '');

const body = marked.parse(md, { gfm: true, breaks: false });

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>TraqHACCP — Guide utilisateur</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #101828; font-size: 10.5pt; line-height: 1.62; margin: 0; }
  h1, h2, h3, h4 { color: #0b1f1c; line-height: 1.25; }
  h2 { font-size: 17pt; margin: 0 0 12px; padding-bottom: 8px;
       border-bottom: 2px solid #0f766e; break-before: page; break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 20px 0 6px; color: #0f766e; break-after: avoid; }
  h4 { font-size: 11pt; margin: 14px 0 4px; break-after: avoid; }
  p { margin: 0 0 9px; }
  a { color: #0f766e; text-decoration: none; }
  strong { color: #0b1f1c; }
  ul, ol { margin: 0 0 10px; padding-left: 20px; }
  li { margin-bottom: 4px; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 9pt;
         background: #f1f5f9; padding: 1px 5px; border-radius: 4px; color: #0f766e; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 9.5pt;
          break-inside: avoid; }
  th { background: #0f766e; color: #fff; text-align: left; padding: 7px 9px; font-weight: 600; }
  td { padding: 6px 9px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  blockquote { margin: 12px 0; padding: 10px 14px; background: #fffbeb;
               border-left: 4px solid #d97706; border-radius: 0 6px 6px 0;
               break-inside: avoid; font-size: 10pt; }
  blockquote p { margin: 0; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 22px 0; }
  img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; margin: 10px 0;
        break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  /* Couverture */
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: space-between;
           break-after: page; }
  .cover-top { border-top: 6px solid #0f766e; padding-top: 18px; }
  .brand { font-size: 11pt; letter-spacing: .18em; text-transform: uppercase; color: #0f766e;
           font-weight: 700; }
  .cover h1 { font-size: 34pt; margin: 26px 0 6px; letter-spacing: -.02em; }
  .cover .sub { font-size: 14pt; color: #475467; margin-bottom: 4px; }
  .cover .ver { display: inline-block; margin-top: 14px; font-size: 9.5pt; font-weight: 700;
                color: #fff; background: #0f766e; padding: 5px 12px; border-radius: 999px; }
  .cover .hero img { box-shadow: 0 12px 30px rgba(15,23,42,.18); }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 26px;
                font-size: 10pt; border-top: 1px solid #e5e7eb; padding-top: 14px; }
  .cover-meta b { color: #0f766e; display: block; font-size: 8.5pt; letter-spacing: .06em;
                  text-transform: uppercase; }
  .fill { border-bottom: 1px dotted #94a3b8; display: inline-block; min-width: 150px; height: 13px; }
</style></head>
<body>
  <section class="cover">
    <div class="cover-top">
      <div class="brand">TraqHACCP · CE 852 · Pâtisserie</div>
      <h1>Guide utilisateur</h1>
      <div class="sub">Registre sanitaire numérique — traçabilité, DLC, food cost</div>
      <div class="ver">Version 4.0-registre</div>
    </div>
    <div class="hero"><img src="captures/vue-traceability.png" alt="Écran principal">
      <div style="font-size:8.5pt;color:#667085;margin-top:2px;">Illustrations : registre d'exemple d'un établissement fictif — un registre nouvellement créé démarre vide.</div>
    </div>
    <div class="cover-meta">
      <div><b>Application</b>https://traqhaccp.vercel.app</div>
      <div><b>Établissement destinataire</b><span class="fill"></span></div>
      <div><b>Référentiel</b>Règlement (CE) 852/2004 · Arrêté 21/12/2009 · DGAL/SDSSA/2010-8075</div>
      <div><b>Date de remise</b><span class="fill"></span></div>
      <div><b>Éditeur</b>FPH Solutions — contact@fph-solutions.com</div>
      <div><b>Document</b>Guide utilisateur — à conserver dans le laboratoire</div>
    </div>
  </section>
  ${body}
</body></html>`;

fs.writeFileSync(OUT_HTML, html);

const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + OUT_HTML, { waitUntil: 'load' });
await p
  .waitForFunction(
    () => [...document.images].length > 0 && [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 20000 },
  )
  .catch(() => {
    throw new Error('Captures non chargées : vérifier les chemins relatifs captures/*.png');
  });
await p.pdf({
  path: OUT_PDF,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate:
    '<div style="font-size:7pt;color:#94a3b8;width:100%;padding:0 16mm;">TraqHACCP — Guide utilisateur · version 4.0-registre</div>',
  footerTemplate:
    '<div style="font-size:7pt;color:#94a3b8;width:100%;padding:0 16mm;text-align:right;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  margin: { top: '20mm', bottom: '18mm', left: '16mm', right: '16mm' },
});
await b.close();
const st = fs.statSync(OUT_PDF);
console.log('PDF OK', (st.size / 1024 / 1024).toFixed(2), 'Mo');
