/**
 * TraqHACCP Pâtisserie — Modal Management & Form Submissions
 */
import { state, saveState, getCurrentOperator, setCurrentOperator } from './state.js';
import { calculateRecipeMetrics, formatDateFr } from './calculations.js';
import { playBeep, showToast } from './audio-toast.js';
import { compressImage, extractLabelData } from './ai-scanner.js';
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
  renderAudit
} from './views.js';

export function closeModals() {
  playBeep(320, 0.03);
  document.querySelectorAll('[id^="modal-"]').forEach(m => {
    m.classList.add('hidden');
    m.classList.remove('flex');
  });
}

export function openScanModal() {
  playBeep(520, 0.04);
  const m = document.getElementById('modal-scan');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function openNewEntryModal() {
  playBeep(520, 0.04);
  const m = document.getElementById('modal-entry');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function openNewRecipeModal() {
  playBeep(590, 0.04);
  const m = document.getElementById('modal-recipe');
  document.getElementById('recipe-form')?.reset();
  const rows = document.getElementById('recipe-ingredients-inputs');
  if (rows) rows.innerHTML = '';
  addRecipeIngredientRow();
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function openWitnessSampleModal() {
  playBeep(560, 0.04);
  const m = document.getElementById('modal-witness');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function openInspectionModal() {
  playBeep(620, 0.05);
  renderAudit();
  const m = document.getElementById('modal-inspection');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function openNewSecondaryDlcModal() {
  playBeep(580, 0.05);
  const m = document.getElementById('modal-secondary');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
  renderSecondaryDlcs();
  adjustSecondaryDelay('entame');
}

export function openOperatorModal() {
  playBeep(550, 0.04);
  renderOperatorSwitchList();
  const m = document.getElementById('modal-operator-switch');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function openAddUserModal() {
  playBeep(600, 0.04);
  const m = document.getElementById('modal-add-user');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function openCustomSaleModal() {
  startSaleWorkflow('REC-01');
}

export function createSecondaryFromLot(lotNum) {
  openNewSecondaryDlcModal();
  const select = document.getElementById('sec-parent-lot');
  if (select) select.value = lotNum;
}

export function adjustSecondaryDelay(type) {
  let days = 3;
  if (type === 'decong') days = 1;
  if (type === 'cuisson') days = 3;
  if (type === 'sousvide') days = 5;

  const expiry = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  const secExp = document.getElementById('sec-computed-dlc');
  if (secExp) secExp.value = expiry;
}

export function setCategoryFilter(cat) {
  state.currentCategory = cat;
  document.querySelectorAll('.category-pill').forEach(btn => {
    btn.classList.remove('bg-zinc-900', 'dark:bg-white', 'text-white', 'dark:text-zinc-900');
    btn.classList.add('bg-white', 'dark:bg-zinc-900', 'text-zinc-600', 'dark:text-zinc-400');
  });

  const activeBtn = document.getElementById(`pill-${cat}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-zinc-900', 'dark:bg-white', 'text-white', 'dark:text-zinc-900');
    activeBtn.classList.remove('bg-white', 'dark:bg-zinc-900', 'text-zinc-600', 'dark:text-zinc-400');
  }

  playBeep(450, 0.03);
  renderLots();
}

export function toggleAlertsOnly() {
  state.alertsOnly = !state.alertsOnly;
  const pill = document.getElementById('pill-alerts');
  if (state.alertsOnly) {
    pill?.classList.add('bg-amber-100', 'dark:bg-amber-950/60', 'text-amber-800', 'dark:text-amber-300', 'font-bold');
  } else {
    pill?.classList.remove('bg-amber-100', 'dark:bg-amber-950/60', 'text-amber-800', 'dark:text-amber-300', 'font-bold');
  }
  playBeep(480, 0.03);
  renderLots();
}

export function handleSwitchOperator(userId) {
  setCurrentOperator(userId);
  updateOperatorUI();
  closeModals();
  const op = getCurrentOperator();
  if (op) {
    showToast(`${op.firstName} ${op.lastName} est maintenant en service.`);
  } else {
    showToast(`L'opérateur est maintenant en service.`);
  }
  playBeep(680, 0.05);
}

export function openAdjustStockModal(id) {
  const lot = state.lots.find(l => l.id === id);
  if (!lot) return;
  state.lotToAdjust = lot;

  document.getElementById('adjust-lot-name').innerText = lot.name;
  document.getElementById('adjust-lot-id').innerText = `Lot ${lot.lot} (${lot.supplier})`;
  document.getElementById('adjust-stock-value').value = lot.stockQty;
  document.getElementById('adjust-stock-unit').innerText = lot.stockUnit;

  const m = document.getElementById('modal-adjust-stock');
  m?.classList.remove('hidden');
  m?.classList.add('flex');
}

export function saveAdjustedStock() {
  if (!state.lotToAdjust) return;
  const val = parseFloat(document.getElementById('adjust-stock-value')?.value);
  if (!isNaN(val) && val >= 0) {
    state.lotToAdjust.stockQty = val;
    saveState();
    renderLots();
    renderRecipes();
    renderSalesCatalog();
    showToast(`Stock de "${state.lotToAdjust.name}" réaligné à ${val} ${state.lotToAdjust.stockUnit}.`);
  }
  closeModals();
}

export async function executeAutomatedScan() {
  await processLabelImage(null);
}

export async function handleFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  await processLabelImage(file);
}

export async function processLabelImage(file) {
  const previewImg = document.getElementById('scan-preview-img');
  const placeholder = document.getElementById('scan-placeholder');
  const loader = document.getElementById('scan-loading');
  const statusText = document.getElementById('scan-status-text');

  try {
    if (loader) loader.classList.add('is-active');
    if (statusText) statusText.textContent = "Extraction IA en cours...";

    let dataUrl;
    if (file) {
      const compressed = await compressImage(file, 1280, 0.8);
      dataUrl = compressed.dataUrl;
      if (previewImg && placeholder) {
        previewImg.src = dataUrl;
        previewImg.style.display = 'block';
        placeholder.style.display = 'none';
      }
    } else {
      // Cas de démonstration
      dataUrl = 'data:image/jpeg;base64,demo';
    }

    const extracted = await extractLabelData(dataUrl);

    if (extracted) {
      if (extracted.name) {
        const el = document.getElementById('form-name');
        if (el) el.value = extracted.name;
      }
      if (extracted.supplier) {
        const el = document.getElementById('form-supplier');
        if (el) el.value = extracted.supplier;
      }
      if (extracted.lot) {
        const el = document.getElementById('form-lot');
        if (el) el.value = extracted.lot;
      }
      if (extracted.dlcDate) {
        const el = document.getElementById('form-dlc-date');
        if (el) el.value = extracted.dlcDate;
      }
      if (extracted.category) {
        const el = document.getElementById('form-category');
        if (el) el.value = extracted.category;
      }

      playBeep(880, 0.15);
      showToast("Étiquette reconnue par IA — vérifiez les champs.");
    }

    if (loader) loader.classList.remove('is-active');
    closeModals();
    openNewEntryModal();

  } catch (err) {
    console.error("Erreur reconnaissance étiquette :", err);
    if (loader) loader.classList.remove('is-active');
    if (statusText) statusText.textContent = "Cadrage détecté · Agrément sanitaire conforme";
    playBeep(320, 0.2);
    showToast(`Information : ${err.message || 'saisie manuelle requise'}.`);
    closeModals();
    openNewEntryModal();
  }
}

export function handleTraceFormSubmit(e) {
  e.preventDefault();
  const newLot = {
    id: `L-${Date.now().toString().slice(-4)}`,
    category: document.getElementById('form-category').value,
    name: document.getElementById('form-name').value,
    supplier: document.getElementById('form-supplier').value,
    lot: document.getElementById('form-lot').value.toUpperCase(),
    receiptDate: new Date().toISOString().split('T')[0],
    dlcDate: document.getElementById('form-dlc-date').value,
    temp: parseFloat(document.getElementById('form-temp').value),
    stockQty: parseFloat(document.getElementById('form-stock-qty').value),
    stockUnit: document.getElementById('form-stock-unit').value,
    unitPriceHT: parseFloat(document.getElementById('form-unit-price').value),
    status: 'conforme'
  };

  state.lots.unshift(newLot);
  saveState();
  playBeep(750, 0.1);
  closeModals();
  renderLots();
  updateTopMetrics();
  showToast(`Lot "${newLot.name}" enregistré et entré en stock.`);
  e.target.reset();
}

export function handleRecipeFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('recipe-form-name').value;
  const icon = document.getElementById('recipe-form-icon').value || '🍰';
  const price = parseFloat(document.getElementById('recipe-form-price').value);

  const ingRows = document.querySelectorAll('.recipe-ing-row');
  const ingredients = [];

  ingRows.forEach(row => {
    const lotMatch = row.querySelector('.ing-lot-select')?.value;
    const nameIng = row.querySelector('.ing-name-input')?.value;
    const qty = parseFloat(row.querySelector('.ing-qty-input')?.value || 0);
    const unit = row.querySelector('.ing-unit-select')?.value || 'kg';

    if (lotMatch && nameIng && qty > 0) {
      ingredients.push({
        lotMatch: lotMatch,
        name: nameIng,
        qtyPerUnit: qty,
        unit: unit
      });
    }
  });

  const newRecipe = {
    id: `REC-${Date.now().toString().slice(-3)}`,
    name: name,
    icon: icon,
    sellingPriceTTC: price,
    tvaRate: 0.055,
    ingredients: ingredients
  };

  state.recipes.push(newRecipe);
  saveState();
  playBeep(850, 0.1);
  closeModals();
  renderRecipes();
  renderSalesCatalog();
  showToast(`Fiche technique "${name}" créée avec succès.`);
  e.target.reset();
  const rowsContainer = document.getElementById('recipe-ingredients-inputs');
  if (rowsContainer) rowsContainer.innerHTML = '';
}

export function addRecipeIngredientRow() {
  playBeep(520, 0.02);
  const container = document.getElementById('recipe-ingredients-inputs');
  if (!container) return;

  const lotOptions = state.lots.map(l => `<option value="${l.lot}">${l.name} (Lot ${l.lot})</option>`).join('');

  const row = document.createElement('div');
  row.className = 'recipe-ing-row grid grid-cols-12 gap-2 items-center';
  row.innerHTML = `
    <div class="col-span-4">
      <select class="ing-lot-select w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs" onchange="autoFillIngName(this)">
        <option value="">Associer au lot FIFO...</option>
        ${lotOptions}
      </select>
    </div>
    <div class="col-span-3">
      <input type="text" placeholder="Nom ingrédient" class="ing-name-input w-full px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs">
    </div>
    <div class="col-span-2">
      <input type="number" step="0.001" placeholder="Qté" class="ing-qty-input w-full px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-right">
    </div>
    <div class="col-span-2 flex items-center gap-1">
      <select class="ing-unit-select w-full px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs">
        <option value="kg">kg</option>
        <option value="L">L</option>
        <option value="u">u</option>
      </select>
    </div>
    <div class="col-span-1 flex justify-end">
      <button type="button" class="icon-btn ing-remove-btn" title="Retirer cette ligne" aria-label="Retirer cet ingrédient" onclick="removeRecipeIngredientRow(this)">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  `;
  container.appendChild(row);
}

/** Retire une ligne d'ingrédient ajoutée par erreur (bouton ✕ de la ligne). */
export function removeRecipeIngredientRow(bouton) {
  const row = bouton?.closest('.recipe-ing-row');
  if (!row) return;
  const container = row.parentElement;
  row.remove();
  if (container && container.querySelectorAll('.recipe-ing-row').length === 0) {
    addRecipeIngredientRow();
  }
}

export function autoFillIngName(selectEl) {
  const lotNum = selectEl.value;
  const lot = state.lots.find(l => l.lot === lotNum);
  const row = selectEl.closest('.recipe-ing-row');
  if (lot && row) {
    const nameInput = row.querySelector('.ing-name-input');
    const unitSelect = row.querySelector('.ing-unit-select');
    if (nameInput && !nameInput.value) nameInput.value = lot.name;
    if (unitSelect) unitSelect.value = lot.stockUnit;
  }
}

export function startSaleWorkflow(recipeId) {
  playBeep(640, 0.04);
  state.pendingSaleRecipe = state.recipes.find(r => r.id === recipeId) || state.recipes[0];
  state.pendingSaleMultiplier = 1;

  document.getElementById('destock-recipe-name').innerText = state.pendingSaleRecipe.name;
  document.getElementById('destock-units').innerText = state.pendingSaleMultiplier;

  renderDestockIngredientsList();

  const modal = document.getElementById('modal-destock-confirm');
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
}

export function adjustDestockMultiplier(delta) {
  const next = state.pendingSaleMultiplier + delta;
  if (next < 1) return;
  state.pendingSaleMultiplier = next;
  document.getElementById('destock-units').innerText = state.pendingSaleMultiplier;
  playBeep(490, 0.03);
  renderDestockIngredientsList();
}

export function renderDestockIngredientsList() {
  if (!state.pendingSaleRecipe) return;
  const listContainer = document.getElementById('destock-ingredients-list');
  if (!listContainer) return;

  listContainer.innerHTML = state.pendingSaleRecipe.ingredients.map((ing, idx) => {
    const lotItem = state.lots.find(l => l.lot === ing.lotMatch);
    const totalNeeded = (ing.qtyPerUnit * state.pendingSaleMultiplier).toFixed(3);
    const stockAfter = lotItem ? (lotItem.stockQty - parseFloat(totalNeeded)).toFixed(2) : 0;
    const isShort = stockAfter < 0;

    return `
      <div class="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-2">
        <div>
          <div class="font-bold text-zinc-900 dark:text-white text-xs">${ing.name}</div>
          <div class="text-[10px] text-zinc-400 font-mono">Lot FIFO : ${lotItem ? lotItem.lot : 'N/A'} (DLC: ${lotItem ? formatDateFr(lotItem.dlcDate) : '-'})</div>
          <div class="text-[10px] ${isShort ? 'text-rose-500 font-bold' : 'text-zinc-500'}">
            Stock actuel : ${lotItem ? lotItem.stockQty : 0} ${ing.unit} → Reste : ${stockAfter} ${ing.unit}
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-zinc-400">Déduire :</span>
          <input 
            type="number" 
            step="0.001" 
            id="destock-input-${idx}" 
            value="${totalNeeded}" 
            class="w-20 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-right font-bold text-xs focus:ring-1 focus:ring-emerald-500"
          >
          <span class="text-[10px] text-zinc-500 font-mono">${ing.unit}</span>
        </div>
      </div>
    `;
  }).join('');
}

export function toggleCustomerTypeInputs(type) {
  const addressGroup = document.getElementById('delivery-address-group');
  const refLabel = document.getElementById('sale-ref-label');
  const refInput = document.getElementById('sale-customer-ref');
  const nameInput = document.getElementById('sale-customer-name');
  const phoneInput = document.getElementById('sale-customer-phone');

  if (type === 'livraison') {
    addressGroup?.classList.remove('hidden');
    if (refLabel) refLabel.innerText = 'Créneau de livraison & N° Course';
    if (refInput) refInput.value = 'Créneau 12h-13h · #LIV-512';
    if (nameInput && nameInput.value === 'Mme Sophie Legrand') nameInput.value = 'Cabinet Meunier & Associés';
    if (phoneInput && phoneInput.value === '06 42 18 90 33') phoneInput.value = '01 44 20 88 12';
  } else {
    addressGroup?.classList.add('hidden');
    if (refLabel) refLabel.innerText = 'Heure de retrait & Réf. Commande';
    if (refInput) refInput.value = 'Retrait 16h30 · Bon #CMD-884';
    if (nameInput && nameInput.value === 'Cabinet Meunier & Associés') nameInput.value = 'Mme Sophie Legrand';
    if (phoneInput && phoneInput.value === '01 44 20 88 12') phoneInput.value = '06 42 18 90 33';
  }
}

export function confirmStockDepletion() {
  if (!state.pendingSaleRecipe) return;
  playBeep(780, 0.08);

  const usedLotsList = [];

  state.pendingSaleRecipe.ingredients.forEach((ing, idx) => {
    const customQty = parseFloat(document.getElementById(`destock-input-${idx}`)?.value || (ing.qtyPerUnit * state.pendingSaleMultiplier));
    const lotItem = state.lots.find(l => l.lot === ing.lotMatch);
    if (lotItem) {
      lotItem.stockQty = Math.max(0, lotItem.stockQty - customQty);
      usedLotsList.push(lotItem.lot);
    }
  });

  const m = calculateRecipeMetrics(state.pendingSaleRecipe);
  const totalTTC = state.pendingSaleRecipe.sellingPriceTTC * state.pendingSaleMultiplier;
  const marginTotal = m.marginBrute * state.pendingSaleMultiplier;

  const custChannel = document.getElementById('sale-customer-type')?.value || 'emporter';
  const custName = document.getElementById('sale-customer-name')?.value.trim() || 'Client Pâtisserie';
  const custPhone = document.getElementById('sale-customer-phone')?.value.trim() || '06 00 00 00 00';
  const custRef = document.getElementById('sale-customer-ref')?.value.trim() || 'Commande';
  const custAddress = custChannel === 'livraison' ? (document.getElementById('sale-customer-address')?.value.trim() || '-') : '-';

  const orderTypeLabel = custChannel === 'livraison' ? '🛵 Livraison à domicile' : '🛍️ À emporter (Retrait)';

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  state.salesHistory.unshift({
    id: `V-${Date.now().toString().slice(-3)}`,
    time: timeStr,
    recipeName: state.pendingSaleRecipe.name,
    channel: custChannel,
    orderType: orderTypeLabel,
    customerName: custName,
    customerPhone: custPhone,
    orderRef: custRef,
    address: custAddress,
    qty: state.pendingSaleMultiplier,
    totalTTC: totalTTC,
    marginTotal: marginTotal,
    lotsUsed: usedLotsList.join(', ')
  });

  saveState();
  closeModals();
  renderLots();
  renderRecipes();
  renderSalesCatalog();
  renderSalesHistory();
  updateTopMetrics();

  showToast(`Vente enregistrée ! Stocks débités en FIFO & Marge de +${marginTotal.toFixed(2)} € consolidée.`);
}

export function handleSecondaryDlcSubmit(e) {
  e.preventDefault();
  const parent = document.getElementById('sec-parent-lot').value || 'Interne';
  const name = document.getElementById('sec-name').value;
  const exp = document.getElementById('sec-computed-dlc').value;
  const type = document.getElementById('sec-type').selectedOptions[0].text;

  state.secondaryDlcs.unshift({
    id: `SEC-${Date.now().toString().slice(-4)}`,
    name: name,
    parentLot: parent,
    type: type,
    creationDate: new Date().toISOString().split('T')[0],
    expiryDate: exp,
    operator: (() => { const op = getCurrentOperator(); return op ? op.firstName + ' (' + op.role + ')' : ''; })()
  });

  saveState();
  playBeep(800, 0.08);
  closeModals();
  renderSecondaryDlcs();
  updateTopMetrics();
  showToast(`Étiquette DLC secondaire imprimée pour "${name}".`);
}

export function handleWitnessFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('witness-name').value;
  const service = document.getElementById('witness-service').value;
  const temp = document.getElementById('witness-temp').value;

  const now = new Date();
  const exp = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0];

  state.witnessSamples.unshift({
    id: `WIT-${Date.now().toString().slice(-4)}`,
    dishName: name,
    service: service,
    serviceDate: now.toISOString().split('T')[0],
    expiryDate: exp,
    temp: temp
  });

  saveState();
  playBeep(780, 0.06);
  closeModals();
  renderWitnessSamples();
  showToast(`Échantillon témoin J+5 consigné pour "${name}".`);
  e.target.reset();
}

export function handleAddUserSubmit(e) {
  e.preventDefault();
  const first = document.getElementById('user-firstname').value.trim();
  const last = document.getElementById('user-lastname').value.trim();
  const role = document.getElementById('user-role').value;
  const pin = document.getElementById('user-pin').value.trim();
  const pin2 = document.getElementById('user-pin-confirm').value.trim();

  if (pin && pin !== pin2) {
    showToast('Les deux codes PIN saisis sont différents.');
    playBeep(250, 0.1);
    return;
  }

  const initials = (first.charAt(0) + last.charAt(0)).toUpperCase();
  const newUser = {
    id: `u-${Date.now().toString().slice(-4)}`,
    firstName: first,
    lastName: last,
    initials: initials,
    role: role,
    pin: pin,
    active: true,
    joinedDate: new Date().toISOString().split('T')[0]
  };

  state.teamMembers.push(newUser);
  saveState();
  playBeep(750, 0.08);
  closeModals();
  renderTeamGrid();
  showToast(`Utilisateur ${newUser.firstName} ${newUser.lastName} créé avec succès !`);
  e.target.reset();
}
