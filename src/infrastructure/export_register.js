/**
 * TraqHACCP Pro — Infrastructure: HTML Registre Sanitaire
 * design-ignore-file:couleurs
 *
 * Génère le document HTML imprimable du registre sanitaire annuel.
 * Fonction pure : reçoit des données brutes, retourne une chaîne HTML.
 * Aucun accès DOM. Aucune dépendance externe.
 */

const CURRENT_VERSION = '4.0-registre';

/**
 * Formate un nombre décimal avec virgule (convention française).
 * @param {number|string|null} v
 */
function fmtNum(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace('.', ',');
}

function fmtDate(isoOrFr) {
  if (!isoOrFr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrFr)) return isoOrFr;
  const d = new Date(isoOrFr);
  return isNaN(d) ? isoOrFr : d.toLocaleDateString('fr-FR');
}

function tr(cells, tag = 'td') {
  return `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
}

function tbl(headers, rows, emptyMsg = 'Aucune donnée') {
  if (!rows.length) {
    return `<p style="color:#6F757B;font-style:italic;font-size:8pt;">${emptyMsg}</p>`;
  }
  return `<table>
    <thead>${tr(headers, 'th')}</thead>
    <tbody>${rows.map(r => tr(r)).join('')}</tbody>
  </table>`;
}

function statusLabel(s) {
  if (s === 'ok' || s === 'success' || s === 'Conforme') {
    return `<span class="ok">Conforme</span>`;
  }
  if (s === 'warning' || s === 'Majeure' || s === 'warn') {
    return `<span class="warn">À surveiller</span>`;
  }
  return `<span class="nc">Non conforme</span>`;
}

/** Styles inline du registre (A4, typographie éditoriale, impression propre). */
function registerCss() {
  return `/* design-ignore: document imprimé autonome */
@page { size: A4 portrait; margin: 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Archivo', Helvetica, Arial, sans-serif;
  font-size: 10pt; line-height: 1.5; color: #1A1C1E; background: #ffffff; }
.reg-header { border-bottom: 2px solid #0E4F55; /* design-ignore: document imprimé autonome */
  padding-bottom: 10px; margin-bottom: 18px; }
.reg-title { font-family: 'Instrument Serif', Georgia, serif;
  font-size: 22pt; font-weight: 400; color: #0E4F55; /* design-ignore: document imprimé autonome */
  text-wrap: balance; margin-bottom: 4px; }
.reg-meta { font-size: 8.5pt; color: #4C5257; }
.reg-meta strong { color: #1A1C1E; }
.reg-section { margin-top: 18px; break-inside: avoid; }
.reg-section-title { font-family: 'Archivo', Helvetica, Arial, sans-serif;
  font-size: 10pt; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.07em; color: #4C5257;
  border-bottom: 1px solid #DDD9CF; /* design-ignore: document imprimé autonome */
  padding-bottom: 3px; margin-bottom: 6px; }
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 10px; }
thead { display: table-header-group; }
th { background: #EAE7DF; /* design-ignore: document imprimé autonome */
  border-bottom: 1.5px solid #0E4F55; /* design-ignore: document imprimé autonome */
  border: 1px solid #C3BEB1; /* design-ignore: document imprimé autonome */
  text-align: left; padding: 4px 7px; font-size: 7.5pt; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; color: #4C5257; }
td { border: 1px solid #DDD9CF; /* design-ignore: document imprimé autonome */
  padding: 3.5px 7px; vertical-align: top; }
tr { break-inside: avoid; }
tr:nth-child(even) td { background: #F2F0EA; /* design-ignore: document imprimé autonome */ }
.num { font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-variant-numeric: tabular-nums; }
.ok   { color: #1D6B3F; font-weight: 600; }
.warn { color: #8A5A00; font-weight: 600; }
.nc   { color: #9E241C; font-weight: 600; }
.kpi-row { display: flex; gap: 16px; margin-bottom: 14px; }
.kpi-box { border: 1px solid #C3BEB1; /* design-ignore: document imprimé autonome */
  padding: 8px 14px; min-width: 110px; text-align: center; }
.kpi-val { font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 20pt; font-weight: 500; color: #0E4F55; /* design-ignore: document imprimé autonome */
  display: block; }
.kpi-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.07em; color: #4C5257; }
.reg-footer { margin-top: 24px;
  border-top: 1px solid #C3BEB1; /* design-ignore: document imprimé autonome */
  padding-top: 8px; font-size: 7.5pt; color: #6F757B;
  display: flex; justify-content: space-between; }`;
}

/**
 * Génère le document HTML complet du registre sanitaire imprimable.
 *
 * @param {{ est, eqs, dels, preps, oils, cool, defr, phs, wgts, ncs, docs }} data
 * @param {{ year?: number }} options
 * @returns {string} document HTML complet
 */
export function buildRegisterHtml(data, options = {}) {
  const { est = {}, eqs = [], dels = [], preps = [], oils = [], cool = [],
    defr = [], phs = [], wgts = [], ncs = [], docs = [] } = data;
  const year = options.year || null;

  const dateEdition = new Date().toLocaleDateString('fr-FR');
  const title = year ? `Registre sanitaire — année ${year}` : 'Registre sanitaire — toutes périodes';

  // Synthèse conformité
  const allRecs = [...eqs, ...dels, ...cool, ...phs, ...wgts];
  const confCount = allRecs.filter(r => {
    if (r.isConform) return r.isConform();
    return r.status === 'ok' || r.status === 'success' || r.status === 'Conforme';
  }).length;
  const conformRate = allRecs.length ? Math.round((confCount / allRecs.length) * 100) : 100;
  const ncOpen = ncs.filter(n => n.status !== 'Résolu').length;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${registerCss()}</style>
</head>
<body>
  <div class="reg-header">
    <div class="reg-title">${title}</div>
    <div class="reg-meta">
      <strong>${est.name || 'Établissement'}</strong>${est.siret ? ` — SIRET : ${est.siret}` : ''}${est.address ? ` — ${est.address}` : ''}<br>
      ${est.manager ? `Responsable HACCP : <strong>${est.manager}</strong> — ` : ''}${est.agreement ? `N° agrément : ${est.agreement} — ` : ''}Édité le : <strong>${dateEdition}</strong>
    </div>
  </div>
  <div class="reg-section">
    <div class="reg-section-title">Synthèse</div>
    <div class="kpi-row">
      <div class="kpi-box"><span class="kpi-val">${conformRate} %</span><span class="kpi-label">Taux de conformité</span></div>
      <div class="kpi-box"><span class="kpi-val">${ncs.length}</span><span class="kpi-label">Non-conformités</span></div>
      <div class="kpi-box"><span class="kpi-val">${ncOpen}</span><span class="kpi-label">NC ouvertes</span></div>
      <div class="kpi-box"><span class="kpi-val">${preps.length}</span><span class="kpi-label">Préparations</span></div>
    </div>
  </div>
  <div class="reg-section">
    <div class="reg-section-title">1. Relevés de températures — enceintes</div>
    ${tbl(
      ['Équipement', 'Plage sanitaire', 'T° constatée', 'Statut', 'Dernier relevé', 'Opérateur'],
      eqs.map(e => [
        e.name,
        `<span class="num">${fmtNum(e.min)} – ${fmtNum(e.max)} °C</span>`,
        `<span class="num">${fmtNum(e.current)} °C</span>`,
        statusLabel(e.isConform ? (e.isConform() ? 'ok' : 'danger') : e.status),
        e.lastLog, e.operator,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">2. Contrôles à réception — fournisseurs</div>
    ${tbl(
      ['Réf', 'Fournisseur', 'N° BL', 'Catégorie', 'T° camion', 'T° produit', 'Décision', 'Heure'],
      dels.map(d => [
        d.id, d.supplier, d.bl, d.category,
        `<span class="num">${fmtNum(d.truckTemp)} °C</span>`,
        `<span class="num">${fmtNum(d.prodTemp)} °C</span>`,
        d.decision, d.time,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">3. Préparations — DLC et traçabilité secondaire</div>
    ${tbl(
      ['Réf', 'Dénomination', 'N° lot', 'Date fab.', 'DLC', 'Quantité', 'Opérateur'],
      preps.map(p => [
        p.id, p.name, `<span class="num">${p.batch}</span>`,
        fmtDate(p.fabDate), fmtDate(p.dlcDate), p.quantity, p.operator,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">4. Huiles de friture — TPM</div>
    ${tbl(
      ['Friteuse', 'Volume', 'TPM (%)', 'Statut', 'Dernier changement', 'Opérateur'],
      oils.map(o => [
        o.name, o.volume, `<span class="num">${fmtNum(o.lastTpm)}</span>`,
        statusLabel(o.status), fmtDate(o.lastChange), o.operator,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">5. Refroidissement rapide (63 °C → 10 °C en 2 h)</div>
    ${tbl(
      ['Réf', 'Préparation', 'T° départ', 'T° arrivée', 'Durée (min)', 'Statut', 'Opérateur'],
      cool.map(c => [
        c.id, c.dish,
        `<span class="num">${fmtNum(c.startTemp)} °C</span>`,
        `<span class="num">${fmtNum(c.endTemp)} °C</span>`,
        `<span class="num">${c.durationMinutes}</span>`,
        statusLabel(c.status), c.operator,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">6. Décongélation sanitaire</div>
    ${tbl(
      ['Réf', 'Produit', 'Lot', 'Date début', 'DLC max', 'Enceinte', 'Statut', 'Opérateur'],
      defr.map(d => [
        d.id, d.product, d.batchOrigin,
        fmtDate(d.startDate), fmtDate(d.maxDlcDate),
        d.chamberName, d.status, d.operator,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">7. Contrôles pH</div>
    ${tbl(
      ['Réf', 'Produit', 'pH mesuré', 'pH max cible', 'Statut', 'Commentaire', 'Opérateur'],
      phs.map(p => [
        p.id, p.product,
        `<span class="num">${fmtNum(p.measuredPh)}</span>`,
        `<span class="num">${fmtNum(p.targetMaxPh)}</span>`,
        statusLabel(p.status), p.comment || '', p.operator,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">8. Contrôles poids — portionnement</div>
    ${tbl(
      ['Réf', 'Plat', 'Cible (g)', 'Mesuré (g)', 'Écart (g)', 'Tolérance', 'Statut', 'Opérateur'],
      wgts.map(w => [
        w.id, w.dishName,
        `<span class="num">${fmtNum(w.targetWeight)}</span>`,
        `<span class="num">${fmtNum(w.measuredWeight)}</span>`,
        `<span class="num">${fmtNum(w.delta)}</span>`,
        `<span class="num">±${fmtNum(w.tolerancePercent)} %</span>`,
        statusLabel(w.status), w.operator,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">9. Non-conformités et actions correctives (méthode 5M)</div>
    ${tbl(
      ['Réf', 'Date', 'Catégorie 5M', 'Sévérité', 'Incident', 'Action corrective', 'Opérateur', 'Statut'],
      ncs.map(n => [
        n.id, n.date, n.category5M, n.severity,
        n.equipOrSubject, n.action, n.operator, n.status,
      ])
    )}
  </div>
  <div class="reg-section">
    <div class="reg-section-title">10. Classeur GED — justificatifs sanitaires</div>
    ${tbl(
      ['Réf', 'Document', 'Organisme émetteur', 'Date émission', 'Expiration', 'Statut'],
      docs.map(d => [
        d.id, d.title, d.issuer, fmtDate(d.fileDate),
        d.expireDate || 'Permanente',
        d.isExpired && d.isExpired()
          ? `<span class="nc">Expiré</span>`
          : `<span class="ok">Valide</span>`,
      ])
    )}
  </div>
  <div class="reg-footer">
    <span>TraqHACCP v${CURRENT_VERSION} — CE 852/2004, CE 178/2002, INCO 1169/2011</span>
    <span>Page __ / __</span>
    <span>Signature du responsable : ____________________</span>
  </div>
</body>
</html>`;
}
