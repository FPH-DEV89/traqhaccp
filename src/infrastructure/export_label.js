/**
 * TraqHACCP Pro — Infrastructure: HTML Étiquette de Préparation
 * design-ignore-file:couleurs
 *
 * Génère le document HTML d'une étiquette 70 × 50 mm (mentions INCO 1169/2011).
 * Fonction pure : reçoit des données brutes, retourne une chaîne HTML.
 * Utilise BarcodeService pour le code-barres du lot.
 * Aucun accès DOM. Aucune dépendance externe hormis barcode_service.js.
 */

import { BarcodeService } from './barcode_service.js';

function fmtDate(isoOrFr) {
  if (!isoOrFr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrFr)) return isoOrFr;
  const d = new Date(isoOrFr);
  return isNaN(d) ? isoOrFr : d.toLocaleDateString('fr-FR');
}

/** Styles inline de l'étiquette 70 × 50 mm, lisible à 300 dpi. */
function labelCss() {
  return `/* design-ignore: document imprimé autonome */
@page { size: 70mm 50mm; margin: 3mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 64mm; height: 44mm;
  font-family: 'Archivo', Helvetica, Arial, sans-serif;
  font-size: 6pt; color: #000000; /* design-ignore: document imprimé autonome */
  overflow: hidden; }
.lbl-name { font-weight: 700; font-size: 8pt; line-height: 1.15;
  border-bottom: 0.5pt solid #000000; /* design-ignore: document imprimé autonome */
  padding-bottom: 1mm; margin-bottom: 1mm; }
.lbl-dlc { font-weight: 700; font-size: 7pt;
  border: 0.5pt solid #000000; /* design-ignore: document imprimé autonome */
  padding: 0.8mm 1.5mm; margin-bottom: 1mm; display: inline-block; }
.lbl-row { margin-bottom: 0.5mm; }
.lbl-key { font-weight: 600; }
.lbl-allergens { font-size: 5.5pt; font-style: italic; margin-top: 0.5mm; }
.lbl-barcode { margin-top: 1mm; }
.lbl-barcode svg { width: 100%; max-height: 10mm; }
.lbl-lot { font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 5pt; margin-top: 0.5mm; }
.lbl-footer { font-size: 5pt; margin-top: 1mm;
  border-top: 0.3pt solid #777777; /* design-ignore: document imprimé autonome */
  padding-top: 0.5mm; color: #333333; /* design-ignore: document imprimé autonome */ }`;
}

/**
 * Génère le document HTML d'une étiquette de préparation.
 *
 * @param {object} prep  – PreparationLabel (name, batch, fabDate, dlcDate,
 *                         durationDays, allergens, operator)
 * @param {object} est   – Établissement (name)
 * @returns {string} document HTML complet
 */
export function buildLabelHtml(prep, est) {
  const barcodeSvg = BarcodeService.generateBarcodeSVG(prep.batch || 'LOT-000', 28);

  const dlcLabel = prep.dlcDate
    ? `À consommer jusqu'au ${fmtDate(prep.dlcDate)}`
    : `À consommer sous J+${prep.durationDays || 3}`;

  const allergensList = prep.allergens && prep.allergens.length
    ? prep.allergens.join(', ')
    : 'Aucun allergène déclaré';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Étiquette — ${prep.name || 'Préparation'}</title>
  <style>${labelCss()}</style>
</head>
<body>
  <div class="lbl-name">${prep.name || 'Préparation maison'}</div>
  <div class="lbl-dlc">${dlcLabel}</div>
  <div class="lbl-row">
    <span class="lbl-key">Fabrication :</span> ${fmtDate(prep.fabDate)}
    &nbsp;|&nbsp;<span class="lbl-key">Opérateur :</span> ${prep.operator || ''}
  </div>
  <div class="lbl-row">
    <span class="lbl-key">Conservation :</span> 0 °C / +4 °C (réfrigéré)
  </div>
  <div class="lbl-allergens">
    <span class="lbl-key">Allergènes :</span> ${allergensList}
  </div>
  <div class="lbl-barcode">${barcodeSvg}</div>
  <div class="lbl-lot"><span class="lbl-key">Lot :</span> ${prep.batch || ''}</div>
  <div class="lbl-footer">
    ${est.name || ''} — Produit étiqueté conformément au règlement INCO 1169/2011
  </div>
</body>
</html>`;
}
