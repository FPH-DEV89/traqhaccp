/**
 * js/patisserie/ai-scanner.js
 * Module client pour la compression et l'analyse intelligente d'étiquettes alimentaires (Option B).
 * Détection automatique : DLC, Numéro de lot, Nom de produit, Marque et Catégorie HACCP.
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
 * Tente le endpoint Vercel Serverless `/api/extract-label` (OpenRouter côté serveur),
 * puis une clé OpenRouter configurée localement. En l'absence des deux, LÈVE une erreur
 * explicite : aucune donnée d'étiquette n'est inventée (voir DEMO_LABEL_DATA_URL).
 * 
 * @param {string} dataUrl - Image encodée en data URL
 * @returns {Promise<{ name: string, supplier: string, lot: string, dlcDate: string, category: string, confidence: string }>}
 */
export async function extractLabelData(dataUrl) {
  // Jeu de démonstration explicite : jamais de données inventées pour une vraie photo.
  if (dataUrl === DEMO_LABEL_DATA_URL) return demoLabelData();

  const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

  // 1. Endpoint serverless. Toute défaillance est MÉMORISÉE puis remontée à l'appelant :
  //    une panne ne doit jamais se transformer en étiquette inventée (registre HACCP).
  let endpointError = null;
  try {
    const response = await fetch('/api/extract-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data, mimeType: 'image/jpeg' })
    });

    if (response.ok) {
      const res = await response.json();
      if (res.success && res.data) {
        return res.data;
      }
      endpointError = new Error(res.error || "Réponse inexploitable du service d'analyse.");
    } else if (response.status !== 404) {
      // 404 = serveur statique sans fonction /api (poste de dev) : on poursuit.
      const errJson = await response.json().catch(() => null);
      endpointError = new Error(
        (errJson && errJson.error) || `Service d'analyse d'images indisponible (HTTP ${response.status}).`
      );
    }
  } catch (err) {
    // Panne réseau ou exception : mémorisée, plus jamais avalée en silence.
    endpointError = /Failed to fetch|NetworkError|load failed/i.test(err.message || '')
      ? new Error("Service d'analyse d'images injoignable (réseau).")
      : err;
    console.warn("Analyse d'étiquette indisponible via l'endpoint serveur.", err);
  }

  // 2. Mode secours : clé IA configurée dans Réglages > Préférences ou localStorage
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

  // 3. Aucun moyen d'analyse disponible : on le dit explicitement à l'appelant.
  //    On n'invente JAMAIS de lot, de DLC ni de fournisseur : le formulaire de
  //    saisie manuelle reste vide et l'opérateur saisit les valeurs de l'étiquette.
  throw endpointError || new Error("Configurez votre clé API IA (Gemini, OpenRouter ou Groq) dans Réglages > Préférences pour activer le scan photo.");
}

const VALID_CATEGORIES = ['cremerie', 'chocolat', 'fruits', 'farine', 'oeufs'];

function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Réponse IA invalide (JSON absent)');
    return JSON.parse(match[0]);
  }
}

function normaliserExtraction(parsed) {
  return {
    name: String(parsed?.name || '').trim(),
    supplier: String(parsed?.supplier || '').trim(),
    lot: String(parsed?.lot || '').toUpperCase().trim(),
    dlcDate: String(parsed?.dlcDate || '').trim(),
    category: VALID_CATEGORIES.includes(parsed?.category) ? parsed.category : 'cremerie',
    confidence: parsed?.confidence || 'medium'
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
- "lot" (numéro de lot en majuscules sans le mot LOT)
- "dlcDate" (format strict YYYY-MM-DD)
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
  if (apiKey.startsWith('gsk_')) {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    model = 'meta-llama/llama-4-scout-17b-16e-instruct';
  } else if (apiKey.startsWith('xai-')) {
    endpoint = 'https://api.x.ai/v1/chat/completions';
    model = 'grok-2-vision-1212';
  } else if (apiKey.startsWith('nvapi-')) {
    endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    model = 'meta/llama-3.2-90b-vision-instruct';
  } else {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'TraqHACCP';
  }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
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
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Vision API status ${resp.status}: ${errText.slice(0, 180)}`);
  }

  const result = await resp.json();
  const text = result.choices?.[0]?.message?.content;
  return text ? normaliserExtraction(parseJsonLoose(text)) : null;
}
