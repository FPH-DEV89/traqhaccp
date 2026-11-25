/**
 * TraqHACCP — Couche présentation — Sprite d'icônes SVG.
 *
 * Contrat (spec P5a §1) : aucune dépendance, aucun emoji, aucune couleur en dur,
 * aucun aplat (pas de cercle plein décoratif), jeu de traits sur une grille 24 px.
 * Chaque icône est retournée en SVG inline dont la couleur suit le texte courant
 * (`currentColor`) ; l'épaisseur de trait est fixe (1.6) pour une silhouette homogène.
 *
 * API publique :
 *   - `icon(name, size)`     → chaîne SVG (repli silencieux sur `dot` si nom inconnu)
 *   - `iconFor(legacyClass)` → résolution des classes Font Awesome v3 vers le jeu v4
 *   - `ICONS`                → tableau des noms disponibles (utilisé par le validateur)
 *   - `ICON_ALIAS`           → table d'équivalence legacy → nom canonique
 *
 * `icon()` n'est jamais une fonction sans effet : elle retourne TOUJOURS une chaîne
 * contenant `<svg`. Le test d'acceptation s'appuie sur cette garantie.
 */

/* ═══════════════════════════════════════════════════════════════════
   TRACES — contenu interne du viewBox (uniquement des traits, jamais d'aplat)
   ═══════════════════════════════════════════════════════════════════ */

const TRACES = {
  dashboard: '<path d="M4 5.5h6.5v5H4z"/><path d="M13.5 5.5H20v9h-6.5z"/><path d="M4 13.5h6.5V19H4z"/><path d="M13.5 17.5H20V19h-6.5z"/>',
  clipboard: '<path d="M9 3.5h6v1.8H9z"/><path d="M6.5 4.6h11a1.2 1.2 0 0 1 1.2 1.2v13.1a1.2 1.2 0 0 1-1.2 1.2h-11a1.2 1.2 0 0 1-1.2-1.2V5.8a1.2 1.2 0 0 1 1.2-1.2z"/><path d="M9 11h6"/><path d="M9 15h4"/>',
  thermometer: '<path d="M13.5 13.6V5.5a2 2 0 1 0-4 0v8.1a3.6 3.6 0 1 0 4 0z"/><path d="M11.5 9.5v5.6"/>',
  truck: '<path d="M2.5 6.5h11v8h-11z"/><path d="M13.5 9.5h3.4l3.1 3.1v1.9h-6.5z"/><circle cx="6.6" cy="16.6" r="1.9"/><circle cx="16.6" cy="16.6" r="1.9"/>',
  tag: '<path d="M11.4 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.6L11 21.5 2.5 13z"/><circle cx="15.9" cy="8.1" r="1.4"/>',
  wheat: '<path d="M12 20.5V7"/><path d="M12 7c0-2 1-3 3-3.5 0 2.5-1 3.5-3 3.5z"/><path d="M12 7c0-2-1-3-3-3.5 0 2.5 1 3.5 3 3.5z"/><path d="M12 11.5c0-2 1-3 3-3.5 0 2.5-1 3.5-3 3.5z"/><path d="M12 11.5c0-2-1-3-3-3.5 0 2.5 1 3.5 3 3.5z"/><path d="M12 16c0-2 1-3 3-3.5 0 2.5-1 3.5-3 3.5z"/><path d="M12 16c0-2-1-3-3-3.5 0 2.5 1 3.5 3 3.5z"/>',
  spray: '<path d="M10 8.5h6.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 19v-9A1.5 1.5 0 0 1 10 8.5z"/><path d="M9.5 8.5V5.3a1.3 1.3 0 0 1 2.6 0v3.2"/><path d="M17.8 3.5h2.7"/><path d="M17.8 6.3h2.7"/><path d="M17.8 9.1h2.1"/>',
  droplet: '<path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 1 1-11 0c0-4 5.5-10 5.5-10z"/>',
  snowflake: '<path d="M12 3v18"/><path d="M4.2 7.5l15.6 9"/><path d="M19.8 7.5l-15.6 9"/><path d="M12 6.5l2.6-2.1M12 6.5L9.4 4.4M12 17.5l2.6 2.1M12 17.5l-2.6 2.1"/>',
  flame: '<path d="M12 21c3.3 0 5.6-2.2 5.6-5.2 0-3.7-3.6-5.4-3.6-9.5-2.1 1.3-3.3 3.1-3.3 5-1.3-.7-2.1-1.7-2.1-1.7-.6 2-2.3 3.5-2.3 6.2C6.4 18.8 8.7 21 12 21z"/>',
  scale: '<path d="M12 4v16"/><path d="M6 20h12"/><path d="M3.5 8h17"/><path d="M3.5 8 1.2 13.2h4.6z"/><path d="M20.5 8l-2.3 5.2h4.6z"/>',
  folder: '<path d="M3 7.2A1.7 1.7 0 0 1 4.7 5.5h4.2l2 2.3h8.4A1.7 1.7 0 0 1 21 9.5v8.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3z"/><path d="M3 10.4h18"/>',
  alert: '<path d="M12 4.5 2.8 19.5h18.4z"/><path d="M12 9.6v4.6"/><path d="M12 17.2h.01"/>',
  shield: '<path d="M12 3.5 5 6.1v5.9c0 4.4 3 7.6 7 8.5 4-.9 7-4.1 7-8.5V6.1z"/>',
  seal: '<path d="M12 3.5l2.2 2 3-.3.9 2.9 2.6 1.5-1 2.8 1 2.8-2.6 1.5-.9 2.9-3-.3-2.2 2-2.2-2-3 .3-.9-2.9L2.3 15l1-2.8-1-2.8 2.6-1.5.9-2.9 3 .3z"/><path d="M9.1 12.2l2.1 2.1 3.9-4.1"/>',
  users: '<path d="M9 11.6a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z"/><path d="M3.2 19.6c0-3 2.6-5.1 5.8-5.1s5.8 2.1 5.8 5.1"/><path d="M16 5.7a3.3 3.3 0 0 1 0 6.3"/><path d="M17.6 14.9c2.1.7 3.4 2.4 3.4 4.7"/>',
  settings: '<path d="M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z"/><path d="M12 2.8v2.5M12 18.7v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.8 12h2.5M18.7 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  search: '<circle cx="11" cy="11" r="6.3"/><path d="M15.6 15.6 20.5 20.5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5.2 17.2z"/><path d="M13.6 6.9 17.4 10.7"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.6 7V4.9h4.8V7"/><path d="M6.6 7l.9 12.3a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5L17.4 7"/><path d="M10.2 11v5.8M13.8 11v5.8"/>',
  check: '<path d="M4.5 12.8 9.5 17.8 19.5 6.5"/>',
  x: '<path d="M5.5 5.5 18.5 18.5"/><path d="M18.5 5.5 5.5 18.5"/>',
  'chevron-right': '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  'chevron-down': '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  'chevron-left': '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  'chevron-up': '<path d="M5.5 14.5 12 8l6.5 6.5"/>',
  download: '<path d="M12 3.5v11"/><path d="M7.5 10 12 14.5 16.5 10"/><path d="M4.5 19.5h15"/>',
  upload: '<path d="M12 14.5v-11"/><path d="M7.5 8 12 3.5 16.5 8"/><path d="M4.5 19.5h15"/>',
  printer: '<path d="M8 9.5V4.5h8v5"/><path d="M5 9.5h14v6h-3"/><path d="M8 15.5H5"/><path d="M8 13.5h8v6H8z"/>',
  camera: '<path d="M4.5 7.5h3l1.6-2.2h5.8l1.6 2.2h3A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5z"/><circle cx="12" cy="13" r="3.4"/>',
  clock: '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.4V12l3.2 2"/>',
  calendar: '<path d="M4.5 5.8h15A1.5 1.5 0 0 1 21 7.3v12.2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5V7.3a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M3 10.3h18"/><path d="M8 3.5v4.4M16 3.5v4.4"/>',
  filter: '<path d="M3.5 5.5h17l-6.6 7.7v5.5l-3.8 1.6v-7.1z"/>',
  command: '<path d="M8.5 8.5h7v7h-7z"/><path d="M8.5 8.5A2.5 2.5 0 1 0 6 11h2.5"/><path d="M15.5 8.5A2.5 2.5 0 1 1 18 11h-2.5"/><path d="M8.5 15.5A2.5 2.5 0 1 0 6 13h2.5"/><path d="M15.5 15.5A2.5 2.5 0 1 1 18 13h-2.5"/>',
  lock: '<path d="M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>',
  unlock: '<path d="M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 6.7-1.5"/>',
  eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.7-6"/><path d="M20.5 4v4.6H16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/>',
  moon: '<path d="M20 14.6A8.6 8.6 0 0 1 9.4 4 8.6 8.6 0 1 0 20 14.6z"/>',
  bell: '<path d="M6.5 10.2a5.5 5.5 0 0 1 11 0v4.3l1.5 3.1h-14l1.5-3.1z"/><path d="M10 20.3a2 2 0 0 0 4 0"/>',
  mail: '<path d="M3.5 6.5h17v11h-17z"/><path d="M3.8 7 12 13.2 20.2 7"/>',
  phone: '<path d="M6.2 3.8h3.1l1.4 3.8-2 1.4a12.5 12.5 0 0 0 5.9 5.9l1.4-2 3.8 1.4v3.1a1.8 1.8 0 0 1-2 1.8A17 17 0 0 1 4.4 5.8a1.8 1.8 0 0 1 1.8-2z"/>',
  map: '<path d="M9 4.5 3.5 7v12L9 16.5l6 2.5 5.5-2.5V4.5L15 7z"/><path d="M9 4.5v12M15 7v12"/>',
  dot: '<circle cx="12" cy="12" r="3.2"/>',
  sparkle: '<path d="M10.5 3.5l1.5 4.2 4.2 1.5-4.2 1.5-1.5 4.2-1.5-4.2L4.8 9.2l4.2-1.5z"/><path d="M18.2 15.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  logout: '<path d="M10 4.5H5.5A1.5 1.5 0 0 0 4 6v12a1.5 1.5 0 0 0 1.5 1.5H10"/><path d="M15.5 8l4 4-4 4"/><path d="M19.5 12H9.5"/>',
  copy: '<path d="M9 9V5.5A1.5 1.5 0 0 1 10.5 4h7A1.5 1.5 0 0 1 19 5.5v7A1.5 1.5 0 0 1 17.5 14H14"/><path d="M4 10.5A1.5 1.5 0 0 1 5.5 9h7A1.5 1.5 0 0 1 14 10.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 17.5z"/>',
  external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 12 12"/><path d="M18 13.5v5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h5"/>',
};

/* ═══════════════════════════════════════════════════════════════════
   ALIAS — équivalences Font Awesome v3 → noms canoniques v4
   Le repli legacy du routeur réutilise les classes historiques : elles
   doivent continuer à produire une icône, jamais un carré vide.
   ═══════════════════════════════════════════════════════════════════ */

export const ICON_ALIAS = {
  'fa-xmark': 'x', 'fa-circle-xmark': 'x', 'fa-times': 'x', 'fa-delete-left': 'trash',
  'fa-trash-can': 'trash', 'fa-trash': 'trash', 'fa-triangle-exclamation': 'alert',
  'fa-exclamation-triangle': 'alert', 'fa-circle-info': 'alert', 'fa-circle-exclamation': 'alert',
  'fa-circle-check': 'check', 'fa-check': 'check', 'fa-check-double': 'check',
  'fa-print': 'printer', 'fa-plus': 'plus', 'fa-circle-plus': 'plus',
  'fa-user-check': 'users', 'fa-user': 'users', 'fa-users': 'users', 'fa-user-group': 'users',
  'fa-person-circle-question': 'users', 'fa-shield-halved': 'shield', 'fa-shield': 'shield',
  'fa-file-shield': 'shield', 'fa-award': 'seal', 'fa-certificate': 'seal',
  'fa-chevron-right': 'chevron-right', 'fa-chevron-down': 'chevron-down',
  'fa-chevron-left': 'chevron-left', 'fa-chevron-up': 'chevron-up',
  'fa-camera': 'camera', 'fa-camera-rotate': 'camera', 'fa-camera-retro': 'camera',
  'fa-temperature-half': 'thermometer', 'fa-thermometer-half': 'thermometer',
  'fa-thermometer': 'thermometer', 'fa-thermometer-three-quarters': 'thermometer',
  'fa-temperature-arrow-down': 'snowflake', 'fa-temperature-arrow-up': 'flame',
  'fa-tags': 'tag', 'fa-tag': 'tag', 'fa-barcode': 'tag', 'fa-qrcode': 'tag',
  'fa-snowflake': 'snowflake', 'fa-cloud-arrow-up': 'upload', 'fa-upload': 'upload',
  'fa-cloud-arrow-down': 'download', 'fa-download': 'download',
  'fa-clock': 'clock', 'fa-stopwatch': 'clock', 'fa-stopwatch-20': 'clock', 'fa-hourglass-half': 'clock',
  'fa-truck-ramp-box': 'truck', 'fa-truck': 'truck', 'fa-truck-fast': 'truck',
  'fa-seedling': 'wheat', 'fa-utensils': 'wheat', 'fa-leaf': 'wheat', 'fa-bowl-food': 'wheat',
  'fa-oil-can': 'droplet', 'fa-droplet': 'droplet', 'fa-tint': 'droplet', 'fa-vial': 'droplet',
  'fa-vial-virus': 'droplet', 'fa-vial-circle-check': 'droplet',
  'fa-clipboard-check': 'clipboard', 'fa-clipboard-list': 'clipboard', 'fa-clipboard': 'clipboard',
  'fa-list-check': 'clipboard', 'fa-list': 'clipboard', 'fa-table-list': 'clipboard',
  'fa-broom': 'spray', 'fa-spray-can-sparkles': 'spray', 'fa-spray-can': 'spray',
  'fa-weight-scale': 'scale', 'fa-scale-balanced': 'scale', 'fa-balance-scale': 'scale',
  'fa-wand-magic-sparkles': 'sparkle', 'fa-sparkles': 'sparkle',
  'fa-sliders': 'settings', 'fa-sliders-h': 'settings', 'fa-gear': 'settings', 'fa-cog': 'settings',
  'fa-wrench': 'settings', 'fa-rotate-left': 'refresh', 'fa-rotate-right': 'refresh',
  'fa-arrows-rotate': 'refresh', 'fa-sync': 'refresh',
  'fa-file-pdf': 'folder', 'fa-file-excel': 'folder', 'fa-file-lines': 'folder',
  'fa-folder': 'folder', 'fa-folder-open': 'folder', 'fa-database': 'folder',
  'fa-chart-pie': 'dashboard', 'fa-chart-line': 'dashboard', 'fa-table-columns': 'dashboard',
  'fa-gauge-high': 'dashboard', 'fa-dashboard': 'dashboard', 'fa-house': 'dashboard',
  'fa-signature': 'edit', 'fa-pen': 'edit', 'fa-pencil': 'edit', 'fa-pen-to-square': 'edit',
  'fa-magnifying-glass': 'search', 'fa-search': 'search',
  'fa-lock-open': 'unlock', 'fa-key': 'lock', 'fa-lock': 'lock', 'fa-unlock': 'unlock',
  'fa-eye': 'eye', 'fa-eye-slash': 'eye', 'fa-door-open': 'logout', 'fa-door-closed': 'logout',
  'fa-sign-out-alt': 'logout', 'fa-right-from-bracket': 'logout',
  'fa-arrow-right-from-bracket': 'logout', 'fa-circle': 'dot', 'fa-bell': 'bell',
  'fa-envelope': 'mail', 'fa-phone': 'phone', 'fa-location-dot': 'map', 'fa-map': 'map',
  'fa-copy': 'copy', 'fa-clone': 'copy', 'fa-external-link-alt': 'external',
  'fa-arrow-up-right-from-square': 'external', 'fa-file-export': 'download',
  'fa-calendar': 'calendar', 'fa-calendar-days': 'calendar', 'fa-calendar-check': 'calendar',
  'fa-filter': 'filter', 'fa-command': 'command', 'fa-terminal': 'command',
  'fa-file-circle-plus': 'plus', 'fa-comment': 'clipboard',
};

/* ═══════════════════════════════════════════════════════════════════
   API
   ═══════════════════════════════════════════════════════════════════ */

/** Noms d'icônes couverts par le sprite (ordre stable, utile aux tests). */
export const ICONS = Object.keys(TRACES);

/**
 * Construit une icône SVG inline.
 * @param {string} name  nom canonique (repli sur `dot` si inconnu)
 * @param {number} [size=18]  côté en pixels (jamais 0 ni négatif)
 * @returns {string} balise `<svg>` complète, colorée par `currentColor`
 */
export function icon(name, size = 18) {
  const trace = TRACES[name] || TRACES.dot;
  const px = Number.isFinite(Number(size)) && Number(size) > 0 ? Number(size) : 18;
  const attrs = [
    'viewBox="0 0 24 24"',
    `width="${px}"`,
    `height="${px}"`,
    'fill="none"',
    'stroke="currentColor"',
    'stroke-width="1.6"',
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    'aria-hidden="true"',
    'focusable="false"',
  ].join(' ');
  return `<svg ${attrs}>${trace}</svg>`;
}

/**
 * Résout une classe Font Awesome historique (v3) vers une icône v4.
 * Accepte une chaîne contenant plusieurs classes (`"fa-solid fa-truck"`).
 * @param {string} legacyClass
 * @returns {string} SVG inline (`dot` si aucune correspondance)
 */
export function iconFor(legacyClass) {
  const tokens = String(legacyClass || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t !== 'fa' && t !== 'fas' && t !== 'far' && t !== 'fal' && t !== 'fa-solid' && t !== 'fa-regular' && t !== 'fa-light');
  for (const token of tokens.slice().reverse()) {
    if (TRACES[token]) return icon(token);
    if (ICON_ALIAS[token]) return icon(ICON_ALIAS[token]);
  }
  return icon('dot');
}
