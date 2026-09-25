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
 * Tente d'abord le endpoint Vercel Serverless `/api/extract-label`.
 * Tente le endpoint Vercel Serverless `/api/extract-label`, puis une clé Gemini
 * configurée localement. En l'absence des deux, LÈVE une erreur explicite : aucune
 * donnée d'étiquette n'est inventée (voir DEMO_LABEL_DATA_URL pour la démo explicite).
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

  // 2. Mode secours : Clé API personnalisée stockée localement (pratique pour tester en local)
  const localApiKey = localStorage.getItem('traqhaccp_gemini_api_key');
  if (localApiKey) {
    try {
      const directData = await callGeminiDirect(localApiKey, base64Data);
      if (directData) return directData;
    } catch (errDirect) {
      console.error("Échec de l'appel direct Gemini avec clé locale :", errDirect);
      throw new Error(`Erreur API Gemini : ${errDirect.message}`);
    }
  }

  // 3. Aucun moyen d'analyse disponible : on le dit explicitement à l'appelant.
  //    On n'invente JAMAIS de lot, de DLC ni de fournisseur : le formulaire de
  //    saisie manuelle reste vide et l'opérateur saisit les valeurs de l'étiquette.
  throw endpointError || new Error("Analyse d'images non configurée sur le serveur.");
}

/**
 * Appel direct client Gemini (utilisé uniquement si l'utilisateur a configuré sa propre clé en local).
 */
async function callGeminiDirect(apiKey, base64Data) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const prompt = `Extrais fidèlement sous forme d'un objet JSON strict :
- "name" (nom du produit)
- "supplier" (marque ou fournisseur)
- "lot" (numéro de lot en majuscules sans le mot LOT)
- "dlcDate" (format strict YYYY-MM-DD)
- "category" ("cremerie", "chocolat", "fruits", "farine", ou "oeufs")
- "confidence" ("high", "medium", ou "low")`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API Gemini status ${resp.status}: ${errText}`);
  }

  const result = await resp.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  return JSON.parse(text);
}
