import type { BuildingId } from './state';

// Gebäude-Icons (48x48). Farben passen zum Spiel: Gold für Linien, Erdtöne für Flächen.
const ROOT = 'viewBox="0 0 48 48" fill="none" stroke="#c9a24a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const svg = (inner: string) => `<svg ${ROOT} aria-hidden="true">${inner}</svg>`;

export const ICONS: Record<BuildingId, string> = {
  saegewerk: svg(`
    <rect x="8" y="26" width="28" height="12" rx="3" fill="#7a5a32"/><circle cx="36" cy="32" r="6" fill="#b58a4f"/><circle cx="36" cy="32" r="2.5"/>
    <rect x="12" y="13" width="24" height="10" rx="3" fill="#7a5a32"/><circle cx="36" cy="18" r="5" fill="#b58a4f"/><circle cx="36" cy="18" r="2"/>`),
  mine: svg(`
    <path d="M4 44 L18 18 L27 30 L33 21 L44 44 Z" fill="#4a4740"/>
    <path d="M22 8 L24 4 M30 9 L33 5 M38 14 L42 12" stroke="#f1ead8"/>
    <path d="M26 14 L28 10 L30 14 Z" fill="#c9a24a"/>`),
  feld: svg(`
    <line x1="24" y1="44" x2="24" y2="8"/>
    <ellipse cx="18" cy="18" rx="4" ry="7" transform="rotate(-25 18 18)" fill="#b58a4f"/>
    <ellipse cx="30" cy="18" rx="4" ry="7" transform="rotate(25 30 18)" fill="#b58a4f"/>
    <ellipse cx="18" cy="30" rx="4" ry="7" transform="rotate(-25 18 30)" fill="#b58a4f"/>
    <ellipse cx="30" cy="30" rx="4" ry="7" transform="rotate(25 30 30)" fill="#b58a4f"/>
    <ellipse cx="24" cy="8" rx="3" ry="5" fill="#b58a4f"/>`),
  schmiede: svg(`
    <path d="M8 18 H40 L36 25 H30 V33 H38 V41 H10 V33 H18 V25 H12 Z" fill="#4a4740"/>
    <path d="M14 13 H34" stroke="#f1ead8"/>`),
  baeckerei: svg(`
    <path d="M6 32 Q6 16 24 16 Q42 16 42 32 Z" fill="#b58a4f"/>
    <path d="M6 32 H42 V36 Q42 38 40 38 H8 Q6 38 6 36 Z" fill="#7a5a32"/>
    <path d="M16 22 L20 28 M24 21 L28 27 M32 22 L36 28" stroke="#f1ead8"/>`),
  weberei: svg(`
    <rect x="12" y="8" width="24" height="6" rx="2" fill="#7a5a32"/>
    <rect x="12" y="34" width="24" height="6" rx="2" fill="#7a5a32"/>
    <rect x="20" y="13" width="8" height="22" fill="#b58a4f"/>
    <path d="M28 22 Q40 26 34 36" stroke="#f1ead8"/>`),
  schreibstube: svg(`
    <rect x="10" y="12" width="28" height="24" fill="#e9dcb8" stroke="none"/>
    <rect x="7" y="9" width="34" height="6" rx="3" fill="#7a5a32"/>
    <rect x="7" y="33" width="34" height="6" rx="3" fill="#7a5a32"/>
    <path d="M15 20 H33 M15 26 H33 M15 32 H26" stroke="#4a4740"/>`),
  werkstatt: svg(`
    <rect x="8" y="9" width="22" height="10" rx="2" fill="#4a4740"/>
    <line x1="28" y1="16" x2="40" y2="40" stroke="#b58a4f" stroke-width="4"/>`),
};
