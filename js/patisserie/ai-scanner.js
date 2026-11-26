import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../src/infrastructure/config.js';

/**
 * js/patisserie/ai-scanner.js
 * Module client pour la compression et l'analyse intelligente d'étiquettes alimentaires (Option B).
 * Détection automatique : DLC / DDM / DLUO, Numéro de lot, Nom de produit, Marque et Catégorie HACCP.
 */

/**
 * Compresse une photo d'étiquette via Canvas pour un envoi ultra-rapide (< 250 Ko).
 * @param {File|Blob} file 
 * @param {number} maxDimension - Largeur ou hauteur maximale (1280px par défaut)
 * @param {number} quality - Qualité JPEG (0.8 par défaut)
 * @returns {Promise<{ dataUrl: string, mimeType: string }>}
 */
export async function compressImage(file, maxDimension = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier image sélectionné."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format d'image non supporté ou fichier corrompu."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ dataUrl: e.target.result, mimeType: file.type || 'image/jpeg' });
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: compressedDataUrl, mimeType: 'image/jpeg' });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Data URL sentinelle du lien « Tester avec l'étiquette de démonstration »
 * (js/patisserie/modals.js, executeAutomatedScan -> processLabelImage(null)).
 * SEULE cette valeur déclenche le jeu de démonstration : une vraie photo ne doit
 * jamais produire de données inventées dans un registre HACCP.
 */
export const DEMO_LABEL_DATA_URL = 'data:image/jpeg;base64,demo';

/** Valeurs du jeu de démonstration — à ne jamais conserver pour un lot réel. */
export function demoLabelData() {
  const futureDlc = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return {
    name: "Beurre de Tourage AOP 84%",
    supplier: "Laiterie Montaigu",
    lot: "L-" + Math.floor(1000 + Math.random() * 9000),
    dlcDate: futureDlc.toISOString().split('T')[0],
    category: "cremerie",
    confidence: "medium"
  };
}

/**
 * Envoie l'image d'étiquette pour extraction par Vision IA.
 * Tente l'Edge Function Supabase `extract-label`, puis `./api/extract-label`,
 * puis une clé IA configurée localement. En l'absence des trois, LÈVE une erreur
 * explicite : aucune donnée d'étiquette n'est inventée (voir DEMO_LABEL_DATA_URL).
 * 
 * @param {string} dataUrl - Image encodée en data URL
 * @returns {Promise<{ name: string, supplier: string, lot: string, dlcDate: string, category: string, confidence: string }>}
 */
export async function extractLabelData(dataUrl) {
  // Jeu de démonstration explicite : jamais de données inventées pour une vraie photo.
  if (dataUrl === DEMO_LABEL_DATA_URL) return demoLabelData();

  const base64Data = dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

  // 1. Edge Function Supabase (fonctionne sur GitHub Pages, Cloudflare Pages, Vercel et en PWA).
  let endpointError = null;
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
    try {
      const fnResp = await fetch(`${SUPABASE_URL}/functions/v1/extract-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ image: base64Data, mimeType: 'image/jpeg' })
      });
      if (fnResp.ok) {
        const res = await fnResp.json();
        if (res.success && res.data) {
          return normaliserExtraction(res.data);
        }
        endpointError = new Error(res.error || "Réponse inexploitable du service d'analyse.");
      } else if (fnResp.status !== 404) {
        const errJson = await fnResp.json().catch(() => null);
        endpointError = new Error(
          (errJson && errJson.error) || `Service d'analyse d'images indisponible (HTTP ${fnResp.status}).`
        );
      }
    } catch (err) {
      endpointError = /Failed to fetch|NetworkError|load failed/i.test(err.message || '')
        ? new Error("Service d'analyse d'images injoignable (réseau).")
        : err;
      console.warn("Analyse d'étiquette indisponible via l'Edge Function Supabase.", err);
    }
  }

  // 2. Repli endpoint serverless relatif (Vercel / serveur local avec /api).
  try {
    const response = await fetch('./api/extract-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, mimeType: 'image/jpeg' })
    });

    if (response.ok) {
      const res = await response.json();
      if (res.success && res.data) {
        return normaliserExtraction(res.data);
      }
      endpointError = new Error(res.error || "Réponse inexploitable du service d'analyse.");
    } else if (response.status !== 404 && !endpointError) {
      const errJson = await response.json().catch(() => null);
      endpointError = new Error(
        (errJson && errJson.error) || `Service d'analyse d'images indisponible (HTTP ${response.status}).`
      );
    }
  } catch (err) {
    if (!endpointError) {
      endpointError = /Failed to fetch|NetworkError|load failed/i.test(err.message || '')
        ? new Error("Service d'analyse d'images injoignable (réseau).")
        : err;
    }
  }

  // 3. Mode secours : clé IA configurée dans Réglages > Préférences ou localStorage
  let settingsKey = '';
  try {
    const rawSettings = localStorage.getItem('traq_settings');
    settingsKey = rawSettings ? (JSON.parse(rawSettings).aiApiKey || '') : '';
  } catch { /* ignore */ }
  const localApiKey = String(settingsKey || localStorage.getItem('traqhaccp_openrouter_api_key') || '').trim();
  if (localApiKey) {
    try {
      const directData = await callVisionProviderDirect(localApiKey, base64Data);
      if (directData) return directData;
    } catch (errDirect) {
      console.error("Échec de l'analyse IA directe :", errDirect);
      throw new Error(`Erreur du service d'analyse d'images : ${errDirect.message}`);
    }
  }

  // 4. Aucun moyen d'analyse disponible : on le dit explicitement à l'appelant.
  //    On n'invente JAMAIS de lot, de DLC ni de fournisseur : le formulaire de
  //    saisie manuelle reste vide et l'opérateur saisit les valeurs de l'étiquette.
  throw endpointError || new Error("Configurez votre clé API IA (Gemini, OpenRouter ou Groq) dans Réglages > Préférences pour activer le scan photo.");
}

const VALID_CATEGORIES = ['cremerie', 'chocolat', 'fruits', 'farine', 'oeufs'];

const MOIS_FR = {
  jan: 1, janv: 1, janvier: 1,
  fev: 2, fevr: 2, fevrier: 2,
  mar: 3, mars: 3,
  avr: 4, avril: 4,
  mai: 5,
  jun: 6, juin: 6,
  jul: 7, juil: 7, juillet: 7,
  aou: 8, aout: 8,
  sep: 9, sept: 9, septembre: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, decembre: 12,
};

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatIsoDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return '';
  const maxDay = lastDayOfMonth(year, month);
  if (day < 1 || day > maxDay) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeYear(y) {
  const n = Number(y);
  return String(y).length === 2 ? 2000 + n : n;
}

/**
 * Convertit toute représentation courante de DLC / DDM / DLUO vers ISO YYYY-MM-DD
 * exigé par `<input type="date">`. Retourne '' si aucune date valide n'est trouvée.
 */
export function normaliserDateIso(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  const isoPrefix = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoPrefix) {
    return formatIsoDate(Number(isoPrefix[1]), Number(isoPrefix[2]), Number(isoPrefix[3]));
  }

  const dmy = s.match(/(?:^|[^\d])([0-3]?\d)[/.\-\s]+([01]?\d)[/.\-\s]+(\d{4}|\d{2})(?:[^\d]|$)/);
  if (dmy) {
    return formatIsoDate(normalizeYear(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  const ym = s.match(/^\s*(20\d{2})[-/.](\d{1,2})\s*$/);
  if (ym) {
    const y = Number(ym[1]);
    const m = Number(ym[2]);
    return m >= 1 && m <= 12 ? formatIsoDate(y, m, lastDayOfMonth(y, m)) : '';
  }

  const my = s.match(/(?:^|[^\d])([01]?\d)[/.\-\s]+(\d{4}|\d{2})\s*$/);
  if (my) {
    const m = Number(my[1]);
    const y = normalizeYear(my[2]);
    return m >= 1 && m <= 12 ? formatIsoDate(y, m, lastDayOfMonth(y, m)) : '';
  }

  const sansAccent = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const frDayMonthYear = sansAccent.match(/(?:^|\b)([0-3]?\d)\s+([a-z]{3,10})\.?\s+(\d{4}|\d{2})\b/);
  if (frDayMonthYear) {
    const m = MOIS_FR[frDayMonthYear[2]];
    if (m) return formatIsoDate(normalizeYear(frDayMonthYear[3]), m, Number(frDayMonthYear[1]));
  }

  const frMonthYear = sansAccent.match(/\b([a-z]{3,10})\.?\s+(\d{4}|\d{2})\b/);
  if (frMonthYear) {
    const m = MOIS_FR[frMonthYear[1]];
    if (m) {
      const y = normalizeYear(frMonthYear[2]);
      return formatIsoDate(y, m, lastDayOfMonth(y, m));
    }
  }

  return '';
}

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Réponse IA invalide (JSON absent)');
    return JSON.parse(match[0]);
  }
}

function nettoyerLot(raw) {
  return String(raw || '')
    .trim()
    .replace(/^(?:N°?\s*DE\s*LOT|NUM[EÉ]RO\s*DE\s*LOT|LOT|BATCH|L)\s*[:.#-]?\s*/i, '')
    .toUpperCase()
    .trim();
}

export function normaliserExtraction(parsed) {
  const rawDate = parsed?.dlcDate ?? parsed?.dlc ?? parsed?.ddm ?? parsed?.dluo
    ?? parsed?.expirationDate ?? parsed?.expiryDate ?? parsed?.bestBefore ?? '';
  let dlcDate = normaliserDateIso(rawDate);
  let lot = nettoyerLot(parsed?.lot ?? parsed?.lotNumber ?? parsed?.numeroLot ?? parsed?.batch ?? '');

  if (!dlcDate && lot) {
    dlcDate = normaliserDateIso(lot);
  }
  if (!lot && dlcDate) {
    lot = `LOT-${dlcDate.replace(/-/g, '')}`;
  }

  const cat = String(parsed?.category || '').toLowerCase().trim();
  const conf = String(parsed?.confidence || 'medium').toLowerCase().trim();

  return {
    name: String(parsed?.name || '').trim(),
    supplier: String(parsed?.supplier || '').trim(),
    lot,
    dlcDate,
    category: VALID_CATEGORIES.includes(cat) ? cat : 'cremerie',
    confidence: ['high', 'medium', 'low'].includes(conf) ? conf : 'medium'
  };
}

/**
 * Appel direct au fournisseur Vision IA selon le préfixe de la clé API :
 * Gemini (`AIza…`), Groq (`gsk_…`), xAI (`xai-…`), NVIDIA NIM (`nvapi-…`) ou OpenRouter.
 */
async function callVisionProviderDirect(apiKey, base64Data) {
  const prompt = `Extrais fidèlement sous forme d'un objet JSON strict sans balises markdown :
- "name" (nom complet du produit)
- "supplier" (marque ou fournisseur)
- "lot" (numéro de lot en majuscules sans le mot LOT ; si "voir date / DLC / DDM / DLUO", utiliser le code date ex: 28092026)
- "dlcDate" (DLC "À consommer jusqu'au", DDM / DLUO "À consommer de préférence avant le / fin", EXP, format strict YYYY-MM-DD ; si MM/YYYY, dernier jour du mois)
- "category" ("cremerie", "chocolat", "fruits", "farine", ou "oeufs")
- "confidence" ("high", "medium", ou "low")`;

  if (apiKey.startsWith('AIza')) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini status ${resp.status}: ${errText.slice(0, 180)}`);
    }
    const result = await resp.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? normaliserExtraction(parseJsonLoose(text)) : null;
  }

  let endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  let model = 'google/gemini-2.5-flash';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  let isNvidia = false;
  if (apiKey.startsWith('gsk_')) {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    model = 'meta-llama/llama-4-scout-17b-16e-instruct';
  } else if (apiKey.startsWith('xai-')) {
    endpoint = 'https://api.x.ai/v1/chat/completions';
    model = 'grok-2-vision-1212';
  } else if (apiKey.startsWith('nvapi-')) {
    endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    model = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
    isNvidia = true;
  } else {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'TraqHACCP';
  }

  const payload = {
    model,
    temperature: 0.1,
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
      ]
    }]
  };
  if (isNvidia) payload.chat_template_kwargs = { enable_thinking: false };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Vision API status ${resp.status}: ${errText.slice(0, 180)}`);
  }

  const result = await resp.json();
  const text = result.choices?.[0]?.message?.content;
  return text ? normaliserExtraction(parseJsonLoose(text)) : null;
}
