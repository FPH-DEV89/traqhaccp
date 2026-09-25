/**
 * js/patisserie/archive.js — Couche UI de l'export PDF d'archive du registre sanitaire.
 *
 * Déclenché depuis Réglages > Données & sauvegardes :
 *   - Sélection des bornes de période (du / au)
 *   - Raccourci « Toute la période »
 *   - Filtrage temporel des relevés
 *   - Calcul d'intégrité SHA-256 (Web Crypto API hors-ligne)
 *   - Téléchargement du document d'archive opposable
 */

import { state } from './state.js';
import { readSettings } from './settings.js';
import { construireArchiveRegistre, chargeCanonique, nomFichierArchive } from '../../src/presentation/archive_registre.js';
import { telechargerPdf } from '../../src/presentation/ddpp_report.js';

let filtreDu = null;
let filtreAu = null;

function dateAujourdhui() {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const jour = String(maintenant.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

function dateDebutDefaut() {
  const dates = [];
  (state.lots || []).forEach(l => {
    if (l && l.receiptDate) dates.push(String(l.receiptDate).slice(0, 10));
  });
  (state.secondaryDlcs || []).forEach(p => {
    if (p && p.creationDate) dates.push(String(p.creationDate).slice(0, 10));
  });
  (state.witnessSamples || []).forEach(w => {
    if (w && w.serviceDate) dates.push(String(w.serviceDate).slice(0, 10));
  });
  const valides = dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (valides.length > 0) {
    return valides[0];
  }
  const annee = new Date().getFullYear();
  return `${annee}-01-01`;
}

/**
 * Rendu du fragment HTML pour la section d'archive PDF dans l'onglet Données.
 */
export function renderArchivePdf(ctx) {
  const du = filtreDu !== null ? filtreDu : dateDebutDefaut();
  const au = filtreAu !== null ? filtreAu : dateAujourdhui();

  return `<section class="section">
    <div class="section__head">
      <span class="section__title">Archive opposable (PDF)</span>
    </div>
    <div class="settings__rows">
      <div class="settings__grid">
        ${ctx.textField('archive-du', 'Du', du, 'Début de la période couverte.', { type: 'date' })}
        ${ctx.textField('archive-au', 'Au', au, 'Fin de la période couverte.', { type: 'date' })}
      </div>
      ${ctx.settingRow('Génération du PDF', 'Export opposable en cas de contrôle officiel DDPP.',
        `<button type="button" class="btn btn--primary" data-settings-action="archive-pdf-exporter">Générer l'archive PDF</button> <button type="button" class="btn btn--ghost" data-settings-action="archive-pdf-tout">Toute la période</button>`)}
      ${ctx.settingRow('Production locale', "L'archive est générée localement sans aucun envoi réseau.",
        `<span class="mark mark--neutral"><span class="mark__label">Aucune donnée n'est transmise : le PDF est produit dans le navigateur.</span></span>`)}
      <p class="settings__row-hint">PDF à conserver en cas de contrôle : en-tête d'établissement, période, relevés, signatures opérateur et responsable, empreinte d'intégrité.</p>
    </div>
  </section>`;
}

/**
 * Enregistre les gestionnaires d'action pour l'export et la réinitialisation des bornes.
 */
export function brancherArchivePdf(ctx) {
  ctx.registerAction('archive-pdf-exporter', () => exporterArchivePdf(ctx));
  ctx.registerAction('archive-pdf-tout', () => {
    filtreDu = dateDebutDefaut();
    filtreAu = dateAujourdhui();
    ctx.rerender();
  });
}

/**
 * Exécute la procédure d'exportation de l'archive PDF.
 */
export async function exporterArchivePdf(ctx) {
  try {
    const racine = document.getElementById('settings-root');
    const inputDu = racine ? racine.querySelector('[name="archive-du"]') : null;
    const inputAu = racine ? racine.querySelector('[name="archive-au"]') : null;

    const du = inputDu ? inputDu.value.trim() : (filtreDu || dateDebutDefaut());
    const au = inputAu ? inputAu.value.trim() : (filtreAu || dateAujourdhui());

    const regexDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!du || !regexDate.test(du) || !au || !regexDate.test(au)) {
      ctx.showToast('Les bornes de période doivent être des dates valides (AAAA-MM-JJ).');
      return;
    }

    if (du > au) {
      ctx.showToast('La date de début doit être antérieure ou égale à la date de fin.');
      return;
    }

    filtreDu = du;
    filtreAu = au;

    const periode = { du, au };

    const dansPeriode = (valeur) => {
      const d = String(valeur || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true;
      return d >= du && d <= au;
    };

    const lotsFiltres = (state.lots || []).filter(l => dansPeriode(l.receiptDate));
    const preparationsFiltrees = (state.secondaryDlcs || []).filter(p => dansPeriode(p.creationDate));
    const temoinsFiltres = (state.witnessSamples || []).filter(w => dansPeriode(w.serviceDate));
    const ventes = state.salesHistory || [];
    const equipe = state.teamMembers || [];

    const opMembre = equipe.find(m => m.id === state.currentOperatorId);
    const operateur = opMembre
      ? {
          nom: `${opMembre.firstName || ''} ${opMembre.lastName || ''}`.trim() || opMembre.role || 'Opérateur',
          role: opMembre.role || 'Opérateur'
        }
      : { nom: 'Opérateur non identifié', role: '' };

    const settings = readSettings();
    const etablissement = settings.establishment || {};
    const respMembre = equipe.find(m => m.role && /responsable/i.test(m.role));
    const responsable = {
      nom: etablissement.manager || (respMembre ? `${respMembre.firstName || ''} ${respMembre.lastName || ''}`.trim() : ''),
      role: "Responsable d'établissement"
    };

    const donneesBase = {
      etablissement,
      lots: lotsFiltres,
      secondaryDlcs: preparationsFiltrees,
      witnessSamples: temoinsFiltres,
      salesHistory: ventes,
      teamMembers: equipe,
      periode,
      operateur,
      responsable
    };

    const canon = chargeCanonique(donneesBase);
    let empreinte = '';
    if (globalThis.crypto && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.digest === 'function') {
      const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
      empreinte = Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    const maintenant = new Date();
    const donneesPdf = {
      ...donneesBase,
      empreinte,
      now: maintenant
    };

    const octets = construireArchiveRegistre(donneesPdf);
    const nomFichier = nomFichierArchive(periode, maintenant);
    telechargerPdf(octets, nomFichier);

    const nbReleves = lotsFiltres.length + preparationsFiltrees.length + temoinsFiltres.length;
    const nbVentes = ventes.length;
    const nbOperateurs = equipe.length;
    const details = `${nbReleves} relevé(s) de la période + ${nbVentes} vente(s) exhaustive(s) + ${nbOperateurs} opérateur(s)`;
    if (empreinte) {
      ctx.showToast(`Archive du registre (PDF) téléchargée : ${details}.`);
    } else {
      ctx.showToast(`Archive du registre (PDF) téléchargée : ${details}. L'empreinte n'a pas pu être calculée (contexte non sécurisé), le PDF le mentionne.`);
    }
  } catch (error) {
    console.warn("Échec de l'export PDF de l'archive du registre :", error);
    ctx.showToast("Échec de l'export PDF. Réessayez depuis Réglages > Données & sauvegardes.");
  }
}
