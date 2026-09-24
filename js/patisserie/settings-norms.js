/**
 * js/patisserie/settings-norms.js — onglets normatifs de l'écran Réglages.
 *
 * Socle V5 en place : ce module livrera les onglets « Normes & seuils »,
 * « Équipements » et « Durées de vie », alimentés par src/domain/haccp_norms.js
 * et src/domain/constants.js (NORMS, DEFAULT_EQUIPMENTS).
 *
 * Contrat d'onglet : { id, label, icon, render(ctx) -> html }
 * ctx = { settings, esc, icon, textField, settingRow, switchControl, writeSettings, showToast }
 */

export const TABS_NORMS = [];
