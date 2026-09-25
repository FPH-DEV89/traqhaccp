/**
 * TraqHACCP Pâtisserie — Health Inspection & DDPP Recall Simulation
 */
import { state } from './state.js';
import { formatDateFr } from './calculations.js';
import { playBeep, showToast } from './audio-toast.js';
import { readSettings } from './settings.js';
import { construireRegistreDdpp, construireFicheAlerteRecherche, nomFichierRegistre, nomFichierFicheAlerte } from '../../src/presentation/ddpp_documents.js';
import { telechargerPdf } from '../../src/presentation/ddpp_report.js';

export function testRecallSearch() {
  const val = (document.getElementById('recall-input')?.value || '').trim().toUpperCase();
  const res = document.getElementById('recall-result');
  if (!res) return;
  res.classList.remove('hidden');

  if (!val) {
    res.innerHTML = '<span class="text-rose-500 font-semibold">Veuillez indiquer ou choisir un numéro de lot à investiguer.</span>';
    return;
  }

  playBeep(650, 0.05);

  // 1. Chercher le lot en matière première
  const lotMatch = state.lots.find(l => l.lot.includes(val) || l.name.toUpperCase().includes(val));

  // 2. Chercher les DLC Secondaires dérivées
  const secondaryMatches = state.secondaryDlcs.filter(s => s.parentLot.includes(val));

  // 3. Chercher les ventes / clients finaux ayant consommé ce lot
  const affectedSales = state.salesHistory.filter(s => s.lotsUsed.includes(val));

  let html = `
    <div class="border-b border-zinc-200 dark:border-zinc-800 pb-3">
      <div class="flex items-center justify-between">
        <span class="font-extrabold text-rose-600 dark:text-rose-400 text-sm flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          RAPPORT DE TRAÇABILITÉ DESCENDANTE : LOT ${val}
        </span>
        <span class="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-mono">${new Date().toLocaleDateString('fr-FR')}</span>
      </div>
      ${lotMatch ? `
        <div class="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
          Matière : <b>${lotMatch.name}</b> (${lotMatch.supplier}) · Stock physique restant : 
          <b class="text-rose-600 font-mono text-sm">${lotMatch.stockQty} ${lotMatch.stockUnit} à consigner immédiatement</b>
        </div>
      ` : `<div class="mt-1 text-xs text-zinc-500">Matière première épuisée ou archivée.</div>`}
    </div>
  `;

  // Préparations secondaires
  if (secondaryMatches.length > 0) {
    html += `
      <div>
        <span class="font-bold text-[11px] uppercase tracking-wide text-zinc-400 block mb-1">Préparations intermédiaires en cours (Labo) :</span>
        <div class="space-y-1">
          ${secondaryMatches.map(sm => `
            <div class="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 flex justify-between items-center text-xs">
              <span>🥣 ${sm.name} (${sm.type})</span>
              <span class="font-bold">À détruire (DLC: ${formatDateFr(sm.expiryDate)})</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Clients impactés
  html += `
    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="font-bold text-[11px] uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
          Clients servis en Vente à Emporter / Livraison (${affectedSales.length}) :
        </span>
        ${affectedSales.length > 0 ? `
          <button onclick="copyCustomerPhonesForAlert()" class="px-2.5 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-bold hover:opacity-90 transition">
            Copier les ${affectedSales.length} mobiles pour SMS d'Alerte
          </button>
        ` : ''}
      </div>
  `;

  if (affectedSales.length === 0) {
    html += `
      <div class="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs">
        ✓ Ce lot n'a été délivré sur aucune commande à emporter ou livraison pour le moment.
      </div>
    `;
  } else {
    html += `
      <div class="space-y-2">
        ${affectedSales.map(sale => {
          const isDelivery = sale.channel === 'livraison';
          return `
            <div class="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-zinc-900 dark:text-white text-xs">${sale.customerName}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isDelivery ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}">
                    ${isDelivery ? '🛵 En Livraison' : '🛍️ À emporter'}
                  </span>
                </div>
                <div class="text-[11px] text-zinc-500 mt-0.5">
                  Acheté à ${sale.time} · <b>${sale.qty}x ${sale.recipeName}</b> · <span>${sale.orderRef}</span>
                </div>
                ${isDelivery && sale.address !== '-' ? `
                  <div class="text-[10px] text-zinc-400 mt-0.5 font-medium">📍 Livré au : ${sale.address}</div>
                ` : ''}
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a href="tel:${sale.customerPhone.replace(/\s/g, '')}" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  <span>${sale.customerPhone}</span>
                </a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  html += `
    <div class="pt-2 flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800">
      <button onclick="downloadSanitaryReport('alerte')" class="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">
        Exporter Fiche d'Alerte DDPP (PDF)
      </button>
    </div>
  </div>`;

  res.innerHTML = html;
}

export function copyCustomerPhonesForAlert() {
  const phones = state.salesHistory
    .map(s => s.customerPhone)
    .filter(p => p && p !== '-')
    .join(', ');
  
  if (!phones) {
    showToast("Aucun numéro de téléphone à copier.");
    return;
  }

  const tempInput = document.createElement('textarea');
  tempInput.value = phones;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);

  playBeep(700, 0.08);
  showToast("Numéros des clients copiés ! Prêts pour l'envoi de SMS.");
}

export function downloadSanitaryReport(contexte = 'registre') {
  playBeep(900, 0.08);
  const etablissement = readSettings().establishment || {};
  const maintenant = new Date();

  if (contexte === 'alerte') {
    const val = (document.getElementById('recall-input')?.value || '').trim().toUpperCase();
    if (!val) {
      showToast("Indiquez ou choisissez d'abord un numéro de lot, puis exportez la fiche d'alerte.");
      return;
    }
    const lot = state.lots.find(l => l.lot.includes(val) || l.name.toUpperCase().includes(val)) || null;
    const preparations = state.secondaryDlcs.filter(s => s.parentLot.includes(val));
    const ventes = state.salesHistory.filter(s => s.lotsUsed.includes(val));
    const octets = construireFicheAlerteRecherche({
      etablissement,
      recherche: val,
      lot,
      preparations,
      ventes,
      now: maintenant
    });
    telechargerPdf(octets, nomFichierFicheAlerte(val, maintenant));
    showToast(`Fiche d'alerte DDPP (PDF) générée : ${ventes.length} client(s) à prévenir, ${preparations.length} préparation(s) à retirer.`);
    return;
  }

  const octets = construireRegistreDdpp({
    etablissement,
    lots: state.lots,
    secondaryDlcs: state.secondaryDlcs,
    witnessSamples: state.witnessSamples,
    salesHistory: state.salesHistory,
    teamMembers: state.teamMembers,
    now: maintenant
  });
  telechargerPdf(octets, nomFichierRegistre(maintenant));
  showToast(`Registre sanitaire DDPP (PDF) généré : ${state.lots.length} lot(s), ${state.salesHistory.length} déstockage(s).`);
}
