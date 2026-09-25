/**
 * Preuve navigateur du cycle complet de synchronisation TraqHACCP.
 *
 * Appareil A : écriture locale dans le registre (vrai chemin state.js → saveState).
 * Serveur    : la ligne doit exister dans registry_records (vérifiée hors client,
 *              avec la clé de service, pour ne pas se contenter du témoignage de l'app).
 * Appareil B : contexte totalement isolé (stockage vide), même compte → le registre
 *              doit être relu DEPUIS LE SERVEUR.
 *
 * Piège de banc : au tout premier chargement, le service worker s'active et
 * recharge la page — tout appel lancé à ce moment meurt avec le contexte. D'où
 * `stabiliser()`, appelé après chaque ouverture, avant d'agir.
 *
 * Le fichier d'identifiants est lu, jamais affiché.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const id = JSON.parse(fs.readFileSync('/tmp/e2e-sync/identifiants.json', 'utf8'));
const APP = 'http://127.0.0.1:8899/index.html';
const JETON = `lot-banc-${Date.now()}`;

const env = fs.readFileSync('/opt/data/.env.supabase-traqhaccp', 'utf8');
const lireEnv = (cle) => (env.match(new RegExp(`^${cle}=(.*)$`, 'm')) || [])[1]?.trim();
const URL_SUPA = lireEnv('SUPABASE_URL');
const CLE_SERVICE = lireEnv('SUPABASE_SERVICE_ROLE_KEY');

const journal = [];
const verifier = (nom, ok, detail = '') => {
  journal.push(`${ok ? 'OK ' : 'ÉCHEC'} · ${nom}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
};

const naviguer = async (page, url = APP) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await stabiliser(page);
};

/** Attend que le service worker contrôle la page (il recharge l'onglet en s'activant). */
async function stabiliser(page) {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

const sessionDansLaPage = () => `
  (async () => {
    const { supabase } = await import('/src/infrastructure/supabase_client.js');
    return supabase.hasSession() === true;
  })()`;

/**
 * Ouvre une session sur la page, en tolérant la navigation déclenchée par le
 * retour d'authentification, et en réessayant si le contexte a été détruit.
 */
async function connecter(page, identifiants) {
  for (let tentative = 1; tentative <= 3; tentative += 1) {
    await page.evaluate(
      async ({ email, motDePasse }) => {
        const { supabase } = await import('/src/infrastructure/supabase_client.js');
        await supabase.signIn(email, motDePasse);
      }, identifiants,
    ).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await stabiliser(page);
    if (await page.evaluate(sessionDansLaPage)) return true;
  }
  return false;
}

const adoptionEtablissement = async (page) => page.evaluate(async (etab) => {
  const { state } = await import('/js/patisserie/state.js');
  return state.establishmentId === etab;
}, id.etablissementId);

const navigateur = await chromium.launch();

try {
  /* ────────── Appareil A : écriture locale ────────── */
  const ctxA = await navigateur.newContext();
  const pageA = await ctxA.newPage();
  await naviguer(pageA);

  verifier('A · le client de l’app ouvre une session Supabase', await connecter(pageA, id));

  // Rechargement → chemin de démarrage réel : initAuth → synchroniserEtablissementConnecte.
  await naviguer(pageA);
  await pageA.waitForFunction(async (etab) => {
    const { state } = await import('/js/patisserie/state.js');
    return state.establishmentId === etab;
  }, id.etablissementId, { timeout: 45000 }).catch(() => {});
  verifier('A · l’app a adopté l’établissement du serveur', await adoptionEtablissement(pageA),
    `id ${id.etablissementId}`);

  const ecrit = await pageA.evaluate(async (jeton) => {
    const { state, saveState } = await import('/js/patisserie/state.js');
    const { viderFile, syncActive, etatSync } = await import('/js/patisserie/sync.js');
    state.lots.push({ id: jeton, produit: 'Banc synchronisation', temperature: 3.5 });
    saveState();
    const bilan = await viderFile();
    return { actif: syncActive(), lots: state.lots.length, bilan, etat: etatSync() };
  }, JETON);
  verifier('A · la synchronisation est active sur l’appareil', ecrit.actif === true);
  verifier('A · le relevé est inscrit au registre local', ecrit.lots > 0, `${ecrit.lots} lot(s)`);

  /* ────────── Vérification côté serveur, hors client ────────── */
  const entetes = { apikey: CLE_SERVICE, Authorization: `Bearer ${CLE_SERVICE}` };
  const requete = `${URL_SUPA}/rest/v1/registry_records`
    + `?establishment_id=eq.${id.etablissementId}&collection=eq.lots&record_id=eq.${encodeURIComponent(JETON)}`;
  const reponse = await fetch(requete, { headers: entetes });
  const lignes = await reponse.json();
  verifier('serveur · la ligne existe dans registry_records (écrite par l’appareil A)',
    reponse.status === 200 && Array.isArray(lignes) && lignes.length === 1,
    `HTTP ${reponse.status}, ${Array.isArray(lignes) ? lignes.length : 0} ligne(s)`);
  if (Array.isArray(lignes) && lignes.length === 1) {
    const ligne = lignes[0];
    verifier('serveur · la charge utile est complète',
      ligne.payload?.produit === 'Banc synchronisation' && ligne.payload?.temperature === 3.5,
      JSON.stringify(ligne.payload));
    verifier('serveur · l’auteur vient du jeton, pas du client (trigger)',
      ligne.updated_by === id.userId, `updated_by = auteur du banc : ${ligne.updated_by === id.userId}`);
    verifier('serveur · la ligne n’est pas marquée supprimée', ligne.deleted === false);
  }

  /* ────────── Appareil B : contexte isolé, relecture serveur ────────── */
  const ctxB = await navigateur.newContext();
  const pageB = await ctxB.newPage();
  await naviguer(pageB);

  const herite = await pageB.evaluate((jeton) => JSON.stringify(localStorage).includes(jeton), JETON);
  verifier('B · rien n’est hérité localement du poste A (jeton absent)', herite === false);

  verifier('B · le client de l’app ouvre une session Supabase', await connecter(pageB, id));

  await naviguer(pageB);
  await pageB.waitForFunction(async ({ etab, jeton }) => {
    const { state } = await import('/js/patisserie/state.js');
    return state.establishmentId === etab && state.lots.some((l) => l.id === jeton);
  }, { etab: id.etablissementId, jeton: JETON }, { timeout: 45000 }).catch(() => {});

  const relu = await pageB.evaluate(async (jeton) => {
    const { state } = await import('/js/patisserie/state.js');
    return state.lots.find((l) => l.id === jeton) || null;
  }, JETON);
  verifier('B · le relevé du poste A est relu depuis le serveur sur un appareil neuf',
    relu !== null, relu ? `température ${relu.temperature} °C` : 'absent');

  await pageB.screenshot({ path: '/tmp/e2e-sync/appareil-B.png' });
} finally {
  await navigateur.close();
}

console.log(`\n${journal.join('\n')}`);
console.log(process.exitCode
  ? `\nÉCHEC — ${journal.filter((l) => l.startsWith('ÉCHEC')).length} vérification(s) en échec.`
  : `\nPASS — ${journal.length} vérifications : cycle complet local → Supabase → autre appareil.`);
