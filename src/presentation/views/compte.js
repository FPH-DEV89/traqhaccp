/**
 * Module 16 — Compte et établissement.
 * Fiche de l'établissement (édition dans la page), brigade (rôles, PIN, permissions) et journal d'activité.
 * Contrat de vue v4 : meta / render(ctx) / mount(root, ctx) / unmount().
 */
import { ROLES, ROLE_ORDER, PERMISSIONS, hasPermission } from '../../domain/roles.js';
export const meta = {
  id: 'compte',
  idx: '16',
  icon: 'users',
  title: 'Compte et établissement',
  desc: "Fiche de l'établissement, brigade et journal d'activité",
  permissions: ['users.manage'],
};
const T_VIDE = 'Non renseigné';
const ROLE_GERANT = 'gerant';
const JOURNAUX_CONSERVES = 500;
const JOURNAL_AFFICHE = 50;
const ONGLETS = [['etablissement', 'Fiche établissement'], ['utilisateurs', 'Utilisateurs'], ['journal', 'Journal']];
const ACTIVITES = ['Restaurant traditionnel', 'Brasserie', 'Restauration rapide', 'Pizzeria', 'Boulangerie-pâtisserie', 'Traiteur',
  'Rôtisserie', 'Cuisine centrale', 'Restauration collective', 'Métier de bouche', 'Crèche et scolaire'];
/** [clé, libellé, type, indication] — ordre d'affichage de la fiche. */
const CHAMPS = [
  ['name', 'Raison sociale', 'text'], ['activity', 'Activité', 'choice'], ['siret', 'SIRET', 'text', '14 chiffres, espaces tolérés.'],
  ['address', 'Adresse', 'text'], ['postal', 'Code postal', 'text', '5 chiffres.'], ['city', 'Ville', 'text'],
  ['phone', 'Téléphone', 'text'], ['email', 'E-mail', 'text'], ['manager', 'Responsable', 'text', 'Responsable de la sécurité sanitaire.'],
  ['agreement', "N° d'agrément sanitaire", 'text', 'Déclaration ou agrément DDPP.'], ['seats', 'Couverts', 'number', 'Couverts servis par jour.'],
  ['openedYear', "Année d'ouverture", 'number'],
];
const COURTS = {
  'users.manage': 'Utilisateurs', 'settings.edit': 'Réglages', 'settings.manage': 'Réglages', 'equipment.manage': 'Équipements',
  'records.create': 'Créer', 'records.edit': 'Modifier', 'records.delete': 'Supprimer', 'records.sign': 'Signer',
  'nc.manage': 'Non-conformités', 'export.data': 'Export', 'data.export': 'Export', 'backup.restore': 'Restauration', 'inspection.mode': 'Inspection',
};
const RAISON_DROITS = "Votre rôle ne permet pas de gérer les utilisateurs : les actions d'écriture sont désactivées.";
const RAISON_DERNIER_GERANT = 'Au moins un gérant actif est obligatoire : cet utilisateur est le dernier gérant actif.';
const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const FORMAT_HEURE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const FORMAT_NOMBRE = new Intl.NumberFormat('fr-FR');
/* ══ Utilitaires et accès aux données ═══════════════════════════════ */
const esc = (valeur) => String(valeur === null || valeur === undefined ? '' : valeur)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const texte = (valeur) => (valeur === null || valeur === undefined ? '' : String(valeur).trim());
const nombre = (valeur) => {
  const n = Number(valeur);
  return valeur === '' || valeur === null || valeur === undefined || !Number.isFinite(n) ? texte(valeur) : FORMAT_NOMBRE.format(n);
};
function dateHeure(valeur) {
  if (!valeur) return T_VIDE;
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return texte(valeur);
  return typeof valeur === 'string' && /\d:\d\d/.test(valeur) ? FORMAT_HEURE.format(date) : FORMAT_DATE.format(date);
}
function messagesErreurs(errors) {
  if (!errors) return [];
  if (typeof errors === 'string') return [errors];
  if (Array.isArray(errors)) return errors.map((e) => (typeof e === 'string' ? e : texte(e && e.message))).filter(Boolean);
  return Object.keys(errors).map((cle) => texte(errors[cle])).filter(Boolean);
}
const erreurChamp = (errors, cle) => (!errors || typeof errors !== 'object' || Array.isArray(errors) ? '' : texte(errors[cle]));
function autorise(role, permission) {
  if (typeof hasPermission === 'function') {
    try { return hasPermission(role, permission) === true; } catch (erreur) { return false; }
  }
  const definition = ROLES[role] || {};
  return (definition.permissions || definition.droits || []).indexOf(permission) !== -1;
}
export function peutGererUtilisateurs(ctx) {
  const store = ctx && ctx.store;
  if (store && typeof store.can === 'function') return store.can('users.manage') === true;
  const operateur = store && typeof store.getCurrentOperator === 'function' ? store.getCurrentOperator() || {} : {};
  return autorise(operateur.role, 'users.manage');
}
const etatStore = (ctx) => (ctx.store && typeof ctx.store.getState === 'function' ? ctx.store.getState() : {});
const brigade = (ctx) => (ctx.account && typeof ctx.account.listOperators === 'function'
  ? ctx.account.listOperators() || [] : ctx.operators || etatStore(ctx).operators || []);
const etablissement = (ctx) => (ctx.account && typeof ctx.account.getEstablishment === 'function'
  ? ctx.account.getEstablishment() || {} : ctx.establishment || etatStore(ctx).establishment || {});
const journal = (ctx) => (ctx.account && typeof ctx.account.getActivityLog === 'function'
  ? ctx.account.getActivityLog(JOURNAUX_CONSERVES) || [] : ctx.activity || etatStore(ctx).activity || etatStore(ctx).activityLog || []);
function operateurCourantId(ctx) {
  const store = ctx && ctx.store;
  if (store && typeof store.getCurrentOperator === 'function') {
    const operateur = store.getCurrentOperator();
    if (operateur && (operateur.id || operateur.name)) return operateur.id || operateur.name;
  }
  return etatStore(ctx).currentOperatorId || '';
}
const nomComplet = (operateur) => texte(operateur && operateur.name)
  || [texte(operateur && operateur.firstName), texte(operateur && operateur.lastName)].filter(Boolean).join(' ') || 'Utilisateur sans nom';
const initiales = (operateur) => texte(operateur && (operateur.short || operateur.initials)).slice(0, 3).toUpperCase()
  || nomComplet(operateur).split(/\s+/).map((mot) => mot.charAt(0)).join('').slice(0, 3).toUpperCase();
const pinDefini = (operateur) => Boolean(operateur && (operateur.pinDefined || operateur.hasPin || operateur.pin));
const estGerant = (operateur) => Boolean(operateur && (operateur.role === ROLE_GERANT || operateur.role === ROLE_ORDER[0]));
const gerantsActifs = (ctx) => brigade(ctx).filter((o) => o.active !== false && estGerant(o));
const identifier = (operateur) => operateur.id || operateur.name;
const trouver = (ctx, id) => brigade(ctx).filter((o) => texte(identifier(o)) === texte(id))[0] || null;
function permissionsListe() {
  const brut = Array.isArray(PERMISSIONS) ? PERMISSIONS : Object.values(PERMISSIONS || {});
  return brut.map((p) => (typeof p === 'string' ? { id: p, label: p } : { id: p.id || p.cle || p.code, label: p.label || p.libelle || p.id || p.cle }))
    .filter((p) => Boolean(p.id));
}
/* ══ Fragments d'interface ══════════════════════════════════════════ */
function bouton(action, libelle, id, desactive, raison, variante) {
  const refus = desactive ? ` aria-disabled="true" title="${esc(raison)}"` : '';
  return `<button class="btn ${variante || 'btn--ghost'}${desactive ? ' is-disabled' : ''}" type="button" data-action="${action}"${id ? ` data-id="${esc(id)}"` : ''}${refus}>${esc(libelle)}</button>`;
}
const champErreur = (cle, message) => `<span class="field__error" data-erreur="${esc(cle)}">${esc(message || '')}</span>`;
function entete() {
  return `<header class="page-head"><h1 class="page-head__title"><span class="page-head__idx">${esc(meta.idx)}</span> ${esc(meta.title)}</h1><p class="page-head__desc">${esc(meta.desc)}</p></header>`;
}
function segmentation() {
  const onglets = ONGLETS.map(([cle, libelle]) => {
    const actif = etat.onglet === cle;
    return `<button class="seg__item${actif ? ' is-active' : ''}" type="button" role="tab" aria-selected="${actif}" data-action="onglet-${cle}">${esc(libelle)}</button>`;
  }).join('');
  return `<div class="seg" role="tablist" aria-label="Sections du compte">${onglets}</div>`;
}
/* (a) Fiche établissement ─────────────────────────────────────────── */
function ficheLecture(ctx, fiche, errors) {
  const peut = peutGererUtilisateurs(ctx);
  const lignes = CHAMPS.map(([cle, libelle, type]) => {
    const valeur = type === 'number' ? nombre(fiche[cle]) : texte(fiche[cle]);
    const rendu = texte(valeur) ? esc(valeur) : `<span class="field__hint">${T_VIDE}</span>`;
    return `<div class="field"><span class="field__label">${esc(libelle)}</span><div>${rendu}</div>${champErreur(cle, erreurChamp(errors, cle))}</div>`;
  }).join('');
  return `<section class="sheet"><div class="section">
    <div class="section__head"><h2 class="section__title">Fiche établissement</h2><div class="section__action">${bouton('etab-editer', 'Modifier', '', !peut, RAISON_DROITS, 'btn--primary btn--sm')}</div></div>
    <div class="callout callout--info">Ces informations apparaissent sur les étiquettes de préparation et sur le registre présenté à la DDPP : tenez-les à jour.</div>
    <div class="grid grid--2">${lignes}</div></div></section>`;
}
function ficheEdition(ctx, fiche, errors) {
  const champs = CHAMPS.map(([cle, libelle, type, indication]) => {
    const valeur = texte(fiche[cle]);
    let saisie;
    if (type === 'choice') {
      const liste = valeur && ACTIVITES.indexOf(valeur) === -1 ? [valeur].concat(ACTIVITES) : ACTIVITES;
      saisie = `<select class="select" data-champ="${cle}" aria-label="${esc(libelle)}"><option value="">— Choisir —</option>`
        + liste.map((a) => `<option value="${esc(a)}"${a === valeur ? ' selected' : ''}>${esc(a)}</option>`).join('') + '</select>';
    } else {
      saisie = `<input class="input" type="${type === 'number' ? 'number' : 'text'}" value="${esc(valeur)}" data-champ="${cle}" aria-label="${esc(libelle)}">`;
    }
    const aide = indication ? `<span class="field__hint">${esc(indication)}</span>` : '';
    return `<div class="field"><label class="field__label">${esc(libelle)}</label>${saisie}${aide}${champErreur(cle, erreurChamp(errors, cle))}</div>`;
  }).join('');
  return `<section class="sheet"><div class="section">
    <div class="section__head"><h2 class="section__title">Modifier la fiche établissement</h2><div class="section__action">
      ${bouton('etab-annuler', 'Annuler', '', false, '', 'btn--ghost btn--sm')}${bouton('etab-enregistrer', 'Enregistrer', '', false, '', 'btn--primary btn--sm')}</div></div>
    <div class="callout callout--info">Ces informations apparaissent sur les étiquettes de préparation et sur le registre présenté à la DDPP.</div>
    <div class="grid grid--2">${champs}</div>
    <p class="field__hint">Les champs laissés vides sont affichés « ${T_VIDE} » sur les documents imprimés.</p></div></section>`;
}
function lireFiche(root, errors) {
  const donnees = {};
  const lire = (nom) => { const el = root.querySelector(`[data-champ="${nom}"]`); return el ? texte(el.value) : ''; };
  CHAMPS.forEach(([cle]) => { donnees[cle] = lire(cle); });
  if (donnees.name.length < 2) errors.name = 'Indiquez la raison sociale (2 caractères minimum).';
  donnees.siret = donnees.siret.replace(/\s/g, '');
  if (donnees.siret && !/^\d{14}$/.test(donnees.siret)) errors.siret = 'Le SIRET doit comporter 14 chiffres.';
  if (donnees.postal && !/^\d{5}$/.test(donnees.postal)) errors.postal = 'Le code postal doit comporter 5 chiffres.';
  if (donnees.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(donnees.email)) errors.email = "L'adresse e-mail semble incorrecte.";
  const anneeMax = new Date().getFullYear();
  if (donnees.openedYear && (!Number.isInteger(Number(donnees.openedYear)) || Number(donnees.openedYear) < 1900 || Number(donnees.openedYear) > anneeMax)) errors.openedYear = `Année comprise entre 1900 et ${anneeMax}.`;
  if (donnees.seats && (!Number.isInteger(Number(donnees.seats)) || Number(donnees.seats) < 0)) errors.seats = 'Nombre de couverts entier et positif.';
  if (donnees.seats !== '') donnees.seats = Number(donnees.seats);
  if (donnees.openedYear !== '') donnees.openedYear = Number(donnees.openedYear);
  return donnees;
}
/* (b) Utilisateurs ────────────────────────────────────────────────── */
function tableauUtilisateurs(ctx) {
  const peut = peutGererUtilisateurs(ctx);
  const liste = brigade(ctx);
  const courant = operateurCourantId(ctx);
  const gerants = gerantsActifs(ctx).length;
  if (!liste.length) return '<div class="empty"><p class="empty__title">Aucun utilisateur</p><p class="empty__body">Ajoutez les membres de la brigade : chaque relevé doit être tracé et signé.</p></div>';
  const lignes = liste.map((operateur) => {
    const id = identifier(operateur);
    const actif = operateur.active !== false;
    const dernier = actif && estGerant(operateur) && gerants <= 1;
    const refus = !peut ? RAISON_DROITS : dernier ? RAISON_DERNIER_GERANT : '';
    const enService = texte(id) === texte(courant);
    const modele = ROLES[operateur.role] || {};
    const statut = actif ? '<span class="mark mark--ok">actif</span>' : '<span class="mark mark--neutral">inactif</span>';
    const code = pinDefini(operateur) ? '<span class="mark mark--ok">défini</span>' : '<span class="mark mark--neutral">non défini</span>';
    return `<tr><td><span class="op-chip">${esc(initiales(operateur))}</span></td>
      <td>${esc(nomComplet(operateur))}${enService ? ' <span class="mark mark--ok">En service</span>' : ''}</td>
      <td>${esc(modele.label || operateur.role || T_VIDE)} <span class="field__hint">${esc(modele.description || '')}</span></td>
      <td>${code}</td><td>${statut}</td><td>${esc(dateHeure(operateur.createdAt || operateur.creeLe))}</td>
      <td><div class="toolbar">${bouton('op-modifier', 'Modifier', id, !peut, RAISON_DROITS)}${bouton('op-pin', 'Changer le PIN', id, !peut, RAISON_DROITS)}
        ${bouton('op-bascule', actif ? 'Désactiver' : 'Réactiver', id, Boolean(refus), refus || '')}
        ${bouton('op-courant', 'Définir comme opérateur courant', id, enService, "Cet utilisateur est déjà l'opérateur courant.")}
        ${bouton('op-supprimer', 'Supprimer', id, !peut || dernier, !peut ? RAISON_DROITS : RAISON_DERNIER_GERANT, 'btn--danger')}</div></td></tr>`;
  }).join('');
  return `<div class="toolbar">${bouton('op-ajouter', 'Ajouter un utilisateur', '', !peut, RAISON_DROITS, 'btn--primary btn--sm')}</div>
    ${peut ? '' : `<div class="callout callout--info">${RAISON_DROITS} La liste et la matrice restent consultables.</div>`}
    <table class="table"><thead><tr><th>Initiales</th><th>Nom</th><th>Rôle</th><th>PIN</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead>
    <tbody>${lignes}</tbody></table>
    <div class="callout callout--warn">Au moins un gérant actif est obligatoire : désactivation et suppression du dernier gérant actif sont refusées avant tout appel.</div>`;
}
function matricePermissions() {
  const permissions = permissionsListe();
  const entetes = permissions.map((p) => `<th title="${esc(p.label)}">${esc(COURTS[p.id] || p.label)}</th>`).join('');
  const lignes = ROLE_ORDER.map((role) => {
    const cellules = permissions.map((p) => (autorise(role, p.id)
      ? '<td><span class="mark mark--ok" title="Autorisé">oui</span></td>'
      : '<td><span class="mark mark--neutral" title="Non autorisé">non</span></td>')).join('');
    return `<tr><td>${esc((ROLES[role] || {}).label || role)}</td>${cellules}</tr>`;
  }).join('');
  return `<section class="sheet"><div class="section">
    <div class="section__head"><h2 class="section__title">Matrice des permissions</h2></div>
    <p class="field__hint">Chaque rôle ouvre un périmètre précis : voici ce que chacun peut faire.</p>
    <div class="matrix"><table class="table"><thead><tr><th>Rôle</th>${entetes}</tr></thead><tbody>${lignes}</tbody></table></div></div></section>`;
}
/* (c) Journal d'activité ──────────────────────────────────────────── */
function valeursDistinctes(entrees, extraire) {
  const vues = [];
  entrees.forEach((entree) => { const valeur = texte(extraire(entree)); if (valeur && vues.indexOf(valeur) === -1) vues.push(valeur); });
  return vues.sort();
}
function choixFiltre(nom, valeurs, courante, libelle) {
  const options = [`<option value="">Toutes les ${esc(libelle)}</option>`].concat(valeurs.map((v) => `<option value="${esc(v)}"${v === courante ? ' selected' : ''}>${esc(v)}</option>`));
  return `<select class="select" data-filtre="${esc(nom)}" aria-label="Filtrer par ${esc(libelle)}">${options.join('')}</select>`;
}
function nomOperateur(ctx, entree) {
  const direct = texte(entree.operatorName || entree.operateur || entree.operator || entree.auteur);
  if (direct) return direct;
  const id = entree.operatorId || entree.operateurId;
  if (!id) return 'Système';
  const trouve = trouver(ctx, id);
  return trouve ? nomComplet(trouve) : texte(id);
}
function vueJournal(ctx) {
  const entrees = journal(ctx);
  const filtrees = entrees.filter((entree) => (!etat.action || texte(entree.action || entree.type) === etat.action)
    && (!etat.operateur || nomOperateur(ctx, entree) === etat.operateur)).slice(0, JOURNAL_AFFICHE);
  const lignes = filtrees.map((entree) => {
    const detail = texte(entree.detail || entree.message || entree.label || entree.description);
    return `<li class="timeline__item"><span class="unit">${esc(dateHeure(entree.at || entree.date || entree.timestamp || entree.createdAt))}</span>
      <strong>${esc(texte(entree.action || entree.type) || 'Événement')}</strong> <span>${esc(nomOperateur(ctx, entree))}</span>
      ${detail ? `<span class="field__hint">${esc(detail)}</span>` : ''}</li>`;
  }).join('');
  const vide = '<div class="empty"><p class="empty__title">Aucune entrée</p><p class="empty__body">Le journal se remplit à chaque relevé signé, sauvegarde ou modification de réglage.</p></div>';
  return `<section class="sheet"><div class="section">
    <div class="section__head"><h2 class="section__title">Journal d'activité</h2><div class="section__action">
      ${choixFiltre('action', valeursDistinctes(entrees, (e) => e.action || e.type), etat.action, 'actions')}
      ${choixFiltre('operateur', valeursDistinctes(entrees, (e) => nomOperateur(ctx, e)), etat.operateur, 'opérateurs')}</div></div>
    <p class="field__hint">Les ${JOURNAUX_CONSERVES} dernières entrées sont conservées (${entrees.length} lues, ${filtrees.length} affichées).</p>
    ${filtrees.length ? `<ul class="timeline">${lignes}</ul>` : vide}</div></section>`;
}
export function render(ctx) {
  const fiche = etablissement(ctx);
  const contenu = etat.onglet === 'utilisateurs' ? `${tableauUtilisateurs(ctx)}${matricePermissions()}`
    : etat.onglet === 'journal' ? vueJournal(ctx) : etat.edition ? ficheEdition(ctx, fiche, {}) : ficheLecture(ctx, fiche, {});
  return `${entete()}${segmentation()}${contenu}`;
}
/* ══ Panneaux (formulaires) ════════════════════════════════════════ */
function formulaireOperateur(ctx, operateur) {
  const edition = Boolean(operateur);
  const roleCourant = (operateur && operateur.role) || ROLE_ORDER[0];
  const actif = !operateur || operateur.active !== false;
  const options = ROLE_ORDER.map((role) => `<option value="${esc(role)}"${role === roleCourant ? ' selected' : ''}>${esc((ROLES[role] || {}).label || role)}</option>`).join('');
  refPan.el = null;
  const champ = (nom, libelle, valeur) => `<div class="field"><label class="field__label">${esc(libelle)}</label><input class="input" type="text" data-champ="${nom}" value="${esc(valeur)}" aria-label="${esc(libelle)}">${champErreur(nom)}</div>`;
  const code = (nom, libelle) => `<div class="field"><label class="field__label">${esc(libelle)}</label><div class="pin"><input class="input" type="password" inputmode="numeric" maxlength="4" data-champ="${nom}" aria-label="${esc(libelle)}"></div>${champErreur(nom)}</div>`;
  ctx.ui.panel({
    title: edition ? 'Modifier un utilisateur' : 'Ajouter un utilisateur',
    subtitle: edition ? nomComplet(operateur) : 'Nouveau membre de la brigade',
    body: `<div class="callout callout--info">Le PIN protège la signature des relevés ; il n'est jamais relu ni affiché.</div>
      ${champ('firstName', 'Prénom', operateur ? operateur.firstName : '')}${champ('lastName', 'Nom', operateur ? operateur.lastName : '')}
      <div class="field"><label class="field__label">Rôle</label><select class="select" data-champ="role" aria-label="Rôle">${options}</select>
        <span class="field__hint" data-description="role">${esc((ROLES[roleCourant] || {}).description || '')}</span>${champErreur('role')}</div>
      <div class="callout callout--danger" data-panneau-erreur hidden></div>
      ${code('pin', 'PIN (facultatif)')}<p class="field__hint">4 chiffres, à confirmer. Laissez vide pour définir le PIN plus tard.</p>
      ${code('pin2', 'Confirmation du PIN')}
      <label class="switch"><input type="checkbox" data-champ="active"${actif ? ' checked' : ''}><span class="switch__track"><span class="switch__thumb"></span></span><span>Utilisateur actif</span></label>`,
    onMount: (el) => { refPan.el = el; },
    actions: [{ label: 'Annuler', kind: 'ghost' }, { label: edition ? 'Enregistrer' : 'Créer', kind: 'primary', onClick: () => soumettreOperateur(ctx, operateur) }],
  });
}
function formulairePin(ctx, operateur, appliquer) {
  refPan.el = null;
  const code = (nom, libelle) => `<div class="field"><label class="field__label">${esc(libelle)}</label><div class="pin"><input class="input" type="password" inputmode="numeric" maxlength="4" data-champ="${nom}" aria-label="${esc(libelle)}"></div>${champErreur(nom)}</div>`;
  ctx.ui.panel({
    title: 'Changer le PIN',
    subtitle: nomComplet(operateur),
    body: `<div class="callout callout--info">Le PIN est remplacé, jamais relu : aucune valeur existante n'est affichée.</div>
      ${code('pin', 'Nouveau PIN')}${code('pin2', 'Confirmation')}
      <div class="callout callout--danger" data-panneau-erreur hidden></div>`,
    onMount: (el) => { refPan.el = el; },
    actions: [{ label: 'Annuler', kind: 'ghost' }, { label: 'Enregistrer', kind: 'primary', onClick: () => soumettrePin(ctx, operateur, appliquer) }],
  });
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
const fermerPanneau = (el) => { const croix = el.querySelector('[data-ui-close]'); if (croix) croix.click(); };
const refuser = (ctx, errors, repli) => ctx.ui.toast({ status: 'danger', message: messagesErreurs(errors)[0] || repli || "L'opération a été refusée par le registre." });
function lireOperateur(el, erreurs) {
  const lire = (nom) => { const champ = el.querySelector(`[data-champ="${nom}"]`); return champ ? texte(champ.value) : ''; };
  const bascule = el.querySelector('[data-champ="active"]');
  const pin = lire('pin');
  const pin2 = lire('pin2');
  const donnees = { firstName: lire('firstName'), lastName: lire('lastName'), role: lire('role'), active: bascule ? Boolean(bascule.checked) : true };
  if (donnees.firstName.length < 2) erreurs.firstName = 'Indiquez un prénom (2 caractères minimum).';
  if (donnees.lastName.length < 2) erreurs.lastName = 'Indiquez un nom (2 caractères minimum).';
  if (ROLE_ORDER.indexOf(donnees.role) === -1) erreurs.role = 'Choisissez un rôle dans la liste.';
  if (pin || pin2) {
    if (!/^\d{4}$/.test(pin)) erreurs.pin = 'Le PIN doit comporter 4 chiffres.';
    else if (pin !== pin2) erreurs.pin2 = 'Les deux saisies du PIN diffèrent.';
    else donnees.pin = pin;
  }
  return donnees;
}
function soumettreOperateur(ctx, operateur) {
  const el = refPan.el;
  if (!el) return false;
  const erreurs = {};
  const donnees = lireOperateur(el, erreurs);
  if (Object.keys(erreurs).length) { afficherErreursPanneau(el, erreurs); return false; }
  const resultat = operateur ? ctx.account.updateOperator(operateur.id, donnees) : ctx.account.createOperator(donnees);
  if (!resultat || resultat.ok === false) { afficherErreursPanneau(el, resultat && resultat.errors); refuser(ctx, resultat && resultat.errors); return false; }
  fermerPanneau(el);
  ctx.ui.toast({ status: 'ok', message: operateur ? 'Utilisateur mis à jour' : 'Utilisateur ajouté' });
  redessiner(ctx);
  return false;
}
function soumettrePin(ctx, operateur, appliquer) {
  const el = refPan.el;
  if (!el) return false;
  const erreurs = {};
  const donnees = lireOperateur(el, erreurs);
  if (erreurs.pin || erreurs.pin2) { afficherErreursPanneau(el, erreurs); return false; }
  if (!donnees.pin) { afficherErreursPanneau(el, { pin: 'Saisissez un PIN à 4 chiffres.' }); return false; }
  const resultat = appliquer ? appliquer(donnees.pin) : ctx.account.changePin(operateur.id, donnees.pin);
  if (!resultat || resultat.ok === false) { afficherErreursPanneau(el, resultat && resultat.errors); refuser(ctx, resultat && resultat.errors); return false; }
  fermerPanneau(el);
  ctx.ui.toast({ status: 'ok', message: 'PIN enregistré' });
  redessiner(ctx);
  return false;
}
/* ══ Actions métier ════════════════════════════════════════════════ */
function afficherErreursFiche(erreurs) {
  if (!racineActive) return;
  racineActive.querySelectorAll('[data-erreur]').forEach((span) => { span.textContent = erreurChamp(erreurs, span.getAttribute('data-erreur')); });
}
function enregistrerFiche(ctx) {
  const erreurs = {};
  const donnees = lireFiche(racineActive, erreurs);
  if (Object.keys(erreurs).length) { afficherErreursFiche(erreurs); return; }
  const resultat = ctx.account.setEstablishment(donnees);
  if (!resultat || resultat.ok === false) { afficherErreursFiche((resultat && resultat.errors) || {}); refuser(ctx, resultat && resultat.errors); return; }
  etat.edition = false;
  ctx.ui.toast({ status: 'ok', message: 'Fiche établissement enregistrée' });
  redessiner(ctx);
}
async function basculerOperateur(ctx, id) {
  const operateur = trouver(ctx, id);
  if (!operateur) return;
  const actif = operateur.active !== false;
  const accord = await ctx.ui.confirm({
    title: actif ? 'Désactiver cet utilisateur' : 'Réactiver cet utilisateur',
    body: `<p>${esc(nomComplet(operateur))} ${actif ? 'ne pourra plus signer de relevé' : 'pourra de nouveau signer des relevés'}.</p>`,
    confirmLabel: actif ? 'Désactiver' : 'Réactiver',
    danger: actif,
  });
  if (!accord) return;
  const resultat = ctx.account.setOperatorActive(id, !actif);
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); return; }
  ctx.ui.toast({ status: 'ok', message: actif ? 'Utilisateur désactivé' : 'Utilisateur réactivé' });
  redessiner(ctx);
}
async function supprimerOperateur(ctx, id) {
  const operateur = trouver(ctx, id);
  if (!operateur) return;
  const accord = await ctx.ui.confirm({
    title: 'Supprimer cet utilisateur',
    body: `<p>${esc(nomComplet(operateur))} quittera la brigade.</p><p>Les enregistrements signés sont conservés : la traçabilité reste complète.</p>`,
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (!accord) return;
  const resultat = ctx.account.deleteOperator(id);
  if (!resultat || resultat.ok === false) { refuser(ctx, resultat && resultat.errors); return; }
  ctx.ui.toast({ status: 'ok', message: 'Utilisateur supprimé, relevés signés conservés' });
  redessiner(ctx);
}
function definirCourant(ctx, id) {
  const operateur = trouver(ctx, id);
  if (!operateur) return;
  const appliquer = (pin) => ctx.account.setCurrentOperator(id, pin ? { pin } : {});
  if (pinDefini(operateur)) { formulairePin(ctx, operateur, appliquer); return; }
  const resultat = appliquer('');
  if (!resultat || resultat.ok === false) {
    const messages = messagesErreurs(resultat && resultat.errors);
    ctx.ui.toast({ status: 'danger', message: messages[0] || 'Changement refusé.' });
    if (/pin/i.test(messages.join(' '))) formulairePin(ctx, operateur, appliquer);
    return;
  }
  ctx.ui.toast({ status: 'ok', message: `Opérateur courant : ${nomComplet(operateur)}` });
  redessiner(ctx);
}
const ACTIONS = {
  'onglet-etablissement': () => { etat.onglet = 'etablissement'; etat.edition = false; redessiner(contexteActif); },
  'onglet-utilisateurs': () => { etat.onglet = 'utilisateurs'; etat.edition = false; redessiner(contexteActif); },
  'onglet-journal': () => { etat.onglet = 'journal'; etat.edition = false; redessiner(contexteActif); },
  'etab-editer': () => { etat.edition = true; redessiner(contexteActif); },
  'etab-annuler': () => { etat.edition = false; redessiner(contexteActif); },
  'etab-enregistrer': (ctx) => enregistrerFiche(ctx),
  'op-ajouter': (ctx) => { formulaireOperateur(ctx, null); },
  'op-modifier': (ctx, element) => { const cible = trouver(ctx, element.getAttribute('data-id')); if (cible) formulaireOperateur(ctx, cible); },
  'op-pin': (ctx, element) => { const cible = trouver(ctx, element.getAttribute('data-id')); if (cible) formulairePin(ctx, cible, null); },
  'op-bascule': (ctx, element) => basculerOperateur(ctx, element.getAttribute('data-id')),
  'op-courant': (ctx, element) => { definirCourant(ctx, element.getAttribute('data-id')); },
  'op-supprimer': (ctx, element) => supprimerOperateur(ctx, element.getAttribute('data-id')),
};
/* ══ État, câblage et cycle de vie ═════════════════════════════════ */
const etat = { onglet: 'etablissement', edition: false, action: '', operateur: '' };
const refPan = { el: null };
let abonnement = null;
let generation = 0;
let racineActive = null;
let contexteActif = null;
function redessiner(ctx) {
  if (!racineActive || !racineActive.isConnected) return;
  const frais = ctx.store && typeof ctx.store.getState === 'function' ? { ...ctx, ...ctx.store.getState() } : ctx;
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
  root.querySelectorAll('[data-filtre]').forEach((element) => {
    element.addEventListener('change', () => {
      if (element.getAttribute('data-filtre') === 'operateur') etat.operateur = element.value; else etat.action = element.value;
      redessiner(ctx);
    });
  });
}
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
