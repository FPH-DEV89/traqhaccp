/**
 * TraqHACCP Pâtisserie — Assemblage des documents officiels remis à la DDPP.
 *
 * Deux documents client-ready sont produits à partir du registre numérique :
 *   - `construireRegistreDdpp` : le registre sanitaire consolidé (synthèse de
 *     conformité, réceptions, DLC dérivées, échantillons témoins, traçabilité
 *     descendante, opérateurs, bloc de signature) ;
 *   - `construireFicheAlerteRecherche` : la fiche d'alerte / rappel client
 *     d'un lot investigué (clients à prévenir, préparations à retirer,
 *     consignes officielles).
 *
 * Aucune donnée n'est envoyée sur le réseau : les octets PDF sont assemblés
 * localement puis téléchargés par le navigateur.
 */
import { NORMS } from '../domain/haccp_norms.js';
import { miseEnPage, horodatage, horodatageFichier } from './ddpp_report.js';

const {
  A4,
  NOIR,
  GRIS,
  VERT,
  ROUGE,
  creerDocument,
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

const MENTION_EDITEUR =
  "Document édité automatiquement par TraqHACCP Pâtisserie depuis le registre numérique de l'établissement.";

/** Date du jour au format ISO court (AAAA-MM-JJ). */
function jourIso(date = new Date()) {
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/** Vrai si la date fournie est antérieure à la date de référence. */
function estDepassee(valeur, reference) {
  if (!valeur) return false;
  return String(valeur).slice(0, 10) < reference;
}

/** Écrit l'en-tête commun : identité de l'éditeur puis de l'établissement. */
function enTete(doc, { titre, sousTitre, etablissement = {}, dateEdition }) {
  ecrire(doc, 'TRAQHACCP PATISSERIE - REGISTRE SANITAIRE NUMERIQUE', { taille: 8, gras: true, couleur: VERT });
  ecrire(doc, titre, { taille: 14.5, gras: true });
  ecrire(doc, sousTitre, { taille: 8.6, couleur: GRIS, largeurMax: LARGEUR_UTILE });
  espace(doc, 3);
  trait(doc, { couleur: NOIR, epaisseur: 1.1 });
  espace(doc, 3);

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

  paragraphe(doc, `Document édité le ${dateEdition}. ${MENTION_EDITEUR}`, { taille: 8.2, couleur: GRIS });
  espace(doc, 2);
}

/** Bloc de signature manuscrite du responsable d'établissement. */
function blocSignature(doc) {
  espace(doc, 10);
  ecrire(doc, 'Fait à ......................................., le ...../...../...........', { taille: 9.5 });
  espace(doc, 16);
  ecrire(doc, 'Nom et qualité du responsable : ..............................................................', {
    taille: 9.5
  });
  espace(doc, 16);
  ecrire(doc, 'Signature et cachet :', { taille: 9.5 });
}

/** Registre sanitaire consolidé — export « Audit DDPP ». */
export function construireRegistreDdpp(donnees = {}) {
  const lots = donnees.lots || [];
  const preparations = donnees.secondaryDlcs || [];
  const temoins = donnees.witnessSamples || [];
  const ventes = donnees.salesHistory || [];
  const equipe = donnees.teamMembers || [];
  const etablissement = donnees.etablissement || {};
  const maintenant = donnees.now instanceof Date ? donnees.now : new Date();
  const reference = jourIso(maintenant);
  const dateEdition = horodatage(maintenant);
  const nomEtablissement = etablissement.name || 'Établissement';

  const doc = creerDocument({
    piedGauche: `Registre sanitaire - ${nomEtablissement} - édité le ${dateEdition} - TraqHACCP Pâtisserie`
  });

  enTete(doc, {
    titre: "REGISTRE SANITAIRE D'ÉTABLISSEMENT",
    sousTitre:
      'Dossier de contrôle : traçabilité amont et aval, maîtrise des températures, DLC dérivées et échantillons témoins.',
    etablissement,
    dateEdition
  });

  titreSection(doc, '1. Synthèse de conformité');
  const nonConformes = lots.filter(l => l.status && l.status !== 'conforme').length;
  const dlcDepassees = lots.filter(l => estDepassee(l.dlcDate, reference)).length;
  const sansTemperature = lots.filter(l => !Number.isFinite(Number(l.temp))).length;
  const secondairesValides = preparations.filter(p => !estDepassee(p.expiryDate, reference)).length;
  const temoinsValides = temoins.filter(t => !estDepassee(t.expiryDate, reference)).length;
  const montantVentes = ventes.reduce((cumul, vente) => cumul + (Number(vente.totalTTC) || 0), 0);

  encadre(doc, [
    { label: 'Lots de matières premières enregistrés', valeur: String(lots.length) },
    {
      label: 'Lots signalés non conformes',
      valeur: `${nonConformes} / ${lots.length}`,
      couleur: nonConformes ? ROUGE : VERT
    },
    {
      label: 'Lots dont la DLC est dépassée',
      valeur: `${dlcDepassees} / ${lots.length}`,
      couleur: dlcDepassees ? ROUGE : VERT
    },
    {
      label: 'Réceptions sans température relevée',
      valeur: `${sansTemperature} / ${lots.length}`,
      couleur: sansTemperature ? ROUGE : VERT
    },
    {
      label: 'Préparations secondaires en cours de validité',
      valeur: `${secondairesValides} / ${preparations.length}`
    },
    { label: 'Échantillons témoins en conservation', valeur: `${temoinsValides} / ${temoins.length}` },
    { label: 'Déstockages clients enregistrés', valeur: String(ventes.length) },
    { label: 'Montant TTC déstocké', valeur: `${nombre(montantVentes)} EUR` },
    { label: "Opérateurs déclarés dans l'équipe", valeur: String(equipe.length) }
  ]);

  paragraphe(
    doc,
    `Durée de conservation réglementaire des enregistrements : ${NORMS.retentionYears} ans minimum ` +
      '(règlement (CE) n° 852/2004, annexe II, chapitre IX).',
    { taille: 8.2, couleur: GRIS }
  );
  espace(doc, 4);

  titreSection(doc, '2. Registre des réceptions et des stocks');
  tableau(
    doc,
    [
      { titre: 'Matière', cle: 'name', largeur: 2, gras: true },
      { titre: 'Fournisseur', cle: 'supplier', largeur: 1.7 },
      { titre: 'N° de lot', cle: 'lot', largeur: 1.3 },
      { titre: 'Réception', cle: 'receiptDate', largeur: 1 },
      { titre: 'DLC', cle: 'dlcDate', largeur: 1 },
      { titre: 'T° (°C)', cle: 'temp', largeur: 0.9, aligne: 'droite' },
      { titre: 'Stock restant', cle: 'stock', largeur: 1.2, aligne: 'droite' },
      { titre: 'Statut', cle: 'statut', largeur: 1.3, couleur: ligne => ligne.couleurStatut }
    ],
    lots.map(lot => ({
      name: lot.name,
      supplier: lot.supplier,
      lot: lot.lot,
      receiptDate: dateCourte(lot.receiptDate),
      dlcDate: dateCourte(lot.dlcDate),
      temp: Number.isFinite(Number(lot.temp)) ? nombre(lot.temp, 1) : 'non relevée',
      stock: `${nombre(lot.stockQty, 2)} ${lot.stockUnit || ''}`.trim(),
      statut: lot.status === 'conforme' ? 'Conforme' : lot.status || 'À vérifier',
      couleurStatut: lot.status === 'conforme' ? VERT : ROUGE
    }))
  );

  titreSection(doc, '3. Préparations secondaires — DLC dérivées');
  tableau(
    doc,
    [
      { titre: 'Préparation', cle: 'name', largeur: 2.2, gras: true },
      { titre: 'Lot parent', cle: 'parentLot', largeur: 1.4 },
      { titre: 'Type', cle: 'type', largeur: 1.5 },
      { titre: 'Préparée le', cle: 'creationDate', largeur: 1.1 },
      { titre: 'DLC dérivée', cle: 'expiryDate', largeur: 1.1 },
      { titre: 'Opérateur', cle: 'operator', largeur: 1.4 },
      { titre: 'État', cle: 'etat', largeur: 1.2, couleur: ligne => ligne.couleurEtat }
    ],
    preparations.map(preparation => {
      const depassee = estDepassee(preparation.expiryDate, reference);
      return {
        name: preparation.name,
        parentLot: preparation.parentLot,
        type: preparation.type,
        creationDate: dateCourte(preparation.creationDate),
        expiryDate: dateCourte(preparation.expiryDate),
        operator: preparation.operator,
        etat: depassee ? 'DLC dépassée' : 'En cours',
        couleurEtat: depassee ? ROUGE : VERT
      };
    })
  );

  titreSection(doc, '4. Échantillons témoins (conservation 5 jours après service)');
  tableau(
    doc,
    [
      { titre: 'Plat témoin', cle: 'dishName', largeur: 2.2, gras: true },
      { titre: 'Service', cle: 'service', largeur: 1.4 },
      { titre: 'Jour de service', cle: 'serviceDate', largeur: 1.3 },
      { titre: 'Fin de conservation', cle: 'expiryDate', largeur: 1.3 },
      { titre: 'T° relevée', cle: 'temp', largeur: 1, aligne: 'droite' },
      { titre: 'État', cle: 'etat', largeur: 1.4, couleur: ligne => ligne.couleurEtat }
    ],
    temoins.map(temoin => {
      const conserve = !estDepassee(temoin.expiryDate, reference);
      return {
        dishName: temoin.dishName,
        service: temoin.service,
        serviceDate: dateCourte(temoin.serviceDate),
        expiryDate: dateCourte(temoin.expiryDate),
        temp: Number.isFinite(Number(temoin.temp)) ? `${nombre(temoin.temp, 1)} °C` : 'non relevée',
        etat: conserve ? 'Conservé' : 'Conservation terminée',
        couleurEtat: conserve ? VERT : GRIS
      };
    })
  );

  titreSection(doc, '5. Traçabilité descendante — déstockages clients');
  tableau(
    doc,
    [
      { titre: 'Heure', cle: 'time', largeur: 0.8 },
      { titre: 'Produit', cle: 'recipeName', largeur: 1.7, gras: true },
      { titre: 'Qté', cle: 'qty', largeur: 0.6, aligne: 'droite' },
      { titre: 'Client', cle: 'customerName', largeur: 1.6 },
      { titre: 'Téléphone', cle: 'customerPhone', largeur: 1.3 },
      { titre: 'Référence', cle: 'orderRef', largeur: 1.7 },
      { titre: 'Lots consommés', cle: 'lotsUsed', largeur: 1.9 },
      { titre: 'Montant TTC', cle: 'montant', largeur: 1.1, aligne: 'droite' }
    ],
    ventes.map(vente => ({
      time: vente.time,
      recipeName: vente.recipeName,
      qty: String(vente.qty === undefined ? '' : vente.qty),
      customerName: vente.customerName,
      customerPhone: vente.customerPhone,
      orderRef: vente.orderRef,
      lotsUsed: Array.isArray(vente.lotsUsed) ? vente.lotsUsed.join(', ') : vente.lotsUsed,
      montant: `${nombre(vente.totalTTC)} EUR`
    }))
  );

  titreSection(doc, '6. Opérateurs déclarés dans le registre');
  tableau(
    doc,
    [
      { titre: 'Nom', cle: 'nom', largeur: 2.4, gras: true },
      { titre: 'Initiales', cle: 'initials', largeur: 1.2 },
      { titre: 'Fonction', cle: 'role', largeur: 2.4 },
      { titre: 'Depuis le', cle: 'joinedDate', largeur: 1.4 },
      { titre: 'Statut', cle: 'statut', largeur: 1.4, couleur: ligne => ligne.couleurStatut }
    ],
    equipe.map(membre => ({
      nom: `${membre.firstName || ''} ${membre.lastName || ''}`.trim(),
      initials: membre.initials,
      role: membre.role,
      joinedDate: dateCourte(membre.joinedDate),
      statut: membre.active === false ? 'Inactif' : 'Actif',
      couleurStatut: membre.active === false ? GRIS : VERT
    }))
  );

  titreSection(doc, '7. Mentions et signature');
  paragraphe(
    doc,
    "Ce document est l'édition officielle du registre numérique tenu par l'établissement. Les enregistrements " +
      "d'origine restent consultables dans l'application, sur l'appareil utilisé en production, et sont conservés " +
      `au minimum ${NORMS.retentionYears} ans.`,
    { taille: 9 }
  );
  espace(doc, 3);
  paragraphe(
    doc,
    'Chaque ligne du registre permet de remonter du produit vendu vers le fournisseur (traçabilité amont) et du ' +
      'lot reçu vers les clients servis (traçabilité descendante), conformément aux obligations de l\'arrêté du ' +
      '21 décembre 2009 et du règlement (CE) n° 852/2004.',
    { taille: 9 }
  );
  blocSignature(doc);

  return serialiserPdf(doc);
}

/** Fiche d'alerte / rappel client pour un lot investigué. */
export function construireFicheAlerteRecherche(donnees = {}) {
  const etablissement = donnees.etablissement || {};
  const recherche = String(donnees.recherche || '').trim();
  const lot = donnees.lot || null;
  const preparations = donnees.preparations || [];
  const ventes = donnees.ventes || [];
  const maintenant = donnees.now instanceof Date ? donnees.now : new Date();
  const reference = jourIso(maintenant);
  const dateEdition = horodatage(maintenant);
  const nomEtablissement = etablissement.name || 'Établissement';
  const quantiteTotale = ventes.reduce((cumul, vente) => cumul + (Number(vente.qty) || 0), 0);

  const doc = creerDocument({
    piedGauche: `Fiche d'alerte lot ${recherche || '-'} - ${nomEtablissement} - édité le ${dateEdition}`
  });

  enTete(doc, {
    titre: "FICHE D'ALERTE SANITAIRE — RAPPEL DE LOTS",
    sousTitre:
      'Traçabilité descendante : identification des clients à prévenir et des préparations à retirer de la vente.',
    etablissement,
    dateEdition
  });

  titreSection(doc, "1. Objet de l'alerte");
  if (lot) {
    encadre(doc, [
      { label: 'Matière première', valeur: lot.name || '-', couleur: NOIR },
      { label: 'Fournisseur', valeur: lot.supplier || '-' },
      { label: 'Numéro de lot', valeur: lot.lot || recherche, couleur: ROUGE },
      { label: 'Date de réception', valeur: dateCourte(lot.receiptDate) },
      { label: 'DLC annoncée', valeur: dateCourte(lot.dlcDate) },
      {
        label: 'Température relevée à réception',
        valeur: Number.isFinite(Number(lot.temp)) ? `${nombre(lot.temp, 1)} °C` : 'non relevée'
      },
      { label: 'Stock restant à consigner', valeur: `${nombre(lot.stockQty, 2)} ${lot.stockUnit || ''}`.trim() },
      {
        label: 'Statut du lot',
        valeur: lot.status === 'conforme' ? 'Conforme' : lot.status || 'À vérifier',
        couleur: lot.status === 'conforme' ? VERT : ROUGE
      }
    ]);
  } else {
    paragraphe(
      doc,
      `Aucun lot enregistré ne correspond exactement à « ${recherche} ». La fiche peut être complétée à la main : ` +
        'identifiez le fournisseur, la date de réception et la DLC du lot concerné.',
      { taille: 9, couleur: ROUGE }
    );
    espace(doc, 4);
  }

  espace(doc, 4);
  titreSection(doc, '2. Préparations intermédiaires à retirer de la vente');
  tableau(
    doc,
    [
      { titre: 'Préparation', cle: 'name', largeur: 2.2, gras: true },
      { titre: 'Type', cle: 'type', largeur: 1.6 },
      { titre: 'Préparée le', cle: 'creationDate', largeur: 1.2 },
      { titre: 'DLC dérivée', cle: 'expiryDate', largeur: 1.2 },
      { titre: 'Opérateur', cle: 'operator', largeur: 1.5 },
      { titre: 'État', cle: 'etat', largeur: 1.3, couleur: ligne => ligne.couleurEtat }
    ],
    preparations.map(preparation => {
      const depassee = estDepassee(preparation.expiryDate, reference);
      return {
        name: preparation.name,
        type: preparation.type,
        creationDate: dateCourte(preparation.creationDate),
        expiryDate: dateCourte(preparation.expiryDate),
        operator: preparation.operator,
        etat: depassee ? 'DLC dépassée' : 'À retirer',
        couleurEtat: depassee ? ROUGE : NOIR
      };
    })
  );

  espace(doc, 4);
  titreSection(doc, '3. Clients à prévenir');
  tableau(
    doc,
    [
      { titre: 'Heure', cle: 'time', largeur: 0.8 },
      { titre: 'Client', cle: 'customerName', largeur: 1.9, gras: true },
      { titre: 'Téléphone', cle: 'customerPhone', largeur: 1.5 },
      { titre: 'Référence commande', cle: 'orderRef', largeur: 1.8 },
      { titre: 'Produit remis', cle: 'recipeName', largeur: 1.7 },
      { titre: 'Qté', cle: 'qty', largeur: 0.7, aligne: 'droite' },
      { titre: 'Canal', cle: 'channel', largeur: 1.2 }
    ],
    ventes.map(vente => ({
      time: vente.time,
      customerName: vente.customerName,
      customerPhone: vente.customerPhone,
      orderRef: vente.orderRef,
      recipeName: vente.recipeName,
      qty: String(vente.qty === undefined ? '' : vente.qty),
      channel: vente.orderType || vente.channel
    }))
  );

  encadre(doc, [
    { label: 'Clients à contacter', valeur: String(ventes.length), couleur: ventes.length ? ROUGE : VERT },
    { label: 'Unités concernées', valeur: nombre(quantiteTotale, 0) },
    { label: 'Préparations à retirer', valeur: String(preparations.length) },
    { label: 'Date de la décision', valeur: dateEdition }
  ]);

  espace(doc, 4);
  titreSection(doc, '4. Consignes à appliquer');
  const consignes = [
    '1. Retirer immédiatement de la vente les denrées listées ci-dessus et les placer en quarantaine identifiée, séparées des autres productions.',
    '2. Prévenir par téléphone les clients listés à la section 3, puis consigner la date, l\'heure et la réponse de chaque appel.',
    '3. Consigner la décision prise (destruction, rappel, maintien sous conditions) dans le registre du jour, avec le nom de l\'opérateur.',
    '4. En cas de danger sanitaire avéré, informer la DDPP et joindre la présente fiche, ainsi que le registre sanitaire de l\'établissement.',
    `5. Conserver cette fiche dans le dossier sanitaire : durée de conservation minimale de ${NORMS.retentionYears} ans.`
  ];
  consignes.forEach(consigne => {
    paragraphe(doc, consigne, { taille: 9 });
    espace(doc, 1);
  });

  blocSignature(doc);
  paragraphe(
    doc,
    "Fiche générée par TraqHACCP Pâtisserie à la demande de l'établissement ; elle ne constitue pas une notification " +
      "officielle à la DDPP, qui doit être effectuée par l'exploitant (déclaration, courrier ou téléservice).",
    { taille: 8, couleur: GRIS }
  );

  return serialiserPdf(doc);
}

/** Nom de fichier horodaté du registre sanitaire. */
export function nomFichierRegistre(date = new Date()) {
  return `traqhaccp-registre-sanitaire-${horodatageFichier(date)}.pdf`;
}

/** Nom de fichier horodaté de la fiche d'alerte, dérivé du lot recherché. */
export function nomFichierFicheAlerte(recherche, date = new Date()) {
  const propre = String(recherche || 'lot')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `traqhaccp-fiche-alerte-${propre || 'LOT'}-${horodatageFichier(date)}.pdf`;
}
