/**
 * TraqHACCP — Couche présentation — API impérative de l'interface (ARCHITECTURE §5, spec P5a §2).
 * Auto-suffisant (ni shell ni routeur) ; aucun effet de bord DOM à l'import.
 * Markup conforme au design system : .toast .panel .modal .palette .callout .empty .skeleton.
 * Aucun style en ligne, aucune couleur en dur, aucun emoji, jamais d'alert() ni de boîte native.
 * `actions` = [{ label, kind: 'primary'|'ghost'|'danger', onClick }] ; un onClick qui renvoie
 * `false` laisse la surcouche ouverte, sinon elle se ferme.
 */
import { icon } from './icons.js';
import { NAV } from '../domain/constants.js';

const STATUTS = ['ok', 'warn', 'danger', 'info', 'neutral'];
const DUREE_TOAST = 4000;
const PROFONDEUR_MAX = 3;
const FOCUSABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const pile = [];
const declarees = new Map();
let sequence = 0, ecouteInstallee = false, verrouEcriture = false, cache = null;

/** Échappe une valeur destinée à un nœud texte ou à un attribut. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const noeud = (html) => { const gabarit = document.createElement('template'); gabarit.innerHTML = String(html).trim(); return gabarit.content.firstElementChild; };
const poser = (hote, contenu) => { if (!hote) return; if (contenu && contenu.nodeType === 1) hote.replaceChildren(contenu); else hote.innerHTML = String(contenu ?? ''); };

/** Conteneurs de surcouche créés paresseusement : seul point du module qui connaît des ids. */
const conteneurs = () => {
  if (!(cache && cache.toasts.isConnected)) {
    if (!document.getElementById('ui-toasts')) document.body.insertAdjacentHTML('beforeend', '<div id="ui-toasts" aria-live="polite" aria-atomic="false"></div><div id="ui-banner"></div><div id="ui-overlay"></div>');
    cache = { toasts: document.getElementById('ui-toasts'), banner: document.getElementById('ui-banner'), overlay: document.getElementById('ui-overlay') };
  }
  return cache;
};

/** Échap ferme la surcouche du dessus ; délégation des actions ; filet du mode inspection. */
const ecouter = () => {
  if (ecouteInstallee) return;
  ecouteInstallee = true;
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && pile.length) { ev.preventDefault(); fermerDessus(); } });
  document.addEventListener('click', (ev) => {
    const cible = ev.target;
    if (!cible || !cible.closest) return;
    if (verrouEcriture && cible.closest('[data-write]')) { ev.preventDefault(); ev.stopPropagation(); return toast({ status: 'warn', message: "Mode inspection : action d'écriture désactivée." }); }
    const declencheur = cible.closest('[data-ui-action]');
    const rappel = declencheur && declarees.get(declencheur.getAttribute('data-ui-action'));
    if (rappel) rappel(ev);
  }, true);
};

/** Piège le focus dans `racine` (Tab / Maj+Tab) ; renvoie la fonction de libération. */
export function focusTrap(racine) {
  const precedent = document.activeElement;
  const surTouche = (ev) => {
    if (ev.key !== 'Tab') return;
    const cibles = [...racine.querySelectorAll(FOCUSABLES)];
    if (!cibles.length) return;
    const premier = cibles[0], dernier = cibles[cibles.length - 1];
    if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
    else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
  };
  racine.addEventListener('keydown', surTouche);
  const entree = racine.querySelector(FOCUSABLES) || racine;
  if (entree.focus) entree.focus();
  return () => { racine.removeEventListener('keydown', surTouche); if (precedent && precedent.focus) precedent.focus(); };
}

/** Empile puis affiche une surcouche (fond `.backdrop` si bloquante ou masquable). */
const empiler = ({ id, element, bloquante = false, masquable = false, onClose, onMount }) => {
  ecouter();
  if (pile.length >= PROFONDEUR_MAX) fermer(pile[0]);
  const racine = document.createElement('div');
  const fond = bloquante || masquable ? noeud('<div class="backdrop is-open"></div>') : null;
  if (fond) racine.appendChild(fond);
  racine.appendChild(element);
  const fiche = { id: id || `ui-surcouche-${++sequence}`, racine, element, fond, onClose, liberer: null };
  if (masquable && fond) fond.addEventListener('click', () => fermer(fiche));
  conteneurs().overlay.appendChild(racine);
  fiche.liberer = focusTrap(element);
  element.classList.add('is-open');
  pile.push(fiche);
  if (onMount) onMount(element);
  return fiche;
};

/** Retire une surcouche de la pile et du DOM (idempotent). */
const fermer = (fiche) => {
  if (!fiche || pile.indexOf(fiche) === -1) return;
  pile.splice(pile.indexOf(fiche), 1);
  if (fiche.liberer) fiche.liberer();
  fiche.racine.remove();
  if (fiche.onClose) fiche.onClose();
};

const fermerDessus = () => fermer(pile[pile.length - 1]);
export const closeTopOverlay = fermerDessus;
export const overlayDepth = () => pile.length;
export const getStack = () => pile.map((fiche) => fiche.id);
export const closeOverlay = (id) => (id ? fermer([...pile].reverse().find((fiche) => fiche.id === id)) : fermerDessus());
export const closeAllOverlays = () => { while (pile.length) fermer(pile[pile.length - 1]); };

/** Pied d'actions `.btn--primary|ghost|danger`. */
const pied = (classe, liste, fermerSur) => {
  if (!Array.isArray(liste) || !liste.length) return null;
  const barre = noeud(`<div class="${classe}"></div>`);
  for (const action of liste) {
    const kind = action.kind === 'danger' || action.kind === 'ghost' ? action.kind : 'primary';
    const bouton = noeud(`<button class="btn btn--${kind}" type="button">${esc(action.label)}</button>`);
    bouton.addEventListener('click', () => { if (!action.onClick || action.onClick() !== false) fermerSur(); });
    barre.appendChild(bouton);
  }
  return barre;
};

/** Notification transitoire : toast({ status, message, actionLabel, onAction, duration }). */
export function toast(options = {}) {
  const cfg = typeof options === 'string' ? { message: options } : (options || {});
  const statut = STATUTS.includes(cfg.status) ? cfg.status : 'ok';
  const mod = ['ok', 'warn', 'danger'].includes(statut) ? ` toast--${statut}` : '';
  const picto = statut === 'ok' ? 'check' : statut === 'warn' || statut === 'danger' ? 'alert' : 'dot';
  const el = noeud(`<div class="toast${mod}" role="status">${icon(picto, 16)}<span>${esc(cfg.message)}</span></div>`);
  const retirer = () => el.remove();
  if (cfg.actionLabel) {
    const bouton = noeud(`<button class="toast__action" type="button">${esc(cfg.actionLabel)}</button>`);
    bouton.addEventListener('click', () => { if (cfg.onAction) cfg.onAction(); retirer(); });
    el.appendChild(bouton);
  }
  const boite = conteneurs().toasts;
  boite.appendChild(el);
  while (boite.children.length > PROFONDEUR_MAX) boite.firstElementChild.remove();
  const duree = Number.isFinite(cfg.duration) ? cfg.duration : DUREE_TOAST;
  if (duree > 0) setTimeout(retirer, duree);
  return el;
}

/* Désignation imposée par le contrat : ui.confirm (aucune boîte native du navigateur). */
export function confirm(options = {}) {  // design-ignore: nom de méthode imposé par le contrat ARCHITECTURE §5
  return new Promise((resoudre) => {
    let repondu = false;
    const finir = (valeur) => { if (!repondu) { repondu = true; resoudre(valeur); } };
    modal({ id: options.id || 'ui-confirm', size: 'sm', title: options.title, body: options.body, onClose: () => finir(false),
      actions: [{ label: 'Annuler', kind: 'ghost', onClick: () => finir(false) },
        { label: options.confirmLabel || 'Confirmer', kind: options.danger ? 'danger' : 'primary', onClick: () => finir(true) }] });
  });
}

/** Surcouche bloquante `.modal` (jamais fermée au clic extérieur). */
export function modal(options = {}) {
  const taille = options.size === 'sm' || options.size === 'lg' ? ` modal--${options.size}` : '';
  const el = noeud(`<div class="modal${taille}" role="dialog" aria-modal="true"><div class="modal__panel"><div class="modal__head"><span>${esc(options.title || '')}</span><button class="icon-btn" type="button" data-ui-close aria-label="Fermer">${icon('x', 18)}</button></div><div class="modal__body"></div></div></div>`);
  poser(el.querySelector('.modal__body'), options.body);
  const fiche = { ouvert: null };
  const fermerSur = () => fermer(fiche.ouvert);
  el.querySelector('[data-ui-close]').addEventListener('click', fermerSur);
  const barre = pied('modal__foot', options.actions, fermerSur);
  if (barre) el.querySelector('.modal__panel').appendChild(barre);
  fiche.ouvert = empiler({ id: options.id, element: el, bloquante: true, onClose: options.onClose, onMount: options.onMount && (() => options.onMount(el)) });
  el.querySelector('.modal__panel').classList.add('is-open');
  return fiche.ouvert;
}

/** Feuille latérale `.panel` : non bloquante, fermeture au clic sur le fond. */
export function panel(options = {}) {
  const el = noeud(`<aside class="panel" role="dialog" aria-modal="false"><div class="panel__head"><span>${esc(options.title || '')}</span><button class="icon-btn" type="button" data-ui-close aria-label="Fermer">${icon('x', 18)}</button></div><div class="panel__body"></div></aside>`);
  if (options.subtitle) el.querySelector('.panel__head span').insertAdjacentHTML('beforeend', ` <span class="unit">${esc(options.subtitle)}</span>`);
  if (options.width) el.setAttribute('data-width', String(options.width));  // variante CSS à venir
  poser(el.querySelector('.panel__body'), options.body);
  const fiche = { ouvert: null };
  const fermerSur = () => fermer(fiche.ouvert);
  el.querySelector('[data-ui-close]').addEventListener('click', fermerSur);
  const barre = pied('panel__foot', options.actions, fermerSur);
  if (barre) el.appendChild(barre);
  fiche.ouvert = empiler({ id: options.id, element: el, masquable: true, onClose: options.onClose, onMount: options.onMount && (() => options.onMount(el)) });
  return fiche.ouvert;
}

/** Palette de commandes (Ctrl/Cmd+K), alimentée par NAV. */
export function palette() {
  const entrees = NAV.flatMap((groupe) => groupe.items.map((item) => ({ ...item, groupe: groupe.group })));
  const el = noeud(`<div class="palette" role="dialog" aria-modal="true" aria-label="Palette de commandes"><div class="palette__input">${icon('search', 18)}<input type="search" placeholder="Rechercher un module" aria-label="Rechercher un module" autofocus></div><ul class="palette__list"></ul></div>`);
  const liste = el.querySelector('.palette__list');
  const champ = el.querySelector('input');
  const dessiner = (filtre) => {
    const f = String(filtre).trim().toLowerCase();
    liste.innerHTML = entrees.filter((it) => !f || `${it.title} ${it.id} ${it.groupe}`.toLowerCase().includes(f))
      .map((it, i) => `<li class="palette__item${i ? '' : ' is-active'}" data-cible="${it.id}">${icon(it.icon, 16)}<span>${esc(it.title)}</span><span class="unit">${esc(it.groupe)}</span></li>`).join('');
  };
  dessiner('');
  champ.addEventListener('input', () => dessiner(champ.value));
  champ.addEventListener('keydown', (ev) => { const actif = ev.key === 'Enter' && liste.querySelector('.palette__item'); if (actif) actif.click(); });
  liste.addEventListener('click', (ev) => {
    const ligne = ev.target.closest && ev.target.closest('[data-cible]');
    if (!ligne) return;
    const cible = ligne.getAttribute('data-cible');
    fermerDessus();
    if (typeof globalThis.switchTab === 'function') globalThis.switchTab(cible);
  });
  return empiler({ id: 'ui-palette', element: el, bloquante: true, masquable: true });
}

/** Lightbox photo : image plein écran + légende. */
export function photo(src, legende) {
  const el = noeud(`<div class="lightbox" role="dialog" aria-modal="true"><img src="${esc(src)}" alt="${esc(legende || 'Photo jointe')}"><div class="lightbox__foot">${esc(legende || '')}</div><button class="icon-btn" type="button" data-ui-close aria-label="Fermer">${icon('x', 18)}</button></div>`);
  el.querySelector('[data-ui-close]').addEventListener('click', fermerDessus);
  el.addEventListener('click', (ev) => { if (ev.target === el) fermerDessus(); });
  return empiler({ id: 'ui-photo', element: el, bloquante: true, masquable: true });
}

/** Compresse et redimensionne une image (Canvas max 1024px, JPEG 0.70) pour préserver le quota localStorage. */
function compresserImage(sourceDataUrl, maxDim = 1024, qualite = 0.70) {
  return new Promise((resoudre) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const toile = document.createElement('canvas');
      toile.width = w;
      toile.height = h;
      const ctx = toile.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resoudre(toile.toDataURL('image/jpeg', qualite));
    };
    img.onerror = () => resoudre(sourceDataUrl);
    img.src = sourceDataUrl;
  });
}

/** Capture photo : `onCapture(dataUrl)` ; résout le dataUrl obtenu, sinon `null`. */
export function camera(options = {}) {
  return new Promise((resoudre) => {
    let flux = null, fini = false;
    const finir = (valeur) => { if (!fini) { fini = true; resoudre(valeur); } };
    const arreter = () => { if (flux) flux.getTracks().forEach((piste) => piste.stop()); flux = null; };
    const el = noeud(`<div class="modal" role="dialog" aria-modal="true"><div class="modal__panel"><div class="modal__head"><span>Prise de photo</span><button class="icon-btn" type="button" data-ui-close aria-label="Fermer">${icon('x', 18)}</button></div><div class="modal__body"><video autoplay playsinline muted style="max-height: 50vh; width: 100%; object-fit: contain; background: var(--paper-2);"></video><div class="stack stack--xs" style="margin-top: var(--s-3); text-align: center;"><label class="btn btn--ghost" style="cursor: pointer;">${icon('upload', 16)} Choisir depuis la galerie / Appareil<input type="file" accept="image/*" capture="environment" data-file-pick style="display: none;"></label></div></div><div class="modal__foot"><button class="btn btn--ghost" type="button" data-ui-close>Annuler</button><button class="btn btn--primary" type="button" data-capture disabled>Prendre la photo</button></div></div></div>`);
    const pan = el.querySelector('.modal__panel');
    if (pan) pan.classList.add('is-open');
    const video = el.querySelector('video');
    const declencheur = el.querySelector('[data-capture]');
    const fileInput = el.querySelector('[data-file-pick]');
    const fiche = { ouvert: null };
    const fermerSur = () => { arreter(); fermer(fiche.ouvert); };
    [...el.querySelectorAll('[data-ui-close]')].forEach((bouton) => bouton.addEventListener('click', fermerSur));
    
    if (fileInput) {
      fileInput.addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
          const brut = e.target.result;
          const compresse = await compresserImage(brut, 1024, 0.70);
          finir(compresse);
          arreter();
          fermer(fiche.ouvert);
          if (options.onCapture) options.onCapture(compresse);
        };
        reader.readAsDataURL(file);
      });
    }

    declencheur.addEventListener('click', async () => {
      const toile = document.createElement('canvas');
      toile.width = video.videoWidth || 640;
      toile.height = video.videoHeight || 480;
      toile.getContext('2d').drawImage(video, 0, 0, toile.width, toile.height);
      const brut = toile.toDataURL('image/jpeg', 0.85);
      const compresse = await compresserImage(brut, 1024, 0.70);
      finir(compresse);
      arreter();
      fermer(fiche.ouvert);
      if (options.onCapture) options.onCapture(compresse);
    });
    fiche.ouvert = empiler({ id: 'ui-camera', element: el, bloquante: true, onClose: () => { arreter(); finir(null); } });
    if (pan) pan.classList.add('is-open');

    const medias = globalThis.navigator && globalThis.navigator.mediaDevices;
    if (!medias || typeof medias.getUserMedia !== 'function') {
      video.style.display = 'none';
      declencheur.style.display = 'none';
      toast({ status: 'info', message: "Accès caméra direct non supporté sur ce navigateur (HTTPS requis). Veuillez importer une photo ci-dessous." });
      return;
    }
    const contraintes = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    medias.getUserMedia(contraintes)
      .catch(() => medias.getUserMedia({ video: true, audio: false }))
      .then((courant) => {
        flux = courant;
        video.srcObject = courant;
        video.play().catch(() => {});
        declencheur.disabled = false;
      })
      .catch(() => {
        video.style.display = 'none';
        declencheur.style.display = 'none';
        toast({ status: 'warn', message: "Accès caméra direct indisponible ou refusé. Vous pouvez importer une photo ci-dessous." });
      });
  });
}

/** Squelette de chargement (markup `.skeleton`). */
export function skeleton(lignes = 3) {
  return '<div class="section" aria-hidden="true">' + '<div class="skeleton">&nbsp;</div>'.repeat(Math.max(1, Number(lignes) || 3)) + '</div>';
}

/** État vide composé ; `actionLabel` + `onAction` optionnels. Retourne du markup. */
export function empty(options = {}) {
  const picto = String(options.icon || 'dot');
  let cle = null;
  if (options.onAction) { cle = `ui-action-${++sequence}`; declarees.set(cle, options.onAction); ecouter(); }
  return '<div class="empty">'
    + `<div class="empty__icon">${picto.includes('<svg') ? picto : icon(picto, 32)}</div>`
    + `<div class="empty__title">${esc(options.title || '')}</div><div class="empty__body">${esc(options.body || '')}</div>`
    + (options.actionLabel ? `<button class="btn btn--primary" type="button" data-ui-action="${cle}">${esc(options.actionLabel)}</button>` : '')
    + '</div>';
}

/** Bandeau persistant (`.callout`) ; `banner(null)` le retire. */
export function banner(options) {
  const hote = conteneurs().banner;
  hote.replaceChildren();
  if (!options || !options.message) return null;
  const statut = STATUTS.includes(options.status) ? options.status : 'info';
  const mod = statut === 'warn' || statut === 'danger' ? ` callout--${statut}` : ' callout--info';
  const el = noeud(`<div class="callout${mod}" role="alert">${icon(statut === 'warn' || statut === 'danger' ? 'alert' : 'dot', 16)}<span>${esc(options.message)}</span></div>`);
  if (options.actionLabel) {
    const bouton = noeud(`<button class="btn btn--ghost btn--sm" type="button">${esc(options.actionLabel)}</button>`);
    bouton.addEventListener('click', () => { if (options.onAction) options.onAction(); });
    el.appendChild(bouton);
  }
  const masquer = noeud(`<button class="icon-btn" type="button" aria-label="Masquer le bandeau">${icon('x', 18)}</button>`);
  masquer.addEventListener('click', () => banner(null));
  el.appendChild(masquer);
  hote.appendChild(el);
  return el;
}

/** Mode inspection : filet de sécurité neutralisant les actions `[data-write]`. */
export function lockOverlay(verrouille) {
  verrouEcriture = Boolean(verrouille);
  if (document.documentElement) document.documentElement.toggleAttribute('data-locked', verrouEcriture);
  ecouter();
  return verrouEcriture;
}

/** Crochets de classe pour le verrou de défilement (CSS du shell). */
export function lockScroll() { document.documentElement.classList.add('is-scroll-locked'); }
export function unlockScroll() { document.documentElement.classList.remove('is-scroll-locked'); }

export const ui = {
  toast, confirm, panel, modal, closeOverlay, closeTopOverlay, overlayDepth, closeAllOverlays,
  photo, camera, palette, skeleton, empty, banner, lockOverlay, lockScroll, unlockScroll, getStack, esc,
};

export default ui;
