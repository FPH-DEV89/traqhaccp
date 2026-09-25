/**
 * /api/extract-label.js
 * Fonction Serverless Vercel (Node.js ES Module).
 * Analyse une étiquette alimentaire ou emballage sanitaire par un modèle de vision
 * (OpenRouter, modèle par défaut google/gemini-2.5-flash) pour extraire les
 * informations de traçabilité HACCP : produit, fournisseur, lot, DLC, catégorie.
 *
 * Variable d'environnement requise : OPENROUTER_API_KEY
 * Optionnelle : OPENROUTER_VISION_MODEL (défaut : google/gemini-2.5-flash)
 */
const CATEGORIES = ['cremerie', 'chocolat', 'fruits', 'farine', 'oeufs'];
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `Tu es un assistant expert HACCP et traçabilité pour les professionnels de la restauration et de la pâtisserie.
Analyse attentivement cette étiquette sanitaire ou cet emballage alimentaire (issu d'un grossiste ou d'une grande surface).
Extrait fidèlement les informations nécessaires à la réception de marchandise et à la conformité réglementaire :

1. "name" : Nom complet et désignation précise du produit (ex: "Beurre de tourage AOP 84%", "Crème Fleurette 35% MG", "Purée de Framboise").
2. "supplier" : Marque du fabricant ou fournisseur identifié sur l'emballage (ex: "Elle & Vire", "Président", "Valrhona", "Laiterie Montaigu", "Carrefour").
3. "lot" : Numéro de lot fabricant exact, en lettres majuscules et chiffres, sans le mot "LOT" ou "L:" (ex: "24250B", "ABC-1234").
4. "dlcDate" : Date Limite de Consommation (DLC) ou Date de Durabilité Minimale (DDM/DLUO/EXP). Convertis impérativement au format strict ISO YYYY-MM-DD (ex: "2026-10-18"). Si l'année est écrite sur 2 chiffres (ex: 18/10/26), convertis-la en 2026.
5. "category" : Choisis impérativement l'une des 5 catégories suivantes :
   - "cremerie" : laits, beurres, crèmes, fromages, matières grasses laitières
   - "chocolat" : chocolats, cacaos, pralines, ganaches
   - "fruits" : fruits frais, surgelés, purées, compotes
   - "farine" : farines, sucres, levures, fécules, poudres
   - "oeufs" : œufs entiers, blancs, jaunes, ovoproduits
   Si incertain, sélectionne la catégorie la plus proche ou "cremerie".
6. "confidence" : Indice de confiance ("high", "medium", "low").

Renvoie UNIQUEMENT un objet JSON valide correspondant à ces champs, sans balises de code ni texte explicatif.`;

/** Extrait un objet JSON d'une réponse texte (tolère les balises Markdown résiduelles). */
function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Format JSON invalide dans la réponse du modèle');
    return JSON.parse(match[0]);
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Analyse d'images non configurée sur le serveur (variable OPENROUTER_API_KEY manquante)"
    });
  }

  try {
    const { image, mimeType = 'image/jpeg' } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Image manquante dans le corps de la requête.' });
    }

    // Nettoyage du préfixe data:image/...;base64, si présent
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // En-têtes recommandés par OpenRouter (attribution, sans effet sur le résultat)
        'HTTP-Referer': 'https://traqhaccp.vercel.app',
        'X-Title': 'TraqHACCP'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_VISION_MODEL || DEFAULT_MODEL,
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erreur OpenRouter:', response.status, errText);
      return res.status(response.status).json({
        error: `Erreur du service d'analyse d'images (${response.status})`,
        details: errText
      });
    }

    const result = await response.json();
    const candidateText = result.choices?.[0]?.message?.content;

    if (!candidateText) {
      return res.status(500).json({ error: "Aucune réponse d'extraction reçue du modèle." });
    }

    const parsed = parseJsonLoose(candidateText);

    return res.status(200).json({
      success: true,
      data: {
        name: parsed.name || '',
        supplier: parsed.supplier || '',
        lot: (parsed.lot || '').toUpperCase().trim(),
        dlcDate: parsed.dlcDate || '',
        category: CATEGORIES.includes(parsed.category) ? parsed.category : 'cremerie',
        confidence: parsed.confidence || 'medium'
      }
    });
  } catch (err) {
    console.error('Erreur traitement extraction étiquette:', err);
    return res.status(500).json({ error: err.message || 'Erreur interne lors de l’analyse' });
  }
}
