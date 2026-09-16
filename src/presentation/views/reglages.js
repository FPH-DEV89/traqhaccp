/**
 * Module 17 — Réglages.
 * Normes et seuils, équipements, préférences, sauvegardes et zone sensible.
 * Contrat de vue v4 : meta / render(ctx) / mount(root, ctx) / unmount().
 */
import { NORMS } from '../../domain/haccp_norms.js';
import { APP_VERSION } from '../../domain/constants.js';
export const meta = { id: 'reglages', idx: '17', icon: 'settings', title: 'Réglages', desc: 'Normes, équipements, préférences et sauvegardes', permissions: ['settings.edit'] };
const ONGLETS = [['seuils', 'Normes et seuils'], ['equipements', 'Équipements'], ['preferences', 'Préférences'], ['sauvegardes', 'Sauvegardes'], ['sensible', 'Zone sensible']];
const TYPES = { froid_pos: 'Froid positif', froid_neg: 'Froid négatif', chaud: 'Chaud et cuisson' };
const JOURS = 24 * 60 * 60 * 1000;
const RAISON_DROITS = "Votre rôle ne permet pas de modifier les réglages : les actions d'écriture sont désactivées.";
const NOMBRE = new Intl.NumberFormat('fr-FR');
const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const FORMAT_HEURE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
/** Seuils ajustables : [chemin, libellé, borne min, borne max, unité, cadre réglementaire, source]. */
const FAMILLES = [
  ['Froid positif', [
    ['cold.positiveMin', 'Température minimale des enceintes froides', -5, 8, '°C', 'au moins 0 °C', 'Règlement (CE) n° 852/2004, annexe II, chapitre I'],
    ['cold.positiveMax', 'Température maximale des enceintes froides', -2, 10, '°C', 'au plus +4 °C', 'Règlement (CE) n° 852/2004, annexe II, chapitre I'],
    ['cold.vegetableMax', 'Température maximale des légumes et fruits', 0, 10, '°C', 'au plus +6 °C pour les végétaux', 'Règlement (CE) n° 852/2004, annexe II']]],
  ['Froid négatif', [
    ['cold.frozenMax', 'Température maximale des surgelés', -30, -12, '°C', '-18 °C ou moins', 'Arrêté du 21 décembre 2009 (températures de conservation)']]],
  ['Liaison chaude', [
    ['hot.serviceMin', 'Température minimale de maintien au chaud', 55, 95, '°C', 'au moins +63 °C', 'Règlement (CE) n° 852/2004, annexe II, chapitre IX']]],
  ['Refroidissement rapide', [
    ['cooling.fromTemp', 'Température de départ du refroidissement', 50, 100, '°C', 'départ à +63 °C', 'Guide de bonnes pratiques d’hygiène (GBPH)'],
    ['cooling.toTemp', 'Température cible de fin de refroidissement', 0, 15, '°C', 'arrivée à +10 °C', 'Guide de bonnes pratiques d’hygiène (GBPH)'],
    ['cooling.maxHours', 'Durée maximale du refroidissement', 1, 4, 'h', '63 °C vers 10 °C en 2 h', 'Guide de bonnes pratiques d’hygiène (GBPH)']]],
  ['Décongélation', [
    ['defrost.maxTemp', 'Température maximale de décongélation', 0, 6, '°C', '+4 °C maximum', 'Règlement (CE) n° 852/2004, annexe II'],
    ['defrost.maxHours', 'Délai maximal avant consommation', 1, 72, 'h', '2 jours (48 h) au plus', 'Guide de bonnes pratiques d’hygiène (GBPH)']]],
  ['Huiles de friture (TPM)', [
    ['oil.tpmMax', 'Taux maximal de composés polaires', 18, 25, '%', '24 % maximum, au-delà l’huile est à changer', 'Arrêté du 11 octobre 2005 relatif aux huiles de friture'],
    ['oil.tpmAlert', 'Seuil d’alerte des composés polaires', 10, 24, '%', 'alerte conseillée à 18 %', 'Arrêté du 11 octobre 2005 relatif aux huiles de friture'],
    ['oil.restHours', 'Durée de repos avant analyse', 1, 48, 'h', 'au moins 8 h de repos', 'Guide de bonnes pratiques d’hygiène (GBPH)']]],
  ['pH des denrées', [
    ['ph.min', 'Valeur minimale de pH mesurable', 0, 6, '', 'plan de maîtrise sanitaire', 'Plan de maîtrise sanitaire de l’établissement'],
    ['ph.max', 'Valeur maximale de pH mesurable', 2, 14, '', 'plan de maîtrise sanitaire', 'Plan de maîtrise sanitaire de l’établissement']]],
  ['Perte au portionnement', [
    ['weight.lossAlertPct', 'Seuil d’alerte de perte', 1, 30, '%', 'alerte au-delà de la perte attendue', 'Plan de maîtrise sanitaire de l’établissement']]],
];
const BORNES = {};
FAMILLES.forEach(([, champs]) => champs.forEach(([chemin, libelle, min, max, unite, cadre, source]) => {
  BORNES[chemin] = { min, max, unite, libelle, cadre, source };
}));
const PREFERENCES = [
  ['theme', 'Thème', 'choix', [['papier', 'Papier'], ['nuit', 'Nuit']]],
  ['density', 'Densité', 'choix', [['confortable', 'Confortable'], ['compacte', 'Compacte']]],
  ['tempUnit', 'Unité de température', 'choix', [['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)']]],
  ['sounds', 'Sons de confirmation', 'bool', []],
  ['autoLockMinutes', 'Verrouillage automatique de la saisie', 'nombre', [['0', 'Jamais'], ['5', '5 minutes'], ['15', '15 minutes'], ['30', '30 minutes']]],
  ['backupReminderDays', 'Rappel de sauvegarde', 'nombre', [['1', 'Tous les jours'], ['7', 'Toutes les semaines'], ['14', 'Toutes les 2 semaines'], ['30', 'Tous les mois']]],
];
/* ══ Utilitaires, accès aux données et fragments ════════════════════ */
const esc = (valeur) => String(valeur === null || valeur === undefined ? '' : valeur).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const texte = (valeur) => (valeur === null || valeur === undefined ? '' : String(valeur).trim());
const nombre = (valeur) => (valeur === '' || valeur === null || valeur === undefined ? '' : NOMBRE.format(Number(valeur)));
const dateFr = (valeur) => (valeur && !Number.isNaN(new Date(valeur).getTime()) ? FORMAT_DATE.format(new Date(valeur)) : 'non précisée');
const dateHeureFr = (valeur) => (valeur && !Number.isNaN(new Date(valeur).getTime()) ? FORMAT_HEURE.format(new Date(valeur)) : 'non précisée');
const erreurChamp = (errors, cle) => (!errors || typeof errors !== 'object' || Array.isArray(errors) ? '' : texte(errors[cle]));
const champErreur = (cle, message) => `<span class="field__error" data-erreur="${esc(cle)}">${esc(message || '')}</span>`;
const etatStore = (ctx) => (ctx.store && typeof ctx.store.getState === 'function' ? ctx.store.getState() : {});
const refuser = (ctx, errors, repli) => ctx.ui.toast({ status: 'danger', message: messagesErreurs(errors)[0] || repli || 'Opération refusée par le registre.' });
const fermerPanneau = (el) => { const croix = el.querySelector('[data-ui-close]'); if (croix) croix.click(); };
function messagesErreurs(errors) {
  if (!errors) return [];
  if (typeof errors === 'string') return [errors];
  if (Array.isArray(errors)) return errors.map((e) => (typeof e === 'string' ? e : texte(e && e.message))).filter(Boolean);
  return Object.keys(errors).map((cle) => texte(errors[cle])).filter(Boolean);
}
function peutRegler(ctx) {
  const store = ctx && ctx.store;
  if (store && typeof store.can === 'function') return store.can('settings.edit') !== false;
  return true;
}
function reglages(ctx) {
  if (ctx.settings && typeof ctx.settings.getSettings === 'function') return ctx.settings.getSettings() || {};
  if (ctx.store && typeof ctx.store.getSettings === 'function') return ctx.store.getSettings() || {};
  return etatStore(ctx).settings || {};
}
function equipements(ctx) {
  if (ctx.settings && typeof ctx.settings.listEquipments === 'function') return ctx.settings.listEquipments() || [];
  return ctx.equipements || etatStore(ctx).equipments || [];
}
function seuilCourant(ctx, chemin) {
  const [famille, cle] = chemin.split('.');
  const live = ctx.settings && typeof ctx.settings.getThresholds === 'function' ? ctx.settings.getThresholds() : null;
  const lire = (source) => (source && source[famille] && source[famille][cle] !== undefined ? source[famille][cle] : undefined);
  const valeur = [lire(live), lire(reglages(ctx).norms), lire(NORMS)].filter((v) => v !== undefined)[0];
  return valeur === undefined ? '' : valeur;
}
function bouton(action, libelle, desactive, raison, variante, id) {
  const refus = desactive ? ` aria-disabled="true" title="${esc(raison)}"` : '';
  const identifiant = id ? ` data-id="${esc(id)}"` : '';
  return `<button class="btn ${variante || 'btn--ghost'}${desactive ? ' is-disabled' : ''}" type="button" data-action="${action}"${identifiant}${refus}>${esc(libelle)}</button>`;
}
function entete() {
  return `<header class="page-head"><h1 class="page-head__title"><span class="page-head__idx">${esc(meta.idx)}</span> ${esc(meta.title)}</h1><p class="page-head__desc">${esc(meta.desc)}</p></header>`;
}
function segmentation() {
  const onglets = ONGLETS.map(([cle, libelle]) => {
    const choisi = etat.onglet === cle;
    return `<button class="seg__item${choisi ? ' is-active' : ''}" type="button" role="tab" aria-selected="${choisi}" data-action="onglet-${cle}">${esc(libelle)}</button>`;
  }).join('');
  return `<div class="seg" role="tablist" aria-label="Sections des réglages">${onglets}</div>`;
}
function choisir(cle, libelle, options, courante) {
  const choix = options.map(([valeur, libelleOption]) => {
    const choisi = String(valeur) === String(courante);
    return `<button class="seg__item${choisi ? ' is-active' : ''}" type="button" role="tab" aria-selected="${choisi}" data-pref="${cle}" data-valeur="${esc(valeur)}" data-type="texte">${esc(libelleOption)}</button>`;
  }).join('');
  return `<div class="field"><span class="field__label">${esc(libelle)}</span><div class="seg" role="tablist" aria-label="${esc(libelle)}">${choix}</div></div>`;
}
function afficherErreurs(root, erreurs) {
  root.querySelectorAll('[data-erreur]').forEach((span) => { span.textContent = erreurChamp(erreurs, span.getAttribute('data-erreur')); });
}
function afficherErreursPanneau(el, errors) {
  el.querySelectorAll('[data-erreur]').forEach((span) => { span.textContent = ''; });
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    Object.keys(errors).forEach((cle) => {
      const span = el.querySelector(`[data-erreur="${cle}"]`);
      if (span) span.textContent = texte(errors[cle]);
    });
  }
  const global = el.querySelector('[data-panneau-erreur]');
  const messages = messagesErreurs(errors);
  if (global && messages.length) { global.hidden = false; global.textContent = messages.join(' '); }
}
/* ══ (a) Normes et seuils ══════════════════════════════════════════ */
function ecartPour(chemin, valeur) {
  const bornes = BORNES[chemin];
  const v = Number(valeur);
  if (!bornes || valeur === '' || !Number.isFinite(v)) return '';
  if (v >= bornes.min && v <= bornes.max) return '';
  return `<div class="callout callout--warn">Valeur hors du cadre réglementaire rappelé (${esc(bornes.cadre)}) — source : ${esc(bornes.source)}.</div>`;
}
function champSeuil(ctx, chemin, libelle, min, max, unite, cadre, source) {
  const step = unite === '%' || chemin.indexOf('positive') !== -1 || chemin.indexOf('defrost') !== -1 ? '0.5' : '1';
  return `<div class="field"><label class="field__label">${esc(libelle)}</label><input class="input" type="number" step="${step}" data-seuil="${esc(chemin)}" value="${esc(seuilCourant(ctx, chemin))}" aria-label="${esc(libelle)}"><span class="field__hint">Bornes admissibles : ${esc(min)} à ${esc(max)} ${esc(unite)} · Cadre réglementaire : ${esc(cadre)}</span><span class="field__hint">Source : ${esc(source)}</span>${champErreur(chemin)}<div data-ecart="${esc(chemin)}"></div></div>`;
}
function vueSeuils(ctx) {
  const peut = peutRegler(ctx);
  const blocs = FAMILLES.map(([titre, champs]) => `<div class="section"><div class="section__head"><h2 class="section__title">${esc(titre)}</h2></div><div class="grid grid--2">${champs.map((champ) => champSeuil(ctx, champ[0], champ[1], champ[2], champ[3], champ[4], champ[5], champ[6])).join('')}</div></div>`).join('');
  return `<section class="sheet"><div class="section"><div class="section__head"><h2 class="section__title">Normes et seuils</h2><div class="section__action">${bouton('seuils-reinitialiser', 'Rétablir les valeurs réglementaires', !peut, RAISON_DROITS)}${bouton('seuils-enregistrer', 'Enregistrer les seuils', !peut, RAISON_DROITS, 'btn--primary btn--sm')}</div></div><div class="callout callout--info">Ces seuils pilotent les contrôles et les alertes : chaque relevé saisi est comparé à ces valeurs, et tout écart déclenche l’alerte affichée dans la fiche.</div>${peut ? '' : `<div class="callout callout--info">${RAISON_DROITS} Les valeurs restent consultables.</div>`}${blocs}</div></section>`;
}
function lireSeuils(root) {
  const patch = {};
  const erreurs = {};
  root.querySelectorAll('[data-seuil]').forEach((champ) => {
    const chemin = champ.getAttribute('data-seuil');
    const brut = texte(champ.value);
    const bornes = BORNES[chemin];
    const valeur = Number(brut);
    if (brut === '' || !Number.isFinite(valeur)) { erreurs[chemin] = 'Saisissez une valeur numérique.'; return; }
    if (bornes && (valeur < bornes.min || valeur > bornes.max)) erreurs[chemin] = `Valeur hors bornes admissibles (${bornes.min} à ${bornes.max} ${bornes.unite}).`;
    const [famille, cle] = chemin.split('.');
    if (!patch[famille]) patch[famille] = {};
    patch[famille][cle] = valeur;
  });
  return { patch, erreurs };
}
function rafraichirEcarts(root) {
  root.querySelectorAll('[data-seuil]').forEach((champ) => {
    const cible = root.querySelector(`[data-ecart="${champ.getAttribute('data-seuil')}"]`);
    if (cible) cible.innerHTML = ecartPour(champ.getAttribute('data-seuil'), champ.value);
  });
}
function enregistrerSeuils(ctx) {
  const lecture = lireSeuils(racineActive);
  if (Object.keys(lecture.erreurs).length) {
    afficherErreurs(racineActive, lecture.erreurs);
    ctx.ui.toast({ status: 'danger', message: 'Corrigez les valeurs signalées avant d’enregistrer.' });
    return;
  }
  const resultat = ctx.settings.updateThresholds(lecture.patch);
  if (!resultat || resultat.ok === false) { afficherErreurs(racineActive, resultat && resultat.errors); refuser(ctx, resultat && resultat.errors); return; }
  ctx.ui.toast({ status: 'ok', message: 'Seuils enregistrés' });
  redessiner(ctx);
}
async function reinitialiserSeuils(ctx) {
  const accord = await ctx.ui.confirm({ title: 'Rétablir les valeurs réglementaires', body: '<p>Tous les seuils ajustés reviennent aux valeurs du référentiel HACCP de l’application.</p><p>Les relevés déjà enregistrés ne sont pas modifiés.</p>', confirmLabel: 'Rétablir' });
  if (!accord) return;
  const resultat = ctx.settings.updateThresholds(NORMS);
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); return; }
  ctx.ui.toast({ status: 'ok', message: 'Valeurs réglementaires rétablies' });
  redessiner(ctx);
}
/* ══ (b) Équipements ═══════════════════════════════════════════════ */
function vueEquipements(ctx) {
  const peut = peutRegler(ctx);
  const liste = equipements(ctx);
  const lignes = liste.map((materiel) => {
    const id = materiel.id || materiel.name;
    const type = TYPES[materiel.type] || texte(materiel.type) || 'non précisé';
    const plage = materiel.min === undefined || materiel.max === undefined ? 'non précisée' : `${texte(materiel.min)} à ${texte(materiel.max)} °C`;
    const statut = materiel.active === false ? '<span class="mark mark--neutral">désactivé</span>' : '<span class="mark mark--ok">actif</span>';
    const actions = bouton('eq-modifier', 'Modifier', !peut, RAISON_DROITS, 'btn--ghost', id) + bouton('eq-supprimer', 'Supprimer', !peut, RAISON_DROITS, 'btn--danger', id);
    return `<tr><td>${esc(materiel.name || 'Sans nom')}</td><td>${esc(type)}</td><td>${esc(plage)}</td><td>${esc(texte(materiel.location || materiel.zone) || 'non précisé')}</td><td>${statut}</td><td><div class="toolbar">${actions}</div></td></tr>`;
  }).join('');
  const vide = '<div class="empty"><p class="empty__title">Aucun équipement</p><p class="empty__body">Déclarez les enceintes et appareils suivis : les relevés s’y rattachent.</p></div>';
  const ajouter = peut ? bouton('eq-ajouter', 'Ajouter un équipement', false, '', 'btn--primary btn--sm') : bouton('eq-ajouter', 'Ajouter un équipement', true, RAISON_DROITS, 'btn--primary btn--sm');
  return `<section class="sheet"><div class="section"><div class="section__head"><h2 class="section__title">Équipements</h2><div class="section__action">${ajouter}</div></div><p class="field__hint">La plage déclarée borne les valeurs acceptées lors de la saisie des relevés.</p>${liste.length ? `<table class="table"><thead><tr><th>Nom</th><th>Type</th><th>Plage</th><th>Emplacement</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${lignes}</tbody></table>` : vide}</div></section>`;
}
function formulaireEquipement(ctx, materiel) {
  const edition = Boolean(materiel);
  const type = (materiel && materiel.type) || 'froid_pos';
  const options = Object.keys(TYPES).map((cle) => `<option value="${esc(cle)}"${cle === type ? ' selected' : ''}>${esc(TYPES[cle])}</option>`).join('');
  const coche = !materiel || materiel.active !== false;
  refPan.el = null;
  const ligne = (nom, libelle, valeur, typeChamp, indication) => `<div class="field"><label class="field__label">${esc(libelle)}</label><input class="input" type="${typeChamp || 'text'}"${typeChamp === 'number' ? ' step="0.5"' : ''} data-champ="${nom}" value="${esc(valeur)}" aria-label="${esc(libelle)}">${indication ? `<span class="field__hint">${esc(indication)}</span>` : ''}${champErreur(nom)}</div>`;
  ctx.ui.panel({
    title: edition ? 'Modifier un équipement' : 'Ajouter un équipement',
    subtitle: edition ? texte(materiel.name) : 'Nouvel appareil suivi',
    body: `${ligne('name', 'Nom', materiel ? materiel.name : '', 'text', 'Nom affiché dans les fiches de relevé.')}<div class="field"><label class="field__label">Type</label><select class="select" data-champ="type" aria-label="Type">${options}</select>${champErreur('type')}</div>${ligne('min', 'Température minimale', materiel && materiel.min !== undefined ? materiel.min : '', 'number')}${ligne('max', 'Température maximale', materiel && materiel.max !== undefined ? materiel.max : '', 'number')}${ligne('location', 'Emplacement', materiel ? materiel.location || '' : '')}<label class="switch"><input type="checkbox" data-champ="active"${coche ? ' checked' : ''}><span class="switch__track"><span class="switch__thumb"></span></span><span>Équipement actif</span></label><div class="callout callout--danger" data-panneau-erreur hidden></div>`,
    onMount: (el) => { refPan.el = el; },
    actions: [{ label: 'Annuler', kind: 'ghost' }, { label: edition ? 'Enregistrer' : 'Créer', kind: 'primary', onClick: () => soumettreEquipement(ctx, materiel) }],
  });
}
function lireEquipement(el) {
  const erreurs = {};
  const lire = (nom) => { const champ = el.querySelector(`[data-champ="${nom}"]`); return champ ? texte(champ.value) : ''; };
  const bascule = el.querySelector('[data-champ="active"]');
  const donnees = { name: lire('name'), type: lire('type'), location: lire('location'), active: bascule ? Boolean(bascule.checked) : true };
  const min = Number(lire('min'));
  const max = Number(lire('max'));
  if (donnees.name.length < 2) erreurs.name = 'Indiquez un nom (2 caractères minimum).';
  if (Object.keys(TYPES).indexOf(donnees.type) === -1) erreurs.type = 'Choisissez un type dans la liste.';
  if (!Number.isFinite(min)) erreurs.min = 'Saisissez une température minimale.';
  if (!Number.isFinite(max)) erreurs.max = 'Saisissez une température maximale.';
  if (Number.isFinite(min) && Number.isFinite(max) && min >= max) erreurs.max = 'La température minimale doit être inférieure à la maximale.';
  else if (donnees.type === 'froid_neg' && max > 0) erreurs.max = 'Un équipement négatif doit rester sous 0 °C.';
  else if (donnees.type === 'chaud' && max < 60) erreurs.max = 'Un équipement chaud doit tenir au moins +60 °C.';
  else if (donnees.type === 'froid_pos' && max > 8) erreurs.max = 'Un froid positif dépasse rarement +8 °C : vérifiez la plage.';
  donnees.min = min;
  donnees.max = max;
  return { donnees, erreurs };
}
function soumettreEquipement(ctx, materiel) {
  const el = refPan.el;
  if (!el) return false;
  const lecture = lireEquipement(el);
  if (Object.keys(lecture.erreurs).length) { afficherErreursPanneau(el, lecture.erreurs); return false; }
  const resultat = materiel ? ctx.settings.updateEquipment(materiel.id, lecture.donnees) : ctx.settings.createEquipment(lecture.donnees);
  if (!resultat || resultat.ok === false) { afficherErreursPanneau(el, resultat && resultat.errors); refuser(ctx, resultat && resultat.errors); return false; }
  fermerPanneau(el);
  ctx.ui.toast({ status: 'ok', message: materiel ? 'Équipement mis à jour' : 'Équipement ajouté' });
  redessiner(ctx);
  return false;
}
async function supprimerEquipement(ctx, id) {
  const materiel = equipements(ctx).filter((e) => texte(e.id || e.name) === texte(id))[0];
  if (!materiel) return;
  const accord = await ctx.ui.confirm({ title: 'Supprimer cet équipement', body: `<p>${esc(texte(materiel.name))} sera retiré du plan de maîtrise.</p><p>Les relevés signés qui s’y rattachent sont conservés : le registre reste complet.</p>`, confirmLabel: 'Supprimer', danger: true });
  if (!accord) return;
  const resultat = ctx.settings.deleteEquipment(id);
  if (resultat && resultat.ok === false) {
    refuser(ctx, resultat.errors, 'Suppression refusée.');
    if (/relev|rattach|mesure|enregistr/i.test(messagesErreurs(resultat.errors).join(' '))) proposerDesactivation(ctx, materiel);
    return;
  }
  ctx.ui.toast({ status: 'ok', message: 'Équipement supprimé' });
  redessiner(ctx);
}
async function proposerDesactivation(ctx, materiel) {
  const accord = await ctx.ui.confirm({ title: 'Désactiver plutôt que supprimer', body: `<p>Des relevés sont rattachés à ${esc(texte(materiel.name))} : l’équipement ne peut pas être supprimé.</p><p>Le désactiver le retire des nouvelles saisies tout en conservant l’historique.</p>`, confirmLabel: 'Désactiver' });
  if (!accord) return;
  const resultat = ctx.settings.updateEquipment(materiel.id, { active: false });
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); return; }
  ctx.ui.toast({ status: 'ok', message: 'Équipement désactivé' });
  redessiner(ctx);
}
/* ══ (c) Préférences ═══════════════════════════════════════════════ */
function vuePreferences(ctx) {
  const actuels = reglages(ctx);
  const peut = peutRegler(ctx);
  const blocs = PREFERENCES.map(([cle, libelle, type, options]) => {
    if (type === 'choix') return choisir(cle, libelle, options, actuels[cle]);
    if (type === 'bool') return `<div class="field"><label class="switch"><input type="checkbox" data-pref="sounds" data-type="bool"${actuels.sounds !== false ? ' checked' : ''}${peut ? '' : ' disabled'}><span class="switch__track"><span class="switch__thumb"></span></span><span>${esc(libelle)}</span></label><span class="field__hint">Bip de validation à l’enregistrement d’un relevé conforme.</span></div>`;
    const optionsListe = options.map(([valeur, texteOption]) => `<option value="${esc(valeur)}"${String(valeur) === String(actuels[cle]) ? ' selected' : ''}>${esc(texteOption)}</option>`).join('');
    const indication = cle === 'autoLockMinutes' ? 'Verrouille la saisie en cours après inactivité : aucune authentification n’est demandée, un appui suffit à reprendre.'
      : cle === 'backupReminderDays' ? 'Rappel affiché dans le tableau de bord.' : '';
    return `<div class="field"><label class="field__label">${esc(libelle)}</label><select class="select" data-pref="${cle}" data-type="nombre" aria-label="${esc(libelle)}"${peut ? '' : ' disabled'}>${optionsListe}</select>${indication ? `<span class="field__hint">${esc(indication)}</span>` : ''}</div>`;
  }).join('');
  const derniere = actuels.lastBackupAt || actuels.lastBackup || actuels.derniereSauvegarde;
  const jours = Number(actuels.backupReminderDays);
  const echeance = derniere && Number.isFinite(jours) ? new Date(new Date(derniere).getTime() + jours * JOURS) : null;
  return `<section class="sheet"><div class="section"><div class="section__head"><h2 class="section__title">Préférences d’usage</h2></div><div class="callout callout--info">Ces préférences sont enregistrées sur cet appareil et s’appliquent immédiatement.</div><div class="grid grid--2">${blocs}</div><p class="field__hint">Dernière sauvegarde réalisée : ${esc(dateHeureFr(derniere))}${echeance ? ` · prochain rappel le ${esc(dateFr(echeance))}` : ''}.</p>${echeance && echeance.getTime() < Date.now() ? '<div class="callout callout--warn">La sauvegarde est en retard : exportez le registre depuis l’onglet Sauvegardes.</div>' : ''}</div></section>`;
}
function appliquerPreference(ctx, element) {
  const cle = element.getAttribute('data-pref');
  const type = element.getAttribute('data-type');
  const valeur = type === 'bool' ? Boolean(element.checked) : type === 'nombre' ? Number(element.value) : element.getAttribute('data-valeur');
  if (cle === 'theme' && ctx.store && typeof ctx.store.setTheme === 'function') ctx.store.setTheme(valeur);
  const resultat = ctx.settings.updateSettings({ [cle]: valeur });
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); redessiner(ctx); return; }
  ctx.ui.toast({ status: 'ok', message: 'Préférence enregistrée' });
  redessiner(ctx);
}
/* ══ (d) Sauvegardes ═══════════════════════════════════════════════ */
function telecharger(ctx, nom, contenu, type) {
  if (ctx.exports && typeof ctx.exports.downloadFile === 'function') { ctx.exports.downloadFile(nom, contenu, type); return; }
  const url = URL.createObjectURL(new Blob([contenu], { type: type || 'text/plain;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  if (document.body) document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
const horodatage = () => new Date().toISOString().slice(0, 10);
async function exporterSauvegarde(ctx) {
  const contenu = await ctx.exports.buildFullBackup(ctx);
  telecharger(ctx, `traqhaccp-sauvegarde-${horodatage()}.json`, typeof contenu === 'string' ? contenu : JSON.stringify(contenu, null, 2), 'application/json');
  ctx.ui.toast({ status: 'ok', message: 'Sauvegarde exportée' });
}
function csv(lignes) {
  return lignes.map((ligne) => ligne.map((cellule) => {
    const valeur = cellule === null || cellule === undefined ? '' : String(cellule);
    return /[";\n]/.test(valeur) ? `"${valeur.replace(/"/g, '""')}"` : valeur;
  }).join(';')).join('\r\n');
}
async function exporterModule(ctx, module) {
  let contenu = await ctx.exports.exportRecordsCsv(ctx, module);
  if (contenu && typeof contenu === 'object' && typeof contenu.csv === 'string') contenu = contenu.csv;
  if (typeof contenu !== 'string' || !contenu.trim()) {
    const depot = ctx.repository;
    const donnees = depot && typeof depot[module] === 'function' ? depot[module]() : null;
    if (!Array.isArray(donnees) || !donnees.length) { ctx.ui.toast({ status: 'warn', message: 'Aucune donnée à exporter pour ce module.' }); return; }
    const colonnes = Object.keys(donnees[0]);
    contenu = csv([colonnes].concat(donnees.map((ligne) => colonnes.map((colonne) => ligne[colonne]))));
  }
  telecharger(ctx, `traqhaccp-${module}-${horodatage()}.csv`, contenu, 'text/csv;charset=utf-8');
  ctx.ui.toast({ status: 'ok', message: 'Export CSV généré' });
}
function apercu() {
  if (!etat.apercu) return '<p class="field__hint">Choisissez un fichier de sauvegarde : son contenu est analysé avant toute application.</p>';
  if (etat.apercu.ok === false) return `<div class="callout callout--danger">Fichier illisible : ${esc(etat.apercu.message || 'format non reconnu')}</div>`;
  const donnees = etat.apercu.donnees || {};
  const etablissement = donnees.establishment || donnees.etablissement || {};
  const comptes = donnees.counts || donnees.compteurs || {};
  const liste = Object.keys(comptes).map((cle) => `${esc(cle)} : ${esc(comptes[cle])}`).join(' · ');
  const total = Object.keys(comptes).reduce((somme, cle) => somme + Number(comptes[cle] || 0), 0);
  return `<table class="table"><tbody><tr><td>Version détectée</td><td>${esc(texte(donnees.version || donnees.appVersion) || 'non précisée')}</td></tr><tr><td>Établissement</td><td>${esc(texte(etablissement.name) || 'non précisé')}</td></tr><tr><td>Enregistrements</td><td>${esc(liste || 'non précisés')}${liste ? ` · total ${esc(nombre(total))}` : ''}</td></tr><tr><td>Date de sauvegarde</td><td>${esc(dateHeureFr(donnees.exportedAt || donnees.date))}</td></tr></tbody></table><div class="callout callout--warn">L’application de cette sauvegarde remplace les données actuelles. Vérifiez ces informations puis confirmez.</div>`;
}
async function choisirFichier(ctx, fichier) {
  if (!fichier) return;
  try {
    etat.texte = await fichier.text();
  } catch (erreur) {
    etat.apercu = { ok: false, message: 'lecture du fichier impossible' };
    redessiner(ctx);
    return;
  }
  const analyse = await ctx.exports.parseBackup(etat.texte);
  etat.apercu = analyse && typeof analyse === 'object' ? { ok: analyse.ok !== false, message: analyse.error || analyse.message, donnees: analyse.data || analyse } : { ok: false, message: 'format non reconnu' };
  redessiner(ctx);
}
async function appliquerSauvegarde(ctx) {
  if (!etat.texte) { ctx.ui.toast({ status: 'warn', message: 'Choisissez d’abord un fichier de sauvegarde.' }); return; }
  const accord = await ctx.ui.confirm({ title: 'Appliquer cette sauvegarde', body: '<p>Les données actuelles sont remplacées par le contenu du fichier.</p><p>Exportez une sauvegarde avant de poursuivre.</p>', confirmLabel: 'Appliquer', danger: true });
  if (!accord) return;
  const resultat = ctx.settings.importBackup(etat.texte);
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); return; }
  const comptes = (resultat && resultat.counts) || {};
  const detail = Object.keys(comptes).map((cle) => `${cle} : ${comptes[cle]}`).join(', ');
  etat.apercu = null;
  etat.texte = '';
  ctx.ui.toast({ status: 'ok', message: detail ? `Sauvegarde appliquée (${detail})` : 'Sauvegarde appliquée' });
  redessiner(ctx);
}
async function restaurerDemo(ctx) {
  const accord = await ctx.ui.confirm({ title: 'Rétablir les données de démonstration', body: '<p>Les données actuelles sont remplacées par le jeu de démonstration (établissement, brigade, relevés).</p><p>Cette opération est destructrice : exportez d’abord une sauvegarde si nécessaire.</p>', confirmLabel: 'Remplacer les données', danger: true });
  if (!accord) return;
  const resultat = ctx.settings.restoreDemoData();
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); return; }
  const comptes = (resultat && (resultat.counts || resultat.purged)) || {};
  const detail = Object.keys(comptes).map((cle) => `${cle} : ${comptes[cle]}`).join(', ');
  ctx.ui.toast({ status: 'ok', message: detail ? `Données de démonstration rétablies (${detail})` : 'Données de démonstration rétablies' });
  redessiner(ctx);
}
function annees(ctx) {
  const trouvees = [];
  collections(ctx).forEach(([, donnees]) => donnees.forEach((ligne) => Object.keys(ligne || {}).forEach((champ) => {
    const brut = ligne[champ];
    if (typeof brut !== 'string') return;
    const annee = /^(\d{4})-\d{2}-\d{2}/.exec(brut);
    if (annee && trouvees.indexOf(Number(annee[1])) === -1) trouvees.push(Number(annee[1]));
  })));
  return trouvees.sort((a, b) => b - a);
}
function decompteAnnee(ctx, annee) {
  let total = 0;
  collections(ctx).forEach(([, donnees]) => donnees.forEach((ligne) => {
    if (Object.keys(ligne || {}).some((champ) => typeof ligne[champ] === 'string' && ligne[champ].indexOf(String(annee)) === 0)) total += 1;
  }));
  return total;
}
function formulairePurge(ctx) {
  const liste = annees(ctx);
  if (!liste.length) { ctx.ui.toast({ status: 'warn', message: 'Aucune année détectée dans les données.' }); return; }
  const options = liste.map((annee) => `<option value="${esc(annee)}">${esc(annee)} — ${esc(decompteAnnee(ctx, annee))} enregistrement(s)</option>`).join('');
  refPan.el = null;
  ctx.ui.panel({
    title: 'Purger une année',
    subtitle: 'Suppression définitive',
    body: `<div class="callout callout--danger">La purge efface les relevés de l’année choisie : les fiches de cette année ne pourront plus être présentées en contrôle.</div><div class="field"><label class="field__label">Année à purger</label><select class="select" data-champ="annee" aria-label="Année à purger">${options}</select><span class="field__hint">Le décompte affiché est calculé sur les données actuellement stockées.</span></div><div class="field"><label class="field__label">Recopiez l’année pour confirmer</label><input class="input" type="text" inputmode="numeric" data-champ="confirmation" aria-label="Recopie de l’année">${champErreur('confirmation')}</div><div class="callout callout--danger" data-panneau-erreur hidden></div>`,
    onMount: (el) => { refPan.el = el; },
    actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Purger', kind: 'danger', onClick: () => soumettrePurge(ctx) }],
  });
}
async function soumettrePurge(ctx) {
  const el = refPan.el;
  if (!el) return false;
  const lire = (nom) => { const champ = el.querySelector(`[data-champ="${nom}"]`); return champ ? texte(champ.value) : ''; };
  const annee = lire('annee');
  if (lire('confirmation') !== annee) { afficherErreursPanneau(el, { confirmation: `Recopiez exactement l’année ${annee} pour confirmer.` }); return false; }
  const volume = decompteAnnee(ctx, annee);
  const accord = await ctx.ui.confirm({ title: `Purger définitivement ${annee}`, body: `<p>${esc(nombre(volume))} enregistrement(s) de ${esc(annee)} seront supprimés sans retour possible.</p><p>Exportez une sauvegarde avant de confirmer.</p>`, confirmLabel: 'Purger définitivement', danger: true });
  if (!accord) return false;
  const resultat = ctx.settings.purgeYear(annee);
  if (!resultat || resultat.ok === false) { afficherErreursPanneau(el, resultat && resultat.errors); refuser(ctx, resultat && resultat.errors); return false; }
  fermerPanneau(el);
  const compte = (resultat.purged && Object.keys(resultat.purged).reduce((somme, cle) => somme + Number(resultat.purged[cle] || 0), 0)) || resultat.total || volume;
  ctx.ui.toast({ status: 'ok', message: `Année ${annee} purgée (${nombre(compte)} enregistrement(s))` });
  redessiner(ctx);
  return false;
}
/* ══ (e) Zone sensible ════════════════════════════════════════════ */
/** Collections du dépôt réellement présentes : [[nom court, tableau], …]. */
function collections(ctx) {
  const depot = ctx.repository;
  if (!depot) return [];
  return Object.keys(depot).filter((nom) => nom.indexOf('get') === 0 && typeof depot[nom] === 'function').map((nom) => {
    try {
      const valeur = depot[nom]();
      return [nom.replace(/^get/, ''), Array.isArray(valeur) ? valeur : null];
    } catch (erreur) {
      return [nom.replace(/^get/, ''), null];
    }
  }).filter(([, donnees]) => donnees !== null);
}
function vueSensible(ctx) {
  const peut = peutRegler(ctx);
  const recensement = collections(ctx);
  const total = recensement.reduce((somme, [, donnees]) => somme + donnees.length, 0);
  const lignes = recensement.map(([nom, donnees]) => `<tr><td>${esc(nom)}</td><td>${esc(nombre(donnees.length))}</td></tr>`).join('');
  return `<section class="sheet"><div class="section"><div class="section__head"><h2 class="section__title">Zone sensible</h2></div><div class="callout callout--danger">Les actions de cette zone modifient ou effacent des données. Exportez une sauvegarde avant d’agir.</div></div>
    <div class="section"><div class="section__head"><h2 class="section__title">Réinitialisation des réglages</h2><div class="section__action">${bouton('sensible-reinitialiser', 'Réinitialiser les réglages', !peut, RAISON_DROITS, 'btn--danger btn--sm')}</div></div><p class="field__hint">Thème, densité, sons, verrouillage, unité, rappels et seuils reviennent aux valeurs par défaut, après double confirmation. Les enregistrements du registre ne sont pas touchés : utilisez « Purger une année » ou « Rétablir les données de démonstration » pour les données.</p></div>
    <div class="section"><div class="section__head"><h2 class="section__title">Volume de données</h2></div>${total ? `<table class="table"><thead><tr><th>Collection</th><th>Enregistrements</th></tr></thead><tbody>${lignes}</tbody></table>` : '<div class="empty"><p class="empty__title">Aucune donnée</p><p class="empty__body">Le registre est vide sur cet appareil.</p></div>'}<p class="field__hint">Total : ${esc(nombre(total))} enregistrement(s) stocké(s) sur cet appareil.</p></div>
    <div class="section"><div class="section__head"><h2 class="section__title">Informations techniques</h2><div class="section__action">${bouton('sensible-cache', 'Vider le cache', false, '', 'btn--ghost btn--sm')}</div></div><div class="grid grid--2"><div class="field"><span class="field__label">Version de l’application</span><div>${esc(APP_VERSION)}</div></div><div class="field"><span class="field__label">Navigateur</span><div>${esc(texte(globalThis.navigator && globalThis.navigator.userAgent) || 'non communiqué')}</div></div><div class="field"><span class="field__label">Service worker</span><div data-info="service-worker">vérification en cours…</div></div><div class="field"><span class="field__label">Espace de stockage utilisé</span><div data-info="stockage">vérification en cours…</div></div></div></div></section>`;
}
async function remplirInformations(root) {
  const navig = globalThis.navigator || {};
  const sw = root.querySelector('[data-info="service-worker"]');
  if (sw) sw.textContent = navig.serviceWorker ? (navig.serviceWorker.controller ? 'actif — application hors ligne disponible' : 'enregistré, aucune page contrôlée pour l’instant') : 'non disponible sur ce navigateur';
  const stockage = root.querySelector('[data-info="stockage"]');
  if (!stockage) return;
  if (!navig.storage || typeof navig.storage.estimate !== 'function') { stockage.textContent = 'estimation indisponible sur ce navigateur'; return; }
  try {
    const estimation = await navig.storage.estimate();
    const utilise = Number(estimation.usage) || 0;
    const quota = Number(estimation.quota) || 0;
    stockage.textContent = `${(utilise / 1048576).toFixed(1)} Mo utilisés${quota ? ` sur ${(quota / 1048576).toFixed(0)} Mo disponibles` : ' (quota non communiqué)'}`;
  } catch (erreur) {
    stockage.textContent = 'estimation indisponible sur ce navigateur';
  }
}
async function reinitialiserReglages(ctx) {
  const premier = await ctx.ui.confirm({ title: 'Réinitialiser les réglages', body: '<p>Thème, densité, sons, verrouillage, unité et rappels reviennent aux valeurs par défaut.</p><p>Les enregistrements du registre sont conservés.</p>', confirmLabel: 'Continuer', danger: true });
  if (!premier) return;
  const second = await ctx.ui.confirm({ title: 'Confirmer la réinitialisation', body: '<p>Cette action remplace vos réglages actuels sans possibilité d’annulation.</p>', confirmLabel: 'Réinitialiser maintenant', danger: true });
  if (!second) return;
  const resultat = ctx.settings.resetSettings();
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); return; }
  ctx.ui.toast({ status: 'ok', message: 'Réglages réinitialisés' });
  redessiner(ctx);
}
async function viderCache(ctx) {
  const cache = globalThis.caches;
  if (!cache || typeof cache.keys !== 'function') { ctx.ui.toast({ status: 'warn', message: 'Cache indisponible sur ce navigateur.' }); return; }
  const accord = await ctx.ui.confirm({ title: 'Vider le cache', body: '<p>Les ressources mises en cache sont supprimées puis rechargées au prochain affichage.</p><p>Les données du registre stockées sur l’appareil ne sont pas concernées.</p>', confirmLabel: 'Vider le cache' });
  if (!accord) return;
  try {
    const cles = await cache.keys();
    await Promise.all(cles.map((cle) => cache.delete(cle)));
    ctx.ui.toast({ status: 'ok', message: `${cles.length} entrée(s) de cache supprimée(s)` });
  } catch (erreur) {
    ctx.ui.toast({ status: 'danger', message: 'Le cache n’a pas pu être vidé.' });
  }
}
/* ══ (d bis) Vue Sauvegardes, assemblage, actions et câblage ═══════ */
function vueSauvegardes(ctx) {
  const modules = collections(ctx).map(([nom]) => nom);
  const options = modules.map((nom) => `<option value="${esc(nom)}">${esc(nom)}</option>`).join('');
  const listeAnnees = annees(ctx);
  return `<section class="sheet"><div class="section"><div class="section__head"><h2 class="section__title">Export et restauration</h2></div><div class="callout callout--info">L’export JSON contient tout le registre (établissement, brigade, relevés, réglages) et sert de sauvegarde de sécurité.</div><div class="toolbar">${bouton('sauvegarde-export', 'Exporter la sauvegarde complète (JSON)', false, '', 'btn--primary btn--sm')}</div><div class="field"><label class="field__label">Export CSV par module</label><div class="toolbar"><select class="select" data-champ="module" aria-label="Module à exporter">${options}</select>${bouton('sauvegarde-csv', 'Exporter en CSV', false, '')}</div><span class="field__hint">${modules.length ? 'Le fichier reprend les colonnes du module choisi.' : 'Aucun module avec données à exporter pour le moment.'}</span></div></div>
    <div class="section"><div class="section__head"><h2 class="section__title">Restaurer une sauvegarde</h2></div><div class="field"><label class="field__label">Fichier de sauvegarde (JSON)</label><input class="input" type="file" accept="application/json,.json" data-fichier="sauvegarde" aria-label="Fichier de sauvegarde"><span class="field__hint">Le contenu est analysé avant application : rien n’est remplacé sans confirmation explicite.</span></div>${apercu()}${etat.apercu && etat.apercu.ok !== false ? `<div class="toolbar">${bouton('sauvegarde-appliquer', 'Appliquer cette sauvegarde', false, '', 'btn--danger btn--sm')}</div>` : ''}</div>
    <div class="section"><div class="section__head"><h2 class="section__title">Autres opérations</h2></div><div class="toolbar">${bouton('demo-restaurer', 'Rétablir les données de démonstration', false, '', 'btn--ghost btn--sm')}${bouton('purge-ouvrir', 'Purger une année', false, '', 'btn--danger btn--sm')}</div><p class="field__hint">${listeAnnees.length ? `Années présentes dans les données : ${listeAnnees.map((a) => `${a} (${decompteAnnee(ctx, a)})`).join(' · ')}.` : 'Aucune année détectée dans les données.'}</p><div class="callout callout--warn">Une purge est définitive : les fiches de l’année purgée ne pourront plus être présentées en contrôle.</div></div></section>`;
}
export function render(ctx) {
  const contenu = etat.onglet === 'equipements' ? vueEquipements(ctx)
    : etat.onglet === 'preferences' ? vuePreferences(ctx)
      : etat.onglet === 'sauvegardes' ? vueSauvegardes(ctx)
        : etat.onglet === 'sensible' ? vueSensible(ctx) : vueSeuils(ctx);
  return `${entete()}${segmentation()}${contenu}`;
}
const etat = { onglet: 'seuils', apercu: null, texte: '' };
const refPan = { el: null };
let abonnement = null;
let generation = 0;
let racineActive = null;
let contexteActif = null;
function aller(onglet) {
  etat.onglet = onglet;
  redessiner(contexteActif);
}
function redessiner(ctx) {
  const base = ctx && ctx.store ? ctx : contexteActif;
  if (!racineActive || !racineActive.isConnected || !base) return;
  const frais = base.store && typeof base.store.getState === 'function' ? { ...base, ...base.store.getState() } : base;
  racineActive.innerHTML = render(frais);
  attacher(racineActive, frais);
}
function attacher(root, ctx) {
  root.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', () => {
      const traitement = ACTIONS[element.getAttribute('data-action')];
      if (!traitement) return;
      Promise.resolve(traitement(ctx, element)).catch(() => {
        ctx.ui.toast({ status: 'danger', message: "L'action n'a pas pu être terminée." });
      });
    });
  });
  root.querySelectorAll('[data-seuil]').forEach((champ) => champ.addEventListener('input', () => rafraichirEcarts(root)));
  root.querySelectorAll('[data-pref]').forEach((element) => {
    element.addEventListener(element.tagName === 'BUTTON' ? 'click' : 'change', () => appliquerPreference(ctx, element));
  });
  const fichier = root.querySelector('[data-fichier="sauvegarde"]');
  if (fichier) fichier.addEventListener('change', () => choisirFichier(ctx, fichier.files && fichier.files[0]));
  rafraichirEcarts(root);
  remplirInformations(root);
}
const ACTIONS = {
  'onglet-seuils': () => aller('seuils'),
  'onglet-equipements': () => aller('equipements'),
  'onglet-preferences': () => aller('preferences'),
  'onglet-sauvegardes': () => aller('sauvegardes'),
  'onglet-sensible': () => aller('sensible'),
  'seuils-enregistrer': (ctx) => enregistrerSeuils(ctx),
  'seuils-reinitialiser': (ctx) => reinitialiserSeuils(ctx),
  'eq-ajouter': (ctx) => { formulaireEquipement(ctx, null); },
  'eq-modifier': (ctx, element) => { const cible = equipements(ctx).filter((e) => texte(e.id || e.name) === texte(element.getAttribute('data-id')))[0]; if (cible) formulaireEquipement(ctx, cible); },
  'eq-supprimer': (ctx, element) => supprimerEquipement(ctx, element.getAttribute('data-id')),
  'sauvegarde-export': (ctx) => exporterSauvegarde(ctx),
  'sauvegarde-csv': (ctx) => { const champ = racineActive.querySelector('[data-champ="module"]'); exporterModule(ctx, champ ? champ.value : ''); },
  'sauvegarde-appliquer': (ctx) => appliquerSauvegarde(ctx),
  'demo-restaurer': (ctx) => restaurerDemo(ctx),
  'purge-ouvrir': (ctx) => { formulairePurge(ctx); },
  'sensible-reinitialiser': (ctx) => reinitialiserReglages(ctx),
  'sensible-cache': (ctx) => viderCache(ctx),
};
export function mount(root, ctx) {
  generation += 1;
  const marque = generation;
  racineActive = root;
  contexteActif = ctx;
  attacher(root, ctx);
  if (ctx.store && typeof ctx.store.subscribe === 'function') {
    abonnement = ctx.store.subscribe(() => {
      if (marque !== generation || !root.isConnected) return;
      redessiner(ctx);
    });
  }
}
export function unmount() {
  generation += 1;
  if (typeof abonnement === 'function') abonnement();
  abonnement = null;
  racineActive = null;
  contexteActif = null;
  refPan.el = null;
}
