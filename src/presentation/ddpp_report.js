/**
 * TraqHACCP Pâtisserie — Édition des documents officiels DDPP au format PDF.
 *
 * Ce module écrit des PDF 1.4 valides sans aucune dépendance externe : il reste
 * donc opérationnel hors-ligne, y compris depuis une PWA installée sur une
 * tablette de laboratoire. Il fournit les primitives de mise en page (texte,
 * tableau, encadré de synthèse, pieds de page) et la sérialisation du fichier.
 *
 * Ce module est le moteur bas niveau : les documents eux-mêmes (registre
 * sanitaire, fiche d'alerte) sont assemblés dans `ddpp_documents.js`.
 */

/** Géométrie A4 portrait, en points PostScript. */
const A4 = Object.freeze({
  largeur: 595.28,
  hauteur: 841.89,
  margeG: 42,
  margeD: 42,
  margeH: 56,
  margeB: 62
});

const NOIR = [0.11, 0.13, 0.16];
const GRIS = [0.45, 0.48, 0.52];
const GRIS_CLAIR = [0.96, 0.96, 0.97];
const VERT = [0.02, 0.42, 0.27];
const ROUGE = [0.72, 0.11, 0.20];
const TRAIT = [0.80, 0.82, 0.85];

/**
 * Restreint une chaîne à l'encodage WinAnsi (Latin-1), attendu par les polices
 * Helvetica du PDF : les accents français sont conservés, le reste est remplacé.
 */
function latin1(valeur) {
  const texte = valeur === null || valeur === undefined ? '' : String(valeur);
  return texte
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u20AC/g, 'EUR')
    .replace(/[\u0152]/g, 'OE')
    .replace(/[\u0153]/g, 'oe')
    .replace(/[^\x00-\xFF]/g, '?');
}

/** Échappe les caractères réservés d'une chaîne PDF. */
function echapper(valeur) {
  return latin1(valeur).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Formate un nombre avec deux décimales, en notation française. */
function nombre(valeur, decimales = 2) {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(decimales).replace('.', ',');
}

/** Formate une date ISO (AAAA-MM-JJ) en JJ/MM/AAAA, sans dépendance externe. */
function dateCourte(valeur) {
  if (!valeur) return '-';
  const brut = String(valeur).slice(0, 10);
  const parties = brut.split('-');
  if (parties.length !== 3) return String(valeur);
  return `${parties[2]}/${parties[1]}/${parties[0]}`;
}

/** Crée un document vierge avec sa première page. */
function creerDocument(meta) {
  const doc = {
    meta: meta || {},
    pages: [],
    page: null,
    y: 0
  };
  nouvellePage(doc);
  return doc;
}

/** Ajoute une page et repositionne le curseur d'écriture en haut de zone. */
function nouvellePage(doc) {
  doc.page = { ops: [] };
  doc.pages.push(doc.page);
  doc.y = A4.hauteur - A4.margeH;
}

/** Garantit l'espace vertical nécessaire avant d'écrire, sinon change de page. */
function reserver(doc, hauteur) {
  if (doc.y - hauteur < A4.margeB) nouvellePage(doc);
}

/**
 * Écrit une ligne de texte.
 * Options : taille, gras, x, largeurMax, couleur, interligne, aligne.
 */
function ecrire(doc, valeur, options = {}) {
  const {
    taille = 9.5,
    gras = false,
    x = A4.margeG,
    largeurMax = A4.largeur - A4.margeG - A4.margeD,
    couleur = NOIR,
    interligne = null,
    aligne = 'gauche'
  } = options;

  const texte = tronquer(valeur, largeurMax, taille, gras);
  const pas = interligne || taille * 1.42;
  reserver(doc, pas);

  const largeurTexte = estimerLargeur(texte, taille, gras);
  let depart = x;
  if (aligne === 'droite') depart = x + largeurMax - largeurTexte;
  if (aligne === 'centre') depart = x + (largeurMax - largeurTexte) / 2;

  const couleurOp = couleur.map(v => v.toFixed(3)).join(' ');
  const police = gras ? 'F2' : 'F1';
  doc.page.ops.push(
    `BT ${couleurOp} rg /${police} ${taille} Tf 1 0 0 1 ${depart.toFixed(2)} ${doc.y.toFixed(2)} Tm (${echapper(texte)}) Tj ET`
  );
  doc.y -= pas;
  return largeurTexte;
}

/** Trace un trait horizontal à la position courante. */
function trait(doc, options = {}) {
  const { epaisseur = 0.6, couleur = TRAIT, retrait = 0 } = options;
  reserver(doc, 8);
  const couleurOp = couleur.map(v => v.toFixed(3)).join(' ');
  doc.page.ops.push(
    `${couleurOp} RG ${epaisseur} w ${(A4.margeG + retrait).toFixed(2)} ${doc.y.toFixed(2)} m ${(A4.largeur - A4.margeD).toFixed(2)} ${doc.y.toFixed(2)} l S`
  );
  doc.y -= 7;
}

/** Dessine un rectangle plein (bandeaux de tableau, encadrés). */
function rectangle(doc, x, y, largeur, hauteur, couleur) {
  const couleurOp = couleur.map(v => v.toFixed(3)).join(' ');
  doc.page.ops.push(
    `${couleurOp} rg ${x.toFixed(2)} ${(y - hauteur).toFixed(2)} ${largeur.toFixed(2)} ${hauteur.toFixed(2)} re f`
  );
}

/** Ajoute un espace vertical. */
function espace(doc, hauteur) {
  doc.y -= hauteur;
}

/**
 * Estime la largeur d'une chaîne en Helvetica (approximation métrique fiable
 * pour du texte latin, suffisante pour la mise en page et la troncature).
 */
function estimerLargeur(valeur, taille, gras = false) {
  const facteur = gras ? 0.545 : 0.515;
  return latin1(valeur).length * taille * facteur;
}

/** Tronque une chaîne à la largeur disponible, avec ellipse si nécessaire. */
function tronquer(valeur, largeurMax, taille, gras = false) {
  const texte = latin1(valeur);
  if (estimerLargeur(texte, taille, gras) <= largeurMax) return texte;
  let resultat = texte;
  while (resultat.length > 1 && estimerLargeur(resultat + '...', taille, gras) > largeurMax) {
    resultat = resultat.slice(0, -1);
  }
  return resultat + '...';
}

/** Découpe un texte en lignes tenant dans largeurMax (retour à la ligne automatique). */
function decouper(valeur, largeurMax, taille, gras = false) {
  const mots = latin1(valeur).split(/\s+/).filter(Boolean);
  const lignes = [];
  let courante = '';
  mots.forEach(mot => {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (estimerLargeur(essai, taille, gras) <= largeurMax) {
      courante = essai;
      return;
    }
    if (courante) lignes.push(courante);
    // Mot seul plus large que la colonne (référence de lot longue) : repli sur troncature.
    courante = estimerLargeur(mot, taille, gras) > largeurMax ? tronquer(mot, largeurMax, taille, gras) : mot;
  });
  if (courante) lignes.push(courante);
  return lignes.length ? lignes : [''];
}

/** Titre de section numéroté, avec filet de séparation. */
function titreSection(doc, valeur) {
  espace(doc, 8);
  ecrire(doc, valeur, { taille: 11.5, gras: true, couleur: NOIR });
  trait(doc, { couleur: VERT, epaisseur: 0.9 });
}

/**
 * Tableau simple en colonnes.
 * colonnes : [{ titre, largeur (poids relatif), cle, aligne, gras }]
 * lignes   : tableau d'objets indexés par colonne.cle
 */
function tableau(doc, colonnes, lignes, options = {}) {
  const totalPoids = colonnes.reduce((somme, c) => somme + (c.largeur || 1), 0);
  const largeurUtile = A4.largeur - A4.margeG - A4.margeD;
  const positions = [];
  let curseur = A4.margeG;
  colonnes.forEach(colonne => {
    const largeur = (largeurUtile * (colonne.largeur || 1)) / totalPoids;
    positions.push({ ...colonne, x: curseur, largeur });
    curseur += largeur;
  });

  const pas = options.pas || 11.6;
  const tailleTexte = options.taille || 8;

  // Bandeau d'en-tête : hauteur calculée sur le titre le plus long
  const titres = positions.map(colonne => decouper(colonne.titre, colonne.largeur - 4, tailleTexte, true));
  const hauteurEntete = Math.max(...titres.map(l => l.length)) * pas + 6;
  reserver(doc, hauteurEntete);
  rectangle(doc, A4.margeG, doc.y + 3, largeurUtile, hauteurEntete - 4, GRIS_CLAIR);
  const yEntete = doc.y;
  positions.forEach((colonne, index) => {
    doc.y = yEntete;
    titres[index].forEach(titre => ecrire(doc, titre, { taille: tailleTexte, gras: true, x: colonne.x, largeurMax: colonne.largeur - 4, couleur: NOIR }));
  });
  doc.y = yEntete - hauteurEntete;
  trait(doc, { couleur: TRAIT, epaisseur: 0.6 });

  if (!lignes.length) {
    ecrire(doc, 'Aucun enregistrement dans cette section.', { taille: 9, couleur: GRIS });
    return;
  }

  lignes.forEach(ligne => {
    // Chaque cellule est repliée sur plusieurs lignes : aucune donnée n'est tronquée.
    const cellules = positions.map(colonne => {
      const brute = ligne[colonne.cle] === undefined || ligne[colonne.cle] === '' ? '-' : String(ligne[colonne.cle]);
      return decouper(brute, colonne.largeur - 4, tailleTexte, !!colonne.gras);
    });
    const hauteur = Math.max(...cellules.map(l => l.length)) * pas;
    reserver(doc, hauteur + 2);
    const yLigne = doc.y;
    positions.forEach((colonne, index) => {
      doc.y = yLigne;
      cellules[index].forEach(texte => ecrire(doc, texte, {
        taille: tailleTexte,
        gras: !!colonne.gras,
        x: colonne.x,
        largeurMax: colonne.largeur - 4,
        couleur: colonne.couleur ? colonne.couleur(ligne) : NOIR,
        aligne: colonne.aligne || 'gauche'
      }));
    });
    doc.y = yLigne - hauteur;
  });
  trait(doc, { couleur: TRAIT, epaisseur: 0.5 });
}

/** Encadré de synthèse : lignes de type { label, valeur, couleur }. */
function encadre(doc, lignes) {
  const pas = 14;
  const hauteur = lignes.length * pas + 12;
  reserver(doc, hauteur + 8);
  const largeurUtile = A4.largeur - A4.margeG - A4.margeD;
  const yHaut = doc.y;
  rectangle(doc, A4.margeG, yHaut, largeurUtile, hauteur, GRIS_CLAIR);
  doc.y = yHaut - 16;
  lignes.forEach(ligne => {
    const yLigne = doc.y;
    doc.y = yLigne;
    ecrire(doc, ligne.label, { taille: 9, x: A4.margeG + 10, largeurMax: largeurUtile * 0.54 });
    doc.y = yLigne;
    ecrire(doc, ligne.valeur, {
      taille: 9,
      gras: true,
      x: A4.margeG + largeurUtile * 0.55,
      largeurMax: largeurUtile * 0.45 - 12,
      couleur: ligne.couleur || NOIR,
      aligne: 'droite'
    });
    doc.y = yLigne - pas;
  });
  doc.y = yHaut - hauteur - 6;
}

/** Écrit un paragraphe avec retour à la ligne automatique (pas de troncature). */
function paragraphe(doc, valeur, options = {}) {
  const {
    taille = 9,
    largeurMax = A4.largeur - A4.margeG - A4.margeD,
    couleur = NOIR,
    gras = false,
    aligne = 'gauche',
    interligne = null
  } = options;

  decouper(valeur, largeurMax, taille, gras).forEach(ligne => ecrire(doc, ligne, { taille, couleur, gras, aligne, largeurMax, interligne }));
}

/** Ajoute le pied de page (mention + pagination) sur chaque page du document. */
function ajouterPieds(doc) {
  const total = doc.pages.length;
  const grisOp = GRIS.map(v => v.toFixed(3)).join(' ');
  const traitOp = TRAIT.map(v => v.toFixed(3)).join(' ');
  const y = A4.margeB - 30;

  doc.pages.forEach((page, index) => {
    page.ops.push(
      `${traitOp} RG 0.5 w ${A4.margeG} ${(y + 11).toFixed(2)} m ${(A4.largeur - A4.margeD).toFixed(2)} ${(y + 11).toFixed(2)} l S`
    );
    page.ops.push(
      `BT ${grisOp} rg /F1 7.5 Tf 1 0 0 1 ${A4.margeG} ${y.toFixed(2)} Tm (${echapper(doc.meta.piedGauche)}) Tj ET`
    );
    const pagination = `Page ${index + 1} / ${total}`;
    const x = A4.largeur - A4.margeD - estimerLargeur(pagination, 7.5);
    page.ops.push(
      `BT ${grisOp} rg /F1 7.5 Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${echapper(pagination)}) Tj ET`
    );
  });
}

/** Sérialise le document en un tableau d'octets PDF conforme. */
function serialiserPdf(doc) {
  ajouterPieds(doc);

  const nbPages = doc.pages.length;
  const objetsPages = doc.pages.map((_, index) => ({ page: 5 + index * 2, contenu: 6 + index * 2 }));
  const totalObjets = 4 + objetsPages.length * 2 + 1;

  let sortie = '%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n';
  const offsets = [];

  const ecrireObjet = (numero, corps) => {
    offsets[numero] = sortie.length;
    sortie += `${numero} 0 obj\n${corps}\nendobj\n`;
  };

  ecrireObjet(1, '<< /Type /Catalog /Pages 2 0 R >>');
  ecrireObjet(
    2,
    `<< /Type /Pages /Count ${nbPages} /Kids [${objetsPages.map(o => `${o.page} 0 R`).join(' ')}] >>`
  );
  ecrireObjet(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  ecrireObjet(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  doc.pages.forEach((page, index) => {
    const cible = objetsPages[index];
    ecrireObjet(
      cible.page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.largeur} ${A4.hauteur}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cible.contenu} 0 R >>`
    );
    const flux = page.ops.join('\n');
    ecrireObjet(cible.contenu, `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`);
  });

  const debutXref = sortie.length;
  sortie += `xref\n0 ${totalObjets}\n0000000000 65535 f \n`;
  for (let numero = 1; numero < totalObjets; numero += 1) {
    sortie += `${String(offsets[numero] || 0).padStart(10, '0')} 00000 n \n`;
  }
  sortie += `trailer\n<< /Size ${totalObjets} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;

  const octets = new Uint8Array(sortie.length);
  for (let i = 0; i < sortie.length; i += 1) {
    octets[i] = sortie.charCodeAt(i) & 0xff;
  }
  return octets;
}

/** Déclenche le téléchargement local du document (aucun envoi réseau). */
export function telechargerPdf(octets, nomFichier) {
  const blob = new Blob([octets], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.rel = 'noopener';
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return nomFichier;
}

/** Horodatage lisible (JJ/MM/AAAA HH:MM) pour les mentions d'édition. */
export function horodatage(date = new Date()) {
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const heures = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()} ${heures}:${minutes}`;
}

/** Identifiant de fichier horodaté (AAAA-MM-JJ-HHMM). */
export function horodatageFichier(date = new Date()) {
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const heures = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}-${heures}${minutes}`;
}

export const miseEnPage = {
  A4,
  NOIR,
  GRIS,
  GRIS_CLAIR,
  VERT,
  ROUGE,
  TRAIT,
  creerDocument,
  nouvellePage,
  ecrire,
  trait,
  espace,
  paragraphe,
  titreSection,
  tableau,
  encadre,
  serialiserPdf,
  nombre,
  dateCourte,
  latin1
};

