/**
 * TraqHACCP Pâtisserie — Main Application Entry Point
 */
import { playBeep, showToast } from './audio-toast.js';
import { 
  state, 
  saveState, 
  loadState, 
  getCurrentOperator, 
  setCurrentOperator 
} from './state.js';
import { calculateRecipeMetrics, formatDateFr } from './calculations.js';
import { demarrerAlertes } from './notifications.js';
import { 
  renderLots, 
  renderRecipes, 
  renderSalesCatalog, 
  renderSalesHistory, 
  renderSecondaryDlcs, 
  renderWitnessSamples, 
  renderTeamGrid, 
  renderOperatorSwitchList, 
  updateOperatorUI, 
  updateTopMetrics, 
  switchView,
  renderAudit,
  renderRecallOptions
} from './views.js';
import { 
  closeModals, 
  openScanModal, 
  openNewEntryModal, 
  openNewRecipeModal, 
  openWitnessSampleModal, 
  openInspectionModal, 
  openNewSecondaryDlcModal, 
  openOperatorModal, 
  openAddUserModal, 
  openCustomSaleModal, 
  createSecondaryFromLot, 
  adjustSecondaryDelay, 
  setCategoryFilter, 
  toggleAlertsOnly, 
  handleSwitchOperator, 
  openAdjustStockModal, 
  saveAdjustedStock, 
  executeAutomatedScan, 
  handleFileUpload, 
  handleTraceFormSubmit, 
  handleRecipeFormSubmit, 
  addRecipeIngredientRow, 
  removeRecipeIngredientRow,
  autoFillIngName, 
  startSaleWorkflow, 
  adjustDestockMultiplier, 
  renderDestockIngredientsList, 
  toggleCustomerTypeInputs, 
  confirmStockDepletion, 
  handleSecondaryDlcSubmit, 
  handleWitnessFormSubmit, 
  handleAddUserSubmit 
} from './modals.js';
import { 
  testRecallSearch, 
  copyCustomerPhonesForAlert, 
  downloadSanitaryReport 
} from './recall.js';
import { 
  initAuth, 
  afficherPortailConnexion, 
  deconnecterEtablissement 
} from './auth.js';

export function toggleDarkMode() {
  const html = document.documentElement;
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    localStorage.theme = 'light';
  } else {
    html.classList.add('dark');
    localStorage.theme = 'dark';
  }
}

// Bind all necessary functions to window for DOM event handlers
window.playBeep = playBeep;
window.showToast = showToast;
window.switchView = switchView;
window.closeModals = closeModals;
window.openScanModal = openScanModal;
window.openNewEntryModal = openNewEntryModal;
window.openNewRecipeModal = openNewRecipeModal;
window.openWitnessSampleModal = openWitnessSampleModal;
window.openInspectionModal = openInspectionModal;
window.openNewSecondaryDlcModal = openNewSecondaryDlcModal;
window.openOperatorModal = openOperatorModal;
window.openAddUserModal = openAddUserModal;
window.openCustomSaleModal = openCustomSaleModal;
window.createSecondaryFromLot = createSecondaryFromLot;
window.adjustSecondaryDelay = adjustSecondaryDelay;
window.setCategoryFilter = setCategoryFilter;
window.toggleAlertsOnly = toggleAlertsOnly;
window.setCurrentOperator = handleSwitchOperator;
window.handleSwitchOperator = handleSwitchOperator;
window.openAdjustStockModal = openAdjustStockModal;
window.saveAdjustedStock = saveAdjustedStock;
window.executeAutomatedScan = executeAutomatedScan;
window.handleFileUpload = handleFileUpload;
window.handleTraceFormSubmit = handleTraceFormSubmit;
window.handleRecipeFormSubmit = handleRecipeFormSubmit;
window.addRecipeIngredientRow = addRecipeIngredientRow;
window.removeRecipeIngredientRow = removeRecipeIngredientRow;
window.autoFillIngName = autoFillIngName;
window.startSaleWorkflow = startSaleWorkflow;
window.adjustDestockMultiplier = adjustDestockMultiplier;
window.renderDestockIngredientsList = renderDestockIngredientsList;
window.toggleCustomerTypeInputs = toggleCustomerTypeInputs;
window.confirmStockDepletion = confirmStockDepletion;
window.handleSecondaryDlcSubmit = handleSecondaryDlcSubmit;
window.handleWitnessFormSubmit = handleWitnessFormSubmit;
window.handleAddUserSubmit = handleAddUserSubmit;
window.testRecallSearch = testRecallSearch;
window.copyCustomerPhonesForAlert = copyCustomerPhonesForAlert;
window.downloadSanitaryReport = downloadSanitaryReport;
window.toggleDarkMode = toggleDarkMode;
window.afficherPortailConnexion = afficherPortailConnexion;
window.deconnecterEtablissement = deconnecterEtablissement;

// Initialisation au chargement de la page
window.addEventListener('DOMContentLoaded', async () => {
  // Thème
  if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  try {
    // Auth Supabase & multi-établissement
    await initAuth();

    // Premier rendu
    renderLots();
    renderRecipes();
    renderSalesCatalog();
    renderSalesHistory();
    renderSecondaryDlcs();
    renderWitnessSamples();
    renderTeamGrid();
    renderAudit();
    renderRecallOptions();
    updateOperatorUI();
    updateTopMetrics();

    // Alertes de service : résumé à l'ouverture, puis surveillance périodique
    demarrerAlertes();
  } finally {
    document.documentElement.dataset.boot = 'ready';
  }
});

// PWA Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }).catch((e) => console.warn('[SW] enregistrement impossible :', e.message));
  let rechargement = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!rechargement) {
      rechargement = true;
      window.location.reload();
    }
  });
}
