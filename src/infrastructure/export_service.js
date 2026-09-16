/**
 * TraqHACCP Pro — Infrastructure Layer: Export Service
 *
 * Exports publics (contrat figé) :
 *   buildFullBackup(app)              → string JSON version '4.0-registre'
 *   parseBackup(text)                 → { ok, errors, data }
 *   exportRecordsCsv(app, opts)       → { filename, content, mime }
 *   registerHtml(app, opts)           → string HTML complet imprimable
 *   labelHtml(prep, app)              → string HTML étiquette 70×50 mm
 *   printDocument(html, opts)         → Promise<{ ok, errors? }>
 *   downloadFile(filename, content, mime)
 *   exportableYears(app)              → number[]
 *
 * Contraintes :
 *   - Pas d'accès DOM hors printDocument/downloadFile (fonctions pures)
 *   - Aucun alert(), aucune dépendance externe
 *   - HTML généré par export_register.js et export_label.js (découpage god-file)
 */

import { buildRegisterHtml } from './export_register.js';
import { buildLabelHtml }    from './export_label.js';

// ─── Constantes ───────────────────────────────────────────────────────────────
const ACCEPTED_VERSIONS = /^(3\.|4\.)/;
const CURRENT_VERSION   = '4.0-registre';

// ─── Helpers purs ─────────────────────────────────────────────────────────────

function _fmtDate(isoOrFr) {
  if (!isoOrFr) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrFr)) return isoOrFr;
  const d = new Date(isoOrFr);
  return isNaN(d) ? isoOrFr : d.toLocaleDateString('fr-FR');
}

function _fmtTime(t) {
  if (!t) return '';
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return isNaN(d) ? t : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function _fmtNum(v) {
  return (v === null || v === undefined) ? '' : String(v).replace('.', ',');
}

function _year(dateStr) {
  if (!dateStr) return null;
  if (/^\d{2}\/\d{2}\/(\d{4})$/.test(dateStr)) return parseInt(dateStr.slice(6), 10);
  const d = new Date(dateStr);
  return isNaN(d) ? null : d.getFullYear();
}

/** Échappe une valeur pour CSV Excel français (séparateur ;). */
function _csv(v) {
  if (v === null || v === undefined) return '""';
  return `"${String(v).replace(/"/g, '""')}"`;
}

// ─── Accesseurs repository ────────────────────────────────────────────────────

function _rec(app) {
  const r = app.repository;
  return {
    equipments:      r.getEquipments       ? r.getEquipments()        : [],
    deliveries:      r.getDeliveries       ? r.getDeliveries()        : [],
    preparations:    r.getPreparations     ? r.getPreparations()      : [],
    allergenDishes:  r.getAllergenDishes    ? r.getAllergenDishes()    : [],
    cleaning:        r.getCleaningTasks    ? r.getCleaningTasks()     : [],
    oils:            r.getFryers           ? r.getFryers()            : [],
    cooling:         r.getCoolingCycles    ? r.getCoolingCycles()     : [],
    defrost:         r.getDefrostCycles    ? r.getDefrostCycles()     : [],
    ph:              r.getPhRecords        ? r.getPhRecords()         : [],
    weights:         r.getWeightRecords    ? r.getWeightRecords()     : [],
    nonConformities: r.getNonConformities  ? r.getNonConformities()   : [],
    documents:       r.getSanitaryDocuments? r.getSanitaryDocuments() : [],
    checklists:      r.getChecklists       ? r.getChecklists()        : {},
  };
}

function _est(app) {
  return app.repository.getEstablishment ? app.repository.getEstablishment() : {};
}

function _brigade(app) {
  return app.repository.getBrigade ? app.repository.getBrigade() : [];
}

function _session(app) {
  try { return app.repository.getSession ? app.repository.getSession() : null; } catch { return null; }
}

function _settings(app) {
  try { return app.repository.getSettings ? app.repository.getSettings() : null; } catch { return null; }
}

function _activityLog(app) {
  try { return app.repository.getActivityLog ? app.repository.getActivityLog() : []; } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. buildFullBackup
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Construit la sauvegarde JSON complète (version '4.0-registre', compat v3).
 * @param {object} app
 * @returns {string} JSON indenté (indent 2)
 */
export function buildFullBackup(app) {
  const rec = _rec(app);
  return JSON.stringify({
    version:       CURRENT_VERSION,
    exportedAt:    new Date().toISOString(),
    establishment: _est(app),
    settings:      _settings(app),
    brigade:       _brigade(app),
    session:       _session(app),
    records: {
      equipments:      rec.equipments,
      deliveries:      rec.deliveries,
      preparations:    rec.preparations,
      allergenDishes:  rec.allergenDishes,
      cleaning:        rec.cleaning,
      oils:            rec.oils,
      cooling:         rec.cooling,
      defrost:         rec.defrost,
      ph:              rec.ph,
      weights:         rec.weights,
      nonConformities: rec.nonConformities,
      documents:       rec.documents,
      checklists:      rec.checklists,
      activityLog:     _activityLog(app),
    },
  }, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. parseBackup
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valide et normalise un export JSON (v3 ou v4).
 * Ne lève jamais d'exception, ne écrit jamais.
 * @param {string} text
 * @returns {{ ok: boolean, errors: string[], data?: object }}
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON invalide : ${e.message}`] };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['Le fichier doit contenir un objet JSON.'] };
  }
  if (!data.version || !ACCEPTED_VERSIONS.test(String(data.version))) {
    return { ok: false, errors: [`Version non reconnue : "${data.version}". Versions acceptées : 3.x, 4.x.`] };
  }
  // Compat v3 → v4 : données à la racine → sous records
  if (!data.records) {
    data = {
      ...data,
      records: {
        equipments:      data.equipments       || [],
        deliveries:      data.deliveries       || [],
        preparations:    data.preparations     || [],
        allergenDishes:  data.allergenDishes   || [],
        cleaning:        data.cleanings        || [],
        oils:            data.fryers           || [],
        cooling:         data.coolings         || [],
        defrost:         data.defrosts         || [],
        ph:              data.phRecords        || [],
        weights:         data.weightRecords    || [],
        nonConformities: data.nonConformities  || [],
        documents:       data.sanitaryDocuments|| [],
        checklists:      data.checklists       || {},
        activityLog:     [],
      },
    };
  }
  return { ok: true, errors: [], data };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. exportRecordsCsv
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Génère un export CSV (sep ;, BOM UTF-8, décimales virgule, dates fr).
 * @param {object} app
 * @param {{ type?: string, year?: number }} options
 * @returns {{ filename: string, content: string, mime: string }}
 */
export function exportRecordsCsv(app, options = {}) {
  const type = options.type || 'all';
  const year = options.year || null;
  const rec  = _rec(app);
  const est  = _est(app);
  const date = new Date().toLocaleDateString('fr-FR');
  const BOM  = '\uFEFF';

  const fil = (arr, dateFn) => year ? arr.filter(r => _year(dateFn(r)) === year) : arr;

  let csv = BOM;
  csv += _csv(`REGISTRE SANITAIRE — ${(est.name || '').toUpperCase()}`) + `;;;;\r\n`;
  csv += _csv(`Extraction le :`) + ';' + _csv(date) + `;;;;\r\n\r\n`;

  function section(title, header, rows) {
    csv += _csv(title) + '\r\n';
    csv += header.map(_csv).join(';') + '\r\n';
    rows.forEach(row => { csv += row.map(_csv).join(';') + '\r\n'; });
    csv += '\r\n';
  }

  if (type === 'temperatures' || type === 'all') {
    section('1. Températures — enceintes',
      ['Équipement', 'Type', 'Température (°C)', 'Norme min (°C)', 'Norme max (°C)', 'Statut', 'Dernier relevé', 'Opérateur'],
      fil(rec.equipments, e => e.lastLog || '').map(e => [
        e.name, e.type, _fmtNum(e.current), _fmtNum(e.min), _fmtNum(e.max),
        e.isConform ? (e.isConform() ? 'Conforme' : 'Non conforme') : e.status,
        _fmtTime(e.lastLog), e.operator,
      ]));
  }
  if (type === 'deliveries' || type === 'all') {
    section('2. Réceptions — contrôles fournisseurs',
      ['Réf', 'Fournisseur', 'N° BL', 'Catégorie', 'T° camion (°C)', 'T° produit (°C)', 'Décision', 'Heure', 'Opérateur'],
      fil(rec.deliveries, d => d.time).map(d => [
        d.id, d.supplier, d.bl, d.category,
        _fmtNum(d.truckTemp), _fmtNum(d.prodTemp), d.decision, _fmtTime(d.time), d.operator,
      ]));
  }
  if (type === 'preparations' || type === 'all') {
    section('3. Préparations — DLC et traçabilité',
      ['Réf', 'Dénomination', 'N° lot', 'Date fabrication', 'DLC', 'Quantité', 'Allergènes', 'Opérateur'],
      fil(rec.preparations, p => p.fabDate).map(p => [
        p.id, p.name, p.batch, _fmtDate(p.fabDate), _fmtDate(p.dlcDate),
        p.quantity, (p.allergens || []).join(' | '), p.operator,
      ]));
  }
  if (type === 'oils' || type === 'all') {
    section('4. Huiles de friture — TPM',
      ['Réf friteuse', 'Dénomination', 'Volume', 'TPM (%)', 'Statut', 'Dernier changement', 'Opérateur'],
      fil(rec.oils, o => o.lastChange).map(o => [
        o.id, o.name, o.volume, _fmtNum(o.lastTpm), o.status, _fmtDate(o.lastChange), o.operator,
      ]));
  }
  if (type === 'cooling' || type === 'all') {
    section('5. Refroidissement rapide',
      ['Réf', 'Préparation', 'T° départ (°C)', 'T° arrivée (°C)', 'Heure départ', 'Heure fin', 'Durée (min)', 'Statut', 'Opérateur'],
      fil(rec.cooling, c => c.startTime).map(c => [
        c.id, c.dish, _fmtNum(c.startTemp), _fmtNum(c.endTemp),
        _fmtTime(c.startTime), _fmtTime(c.endTime), c.durationMinutes, c.status, c.operator,
      ]));
  }
  if (type === 'defrost' || type === 'all') {
    section('6. Décongélation sanitaire',
      ['Réf', 'Produit', 'Lot origine', 'Date début', 'DLC max J+2', 'Enceinte', 'Statut', 'Opérateur'],
      fil(rec.defrost, d => d.startDate).map(d => [
        d.id, d.product, d.batchOrigin, _fmtDate(d.startDate), _fmtDate(d.maxDlcDate),
        d.chamberName, d.status, d.operator,
      ]));
  }
  if (type === 'ph' || type === 'all') {
    section('7. Contrôles pH',
      ['Réf', 'Produit', 'pH mesuré', 'pH cible max', 'Statut', 'Commentaire', 'Heure', 'Opérateur'],
      fil(rec.ph, p => p.time).map(p => [
        p.id, p.product, _fmtNum(p.measuredPh), _fmtNum(p.targetMaxPh),
        p.status, p.comment, _fmtTime(p.time), p.operator,
      ]));
  }
  if (type === 'weights' || type === 'all') {
    section('8. Contrôles poids',
      ['Réf', 'Plat', 'Poids cible (g)', 'Poids mesuré (g)', 'Écart (g)', 'Tolérance (%)', 'Statut', 'Heure', 'Opérateur'],
      fil(rec.weights, w => w.time).map(w => [
        w.id, w.dishName, _fmtNum(w.targetWeight), _fmtNum(w.measuredWeight),
        _fmtNum(w.delta), _fmtNum(w.tolerancePercent), w.status, _fmtTime(w.time), w.operator,
      ]));
  }
  if (type === 'nonconformities' || type === 'all') {
    section('9. Non-conformités et actions correctives (5M)',
      ['Réf', 'Date', 'Catégorie 5M', 'Sévérité', 'Incident', 'Cause', 'Action corrective', 'Opérateur', 'Statut'],
      fil(rec.nonConformities, n => n.date).map(n => [
        n.id, n.date, n.category5M, n.severity,
        n.equipOrSubject, n.cause, n.action, n.operator, n.status,
      ]));
  }

  const suffix    = year ? `_${year}` : '';
  const dateTag   = date.replace(/\//g, '-');
  const typeSuffix = type !== 'all' ? `_${type}` : '';
  return {
    filename: `TraqHACCP_CSV${typeSuffix}${suffix}_${dateTag}.csv`,
    content:  csv,
    mime:     'text/csv;charset=utf-8;',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. registerHtml
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Génère le registre sanitaire A4 imprimable (délègue à export_register.js).
 * @param {object} app
 * @param {{ year?: number }} options
 * @returns {string} document HTML complet
 */
export function registerHtml(app, options = {}) {
  const year = options.year || null;
  const rec  = _rec(app);
  const fil  = (arr, dateFn) => year ? arr.filter(r => _year(dateFn(r)) === year) : arr;

  return buildRegisterHtml({
    est:  _est(app),
    eqs:  fil(rec.equipments,     e => e.lastLog || ''),
    dels: fil(rec.deliveries,     d => d.time),
    preps:fil(rec.preparations,   p => p.fabDate),
    oils: fil(rec.oils,           o => o.lastChange),
    cool: fil(rec.cooling,        c => c.startTime),
    defr: fil(rec.defrost,        d => d.startDate),
    phs:  fil(rec.ph,             p => p.time),
    wgts: fil(rec.weights,        w => w.time),
    ncs:  fil(rec.nonConformities,n => n.date),
    docs: rec.documents,
  }, { year });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. labelHtml
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Génère l'étiquette de préparation 70 × 50 mm (délègue à export_label.js).
 * @param {object} prep – PreparationLabel
 * @param {object} app
 * @returns {string} document HTML complet
 */
export function labelHtml(prep, app) {
  return buildLabelHtml(prep, _est(app));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. printDocument
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ouvre une fenêtre et lance l'impression. Replis iframe, puis téléchargement.
 * @param {string} html
 * @param {{ title?: string, autoPrint?: boolean }} opts
 * @returns {Promise<{ ok: boolean, errors?: string[] }>}
 */
export async function printDocument(html, { title = 'Impression', autoPrint = true } = {}) {
  // Tentative 1 : popup
  let win = null;
  try { win = window.open('about:blank', '_blank'); } catch (_) { win = null; }

  if (win) {
    try {
      win.document.write(html);
      win.document.close();
      win.document.title = title;
      if (autoPrint) {
        await Promise.race([
          win.document.fonts ? win.document.fonts.ready : Promise.resolve(),
          new Promise(res => setTimeout(res, 200)),
        ]);
        win.print();
        setTimeout(() => { try { win.close(); } catch (_) {} }, 800);
      }
      return { ok: true };
    } catch (_) { try { win.close(); } catch (__) {} }
  }

  // Tentative 2 : iframe caché
  try {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.write(html);
    doc.close();
    if (autoPrint) {
      await Promise.race([
        doc.fonts ? doc.fonts.ready : Promise.resolve(),
        new Promise(res => setTimeout(res, 200)),
      ]);
      frame.contentWindow.print();
    }
    setTimeout(() => { try { document.body.removeChild(frame); } catch (_) {} }, 1500);
    return { ok: true };
  } catch (_) {}

  // Repli final : téléchargement
  const fn = `${title.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
  downloadFile(fn, html, 'text/html;charset=utf-8');
  return { ok: false, errors: ['Impression bloquée par le navigateur — fichier téléchargé'] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. downloadFile
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crée un Blob, déclenche le téléchargement via une ancre temporaire (URL révoquée).
 * @param {string} filename
 * @param {string} content
 * @param {string} mime
 */
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. exportableYears
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retourne les années présentes dans les données (ordre décroissant).
 * @param {object} app
 * @returns {number[]}
 */
export function exportableYears(app) {
  const rec = _rec(app);
  const years = new Set();
  const add = (arr, fn) => arr.forEach(r => { const y = _year(fn(r)); if (y) years.add(y); });

  add(rec.equipments,     e => e.lastLog || '');
  add(rec.deliveries,     d => d.time);
  add(rec.preparations,   p => p.fabDate);
  add(rec.oils,           o => o.lastChange);
  add(rec.cooling,        c => c.startTime);
  add(rec.defrost,        d => d.startDate);
  add(rec.ph,             p => p.time);
  add(rec.weights,        w => w.time);
  add(rec.nonConformities,n => n.date);

  return [...years].sort((a, b) => b - a);
}
