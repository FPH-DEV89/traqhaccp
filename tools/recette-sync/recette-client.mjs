/**
 * Recette de synchronisation sur compte client réel (TraqHACCP).
 *
 * Objectif : prouver, sur un profil navigateur VIERGE, qu'un compte client réel
 * se connecte sans mot de passe (magic link via API admin GoTrue), adopte son
 * établissement et relit ses vraies données depuis le serveur.
 *
 * Mode LECTURE SEULE strict :
 *   - aucune modification de mot de passe, aucun identifiant jetable ;
 *   - aucune écriture dans les données du client (pas de saveState, pas d'ajout) ;
 *   - aucun secret imprimé (jetons, clés, session).
 *
 * Vérifications croisées :
 *   - session cliente valide dans l'app (supabase.hasSession() === true) ;
 *   - établissement adopté égal à l'adhésion gérant sur le serveur ;
 *   - indicateur d'état de sauvegarde serveur actif (non local) ;
 *   - 0 requête en échec et 0 erreur console ;
 *   - chaque collection de données dans l'app compte au moins autant d'éléments
 *     que de lignes non supprimées dans registry_records sur le serveur (≥).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { SUPABASE_CLE_SESSION } from '../../src/infrastructure/config.js';

// ─── Arguments et configuration ──────────────────────────────────────────────

function lireArguments() {
  const args = process.argv.slice(2);
  let email = process.env.CLIENT_EMAIL || process.env.RECETTE_CLIENT_EMAIL || 'manon@lesartssucres.fr';
  let url = process.env.APP_URL || 'http://127.0.0.1:8899/index.html';

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1];
      i += 1;
    } else if (args[i].startsWith('--email=')) {
      email = args[i].slice('--email='.length);
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i += 1;
    } else if (args[i].startsWith('--url=')) {
      url = args[i].slice('--url='.length);
    }
  }

  return { email, url };
}

const { email: EMAIL_CLIENT, url: URL_APP } = lireArguments();

const FICHIER_ENV = '/opt/data/.env.supabase-traqhaccp';
if (!fs.existsSync(FICHIER_ENV)) {
  console.error(`ÉCHEC · fichier d'environnement Supabase introuvable : ${FICHIER_ENV}`);
  process.exit(1);
}

const contenuEnv = fs.readFileSync(FICHIER_ENV, 'utf8');
const lireEnv = (cle) => (contenuEnv.match(new RegExp(`^${cle}=(.*)$`, 'm')) || [])[1]?.trim();

const URL_SUPA = lireEnv('SUPABASE_URL')?.replace(/\/+$/, '');
const CLE_SERVICE = lireEnv('SUPABASE_SERVICE_ROLE_KEY');
const CLE_PUBLIQUE = lireEnv('SUPABASE_PUBLISHABLE_KEY');

if (!URL_SUPA || !CLE_SERVICE || !CLE_PUBLIQUE) {
  console.error('ÉCHEC · variables SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_PUBLISHABLE_KEY manquantes.');
  process.exit(1);
}

// ─── Journalisation ──────────────────────────────────────────────────────────

const journal = [];
const verifier = (nom, ok, detail = '') => {
  journal.push(`${ok ? 'OK ' : 'ÉCHEC'} · ${nom}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
};

// ─── Stabilisation de page (Service Worker) ──────────────────────────────────

async function stabiliser(page) {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
}

// ─── Collections vérifiées ───────────────────────────────────────────────────

const COLLECTIONS_REGISTRE = [
  { collection: 'lots', champ: 'lots' },
  { collection: 'recipes', champ: 'recipes' },
  { collection: 'secondaryDlcs', champ: 'secondaryDlcs' },
  { collection: 'witnessSamples', champ: 'witnessSamples' },
  { collection: 'salesHistory', champ: 'salesHistory' },
  { collection: 'teamMembers', champ: 'teamMembers' },
];

// ─── Exécution principale ────────────────────────────────────────────────────

const navigateur = await chromium.launch();

try {
  /* 1. Émission du lien magique via l'API admin GoTrue (service role) */
  const reponseLien = await fetch(`${URL_SUPA}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: CLE_SERVICE,
      Authorization: `Bearer ${CLE_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email: EMAIL_CLIENT }),
  });

  const donneesLien = reponseLien.ok ? await reponseLien.json() : null;
  const jetonHache = donneesLien?.hashed_token;

  verifier(
    'service role · génération du jeton magiclink pour le client',
    reponseLien.ok && !!jetonHache,
    `HTTP ${reponseLien.status}, compte ${EMAIL_CLIENT}`,
  );

  if (!jetonHache) {
    throw new Error(`Impossible de générer le lien magique pour ${EMAIL_CLIENT} (HTTP ${reponseLien.status})`);
  }

  /* 2. Contexte Playwright vierge & échange du jeton contre la session */
  const ctx = await navigateur.newContext();

  const reponseVerify = await ctx.request.get(
    `${URL_SUPA}/auth/v1/verify?token=${encodeURIComponent(jetonHache)}&type=magiclink`,
    {
      headers: { apikey: CLE_PUBLIQUE },
      maxRedirects: 0,
    },
  );

  let session = null;
  if (reponseVerify.status() === 200) {
    session = await reponseVerify.json();
  } else if (reponseVerify.headers().location) {
    const fragment = new URL(reponseVerify.headers().location).hash.slice(1);
    const parametres = new URLSearchParams(fragment);
    const accessToken = parametres.get('access_token');
    const refreshToken = parametres.get('refresh_token');
    const expiresAt = Number(parametres.get('expires_at'))
      || (Math.floor(Date.now() / 1000) + Number(parametres.get('expires_in') || 3600));
    const tokenType = parametres.get('token_type') || 'bearer';

    const reponseUser = await ctx.request.get(`${URL_SUPA}/auth/v1/user`, {
      headers: {
        apikey: CLE_PUBLIQUE,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const utilisateur = reponseUser.ok() ? await reponseUser.json() : null;

    session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: tokenType,
      expires_at: expiresAt,
      user: utilisateur,
    };
  }

  const sessionValide = Boolean(session?.access_token && session?.user?.id);
  verifier(
    'Playwright · échange du jeton contre une session cliente complète',
    sessionValide,
    sessionValide ? `utilisateur id ${session.user.id}` : `HTTP ${reponseVerify.status()}`,
  );

  if (!sessionValide) {
    throw new Error('Échange de session échoué : ni jeton ni profil utilisateur retournés.');
  }

  /* 3. Recherche de l'établissement du client côté serveur (memberships) */
  const reponseMembres = await fetch(
    `${URL_SUPA}/rest/v1/memberships?user_id=eq.${encodeURIComponent(session.user.id)}&role=eq.gerant&select=establishment_id`,
    {
      headers: {
        apikey: CLE_SERVICE,
        Authorization: `Bearer ${CLE_SERVICE}`,
      },
    },
  );
  const membres = reponseMembres.ok ? await reponseMembres.json() : [];
  const etabAttendu = Array.isArray(membres) && membres[0] ? membres[0].establishment_id : null;

  verifier(
    'serveur · établissement client retrouvé dans memberships (role=gerant)',
    Boolean(etabAttendu),
    etabAttendu ? `id ${etabAttendu}` : 'aucun établissement gérant trouvé',
  );

  if (!etabAttendu) {
    throw new Error(`Aucun établissement gérant rattaché à l'utilisateur ${session.user.id}`);
  }

  /* 4. Preuve croisée hors client : comptage serveur par collection */
  const reponseServeur = await fetch(
    `${URL_SUPA}/rest/v1/registry_records?establishment_id=eq.${encodeURIComponent(etabAttendu)}&deleted=eq.false&select=collection`,
    {
      headers: {
        apikey: CLE_SERVICE,
        Authorization: `Bearer ${CLE_SERVICE}`,
      },
    },
  );
  const lignesServeur = reponseServeur.ok ? await reponseServeur.json() : [];
  const comptageServeur = {};
  if (Array.isArray(lignesServeur)) {
    for (const ligne of lignesServeur) {
      comptageServeur[ligne.collection] = (comptageServeur[ligne.collection] || 0) + 1;
    }
  }

  verifier(
    'serveur · inventaire des lignes registry_records non supprimées',
    reponseServeur.ok && Array.isArray(lignesServeur),
    `${lignesServeur.length} ligne(s) sur le serveur`,
  );

  /* 5. Injection de la session seule dans le stockage du profil vierge */
  await ctx.addInitScript(({ cle, donnees }) => {
    try {
      localStorage.setItem(cle, JSON.stringify(donnees));
    } catch (err) {
      console.error('Erreur addInitScript :', err);
    }
  }, { cle: SUPABASE_CLE_SESSION, donnees: session });

  /* 6. Surveillance réseau et console pendant toute la session */
  const page = await ctx.newPage();
  const erreursConsole = [];
  const requetesEchouees = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      erreursConsole.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    requetesEchouees.push(`${req.url()} (${req.failure()?.errorText || 'échec'})`);
  });

  /* 7. Navigation et stabilisation du service worker */
  await page.goto(URL_APP, { waitUntil: 'domcontentloaded' });
  await stabiliser(page);

  /* 8. Attente de l'adoption de l'établissement par l'application */
  await page.waitForFunction(async (etab) => {
    const { state } = await import('/js/patisserie/state.js');
    return state.establishmentId === etab;
  }, etabAttendu, { timeout: 45000 }).catch(() => {});

  /* 9. Assertions sur l'application dans la page */
  const etatApp = await page.evaluate(async () => {
    const { state } = await import('/js/patisserie/state.js');
    const { supabase } = await import('/src/infrastructure/supabase_client.js');
    const { syncActive, etatSync } = await import('/js/patisserie/sync.js');
    const { resumerEtat } = await import('/js/patisserie/etat-sauvegarde.js');

    const badge = document.getElementById('badge-sauvegarde');
    const label = document.getElementById('badge-sauvegarde-label');
    const etat = etatSync();
    const resume = resumerEtat(etat);

    return {
      hasSession: supabase.hasSession() === true,
      establishmentId: state.establishmentId,
      establishmentName: state.establishmentName,
      syncActive: syncActive(),
      etatSync: etat,
      resumeSauvegarde: resume,
      badgeVisible: badge ? !badge.hidden : false,
      badgeTexte: label ? label.textContent?.trim() : null,
      comptageLocal: {
        lots: Array.isArray(state.lots) ? state.lots.length : 0,
        recipes: Array.isArray(state.recipes) ? state.recipes.length : 0,
        secondaryDlcs: Array.isArray(state.secondaryDlcs) ? state.secondaryDlcs.length : 0,
        witnessSamples: Array.isArray(state.witnessSamples) ? state.witnessSamples.length : 0,
        salesHistory: Array.isArray(state.salesHistory) ? state.salesHistory.length : 0,
        teamMembers: Array.isArray(state.teamMembers) ? state.teamMembers.length : 0,
      },
    };
  });

  verifier(
    'client · session cliente active dans l’app (supabase.hasSession() === true)',
    etatApp.hasSession === true,
  );

  verifier(
    'client · l’app a adopté l’établissement du client',
    etatApp.establishmentId === etabAttendu,
    `étab attendu ${etabAttendu}, actif ${etatApp.establishmentId} (${etatApp.establishmentName || 'sans nom'})`,
  );

  const syncActiveEtNonLocale = etatApp.syncActive === true
    && etatApp.resumeSauvegarde?.texte !== 'Local seulement'
    && etatApp.badgeVisible === true;

  verifier(
    'client · indicateur d’état de sauvegarde serveur actif dans l’en-tête (non local)',
    syncActiveEtNonLocale,
    `badge "${etatApp.badgeTexte || etatApp.resumeSauvegarde?.texte || 'inconnu'}", sync active: ${etatApp.syncActive}`,
  );

  verifier(
    'réseau · 0 requête réseau en échec',
    requetesEchouees.length === 0,
    requetesEchouees.length ? `${requetesEchouees.length} échec(s) : ${requetesEchouees.slice(0, 3).join('; ')}` : '0 échec',
  );

  verifier(
    'console · 0 erreur console',
    erreursConsole.length === 0,
    erreursConsole.length ? `${erreursConsole.length} erreur(s) : ${erreursConsole.slice(0, 3).join('; ')}` : '0 erreur',
  );

  /* 10. Preuve croisée des collections : local ≥ serveur */
  let totalLocal = 0;
  let totalServeur = 0;

  for (const { collection, champ } of COLLECTIONS_REGISTRE) {
    const nbServeur = comptageServeur[collection] || 0;
    const nbLocal = etatApp.comptageLocal[champ] || 0;
    totalServeur += nbServeur;
    totalLocal += nbLocal;

    verifier(
      `collection · ${collection} : données relues du serveur (local ≥ serveur)`,
      nbLocal >= nbServeur,
      `local: ${nbLocal} ≥ serveur: ${nbServeur}`,
    );
  }

  verifier(
    'collection · volume global de données relues conforme (total local ≥ serveur)',
    totalLocal >= totalServeur,
    `total local: ${totalLocal} ≥ total serveur: ${totalServeur}`,
  );

  /* 11. Capture d’écran finale horodatée */
  const dossierCaptures = '/tmp/e2e-sync';
  fs.mkdirSync(dossierCaptures, { recursive: true });
  const cheminCapture = path.join(dossierCaptures, `client-${Date.now()}.png`);
  await page.screenshot({ path: cheminCapture, fullPage: true });

  verifier(
    'preuve visuelle · capture d’écran enregistrée',
    fs.existsSync(cheminCapture),
    cheminCapture,
  );
} finally {
  await navigateur.close();
}

// ─── Synthèse finale ─────────────────────────────────────────────────────────

console.log(`\n${journal.join('\n')}`);
const echecs = journal.filter((l) => l.startsWith('ÉCHEC')).length;
if (process.exitCode || echecs > 0) {
  console.log(`\nÉCHEC — ${echecs}/${journal.length} vérification(s) en échec.`);
} else {
  console.log(`\nPASS — ${journal.length}/${journal.length} vérifications : session cliente réelle adoptée et données relues depuis le serveur.`);
}
