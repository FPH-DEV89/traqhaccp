/**
 * check-sync-contract.mjs — contrat de la synchronisation du registre.
 *
 * POURQUOI CE GATE
 * La synchronisation relie quatre sources de vérité qui peuvent diverger
 * silencieusement :
 *   · `supabase/migrations/0004_registre_sync.sql` — la table, son RLS, ses droits ;
 *   · `js/patisserie/sync.js`                     — les collections réellement envoyées ;
 *   · `js/patisserie/state.js`                    — le modèle de l'application ;
 *   · `js/patisserie/auth.js` + `sw.js`           — le branchement et le précache.
 *
 * Les pannes redoutées, toutes silencieuses :
 *   · une collection renommée côté client mais pas côté serveur → les écritures
 *     sont rejetées par le RLS et l'utilisateur croit avoir sauvegardé ;
 *   · un champ retiré de `state` mais gardé dans `COLLECTIONS` → la fusion
 *     écrit dans une propriété fantôme, les données disparaissent à l'écran ;
 *   · `sync.js` précaché manquant → hors-ligne cassé (panne du 23/09/2026) ;
 *   · `brancherSauvegarde` oublié → plus rien n'est jamais envoyé, sans erreur.
 *
 * CODES DE SORTIE
 *   0 = contrat respecté
 *   1 = violation du contrat (divergence détectée)
 *   2 = gate inutilisable (fichier source illisible) — jamais confondu avec 1
 */
import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = { root: null };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--root') opt.root = argv[++i];
  else { console.error(`option inconnue: ${argv[i]}`); process.exit(2); }
}

const racine = opt.root || process.cwd();
const chemins = {
  migration: `${racine}/supabase/migrations/0004_registre_sync.sql`,
  sync: `${racine}/js/patisserie/sync.js`,
  state: `${racine}/js/patisserie/state.js`,
  auth: `${racine}/js/patisserie/auth.js`,
  sw: `${racine}/sw.js`,
};

// --- 0. lisibilité des sources (exit 2 : le gate n'a pas pu tourner) ---------
const sources = {};
for (const [cle, chemin] of Object.entries(chemins)) {
  if (!existsSync(chemin)) {
    console.error(`ERREUR D'INFRASTRUCTURE — ${chemin} introuvable (exit 2 : le gate n'a pas pu tourner).`);
    process.exit(2);
  }
  sources[cle] = readFileSync(chemin, 'utf8');
}

const violations = [];
const noter = (code, message) => violations.push({ code, message });

// --- 1. socle serveur : table, clé, RLS, politiques, droits ------------------
const sql = sources.migration;
if (!/create\s+table\s+(if\s+not\s+exists\s+)?public\.registry_records/i.test(sql)) {
  noter('TABLE', 'migration 0004 : `public.registry_records` non déclarée');
}
if (!/primary\s+key\s*\(\s*establishment_id\s*,\s*collection\s*,\s*record_id\s*\)/i.test(sql)) {
  noter('CLE', 'migration 0004 : clé primaire (establishment_id, collection, record_id) absente ou modifiée');
}
if (!/alter\s+table\s+public\.registry_records\s+enable\s+row\s+level\s+security/i.test(sql)) {
  noter('RLS', 'migration 0004 : RLS non activée — la table serait ouverte à tous les comptes');
}
for (const politique of ['p_read', 'p_insert', 'p_update', 'p_delete']) {
  if (!new RegExp(`create\\s+policy\\s+${politique}\\b`, 'i').test(sql)) {
    noter('POLITIQUE', `migration 0004 : politique ${politique} absente`);
  }
}
if (!/grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+public\.registry_records\s+to\s+authenticated/i.test(sql)) {
  noter('DROITS', 'migration 0004 : `grant … to authenticated` absent — la table créée après 0001 hérite de rien, toute écriture échouerait');
}

// --- 2. surface publique de sync.js ------------------------------------------
const attendus = [
  'syncActive', 'detecterChangements', 'viderFile', 'planifierEnvoi',
  'recevoirRegistre', 'synchroniser', 'etatSync', 'demarrerSync',
];
for (const nom of attendus) {
  if (!new RegExp(`export\\s+(async\\s+)?function\\s+${nom}\\b`).test(sources.sync)) {
    noter('EXPORT', `sync.js : export manquant — ${nom}() (appelé par auth.js ou les réglages)`);
  }
}

// --- 3. anti-dérive du modèle : COLLECTIONS ↦ champs réels de `state` --------
const blocCollections = sources.sync.match(/const\s+COLLECTIONS\s*=\s*\[([\s\S]*?)\n\];/);
if (!blocCollections) {
  noter('COLLECTIONS', 'sync.js : bloc COLLECTIONS introuvable — impossible de vérifier le modèle');
} else {
  const entrees = [...blocCollections[1].matchAll(/\{\s*collection:\s*'([^']+)'\s*,\s*champ:\s*(null|'([^']+)')\s*\}/g)]
    .map((m) => ({ collection: m[1], champ: m[2] === 'null' ? null : m[3] }));
  if (!entrees.length) {
    noter('COLLECTIONS', 'sync.js : COLLECTIONS est vide — plus rien ne serait synchronisé');
  }
  const blocEtat = sources.state.match(/export\s+const\s+state\s*=\s*\{([\s\S]*?)\n\};/);
  if (!blocEtat) {
    noter('MODELE', 'state.js : objet `state` initial introuvable — contrat invérifiable');
  } else {
    const champs = new Set(
      [...blocEtat[1].matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map((m) => m[1]),
    );
    for (const { collection, champ } of entrees) {
      if (champ && !champs.has(champ)) {
        noter('CHAMP_FANTOME',
          `sync.js : collection « ${collection} » mappée sur state.${champ}, absent du modèle — les données seraient écrites dans le vide`);
      }
    }
  }
}

// --- 4. chaîne de déclenchement ----------------------------------------------
if (!/export\s+function\s+brancherSauvegarde\b/.test(sources.state)) {
  noter('DECLENCHEUR', 'state.js : brancherSauvegarde() non exporté — sync.js ne peut pas se brancher');
}
const saveState = sources.state.match(/export\s+function\s+saveState\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
if (!saveState) {
  noter('SAUVEGARDE', 'state.js : saveState() introuvable');
} else if (!/notifierSauvegarde\s*\(\s*\)/.test(saveState[1])) {
  // On exige l'APPEL, pas la simple mention du nom : le garde
  // `if (notifierSauvegarde)` suffirait à faire passer un contrôle laxiste
  // alors que la synchronisation ne serait plus jamais déclenchée.
  noter('SAUVEGARDE', 'state.js : saveState() n\'appelle plus notifierSauvegarde() — les écritures locales partiraient sans être synchronisées');
}
if (!/brancherSauvegarde\s*\(\s*planifierEnvoi\s*\)/.test(sources.sync)) {
  noter('BRANCHEMENT', 'sync.js : brancherSauvegarde(planifierEnvoi) absent — le déclencheur n\'est jamais branché');
}

// --- 5. auth.js : adopter le serveur AVANT de toucher à la brigade -----------
if (!/await\s+synchroniser\s*\(\s*\)/.test(sources.auth)) {
  noter('AUTH', 'auth.js : `await synchroniser()` absent — le registre du serveur n\'est jamais adopté');
} else {
  const iSync = sources.auth.search(/await\s+synchroniser\s*\(\s*\)/);
  const iBrigade = sources.auth.search(/state\.teamMembers\s*=\s*\[/);
  if (iBrigade !== -1 && iBrigade < iSync) {
    noter('ORDRE', 'auth.js : la brigade est réécrite AVANT l\'adoption du serveur — les membres distants seraient écrasés');
  }
}
if (/state\.teamMembers\s*=\s*\[profilConnecte\]/.test(sources.auth)) {
  noter('BRIGADE', 'auth.js : la brigade est de nouveau REMPLACÉE par le seul utilisateur connecté — chaque connexion effacerait la brigade des autres appareils');
}
if (!/demarrerSync\s*\(\s*\)/.test(sources.auth)) {
  noter('AUTH', 'auth.js : demarrerSync() absent — la file d\'attente ne serait jamais rejouée au retour du réseau');
}

// --- 6. hors-ligne : le module doit être précaché ----------------------------
if (!/['"]\.\/js\/patisserie\/sync\.js['"]/.test(sources.sw)) {
  noter('PRECACHE', 'sw.js : ./js/patisserie/sync.js absent du précache — import cassé au premier démarrage hors-ligne (panne du 23/09/2026)');
}

// --- 7. vidage réel : viderFile() doit d'abord vider le minuteur ------------
// Le déclencheur est différé (DELAI_ENVOI) : entre l'écriture locale et l'envoi,
// la file est encore VIDE — la modification n'existe que dans l'état local.
// Une fonction de vidage qui lit la file sans déclencher la détection rend donc
// la main en laissant la donnée sur l'appareil, et l'appelant croit que tout est
// parti. C'est la panne que ce gate interdit.
const blocVidage = sources.sync.match(/export\s+async\s+function\s+viderFile\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
if (!blocVidage) {
  noter('VIDAGE', 'sync.js : viderFile() introuvable — le vidage de la file n\'est pas vérifiable');
} else {
  const corps = blocVidage[1];
  const iDetection = corps.search(/detecterChangements\s*\(\s*\)/);
  const iLecture = corps.search(/lireFile\s*\(\s*\)/);
  if (iDetection === -1) {
    noter('VIDAGE', 'sync.js : viderFile() ne détecte plus les modifications en attente avant de vider — l\'envoi différé serait laissé à son minuteur, donc perdu si l\'app se ferme avant');
  } else if (iLecture !== -1 && iLecture < iDetection) {
    noter('ORDRE_VIDAGE', 'sync.js : viderFile() lit la file AVANT de détecter les modifications — le vidage raterait systématiquement l\'envoi en attente de son minuteur');
  }
  if (!/clearTimeout\s*\(\s*minuteur\s*\)/.test(corps)) {
    noter('MINUTEUR', 'sync.js : viderFile() ne neutralise plus le minuteur d\'envoi différé — l\'envoi serait rejoué deux fois');
  }
}

// --- 8. verdict --------------------------------------------------------------
if (!violations.length) {
  console.log('check-sync-contract: OK — table, RLS, droits, exports, modèle, déclencheur, ordre d\'adoption et précache concordent.');
  process.exit(0);
}

console.log(`check-sync-contract: ${violations.length} violation(s) de contrat.\n`);
for (const { code, message } of violations) {
  console.log(`❌ ${code} — ${message}`);
}
console.log('\nFAIL — la synchronisation diverge du code livré.');
process.exit(1);
