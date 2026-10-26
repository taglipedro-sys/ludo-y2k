// Geometria e regras de posição do tabuleiro.
//
// Modelo de posição de um peão (relativo ao dono, "progress"):
//   'BASE'                     -> na base
//   0 .. ring-2                -> na pista circular (0 = casa de saída do dono)
//   ring-1 .. ring+3           -> reta final (5 casas, protegidas)
//   ring+4 (= finish)          -> chegou ao centro (peão concluído)
// Casa absoluta na pista = (offset do assento + progress) % ring.

export const HOME_LEN = 5;

export function modeConfig(mode) {
  return mode === 6
    ? { mode: 6, ring: 54, spacing: 9, pawns: 3 }
    : { mode: 4, ring: 52, spacing: 13, pawns: 4 };
}

export const finishOf = (cfg) => cfg.ring + HOME_LEN - 1;
export const seatOffset = (cfg, seat) => seat * cfg.spacing;
export const isRingProgress = (cfg, p) => typeof p === 'number' && p >= 0 && p <= cfg.ring - 2;
export const absTile = (cfg, seat, p) => (seatOffset(cfg, seat) + p) % cfg.ring;
export const isStartTile = (cfg, tile) => tile % cfg.spacing === 0;

// Casas "Beba ou Pague": a cada 8 casas, exceto casas de saída (seguras).
export function drinkTiles(cfg) {
  const out = new Set();
  for (let i = 0; i < cfg.ring; i++) if (i % 8 === 4 && !isStartTile(cfg, i)) out.add(i);
  return out;
}

// ---------- Geometria visual (coordenadas em um quadro 0..100) ----------

const rot = (x, y, k) => {
  // rotaciona k*90° em torno do centro (7,7) de uma grade 15x15
  let px = x, py = y;
  for (let i = 0; i < k; i++) [px, py] = [14 - py, px];
  return [px, py];
};

function crossLayout() {
  const cell = 100 / 15;
  const c = (x, y) => ({ x: (x + 0.5) * cell, y: (y + 0.5) * cell });
  const walk = [];
  const add = (x, y) => walk.push([x, y]);
  for (let x = 1; x <= 5; x++) add(x, 6);
  for (let y = 5; y >= 0; y--) add(6, y);
  add(7, 0); add(8, 0);
  for (let y = 1; y <= 5; y++) add(8, y);
  for (let x = 9; x <= 14; x++) add(x, 6);
  add(14, 7); add(14, 8);
  for (let x = 13; x >= 9; x--) add(x, 8);
  for (let y = 9; y <= 14; y++) add(8, y);
  add(7, 14); add(6, 14);
  for (let y = 13; y >= 9; y--) add(6, y);
  for (let x = 5; x >= 0; x--) add(x, 8);
  add(0, 7); add(0, 6);
  const tiles = walk.map(([x, y]) => c(x, y));
  const homes = [];
  const bases = [];
  for (let s = 0; s < 4; s++) {
    homes.push([1, 2, 3, 4, 5].map((x) => { const [rx, ry] = rot(x, 7, s); return c(rx, ry); }));
    const slots = [[2.3, 2.3], [3.7, 2.3], [2.3, 3.7], [3.7, 3.7]].map(([x, y]) => { const [rx, ry] = rot(x, y, s); return c(rx, ry); });
    bases.push(slots);
  }
  return { kind: 'cross', cell, tiles, homes, bases, center: c(7, 7) };
}

function hexLayout() {
  const cx = 50, cy = 50, r = 36;
  const V = [];
  for (let k = 0; k < 6; k++) {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    V.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  const tiles = [];
  for (let k = 0; k < 6; k++) {
    const a = V[k], b = V[(k + 1) % 6];
    for (let i = 0; i < 9; i++) tiles.push({ x: a.x + ((b.x - a.x) * i) / 9, y: a.y + ((b.y - a.y) * i) / 9 });
  }
  const homes = [], bases = [];
  for (let s = 0; s < 6; s++) {
    const v = V[s];
    homes.push([1, 2, 3, 4, 5].map((n) => ({ x: v.x + ((cx - v.x) * n) / 6.4, y: v.y + ((cy - v.y) * n) / 6.4 })));
    const out = { x: cx + (v.x - cx) * 1.24, y: cy + (v.y - cy) * 1.24 };
    const dx = -(v.y - cy) / r, dy = (v.x - cx) / r; // perpendicular
    bases.push([-1, 0, 1].map((n) => ({ x: out.x + dx * n * 5.2, y: out.y + dy * n * 5.2 })));
  }
  return { kind: 'hex', cell: 4.5, tiles, homes, bases, center: { x: cx, y: cy } };
}

export function layoutFor(mode) {
  return mode === 6 ? hexLayout() : crossLayout();
}

// Coordenadas de um peão no quadro visual.
export function pawnXY(layout, cfg, seat, pawn) {
  const pos = pawn.position;
  if (pos === 'BASE') return layout.bases[seat][pawn.id % layout.bases[seat].length];
  const finish = finishOf(cfg);
  if (pos >= finish) return layout.center;
  if (pos <= cfg.ring - 2) return layout.tiles[absTile(cfg, seat, pos)];
  return layout.homes[seat][pos - (cfg.ring - 1)];
}

// Pontos da reta final restante de um peão (para acender as setas).
export function remainingPath(layout, cfg, seat, pawn) {
  const finish = finishOf(cfg);
  const pts = [];
  for (let p = pawn.position + 1; p <= finish; p++) {
    pts.push(pawnXY(layout, cfg, seat, { id: pawn.id, position: p }));
  }
  return pts;
}
