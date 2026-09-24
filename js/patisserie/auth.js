/**
 * TraqHACCP Pâtisserie — Supabase Auth & Multi-Establishment Portal
 */
import { supabase } from '../../src/infrastructure/supabase_client.js';
import { afficherConnexion, masquerConnexion } from '../../src/presentation/connexion.js?v=4.5';
import { modePersistance, definirModePersistance } from '../../src/infrastructure/config.js';
import { state, loadState, saveState, lireEtablissementCourant } from './state.js';
import { showToast, playBeep } from './audio-toast.js';
import { 
  renderLots, 
  renderRecipes, 
  renderSalesCatalog, 
  renderSalesHistory, 
  renderSecondaryDlcs, 
  renderWitnessSamples, 
  renderTeamGrid, 
  updateOperatorUI, 
  updateTopMetrics 
} from './views.js';
import { closeModals } from './modals.js';

export function updateHeaderEstablishment() {
  const el = document.getElementById('header-establishment-name');
  if (el) {
    el.innerText = state.establishmentSub;
  }
}

export async function initAuth() {
  const hash = typeof window !== 'undefined' && window.location ? window.location.hash : '';
  const estRetourAuth = hash.includes('type=recovery') || hash.includes('access_token=') || hash.includes('type=signup') || hash.includes('error_description');

  if (!supabase.hasSession() || estRetourAuth) {
    await afficherPortailConnexion();
    return;
  }

  try {
    await synchroniserEtablissementConnecte();
  } catch (e) {
    console.warn('Erreur synchronisation Supabase :', e);
    const dernier = lireEtablissementCourant();
    if (dernier) {
      loadState(dernier.id, dernier.nom);
      updateHeaderEstablishment();
      rafraichirToutesLesVues();
    } else {
      await afficherPortailConnexion();
    }
  }
}

export async function afficherPortailConnexion() {
  try {
    const res = await afficherConnexion({
      client: supabase,
      repository: {
        creerEtablissement: async (nom) => {
          const id = await supabase.rpc('create_establishment', { p_name: nom });
          return id;
        },
        definirEtablissement: (id) => id
      },
      onErreur: (err) => console.warn('Portail connexion :', err)
    });

    if (res && res.ok) {
      definirModePersistance('serveur');
      await synchroniserEtablissementConnecte();
      showToast(`Connecté avec succès à ${state.establishmentName}`);
    } else {
      // Authentification Supabase requise : maintenir le portail actif
      await afficherPortailConnexion();
    }
  } catch (e) {
    console.error('Erreur ouverture portail :', e);
  }
}

async function synchroniserEtablissementConnecte() {
  let etabId = 'serveur';
  let etabNom = 'Mon Établissement';

  try {
    const membres = await supabase.select('memberships', { colonnes: 'establishment_id,role', limite: 1 });
    if (Array.isArray(membres) && membres[0] && membres[0].establishment_id) {
      etabId = String(membres[0].establishment_id);
      
      const etabs = await supabase.select('establishments', { colonnes: 'id,name', filtres: { id: etabId }, limite: 1 });
      if (Array.isArray(etabs) && etabs[0] && etabs[0].name) {
        etabNom = etabs[0].name;
      }
    }
  } catch (err) {
    console.warn('Impossible de charger les infos établissement Supabase :', err);
  }

  if (etabId === 'serveur') {
    const dernier = lireEtablissementCourant();
    if (dernier && dernier.id) {
      etabId = dernier.id;
      etabNom = dernier.nom || etabNom;
    }
  }

  loadState(etabId, etabNom);

  // Synchroniser l'utilisateur réel connecté pour ne pas afficher un opérateur de démonstration.
  try {
    const utilisateur = supabase.currentUser();
    if (utilisateur && utilisateur.email) {
      const email = utilisateur.email;
      const meta = utilisateur.user_metadata || {};
      const prenom = meta.first_name || meta.firstName || email.split('@')[0];
      const nom = meta.last_name || meta.lastName || '';
      const initiales = `${prenom.charAt(0)}${nom ? nom.charAt(0) : ''}`.toUpperCase() || 'MO';

      const opExistant = state.teamMembers.find(m => m.id === utilisateur.id || m.email === email);
      if (!opExistant) {
        const profilConnecte = {
          id: utilisateur.id || 'usr-connecte',
          firstName: prenom,
          lastName: nom,
          initials: initiales,
          role: 'Responsable',
          email: email,
          pin: '',
          active: true,
          joinedDate: new Date().toISOString().split('T')[0]
        };
        // Remplacer la brigade par défaut de démo par l'utilisateur connecté
        state.teamMembers = [profilConnecte];
        state.currentOperatorId = profilConnecte.id;
        saveState();
      } else {
        state.currentOperatorId = opExistant.id;
      }
    }
  } catch (e) {
    console.warn('Erreur synchronisation utilisateur connecté :', e);
  }

  updateHeaderEstablishment();
  rafraichirToutesLesVues();
}

export async function deconnecterEtablissement() {
  playBeep(450, 0.08);
  try {
    await supabase.signOut();
  } catch {
    // Ignorer si déjà déconnecté
  }
  supabase.effacerSession();
  closeModals();
  showToast("Vous avez été déconnecté.");
  
  // Rouvrir immédiatement le portail de connexion Supabase
  setTimeout(() => {
    afficherPortailConnexion();
  }, 400);
}

function rafraichirToutesLesVues() {
  renderLots();
  renderRecipes();
  renderSalesCatalog();
  renderSalesHistory();
  renderSecondaryDlcs();
  renderWitnessSamples();
  renderTeamGrid();
  updateOperatorUI();
  updateTopMetrics();
}
