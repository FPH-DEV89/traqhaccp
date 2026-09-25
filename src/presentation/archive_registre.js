/**
 * TraqHACCP Pâtisserie — Édition de l'archive officielle du registre sanitaire (PDF).
 *
 * Assemble un document PDF opposable pour les contrôles officiels (DDPP) :
 *   - En-tête d'établissement et identification
 *   - Période couverte et date d'édition
 *   - Relevés détaillés par module HACCP (lots, DLC secondaires, témoins, ventes, brigade)
 *   - Synthèse chiffrée
 *   - Bloc de visa opérateur et responsable
 *   - Empreinte d'intégrité SHA-256
 *
 * Fonctionne 100% hors-ligne, sans dépendance externe, sans accès DOM ni state global.
 */
import { miseEnPage, horodatage, horodatageFichier } from './ddpp_report.js';

const {
  A4,
  NOIR,
  GRIS,
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
  dateCourte
} = miseEnPage;

const LARGEUR_UTILE = A4.largeur - A4.margeG - A4.margeD;

/**
 * Chaîne canonique déterministe (clés triées, séparateurs stables,
 * indépendante de l'ordre d'insertion) servant d'entrée au SHA-256.
 */
export function chargeCanonique(donnees = {}) {
  function normaliser(valeur) {
    if (valeur === null || typeof valeur !== 'object') {
      return valeur;
    }
    if (valeur instanceof Date) {
      return valeur.toISOString();
    }
    if (Array.isArray(valeur)) {
      return valeur.map(normaliser);
    }
    const objetTrie = {};
    const cles = Object.keys(valeur)
      .filter(cle => cle !== 'empreinte' && cle !== 'now' && typeof valeur[cle] !== 'function' && valeur[cle] !== undefined)
      .sort();
    for (const cle of cles) {
      objetTrie[cle] = normaliser(valeur[cle]);
    }
    return objetTrie;
  }
  return JSON.stringify(normaliser(donnees));
}

/**
 * Nom de fichier horodaté pour l'archive PDF.
 * Format : « traqhaccp-archive-registre-<du>_<au>-<horodatageFichier>.pdf »
 */
export function nomFichierArchive(periode = {}, date = new Date()) {
  const du = String(periode && periode.du ? periode.du : 'debut').slice(0, 10).replace(/[^a-zA-Z0-9-]/g, '');
  const au = String(periode && periode.au ? periode.au : 'fin').slice(0, 10).replace(/[^a-zA-Z0-9-]/g, '');
  const horodatageStr = horodatageFichier(date instanceof Date ? date : new Date());
  return `traqhaccp-archive-registre-${du}_${au}-${horodatageStr}.pdf`;
}

/**
 * Construit les octets du document PDF d'archive du registre sanitaire.
 *
 * @param {Object} donnees
 * @param {Object} donnees.etablissement - Coordonnées de l'établissement
 * @param {Array}  donnees.lots - Relevés de matières premières et traçabilité amont
 * @param {Array}  donnees.secondaryDlcs - Préparations secondaires et DLC dérivées
 * @param {Array}  donnees.witnessSamples - Échantillons témoins consignés
 * @param {Array}  donnees.salesHistory - Traçabilité descendante des ventes
 * @param {Array}  donnees.teamMembers - Membres de brigade et opérateurs déclarés
 * @param {Object} donnees.periode - { du: 'AAAA-MM-JJ', au: 'AAAA-MM-JJ' }
 * @param {Object} donnees.operateur - { nom: string, role: string }
 * @param {Object} donnees.responsable - { nom: string, role: string }
 * @param {string} donnees.empreinte - Empreinte hex SHA-256 (optionnelle)
 * @param {Date}   donnees.now - Date de référence pour l'édition
 * @returns {Uint8Array} Octets PDF
 */
export function construireArchiveRegistre(donnees = {}) {
  const etablissement = donnees.etablissement || {};
  const lots = donnees.lots || [];
  const preparations = donnees.secondaryDlcs || [];
  const temoins = donnees.witnessSamples || [];
  const ventes = donnees.salesHistory || [];
  const equipe = donnees.teamMembers || [];
  const periode = donnees.periode || {};
  const operateur = donnees.operateur || {};
  const responsable = donnees.responsable || {};
  const empreinte = typeof donnees.empreinte === 'string' ? donnees.empreinte.trim() : '';
  const maintenant = donnees.now instanceof Date ? donnees.now : new Date();

  const totalEnregistrements = lots.length + preparations.length + temoins.length + ventes.length + equipe.length;

  // 8. Pied de page
  const nomEtab = etablissement.name || 'Établissement';
  const periodePied = (periode.du && periode.au)
    ? `${dateCourte(periode.du)} / ${dateCourte(periode.au)}`
    : (periode.du ? `du ${dateCourte(periode.du)}` : (periode.au ? `au ${dateCourte(periode.au)}` : 'non précisée'));
  const dateEdition = horodatage(maintenant);

  const doc = creerDocument({
    piedGauche: `Archive du registre - ${nomEtab} - période ${periodePied} - éditée le ${dateEdition} - TraqHACCP Pâtisserie`
  });

  // 1. Bandeau
  ecrire(doc, 'TRAQHACCP PATISSERIE - REGISTRE SANITAIRE NUMERIQUE', { taille: 8, gras: true, couleur: VERT });
  ecrire(doc, 'ARCHIVE DU REGISTRE SANITAIRE', { taille: 14.5, gras: true });
  ecrire(doc, "Export d'archive destiné au contrôle sanitaire (DDPP) — document non modifiable après édition.", {
    taille: 8.6,
    couleur: GRIS,
    largeurMax: LARGEUR_UTILE
  });
  espace(doc, 3);
  trait(doc, { couleur: NOIR, epaisseur: 1.1 });
  espace(doc, 3);

  // 2. Identité établissement
  ecrire(doc, etablissement.name || 'Établissement non renseigné dans les réglages', { taille: 11, gras: true });

  const adresse = [
    etablissement.activity,
    [etablissement.address, [etablissement.postal, etablissement.city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ')
  ].filter(Boolean);
  if (adresse.length) paragraphe(doc, adresse.join(' - '), { taille: 8.6, couleur: GRIS });

  const administration = [];
  if (etablissement.siret) administration.push(`SIRET ${etablissement.siret}`);
  if (etablissement.agreement) administration.push(`Agrément sanitaire ${etablissement.agreement}`);
  if (etablissement.phone) administration.push(`Tél. ${etablissement.phone}`);
  if (etablissement.manager) administration.push(`Responsable ${etablissement.manager}`);
  paragraphe(
    doc,
    administration.length ? administration.join('  |  ') : "SIRET et agrément sanitaire non renseignés dans les réglages.",
    { taille: 8.6, couleur: GRIS }
  );
  espace(doc, 4);

  // 3. Encadré « Période couverte »
  const textePeriode = (periode.du && periode.au)
    ? `du ${dateCourte(periode.du)} au ${dateCourte(periode.au)}`
    : 'bornes non précisées';

  const opNom = operateur.nom || '';
  const opRole = operateur.role || '';
  const texteOperateur = (opNom || opRole)
    ? [opNom, opRole].filter(Boolean).join(' — ')
    : 'opérateur non identifié';

  encadre(doc, [
    { label: 'Période couverte', valeur: textePeriode },
    { label: 'Archive établie le', valeur: dateEdition },
    { label: 'Enregistrements inclus', valeur: String(totalEnregistrements) },
    { label: 'Archive établie par', valeur: texteOperateur }
  ]);
  espace(doc, 4);

  // 4. Modules HACCP
  // 4.1 Réception et traçabilité des lots
  titreSection(doc, '1. Réception et traçabilité des lots');
  tableau(
    doc,
    [
      { titre: 'Réception', cle: 'receiptDate', largeur: 1.1 },
      { titre: 'Lot', cle: 'lot', largeur: 1.3 },
      { titre: 'Produit', cle: 'name', largeur: 2.0, gras: true },
      { titre: 'Fournisseur', cle: 'supplier', largeur: 1.6 },
      { titre: 'DLC', cle: 'dlcDate', largeur: 1.1 },
      { titre: 'Temp. °C', cle: 'temp', largeur: 0.9, aligne: 'droite' },
      { titre: 'Opérateur', cle: 'operator', largeur: 1.3 }
    ],
    lots.map(l => ({
      receiptDate: dateCourte(l.receiptDate),
      lot: l.lot || '-',
      name: l.name || '-',
      supplier: l.supplier || '-',
      dlcDate: dateCourte(l.dlcDate),
      temp: Number.isFinite(Number(l.temp)) ? nombre(l.temp, 1) : (l.temp ? String(l.temp) : '-'),
      operator: l.operator || '-'
    }))
  );

  // 4.2 Préparations et DLC dérivées
  titreSection(doc, '2. Préparations et DLC dérivées');
  tableau(
    doc,
    [
      { titre: 'Date', cle: 'creationDate', largeur: 1.1 },
      { titre: 'Préparation', cle: 'name', largeur: 2.6, gras: true },
      { titre: 'DLC', cle: 'expiryDate', largeur: 1.1 },
      { titre: 'Opérateur', cle: 'operator', largeur: 1.8 }
    ],
    preparations.map(p => ({
      creationDate: dateCourte(p.creationDate),
      name: p.name || '-',
      expiryDate: dateCourte(p.expiryDate),
      operator: p.operator || '-'
    }))
  );

  // 4.3 Échantillons témoins
  titreSection(doc, '3. Échantillons témoins');
  tableau(
    doc,
    [
      { titre: 'Service', cle: 'serviceDate', largeur: 1.1 },
      { titre: 'Plat', cle: 'dishName', largeur: 2.5, gras: true },
      { titre: 'DLC', cle: 'expiryDate', largeur: 1.1 },
      { titre: 'Temp. °C', cle: 'temp', largeur: 1.0, aligne: 'droite' },
      { titre: 'Opérateur', cle: 'operator', largeur: 1.6 }
    ],
    temoins.map(t => ({
      serviceDate: dateCourte(t.serviceDate),
      dishName: t.dishName || '-',
      expiryDate: dateCourte(t.expiryDate),
      temp: t.temp ? (Number.isFinite(Number(t.temp)) ? nombre(t.temp, 1) : String(t.temp)) : '-',
      operator: t.operator || '-'
    }))
  );

  // 4.4 Traçabilité des ventes
  titreSection(doc, '4. Traçabilité des ventes');
  paragraphe(
    doc,
    'Ventes : enregistrements non filtrables par période (aucun champ date au registre). Tableau exhaustif.',
    { taille: 8.2, couleur: GRIS }
  );
  espace(doc, 2);
  tableau(
    doc,
    [
      { titre: 'Réf.', cle: 'id', largeur: 1.0 },
      { titre: 'Heure', cle: 'time', largeur: 0.8 },
      { titre: 'Recette', cle: 'recipeName', largeur: 2.0, gras: true },
      { titre: 'Canal', cle: 'channel', largeur: 1.2 },
      { titre: 'Qté', cle: 'qty', largeur: 0.6, aligne: 'droite' },
      { titre: 'Lots utilisés', cle: 'lotsUsed', largeur: 2.2 }
    ],
    ventes.map(v => ({
      id: v.id || '-',
      time: v.time || '-',
      recipeName: v.recipeName || '-',
      channel: v.channel || '-',
      qty: String(v.qty ?? '-'),
      lotsUsed: Array.isArray(v.lotsUsed) ? v.lotsUsed.join(', ') : (v.lotsUsed || '-')
    }))
  );

  // 4.5 Opérateurs habilités
  titreSection(doc, '5. Opérateurs habilités');
  tableau(
    doc,
    [
      { titre: 'Nom', cle: 'nom', largeur: 2.4, gras: true },
      { titre: 'Rôle', cle: 'role', largeur: 2.2 },
      { titre: 'Habilitation', cle: 'joinedDate', largeur: 1.3 },
      { titre: 'Statut', cle: 'statut', largeur: 1.2, couleur: l => l.couleurStatut }
    ],
    equipe.map(m => {
      const nomComplet = `${m.firstName || ''} ${m.lastName || ''}`.trim();
      const actif = m.active !== false;
      return {
        nom: nomComplet || m.role || '-',
        role: m.role || '-',
        joinedDate: dateCourte(m.joinedDate),
        statut: actif ? 'Actif' : 'Inactif',
        couleurStatut: actif ? VERT : GRIS
      };
    })
  );

  // 5. Encadré « Synthèse de l'archive »
  titreSection(doc, "6. Synthèse de l'archive");
  encadre(doc, [
    { label: 'Lots de matières premières (réceptions)', valeur: String(lots.length) },
    { label: 'Préparations et DLC dérivées', valeur: String(preparations.length) },
    { label: 'Échantillons témoins consignés', valeur: String(temoins.length) },
    { label: 'Traçabilité des ventes (exhaustif)', valeur: String(ventes.length) },
    { label: 'Opérateurs habilités', valeur: String(equipe.length) },
    { label: 'Total des enregistrements inclus', valeur: String(totalEnregistrements), couleur: VERT },
    { label: 'Période couverte', valeur: textePeriode }
  ]);

  // 6. Bloc de signatures (deux visa, sur la même page)
  espace(doc, 8);
  if (doc.y - 200 < A4.margeB) {
    nouvellePage(doc);
  }

  const nomOpSignature = operateur.nom || '..............................................................';
  const roleOpSignature = operateur.role || 'Opérateur';
  ecrire(doc, `Opérateur / Établissant : ${nomOpSignature} — ${roleOpSignature}`, { taille: 9.5, gras: true });
  espace(doc, 4);
  ecrire(doc, 'Fait à ......................................., le ...../...../...........', { taille: 9.5 });
  espace(doc, 6);
  ecrire(doc, 'Signature :', { taille: 9.5 });
  espace(doc, 14);
  ecrire(doc, '..............................................................', { taille: 9.5, couleur: TRAIT });

  espace(doc, 10);

  const nomRespSignature = responsable.nom || etablissement.manager || '..............................................................';
  const roleRespSignature = responsable.role || "Responsable d'établissement";
  ecrire(doc, `Responsable d'établissement : ${nomRespSignature} — ${roleRespSignature}`, { taille: 9.5, gras: true });
  espace(doc, 4);
  ecrire(doc, 'Fait à ......................................., le ...../...../...........', { taille: 9.5 });
  espace(doc, 6);
  ecrire(doc, 'Signature :', { taille: 9.5 });
  espace(doc, 14);
  ecrire(doc, '..............................................................', { taille: 9.5, couleur: TRAIT });

  // 7. Encadré « Empreinte d'intégrité »
  espace(doc, 10);
  if (doc.y - 70 < A4.margeB) {
    nouvellePage(doc);
  }

  trait(doc, { couleur: TRAIT, epaisseur: 0.8 });
  espace(doc, 2);
  ecrire(doc, "Empreinte d'intégrité SHA-256", { taille: 9, gras: true, couleur: NOIR });
  espace(doc, 2);

  if (empreinte) {
    const nettoyee = empreinte.toLowerCase().replace(/[^a-f0-9]/g, '');
    const groupes = nettoyee.match(/.{1,8}/g);
    const hexGroupe = groupes ? groupes.join(' ') : nettoyee;
    paragraphe(doc, `Empreinte SHA-256 des enregistrements : ${hexGroupe}`, { taille: 8.5 });
  } else {
    paragraphe(doc, 'Empreinte non calculée : contexte non sécurisé (crypto.subtle indisponible).', {
      taille: 8.5,
      couleur: GRIS
    });
  }
  espace(doc, 2);
  paragraphe(
    doc,
    "Cette empreinte atteste l'intégrité du contenu exporté au moment de l'édition. Elle ne constitue pas une signature numérique et n'a pas de valeur légale de signature électronique.",
    { taille: 8, couleur: GRIS }
  );
  espace(doc, 2);
  trait(doc, { couleur: TRAIT, epaisseur: 0.8 });

  // 9. Sérialisation
  return serialiserPdf(doc);
}
