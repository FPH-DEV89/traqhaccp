/**
 * /api/extract-label.js
 * Fonction Serverless Vercel (Node.js ES Module).
 * Analyse une étiquette alimentaire ou emballage sanitaire avec Google Gemini Flash
 * pour extraire automatiquement les informations de traçabilité HACCP.
 */
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Clé API Gemini non configurée sur le serveur (variable GEMINI_API_KEY manquante)' 
    });
  }

  try {
    const { image, mimeType = 'image/jpeg' } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Image manquante dans le corps de la requête.' });
    }

    // Nettoyage du préfixe data:image/...;base64, si présent
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');

    const systemPrompt = `Tu es un assistant expert HACCP et traçabilité pour les professionnels de la restauration et de la pâtisserie.
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erreur Gemini API:', response.status, errText);
      return res.status(response.status).json({ 
        error: `Erreur API Gemini (${response.status})`, 
        details: errText 
      });
    }

    const result = await response.json();
    const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({ error: "Aucune réponse d'extraction reçue du modèle." });
    }

    let parsed;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Format JSON invalide dans la réponse du modèle");
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        name: parsed.name || '',
        supplier: parsed.supplier || '',
        lot: (parsed.lot || '').toUpperCase().trim(),
        dlcDate: parsed.dlcDate || '',
        category: ['cremerie', 'chocolat', 'fruits', 'farine', 'oeufs'].includes(parsed.category) 
          ? parsed.category 
          : 'cremerie',
        confidence: parsed.confidence || 'medium'
      }
    });
  } catch (err) {
    console.error('Erreur traitement extraction étiquette:', err);
    return res.status(500).json({ error: err.message || 'Erreur interne lors de l’analyse' });
  }
}
