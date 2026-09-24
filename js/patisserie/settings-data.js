/**
 * js/patisserie/settings-data.js — onglets « Alertes » et « Données » de l'écran Réglages.
 *
 * Socle V5 en place : ce module livrera les notifications de service
 * (permission, test, heures calmes) et la gestion du registre
 * (export JSON, import contrôlé, sauvegarde, état du cache hors-ligne).
 *
 * Contrat d'onglet : { id, label, icon, render(ctx) -> html }
 * ctx = { settings, esc, icon, textField, settingRow, switchControl, writeSettings, showToast }
 */

export const TABS_DATA = [];
