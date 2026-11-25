/**
 * Indicateur d'état de la sauvegarde serveur.
 *
 * Pourquoi ce module : l'app est « local-first ». Les données vivent d'abord
 * dans le navigateur, et la synchronisation vers Supabase peut échouer — ou
 * rester en attente — sans que personne ne le sache. C'est précisément ce qui a
 * fait croire à une cliente qu'elle avait perdu tout son historique.
 *
 * On rend donc l'état VISIBLE en permanence dans l'en-tête, en réutilisant le
 * composant .mark du design system : « Sauvegardé », « Sauvegarde… n »,
 * « Non sauvegardé ». Un clic force une synchronisation et affiche le détail.
 *
 * Ce module n'écrit aucune donnée : il lit `etatSync()` et peint le badge.
 */
import { etatSync, synchroniser } from './sync.js';
import { showToast } from './audio-toast.js';

const ID_BADGE = 'badge-sauvegarde';
const ID_LABEL = 'badge-sauvegarde-label';
const INTERVALLE_MS = 20000;

/** État lisible → modificateur du composant .mark (voir css/components.css). */
const MODIFIANT = { ok: 'ok', attente: 'warn', echec: 'danger', neutre: 'neutral' };

let branche = false;

/** Heure locale courte (« 14:32 »), tolérante aux dates invalides. */
function heure(iso) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

/** Traduit l'état technique de la sync en message lisible pour la pâtissière. */
export function resumerEtat(etat) {
  if (!etat.actif) {
    return {
      cle: 'neutre',
      texte: 'Local seulement',
      titre: "Aucun établissement serveur actif : ces données ne vivent que sur cet appareil.",
    };
  }
  if (!etat.connecte) {
    return {
      cle: 'echec',
      texte: 'Non connecté',
      titre: 'Reconnectez-vous pour envoyer vos données sur le serveur.',
    };
  }
  if (!etat.dernierBilan) {
    return { cle: 'neutre', texte: 'Sauvegarde…', titre: 'Première synchronisation en cours.' };
  }
  if (etat.dernierBilan.ok === false) {
    return {
      cle: 'echec',
      texte: 'Non sauvegardé',
      titre: `La dernière sauvegarde a échoué (${etat.dernierBilan.raison || 'raison inconnue'}).`
        + " Vos données restent sur cet appareil.",
    };
  }
  if (etat.enAttente > 0) {
    return {
      cle: 'attente',
      texte: `Sauvegarde… ${etat.enAttente}`,
      titre: `${etat.enAttente} enregistrement(s) en attente d'envoi.`,
    };
  }
  return {
    cle: 'ok',
    texte: 'Sauvegardé',
    titre: `Toutes vos données sont sur le serveur (dernière sauvegarde à ${heure(etat.dernierBilan.quand)}).`,
  };
}

/** Peint le badge. Sans badge dans le DOM (portail de connexion, tests) : sans effet. */
export function afficherEtatSauvegarde() {
  const badge = document.getElementById(ID_BADGE);
  const label = document.getElementById(ID_LABEL);
  if (!badge || !label) return null;
  const resume = resumerEtat(etatSync());
  badge.className = `mark mark--${MODIFIANT[resume.cle]}`;
  badge.hidden = false;
  label.textContent = resume.texte;
  badge.title = resume.titre;
  return resume;
}

/** Clic sur le badge : synchronisation à la demande, puis explication franche. */
async function surClic() {
  const avant = resumerEtat(etatSync());
  await synchroniser().catch(() => {});
  const apres = afficherEtatSauvegarde();
  const bilan = etatSync().dernierBilan;
  if (apres && apres.cle === 'ok') {
    showToast(`Données sauvegardées sur le serveur (${heure(bilan && bilan.quand)}).`);
  } else {
    showToast(`${apres ? apres.texte : 'Indisponible'} — ${avant.titre}`);
  }
}

/**
 * Branche l'indicateur : peinture immédiate, rafraîchissement périodique, et
 * mise à jour au retour du réseau comme au retour au premier plan.
 * Idempotent : un second appel ne réinstalle rien.
 */
export function brancherEtatSauvegarde() {
  const badge = document.getElementById(ID_BADGE);
  if (!badge) return;
  if (branche) {
    afficherEtatSauvegarde();
    return;
  }
  branche = true;
  badge.addEventListener('click', () => { surClic(); });
  window.addEventListener('online', afficherEtatSauvegarde);
  window.addEventListener('offline', afficherEtatSauvegarde);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') afficherEtatSauvegarde();
  });
  setInterval(afficherEtatSauvegarde, INTERVALLE_MS);
  afficherEtatSauvegarde();
}
