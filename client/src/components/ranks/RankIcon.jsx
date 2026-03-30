/**
 * Distinct 32×32 icons for each competitive rank (matches server `rankIconId`).
 */
const S = {
  wood: '#8B5A2B',
  woodDark: '#5C3D1E',
  iron: '#6B7280',
  ironLight: '#9CA3AF',
  ironDark: '#374151',
  silver: '#C0C0C0',
  silverDark: '#64748B',
  gold: '#EAB308',
  goldDark: '#A16207',
  plat: '#22D3EE',
  platDark: '#0891B2',
  em: '#10B981',
  emDark: '#047857',
  di: '#38BDF8',
  diDark: '#0369A1',
  ma: '#A78BFA',
  maDark: '#6D28D9',
  uc: '#F97316',
  ucGold: '#FBBF24',
};

function Pips({ n, cx, cy, r, fill }) {
  const offsets = n === 1 ? [0] : n === 2 ? [-5, 5] : [-7, 0, 7];
  return offsets.slice(0, n).map((dx, i) => (
    <circle key={i} cx={cx + dx} cy={cy} r={r} fill={fill} />
  ));
}

const ICONS = {
  'wood-1': (
    <>
      <ellipse cx="16" cy="22" rx="10" ry="4" fill={S.woodDark} opacity="0.5" />
      <path
        d="M8 20 Q16 8 24 20 L22 24 Q16 26 10 24 Z"
        fill={S.wood}
        stroke={S.woodDark}
        strokeWidth="1"
      />
      <path d="M12 18 Q16 12 20 18" stroke={S.woodDark} strokeWidth="1.2" fill="none" />
    </>
  ),
  'wood-2': (
    <>
      <ellipse cx="16" cy="24" rx="11" ry="3.5" fill={S.woodDark} opacity="0.45" />
      <rect x="9" y="14" width="14" height="8" rx="2" fill={S.wood} stroke={S.woodDark} strokeWidth="1" />
      <rect x="10" y="8" width="12" height="7" rx="2" fill={S.wood} stroke={S.woodDark} strokeWidth="1" />
      <line x1="11" y1="11" x2="21" y2="11" stroke={S.woodDark} strokeWidth="0.8" />
    </>
  ),
  'wood-3': (
    <>
      <ellipse cx="16" cy="26" rx="12" ry="3" fill={S.woodDark} opacity="0.4" />
      <rect x="8" y="6" width="16" height="5" rx="1.5" fill={S.wood} stroke={S.woodDark} strokeWidth="0.9" />
      <rect x="9" y="12" width="14" height="5" rx="1.5" fill={S.wood} stroke={S.woodDark} strokeWidth="0.9" />
      <rect x="10" y="18" width="12" height="5" rx="1.5" fill={S.wood} stroke={S.woodDark} strokeWidth="0.9" />
    </>
  ),
  'iron-1': (
    <>
      <path d="M10 24 L16 8 L22 24 Z" fill={S.iron} stroke={S.ironLight} strokeWidth="1" />
      <rect x="13" y="22" width="6" height="4" fill={S.ironDark} />
    </>
  ),
  'iron-2': (
    <>
      <rect x="8" y="10" width="16" height="14" rx="2" fill={S.iron} stroke={S.ironLight} strokeWidth="1" />
      <rect x="11" y="13" width="10" height="2" fill={S.ironDark} />
      <rect x="11" y="17" width="10" height="2" fill={S.ironDark} />
      <circle cx="16" cy="22" r="2" fill={S.ironLight} />
    </>
  ),
  'iron-3': (
    <>
      <path
        d="M6 24 L12 10 L16 14 L20 10 L26 24 Z"
        fill={S.iron}
        stroke={S.ironLight}
        strokeWidth="1"
      />
      <line x1="16" y1="14" x2="16" y2="22" stroke={S.ironDark} strokeWidth="1.5" />
    </>
  ),
  'silver-1': (
    <>
      <polygon points="16,6 20,14 29,15 22,21 24,30 16,25 8,30 10,21 3,15 12,14" fill={S.silver} stroke={S.silverDark} strokeWidth="0.8" />
    </>
  ),
  'silver-2': (
    <>
      <polygon points="16,5 19,12 27,13 21,18 23,27 16,23 9,27 11,18 5,13 13,12" fill={S.silver} stroke={S.silverDark} strokeWidth="0.7" />
      <polygon points="16,9 18,13 22,14 19,17 20,22 16,20 12,22 13,17 10,14 14,13" fill={S.silverDark} opacity="0.35" />
    </>
  ),
  'silver-3': (
    <>
      <polygon points="16,4 20,11 28,12 22,18 24,28 16,24 8,28 10,18 4,12 12,11" fill={S.silver} stroke={S.silverDark} strokeWidth="0.8" />
      <circle cx="16" cy="14" r="2.5" fill={S.silverDark} opacity="0.5" />
      {Pips({ n: 3, cx: 16, cy: 22, r: 1.8, fill: S.silverDark })}
    </>
  ),
  'gold-1': (
    <>
      <circle cx="16" cy="16" r="11" fill={S.gold} stroke={S.goldDark} strokeWidth="1" />
      <polygon points="16,9 18,14 23,14 19,17 21,23 16,19 11,23 13,17 9,14 14,14" fill={S.goldDark} opacity="0.45" />
    </>
  ),
  'gold-2': (
    <>
      <circle cx="16" cy="16" r="11" fill={S.gold} stroke={S.goldDark} strokeWidth="1" />
      <polygon points="16,7 17,12 22,12 18,15 20,21 16,17 12,21 14,15 10,12 15,12" fill="#FEF08A" opacity="0.9" />
      <polygon points="16,10 17,14 21,14 18,16 19,20 16,18 13,20 14,16 11,14 15,14" fill={S.goldDark} opacity="0.4" />
    </>
  ),
  'gold-3': (
    <>
      <circle cx="16" cy="16" r="11" fill={S.gold} stroke={S.goldDark} strokeWidth="1" />
      <polygon points="16,6 19,13 26,13 20,18 22,26 16,22 10,26 12,18 6,13 13,13" fill="#FEF9C3" opacity="0.85" />
      {Pips({ n: 3, cx: 16, cy: 17, r: 2, fill: S.goldDark })}
    </>
  ),
  'platinum-1': (
    <>
      <path d="M16 4 L28 12 L24 28 L8 28 L4 12 Z" fill={S.plat} stroke={S.platDark} strokeWidth="1" />
      <path d="M16 10 L22 14 L20 22 L12 22 L10 14 Z" fill={S.platDark} opacity="0.35" />
    </>
  ),
  'platinum-2': (
    <>
      <path d="M16 3 L29 11 L25 29 L7 29 L3 11 Z" fill={S.plat} stroke={S.platDark} strokeWidth="1" />
      <path d="M16 8 L24 13 L21 24 L11 24 L8 13 Z" fill="#E0F2FE" opacity="0.5" />
      <line x1="16" y1="12" x2="16" y2="22" stroke={S.platDark} strokeWidth="1.2" />
    </>
  ),
  'platinum-3': (
    <>
      <path d="M16 2 L30 10 L26 30 L6 30 L2 10 Z" fill={S.plat} stroke={S.platDark} strokeWidth="1" />
      <path d="M16 6 L26 12 L23 26 L9 26 L6 12 Z" fill="#FFF" opacity="0.25" />
      {Pips({ n: 3, cx: 16, cy: 18, r: 2, fill: S.platDark })}
    </>
  ),
  'emerald-1': (
    <>
      <path d="M16 4 L26 14 L16 28 L6 14 Z" fill={S.em} stroke={S.emDark} strokeWidth="1" />
      <path d="M16 9 L21 14 L16 22 L11 14 Z" fill="#6EE7B7" opacity="0.6" />
    </>
  ),
  'emerald-2': (
    <>
      <path d="M16 3 L27 13 L16 29 L5 13 Z" fill={S.em} stroke={S.emDark} strokeWidth="1" />
      <path d="M16 7 L23 13 L16 24 L9 13 Z" fill={S.emDark} opacity="0.4" />
      <line x1="16" y1="11" x2="16" y2="20" stroke="#A7F3D0" strokeWidth="1" />
    </>
  ),
  'emerald-3': (
    <>
      <path d="M16 2 L28 12 L16 30 L4 12 Z" fill={S.em} stroke={S.emDark} strokeWidth="1" />
      <path d="M16 6 L24 12 L16 25 L8 12 Z" fill="#34D399" opacity="0.5" />
      {Pips({ n: 3, cx: 16, cy: 16, r: 1.6, fill: S.emDark })}
    </>
  ),
  'diamond-1': (
    <>
      <path d="M16 5 L25 12 L16 27 L7 12 Z" fill={S.di} stroke={S.diDark} strokeWidth="1" />
      <path d="M16 8 L21 12 L16 20 L11 12 Z" fill="#E0F2FE" opacity="0.7" />
    </>
  ),
  'diamond-2': (
    <>
      <path d="M16 4 L26 11 L16 28 L6 11 Z" fill={S.di} stroke={S.diDark} strokeWidth="1" />
      <path d="M10 11 L16 6 L22 11 L19 18 L13 18 Z" fill="#BAE6FD" opacity="0.8" />
      <path d="M16 12 L20 18 L12 18 Z" fill={S.diDark} opacity="0.35" />
    </>
  ),
  'diamond-3': (
    <>
      <path d="M16 3 L27 10 L16 29 L5 10 Z" fill={S.di} stroke={S.diDark} strokeWidth="1" />
      <path d="M16 7 L23 11 L16 24 L9 11 Z" fill="#7DD3FC" opacity="0.55" />
      {Pips({ n: 3, cx: 16, cy: 15, r: 1.5, fill: '#FFF' })}
    </>
  ),
  'master-1': (
    <>
      <path d="M8 22 Q16 6 24 22" stroke={S.ma} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="22" r="4" fill={S.maDark} />
    </>
  ),
  'master-2': (
    <>
      <path d="M6 24 Q16 4 26 24" stroke={S.ma} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="20" r="3" fill={S.ma} opacity="0.85" />
      <circle cx="20" cy="20" r="3" fill={S.ma} opacity="0.85" />
    </>
  ),
  'master-3': (
    <>
      <path d="M5 25 Q16 2 27 25" stroke={S.maDark} strokeWidth="2" fill="none" />
      <path d="M7 23 Q16 6 25 23" stroke={S.ma} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {Pips({ n: 3, cx: 16, cy: 22, r: 2.2, fill: S.maDark })}
    </>
  ),
  'ultimate-champion-1': (
    <>
      <path
        d="M8 22 L10 14 L16 18 L22 14 L24 22 Z"
        fill={S.ucGold}
        stroke={S.uc}
        strokeWidth="1"
      />
      <circle cx="16" cy="12" r="5" fill={S.uc} stroke={S.ucGold} strokeWidth="1" />
    </>
  ),
  'ultimate-champion-2': (
    <>
      <path d="M6 24 L9 12 L16 16 L23 12 L26 24 Z" fill={S.ucGold} stroke={S.uc} strokeWidth="1" />
      <ellipse cx="16" cy="11" rx="7" ry="5" fill={S.uc} />
      <path d="M12 8 L14 4 L16 7 L18 4 L20 8" fill={S.ucGold} />
    </>
  ),
  'ultimate-champion-3': (
    <>
      <path d="M5 26 L8 11 L16 15 L24 11 L27 26 Z" fill={S.ucGold} stroke={S.uc} strokeWidth="1.2" />
      <circle cx="16" cy="10" r="6" fill={S.uc} stroke={S.ucGold} strokeWidth="1" />
      <path d="M10 6 L12 2 L14 5 L16 2 L18 5 L20 2 L22 6" fill="none" stroke={S.ucGold} strokeWidth="1.5" strokeLinecap="round" />
      {Pips({ n: 3, cx: 16, cy: 21, r: 2, fill: S.uc })}
    </>
  ),
};

export function RankIcon({ iconId, className = 'h-9 w-9 shrink-0', title }) {
  const body = ICONS[iconId];
  if (!body) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-lg bg-slate-700/80 text-[10px] font-bold text-slate-400 ${className}`}
        title={title}
      >
        ?
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}
