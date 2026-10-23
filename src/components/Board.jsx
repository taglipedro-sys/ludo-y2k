import { COLOR_HEX } from '../game/constants.js';
import { drinkTiles, isStartTile, layoutFor, modeConfig, pawnXY, remainingPath } from '../game/board.js';

const NEUTRAL = '#3a3a4a';

// Tabuleiro (cruz p/ 4 jogadores, hexágono p/ 6) desenhado em SVG 0..100.
export default function Board({ state, explosions = [], anim = {} }) {
  const mode = state.room.mode;
  const cfg = modeConfig(mode);
  const L = layoutFor(mode);
  const drinks = drinkTiles(cfg);
  const round = state.room.round;
  const bySeat = (seat) => state.players.find((p) => p.seat === seat);
  const seatColor = (seat) => (bySeat(seat) ? COLOR_HEX[bySeat(seat).color] : NEUTRAL);
  const tileSeat = (i) => (isStartTile(cfg, i) ? i / cfg.spacing : null);
  const size = L.cell * 0.86;
  const round2 = (n) => Math.round(n * 10) / 10;

  // agrupa peões na mesma casa para deslocá-los um pouco
  const groups = {};
  const pawns = [];
  for (const pl of state.players) {
    for (const pw of pl.pawns) {
      const ak = `${pl.id}:${pw.id}`;
      const walking = anim[ak] !== undefined;
      const shown = walking ? { ...pw, position: anim[ak] } : pw;
      const xy = pawnXY(L, cfg, pl.seat, shown);
      const key = `${round2(xy.x)},${round2(xy.y)}`;
      (groups[key] = groups[key] || []).push(pw);
      pawns.push({ pl, pw, xy, key, walking, dpos: shown.position });
    }
  }

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ maxHeight: '100%' }}>
      {/* bases */}
      {L.bases.map((slots, seat) => {
        if (seat >= (mode === 6 ? 6 : 4)) return null;
        const xs = slots.map((p) => p.x), ys = slots.map((p) => p.y);
        const pad = L.cell * 1.1;
        const col = seatColor(seat);
        return (
          <g key={`base${seat}`} opacity={bySeat(seat) ? 1 : 0.35}>
            <rect x={Math.min(...xs) - pad} y={Math.min(...ys) - pad} width={Math.max(...xs) - Math.min(...xs) + pad * 2}
              height={Math.max(...ys) - Math.min(...ys) + pad * 2} rx={3} fill={col} fillOpacity={0.14} stroke={col} strokeWidth={0.5} />
            {slots.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={L.cell * 0.5} fill="#05020d" stroke={col} strokeWidth={0.4} />)}
          </g>
        );
      })}

      {/* reta final */}
      {L.homes.map((cells, seat) => (
        <g key={`home${seat}`} opacity={bySeat(seat) ? 1 : 0.3}>
          {cells.map((c, i) => (
            <rect key={i} x={c.x - size / 2} y={c.y - size / 2} width={size} height={size} rx={1.2}
              fill={seatColor(seat)} fillOpacity={0.35} stroke={seatColor(seat)} strokeWidth={0.35} />
          ))}
        </g>
      ))}

      {/* pista */}
      {L.tiles.map((t, i) => {
        const seat = tileSeat(i);
        const booth = state.room.toll_booths.find((b) => b.tile_index === i && b.until_round > round);
        const isDrink = drinks.has(i);
        const stroke = booth ? '#ff8a1f' : isDrink ? '#ffe62a' : seat != null ? seatColor(seat) : '#3a2f7a';
        return (
          <g key={i}>
            <rect x={t.x - size / 2} y={t.y - size / 2} width={size} height={size} rx={1.2}
              fill={seat != null ? seatColor(seat) : '#120a2c'} fillOpacity={seat != null ? 0.85 : 1}
              stroke={stroke} strokeWidth={booth || isDrink ? 0.6 : 0.3} />
            {isDrink && !booth && <text x={t.x} y={t.y + 1.3} fontSize={L.cell * 0.6} textAnchor="middle">🍺</text>}
            {booth && <text x={t.x} y={t.y + 1.3} fontSize={L.cell * 0.6} textAnchor="middle">🚧</text>}
          </g>
        );
      })}

      {/* números das casas: aparecem só enquanto alguém escolhe onde pôr o pedágio */}
      {state.room.toll_picker && L.tiles.map((t, i) => {
        const sel = state.room.toll_picker.tile === i;
        return (
          <g key={`num${i}`} style={{ pointerEvents: 'none' }}>
            {sel && <rect x={t.x - size / 2 - 0.4} y={t.y - size / 2 - 0.4} width={size + 0.8} height={size + 0.8} rx={1.4}
              fill="#ffe62a" fillOpacity={0.35} stroke="#ffe62a" strokeWidth={0.7} className="aura" />}
            <text x={t.x} y={t.y + L.cell * 0.18} fontSize={L.cell * (i > 9 ? 0.5 : 0.6)} textAnchor="middle"
              fontFamily="Press Start 2P" fill={sel ? '#fff' : '#ffe62a'} stroke="#000" strokeWidth={0.25} paintOrder="stroke">{i}</text>
          </g>
        );
      })}

      {/* centro */}
      <circle cx={L.center.x} cy={L.center.y} r={L.cell * 1.1} fill="#05020d" stroke="#ffe62a" strokeWidth={0.6} />
      <text x={L.center.x} y={L.center.y + 2} fontSize={L.cell * 1.2} textAnchor="middle">🏁</text>

      {/* setas da reta final de peões CRITICAL */}
      {pawns.filter(({ pw, walking }) => pw.status === 'CRITICAL_STATE' && !walking).map(({ pl, pw, xy }) => {
        const path = remainingPath(L, cfg, pl.seat, pw);
        const pts = [xy, ...path].map((p) => `${p.x},${p.y}`).join(' ');
        return <polyline key={`arrow${pl.id}${pw.id}`} points={pts} fill="none" stroke={COLOR_HEX[pl.color]}
          strokeWidth={1.1} strokeLinecap="round" className="path-glow" />;
      })}

      {/* peões */}
      {pawns.map(({ pl, pw, xy, key, walking, dpos }) => {
        const g = groups[key];
        const idx = g.indexOf(pw);
        const dx = (idx - (g.length - 1) / 2) * (L.cell * 0.32);
        const x = xy.x + dx, y = xy.y;
        const col = COLOR_HEX[pl.color];
        const r = L.cell * 0.36;
        const crit = pw.status === 'CRITICAL_STATE';
        const immune = pw.immune_until != null && pw.immune_until > round;
        return (
          <g key={`pawn${pl.id}${pw.id}`} style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform .2s ease-in-out' }}>
            <ellipse cx={0} cy={r * 0.9} rx={r * 0.8} ry={r * 0.28} fill="#000" fillOpacity={walking ? 0.45 : 0.25} />
            <g key={walking ? String(dpos) : 'idle'} className={walking ? 'pawn-hop' : ''}>
              {crit && <circle cx={0} cy={0} r={r * 1.3} fill="none" stroke={col} strokeWidth={0.8} className="aura" />}
              {immune && <circle cx={0} cy={0} r={r * 1.35} fill="none" stroke="#fff" strokeWidth={0.5} strokeDasharray="1.2 1" />}
              <circle cx={0} cy={0} r={r} fill={col} stroke="#fff" strokeWidth={0.5} />
              <text x={0} y={r * 0.35} fontSize={r * 1.1} textAnchor="middle" fill="#08031a" fontFamily="Press Start 2P">
                {pw.id + 1}
              </text>
            </g>
          </g>
        );
      })}

      {/* explosões em pixel art */}
      {explosions.map((e) => (
        <g key={e.id} transform={`translate(${e.x} ${e.y})`}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const d = 6 + (i % 3) * 3;
            return (
              <rect key={i} className="boom-piece" x={-1} y={-1} width={2.2} height={2.2}
                fill={i % 2 ? '#ffe62a' : '#ff2a55'}
                style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px` }} />
            );
          })}
          <text className="boom-piece" textAnchor="middle" y={-4} fontSize={5} fontFamily="Press Start 2P" fill="#fff"
            style={{ '--dx': '0px', '--dy': '-4px' }}>K.O.</text>
        </g>
      ))}
    </svg>
  );
}
