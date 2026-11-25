/**
 * Filet de sécurité : récupération des registres locaux « orphelins ».
 *
 * Le registre de l'app est cloisonné par établissement, sous la clé
 * `traqhaccp_patisserie_<scope>_<champ>_v1`. Ce cloisonnement a un revers : une
 * pâtissière qui a travaillé AVANT de se connecter (cloisonnement « serveur »),
 * ou avant un changement d'établissement, garde ses lots rangés sous l'ancienne
 * clé. Les données sont intactes — simplement plus lues. Si elle a réinitialisé
 * son mot de passe entre-temps, elle ouvre un registre vide et croit avoir tout
 * perdu (cas réel du 08/10/2026).
 *
 * Ce module repère ces registres orphelins et les réintègre :
 *   - « serveur » (saisi avant toute connexion) → fusionné systématiquement :
 *     ces données appartiennent à cet appareil, on ne peut pas les confondre
 *     avec celles d'un autre établissement ;
 *   - un autre établissement → fusionné uniquement si le registre courant est
 *     vide, pour ne jamais mélanger deux commerces sur un même appareil.
 *
 * La fusion se fait par `id` : on ajoute ce qui manque, on n'écrase jamais
 * l'existant, et aucune clé d'origine n'est supprimée.
 */
import { state, loadState, saveState } from './state.js';

const PREFIXE_LOCAL = 'traqhaccp_patisserie_';
const SUFFIXE_LOCAL = '_v1';
const SCOPE_INVITE = 'serveur';

/** Collections « métier » : leur présence prouve qu'un registre local a vécu. */
const CHAMPS_METIER = ['lots', 'recipes', 'secondaryDlcs', 'witnessSamples', 'salesHistory'];

/** Clés dont on compte les ajouts dans le compte rendu affiché à l'utilisateur. */
const CHAMPS_RAPPORTES = ['lots', 'recipes', 'salesHistory'];

function scopeCourant() {
  return String(state.establishmentId || SCOPE_INVITE);
}

function cleChamp(scope, champ) {
  return `${PREFIXE_LOCAL}${scope}_${champ}${SUFFIXE_LOCAL}`;
}

function lireListe(scope, champ) {
  try {
    const brut = localStorage.getItem(cleChamp(scope, champ));
    if (!brut) return [];
    const valeur = JSON.parse(brut);
    return Array.isArray(valeur) ? valeur : [];
  } catch {
    return [];
  }
}

/** Clé d'unicité d'une entrée : son `id`, sinon sa forme sérialisée. */
function identifiant(entree) {
  if (entree && typeof entree === 'object' && entree.id != null) return `id:${entree.id}`;
  return `brut:${JSON.stringify(entree)}`;
}

/**
 * Recense les cloisonnements locaux autres que l'établissement courant qui
 * contiennent encore des données métier.
 * @returns {Array<{scope: string, poids: number}>} du plus fourni au moins fourni
 */
export function registresOrphelins() {
  const courant = scopeCourant();
  let cles = [];
  try {
    cles = Object.keys(localStorage);
  } catch {
    return [];
  }

  const scopes = new Set();
  for (const cle of cles) {
    if (!cle.startsWith(PREFIXE_LOCAL) || !cle.endsWith(SUFFIXE_LOCAL)) continue;
    const milieu = cle.slice(PREFIXE_LOCAL.length, cle.length - SUFFIXE_LOCAL.length);
    const separateur = milieu.lastIndexOf('_');
    if (separateur <= 0) continue;
    const scope = milieu.slice(0, separateur);
    const champ = milieu.slice(separateur + 1);
    if (scope === courant || !CHAMPS_METIER.includes(champ)) continue;
    scopes.add(scope);
  }

  const orphelins = [];
  for (const scope of scopes) {
    const registre = { scope, poids: 0 };
    for (const champ of CHAMPS_METIER) {
      const contenu = lireListe(scope, champ);
      registre[champ] = contenu;
      registre.poids += contenu.length;
    }
    if (registre.poids > 0) orphelins.push(registre);
  }
  return orphelins.sort((a, b) => b.poids - a.poids);
}

/**
 * Réintègre les registres orphelins dans l'établissement courant, par fusion.
 * Idempotent : rejouable sans doublon grâce à la déduplication par `id`.
 * Ne fait rien si aucun orphelin, ou si l'unique orphelin est un autre
 * établissement alors que le registre courant contient déjà des données.
 *
 * @returns {{lots: number, recipes: number, salesHistory: number, scopes: string[]}|null}
 *   nombre d'entrées réellement ajoutées, ou `null` si rien n'a été récupéré.
 */
export function restaurerRegistreOrphelin() {
  const courant = scopeCourant();
  const cleMarqueur = `${PREFIXE_LOCAL}${courant}_registre_restaure${SUFFIXE_LOCAL}`;

  try {
    // Une seule récupération par établissement : sans ce garde-fou, un registre
    // légitimement vidé ressusciterait indéfiniment.
    if (localStorage.getItem(cleMarqueur)) return null;
  } catch {
    return null;
  }

  const orphelins = registresOrphelins();
  if (!orphelins.length) return null;

  const registreCourantVide = CHAMPS_METIER.every((champ) => lireListe(courant, champ).length === 0);

  // « serveur » = saisie d'avant connexion → toujours récupérable. Un autre
  // établissement n'est absorbé que dans un registre vide (aucun écrasement).
  const sources = orphelins.filter((o) => o.scope === SCOPE_INVITE || registreCourantVide);
  if (!sources.length) return null;

  const ajouts = { lots: 0, recipes: 0, salesHistory: 0, scopes: [] };

  try {
    for (const champ of CHAMPS_METIER) {
      const fusion = lireListe(courant, champ);
      const vus = new Set(fusion.map(identifiant));

      for (const source of sources) {
        for (const entree of source[champ] || []) {
          const cle = identifiant(entree);
          if (vus.has(cle)) continue;
          vus.add(cle);
          fusion.push(entree);
          if (CHAMPS_RAPPORTES.includes(champ)) ajouts[champ] += 1;
        }
      }

      localStorage.setItem(cleChamp(courant, champ), JSON.stringify(fusion));
    }
    ajouts.scopes = sources.map((s) => s.scope);
    localStorage.setItem(cleMarqueur, ajouts.scopes.join(','));
  } catch (erreur) {
    console.warn('Récupération du registre local impossible :', erreur);
    return null;
  }

  loadState(state.establishmentId, state.establishmentName || null);
  saveState();

  const total = CHAMPS_RAPPORTES.reduce((somme, champ) => somme + ajouts[champ], 0);
  if (total === 0) return null;

  console.info(
    `Registre récupéré depuis « ${ajouts.scopes.join(' », « ')} » : ` +
      `${ajouts.lots} lot(s), ${ajouts.recipes} recette(s), ${ajouts.salesHistory} vente(s).`,
  );
  return ajouts;
}
