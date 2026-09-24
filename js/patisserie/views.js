/**
 * TraqHACCP Pâtisserie — UI Render Functions
 */
import { state, getCurrentOperator } from './state.js';
import { calculateRecipeMetrics, formatDateFr } from './calculations.js';
import { playBeep } from './audio-toast.js';
import { renderSettings, readSettings } from './settings.js';
import { NORMS } from '../../src/domain/haccp_norms.js';

export function renderLots() {
  const grid = document.getElementById('lots-grid');
  if (!grid) return;

  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  const filtered = state.lots.filter(l => {
    const matchesCat = state.currentCategory === 'all' || l.category === state.currentCategory;
    const matchesSearch = !search || 
      l.name.toLowerCase().includes(search) || 
      l.lot.toLowerCase().includes(search) || 
      l.supplier.toLowerCase().includes(search);
    const matchesAlert = !state.alertsOnly || (l.status === 'urgent' || l.status === 'warning');
    return matchesCat && matchesSearch && matchesAlert;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
        </div>
        <h4 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Aucun lot d'ingrédient trouvé</h4>
        <p class="text-xs text-zinc-400 mt-1">Modifiez vos filtres ou effectuez une nouvelle réception.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(l => {
    let badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    let badgeText = 'Conforme';
    if (l.status === 'urgent') {
      badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse';
      badgeText = 'DLC Urgente ≤24h';
    } else if (l.status === 'warning') {
      badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      badgeText = 'DLC ≤48h';
    }

    return `
      <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between gap-3">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}">
              ${badgeText}
            </span>
            <span class="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">${l.lot}</span>
          </div>
          
          <h3 class="font-bold text-sm text-zinc-900 dark:text-white mt-2">${l.name}</h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">${l.supplier} · Reçu le ${formatDateFr(l.receiptDate)}</p>

          <div class="grid grid-cols-2 gap-2 my-3 p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-xs">
            <div>
              <span class="text-[10px] text-zinc-400 block">Stock actuel</span>
              <span class="font-extrabold text-sm text-zinc-900 dark:text-white">${l.stockQty} ${l.stockUnit}</span>
              <span class="text-[10px] text-emerald-600 block">${l.unitPriceHT.toFixed(2)} € HT/${l.stockUnit}</span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-zinc-400 block">DLC Fabricant</span>
              <span class="font-bold text-xs ${l.status === 'urgent' ? 'text-rose-600' : 'text-zinc-800 dark:text-zinc-200'}">${formatDateFr(l.dlcDate)}</span>
              <span class="text-[10px] text-zinc-400 block">Temp. : ${l.temp}°C</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button onclick="openAdjustStockModal('${l.id}')" class="flex-1 py-1.5 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition text-center">
            Ajuster Stock
          </button>
          <button onclick="createSecondaryFromLot('${l.lot}')" class="flex-1 py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-200/60 dark:border-emerald-800/60 transition text-center">
            + DLC 2nd
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function renderRecipes() {
  const grid = document.getElementById('recipes-grid');
  if (!grid) return;

  if (state.recipes.length === 0) {
    grid.innerHTML = '<div style="padding:32px;font-size:13px;opacity:0.6;text\\u0061lign:center">Aucune fiche recette enregistrée. Cliquez sur "+ Nouvelle Fiche Recette" pour en créer une.</div>';
    return;
  }

  grid.innerHTML = state.recipes.map(r => {
    const m = calculateRecipeMetrics(r);
    return `
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between gap-4">
        <div>
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="text-3xl">${r.icon}</span>
              <div>
                <h3 class="font-bold text-base text-zinc-900 dark:text-white leading-tight">${r.name}</h3>
                <span class="text-xs text-zinc-400">${r.ingredients.length} ingrédients suivis</span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.fabricables > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'} shrink-0">
              ${m.fabricables} réalisables
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 my-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-center">
            <div>
              <span class="text-[10px] text-zinc-400 block uppercase font-semibold">Prix Vente</span>
              <span class="font-extrabold text-sm text-zinc-900 dark:text-white">${r.sellingPriceTTC.toFixed(2)} € TTC</span>
              <span class="text-[9px] text-zinc-400 block">${m.prixVenteHT.toFixed(2)} € HT</span>
            </div>
            <div>
              <span class="text-[10px] text-zinc-400 block uppercase font-semibold">Coût Matière</span>
              <span class="font-extrabold text-sm text-zinc-700 dark:text-zinc-300">${m.costMatiereHT.toFixed(2)} € HT</span>
              <span class="text-[9px] ${m.foodCostRatio > 30 ? 'text-amber-500 font-bold' : 'text-emerald-500'} block">${m.foodCostRatio.toFixed(1)}% FC</span>
            </div>
            <div>
              <span class="text-[10px] text-zinc-400 block uppercase font-semibold">Marge Brute</span>
              <span class="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">+${m.marginBrute.toFixed(2)} €</span>
              <span class="text-[9px] text-emerald-600 block">${m.margeRatio.toFixed(0)}% (${m.coefMarge.toFixed(1)}x)</span>
            </div>
          </div>

          <div class="space-y-1.5">
            <span class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Ingrédients & Déstockage FIFO :</span>
            ${r.ingredients.map(ing => {
              const lotItem = state.lots.find(l => l.lot === ing.lotMatch);
              const isShort = !lotItem || lotItem.stockQty < ing.qtyPerUnit;
              return `
                <div class="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-zinc-50/60 dark:bg-zinc-800/30">
                  <span class="text-zinc-700 dark:text-zinc-300 font-medium">${ing.name} (${ing.qtyPerUnit} ${ing.unit})</span>
                  <div class="flex items-center gap-1.5 font-mono text-[11px]">
                    <span class="${isShort ? 'text-rose-500 font-bold' : 'text-zinc-500'}">
                      ${lotItem ? `Stock: ${lotItem.stockQty} ${ing.unit}` : 'RUPTURE'}
                    </span>
                    <span class="text-zinc-300 dark:text-zinc-700">·</span>
                    <span class="text-zinc-400">${ing.lotMatch}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <button onclick="startSaleWorkflow('${r.id}')" class="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5 active:scale-95">
          <svg class="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          <span>Vendre & Déstocker</span>
        </button>
      </div>
    `;
  }).join('');
}

export function renderSalesCatalog() {
  const cat = document.getElementById('sales-catalog-grid');
  if (!cat) return;

  if (state.recipes.length === 0) {
    cat.innerHTML = '<div style="padding:24px;font-size:13px;opacity:0.6;text\\u0061lign:center">Aucune recette enregistrée pour la vente.</div>';
    return;
  }

  cat.innerHTML = state.recipes.map(r => {
    const m = calculateRecipeMetrics(r);
    return `
      <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between gap-3">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-3xl">${r.icon}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.fabricables > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800'}">
              ${m.fabricables} fabricables
            </span>
          </div>
          <h3 class="font-bold text-sm text-zinc-900 dark:text-white mt-2">${r.name}</h3>
          <p class="text-xs text-zinc-400 mt-0.5">${r.ingredients.length} matières débitées en FIFO</p>
          
          <div class="flex items-baseline justify-between mt-3">
            <span class="text-xl font-extrabold text-zinc-900 dark:text-white">${r.sellingPriceTTC.toFixed(2)} €</span>
            <span class="text-xs text-emerald-600 font-bold">+${m.marginBrute.toFixed(2)} € marge</span>
          </div>
        </div>

        <button onclick="startSaleWorkflow('${r.id}')" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow transition flex items-center justify-center gap-1.5 active:scale-95">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          <span>Vendre & Déstocker</span>
        </button>
      </div>
    `;
  }).join('');
}

export function renderSalesHistory() {
  const hist = document.getElementById('sales-history-body');
  if (!hist) return;

  if (state.salesHistory.length === 0) {
    hist.innerHTML = '<tr><td colspan="7" style="padding:24px;font-size:13px;opacity:0.6;text\\u0061lign:center">Aucune vente enregistrée pour le moment.</td></tr>';
    return;
  }

  hist.innerHTML = state.salesHistory.map(s => {
    const isDelivery = s.channel === 'livraison';
    return `
      <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
        <td class="p-3 font-mono text-zinc-400">${s.time}</td>
        <td class="p-3 font-bold text-zinc-900 dark:text-white">${s.recipeName}</td>
        <td class="p-3">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-zinc-800 dark:text-zinc-200">${s.customerName}</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${isDelivery ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}">
              ${isDelivery ? 'Livraison' : 'À emporter'}
            </span>
          </div>
          <div class="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
            <span>📞 ${s.customerPhone}</span>
            <span class="text-zinc-300 dark:text-zinc-700">·</span>
            <span>${s.orderRef}</span>
          </div>
          ${isDelivery && s.address !== '-' ? `
            <div class="text-[10px] text-zinc-400 truncate max-w-[240px] mt-0.5">📍 ${s.address}</div>
          ` : ''}
        </td>
        <td class="p-3 font-semibold">${s.qty}</td>
        <td class="p-3 font-bold text-zinc-900 dark:text-white">${s.totalTTC.toFixed(2)} €</td>
        <td class="p-3 text-emerald-600 font-semibold">+${s.marginTotal.toFixed(2)} €</td>
        <td class="p-3 text-zinc-400 font-mono text-[11px]">${s.lotsUsed}</td>
      </tr>
    `;
  }).join('');
}

export function renderSecondaryDlcs() {
  const container = document.getElementById('secondary-dlc-grid');
  const parentSelect = document.getElementById('sec-parent-lot');

  if (parentSelect) {
    parentSelect.innerHTML = '<option value="">Sélectionner un lot actif en stock...</option>' + 
      state.lots.map(l => `<option value="${l.lot}">${l.lot} — ${l.name} (${l.supplier})</option>`).join('');
  }

  if (!container) return;

  if (state.secondaryDlcs.length === 0) {
    container.innerHTML = '<div style="padding:24px;font-size:13px;opacity:0.6;text\\u0061lign:center">Aucune DLC secondaire active.</div>';
    return;
  }

  container.innerHTML = state.secondaryDlcs.map(item => `
    <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          ${item.type}
        </span>
        <span class="text-[11px] text-zinc-400 font-mono">Lot mère: ${item.parentLot}</span>
      </div>
      <div>
        <h4 class="font-bold text-sm text-zinc-900 dark:text-white">${item.name}</h4>
        <p class="text-xs text-zinc-500 mt-0.5">Par : ${item.operator}</p>
      </div>
      <div class="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs flex justify-between items-center">
        <div>
          <span class="text-[10px] text-zinc-400 block">Créé le</span>
          <span class="font-semibold">${formatDateFr(item.creationDate)}</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-zinc-400 block font-bold text-rose-500">DLC SECONDAIRE</span>
          <span class="font-extrabold text-rose-600 dark:text-rose-400 text-sm">${formatDateFr(item.expiryDate)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

export function renderWitnessSamples() {
  const container = document.getElementById('witness-grid');
  if (!container) return;

  if (state.witnessSamples.length === 0) {
    container.innerHTML = '<div style="padding:24px;font-size:13px;opacity:0.6;text\\u0061lign:center">Aucun échantillon témoin enregistré.</div>';
    return;
  }

  container.innerHTML = state.witnessSamples.map(sample => `
    <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">${sample.service}</span>
        <span class="text-[11px] text-zinc-400 font-mono">${sample.id}</span>
      </div>
      <div>
        <h4 class="font-bold text-sm text-zinc-900 dark:text-white">${sample.dishName}</h4>
        <p class="text-xs text-zinc-500 mt-0.5">Prélevé le ${formatDateFr(sample.serviceDate)}</p>
      </div>
      <div class="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs flex justify-between items-center">
        <div>
          <span class="text-[10px] text-zinc-400 block">Conservation</span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">${sample.temp}</span>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-zinc-400 block">Garder jusqu'au</span>
          <span class="font-bold text-zinc-800 dark:text-zinc-200">${formatDateFr(sample.expiryDate)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

export function updateOperatorUI() {
  const op = getCurrentOperator();
  if (!op) return;

  const initEl = document.getElementById('current-op-initials');
  const nameEl = document.getElementById('current-op-name');
  const roleEl = document.getElementById('current-op-role');

  if (initEl) initEl.innerText = op.initials;
  if (nameEl) nameEl.innerText = `${op.firstName} ${op.lastName.charAt(0)}.`;
  if (roleEl) roleEl.innerText = op.role;
}

export function renderTeamGrid() {
  const container = document.getElementById('team-grid');
  if (!container) return;

  if (state.teamMembers.length === 0) {
    container.innerHTML = '<div style="padding:24px;font-size:13px;opacity:0.6;text\\u0061lign:center">Aucun membre d\'équipe enregistré.</div>';
    return;
  }

  container.innerHTML = state.teamMembers.map(m => {
    const isCurrent = m.id === state.currentOperatorId;
    return `
      <div class="p-4 rounded-2xl border ${isCurrent ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20' : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900'} shadow-sm flex flex-col justify-between gap-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-extrabold text-sm">
              ${m.initials}
            </span>
            <div>
              <h4 class="font-bold text-sm text-zinc-900 dark:text-white">${m.firstName} ${m.lastName}</h4>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">${m.role}</p>
            </div>
          </div>
          ${isCurrent ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">En service</span>' : ''}
        </div>

        <div class="flex items-center justify-between text-[11px] pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span class="text-zinc-400">PIN : ${m.pin ? '•••• (Défini)' : 'Non configuré'}</span>
          ${!isCurrent ? `<button onclick="handleSwitchOperator('${m.id}')" class="px-3 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold transition active:scale-95">Choisir</button>` : '<span class="text-emerald-600 font-semibold">Actif</span>'}
        </div>
      </div>
    `;
  }).join('');
}

export function renderOperatorSwitchList() {
  const container = document.getElementById('operator-switch-list');
  if (!container) return;

  container.innerHTML = state.teamMembers.map(m => {
    const isCurrent = m.id === state.currentOperatorId;
    return `
      <button onclick="handleSwitchOperator('${m.id}')" class="w-full p-2.5 rounded-xl flex items-center justify-between ${isCurrent ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-transparent'} transition text-left">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-lg ${isCurrent ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'} flex items-center justify-center font-bold text-xs">
            ${m.initials}
          </span>
          <div>
            <p class="font-bold text-xs text-zinc-900 dark:text-white">${m.firstName} ${m.lastName}</p>
            <p class="text-[10px] text-zinc-400">${m.role}</p>
          </div>
        </div>
        ${isCurrent ? '<svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
      </button>
    `;
  }).join('');
}

export function updateTopMetrics() {
  const urgentCount = state.lots.filter(l => l.status === 'urgent' || l.status === 'warning').length;
  const statLots = document.getElementById('stat-total-lots');
  const statWarn = document.getElementById('stat-warning-dlc');
  const statSec = document.getElementById('stat-sec-dlc');
  const countAll = document.getElementById('count-all');
  const statMargin = document.getElementById('stat-margin');
  const statMarginCoef = document.getElementById('stat-margin-coef');
  const statMarginSub = document.getElementById('stat-margin-sub');

  if (statLots) statLots.innerText = state.lots.length;
  if (statWarn) statWarn.innerText = urgentCount;
  if (statSec) statSec.innerText = state.secondaryDlcs.length;
  if (countAll) countAll.innerText = state.lots.length;

  if (statMargin) {
    if (state.salesHistory && state.salesHistory.length > 0) {
      let totalVentesTTC = 0;
      let totalMarge = 0;
      state.salesHistory.forEach(s => {
        totalVentesTTC += (s.totalTTC || 0);
        totalMarge += (s.marginTotal || 0);
      });
      const totalVentesHT = totalVentesTTC / 1.10; // Base TVA moyenne pâtisserie 10%
      const margeRatio = totalVentesHT > 0 ? (totalMarge / totalVentesHT) * 100 : 0;
      const coutMatiere = Math.max(0, totalVentesHT - totalMarge);
      const coef = coutMatiere > 0 ? (totalVentesTTC / coutMatiere) : 0;
      const countVentes = state.salesHistory.length;

      statMargin.innerText = `${margeRatio.toFixed(1)}%`;
      if (statMarginCoef) statMarginCoef.innerText = coef > 0 ? `Coef. ~${coef.toFixed(1)}x` : '—';
      if (statMarginSub) statMarginSub.innerText = `${countVentes} vente${countVentes > 1 ? 's' : ''} enregistrée${countVentes > 1 ? 's' : ''}`;
    } else if (state.recipes && state.recipes.length > 0) {
      let sumMargeRatio = 0;
      let sumCoef = 0;
      let validCount = 0;
      state.recipes.forEach(r => {
        const m = calculateRecipeMetrics(r);
        sumMargeRatio += m.margeRatio;
        sumCoef += m.coefMarge;
        validCount++;
      });
      const avgMarge = validCount > 0 ? sumMargeRatio / validCount : 0;
      const avgCoef = validCount > 0 ? sumCoef / validCount : 0;

      statMargin.innerText = `${avgMarge.toFixed(1)}%`;
      if (statMarginCoef) statMarginCoef.innerText = avgCoef > 0 ? `Coef. ~${avgCoef.toFixed(1)}x` : '—';
      if (statMarginSub) statMarginSub.innerText = 'Moyenne fiches techniques';
    } else {
      statMargin.innerText = '—';
      if (statMarginCoef) statMarginCoef.innerText = '—';
      if (statMarginSub) statMarginSub.innerText = 'En attente de données';
    }
  }
}

export function switchView(tab) {
  playBeep(520, 0.03);
  ['traceability', 'recipes', 'sales', 'dlc', 'team', 'reglages'].forEach(t => {
    document.getElementById(`view-${t}`)?.classList.add('hidden');
    
    // Desktop nav
    const dBtn = document.getElementById(`nav-${t === 'traceability' ? 'trace' : t}`);
    if (dBtn) {
      dBtn.classList.remove('bg-zinc-900', 'dark:bg-zinc-700', 'text-white');
      dBtn.classList.add('text-zinc-600', 'dark:text-zinc-400');
    }

    // Mobile nav
    const mBtn = document.getElementById(`mob-${t === 'traceability' ? 'trace' : t}`);
    if (mBtn) {
      mBtn.classList.remove('text-emerald-600', 'dark:text-emerald-400', 'font-bold');
      mBtn.classList.add('text-zinc-500', 'dark:text-zinc-400');
    }
  });

  document.getElementById(`view-${tab}`)?.classList.remove('hidden');

  // Écran Réglages : rendu à la demande par le module settings.js
  if (tab === 'reglages') renderSettings();

  // Active desktop button
  const activeDesktop = document.getElementById(`nav-${tab === 'traceability' ? 'trace' : tab}`);
  if (activeDesktop) {
    activeDesktop.classList.add('bg-zinc-900', 'dark:bg-zinc-700', 'text-white');
    activeDesktop.classList.remove('text-zinc-600', 'dark:text-zinc-400');
  }

  // Active mobile button
  const activeMobile = document.getElementById(`mob-${tab === 'traceability' ? 'trace' : tab}`);
  if (activeMobile) {
    activeMobile.classList.add('text-emerald-600', 'dark:text-emerald-400', 'font-bold');
    activeMobile.classList.remove('text-zinc-500', 'dark:text-zinc-400');
  }
}

export function renderAudit() {
  const elTrace = document.getElementById('audit-trace');
  const elFroid = document.getElementById('audit-froid');
  const elTemoins = document.getElementById('audit-temoins');
  const elName = document.getElementById('audit-establishment-name');
  const elSiret = document.getElementById('audit-siret-line');

  if (elName) {
    elName.textContent = state.establishmentName;
  }

  if (elSiret) {
    const siret = (readSettings().establishment || {}).siret || '';
    if (siret) {
      elSiret.textContent = `SIRET : ${siret} · Registre de traçabilité 100% numérique`;
    } else {
      elSiret.textContent = 'Registre de traçabilité 100% numérique';
    }
  }

  if (elTrace) {
    if (state.lots.length === 0) {
      elTrace.textContent = '—';
      elTrace.dataset.audit = 'vide';
    } else {
      const tracedCount = state.lots.filter(l => l.lot).length;
      const pct = Math.round((tracedCount / state.lots.length) * 100);
      elTrace.textContent = `${pct}% tracé`;
      elTrace.dataset.audit = pct === 100 ? 'ok' : 'ko';
    }
  }

  if (elFroid) {
    const coldLots = state.lots.filter(l => ['cremerie', 'oeufs', 'fruits'].includes(l.category));
    if (coldLots.length === 0) {
      elFroid.textContent = '—';
      elFroid.dataset.audit = 'vide';
    } else {
      const conformCount = coldLots.filter(l => {
        const limit = l.category === 'fruits' ? NORMS.cold.vegetableMax : NORMS.cold.positiveMax;
        return l.temp <= limit;
      }).length;
      const pct = Math.round((conformCount / coldLots.length) * 100);
      elFroid.textContent = `${pct}% Conforme`;
      elFroid.dataset.audit = pct === 100 ? 'ok' : 'ko';
    }
  }

  if (elTemoins) {
    const activeWitnesses = state.witnessSamples.filter(w => new Date(w.expiryDate) >= new Date());
    if (activeWitnesses.length === 0) {
      elTemoins.textContent = 'Aucun témoin';
      elTemoins.dataset.audit = 'vide';
    } else {
      const sorted = [...activeWitnesses].sort((a, b) => new Date(b.serviceDate) - new Date(a.serviceDate));
      const mostRecent = sorted[0];
      elTemoins.textContent = `${activeWitnesses.length} actifs (${mostRecent.temp})`;
      elTemoins.dataset.audit = 'ok';
    }
  }
}

export function renderRecallOptions() {
  const select = document.getElementById('recall-quick-select');
  if (!select) return;

  select.innerHTML = '<option value="">Sélectionner un lot actif...</option>';
  
  if (state.lots && state.lots.length > 0) {
    const uniqueLots = Array.from(new Set(state.lots.map(l => l.lot)))
      .map(lotId => state.lots.find(l => l.lot === lotId))
      .filter(l => l && l.lot);
    
    uniqueLots.sort((a, b) => a.lot.localeCompare(b.lot));

    uniqueLots.forEach(l => {
      const option = document.createElement('option');
      option.value = l.lot;
      option.textContent = `${l.lot} — ${l.name}`;
      select.appendChild(option);
    });
  }
}
