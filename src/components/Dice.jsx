import { useEffect, useMemo, useState } from 'react';
import { POINTS } from '../game/constants.js';

// Posições dos pontos numa grade 3x3 (0..8, linha por linha).
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

// Rotação final do cubo (X, Y) para deixar cada número virado para a frente.
// Faces opostas somam 7: 1-6, 3-4, 2-5.
const FINAL = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
const FACES = [
  [1, 'rotateY(0deg)'], [6, 'rotateY(180deg)'], [3, 'rotateY(90deg)'],
  [4, 'rotateY(-90deg)'], [2, 'rotateX(90deg)'], [5, 'rotateX(-90deg)'],
];

function Face({ n, size, tf, accent }) {
  return (
    <div className="dice-face" style={{ width: size, height: size, borderRadius: size * 0.18, padding: size * 0.14, transform: `${tf} translateZ(${size / 2}px)` }}>
      <div className="dice-grid">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="dice-pip" style={{
            width: size * 0.19, height: size * 0.19,
            visibility: PIPS[n].includes(i) ? 'visible' : 'hidden',
            background: n === 1 ? accent : '#14082e',
          }} />
        ))}
      </div>
    </div>
  );
}

// Dado 3D. Para rolar de novo, o pai troca a `key` (o componente reinicia e gira até o valor).
export default function Dice({ value, size = 64, animate = true, accent = '#ff2a55', glow = '#ffffff' }) {
  const [go, setGo] = useState(!animate);
  const spins = useMemo(() => [2 + Math.floor(Math.random() * 2), 2 + Math.floor(Math.random() * 2)], []);

  useEffect(() => {
    if (!animate) return undefined;
    const t = setTimeout(() => setGo(true), 40);
    return () => clearTimeout(t);
  }, [animate]);

  const v = FINAL[value] ? value : 1;
  const [rx, ry] = FINAL[v];
  const end = `rotateX(${rx + 360 * spins[0]}deg) rotateY(${ry + 360 * spins[1]}deg)`;
  const dur = animate ? 1.35 : 0;
  const ease = `transform ${dur}s cubic-bezier(.2,.75,.25,1)`;

  return (
    <div style={{ width: size, height: size, filter: `drop-shadow(0 0 ${size * 0.16}px ${glow})` }}>
      <div className={animate ? 'dice-hop' : ''} style={{ width: size, height: size, perspective: size * 5 }}>
        <div style={{
          width: size, height: size, transformStyle: 'preserve-3d', transition: ease,
          transform: go ? 'rotateX(-10deg) rotateY(-14deg)' : 'rotateX(-26deg) rotateY(-32deg)',
        }}>
          <div className="dice-cube" style={{
            width: size, height: size, transformStyle: 'preserve-3d', transition: ease,
            transform: go ? end : 'rotateX(0deg) rotateY(0deg)',
          }}>
            {FACES.map(([n, tf]) => <Face key={n} n={n} size={size} tf={tf} accent={accent} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tela de resultado: o dado gira, para num número e some sozinho (toque para pular).
export function DiceOverlay({ roll, color = '#ffe62a', size = 110, fixed = false, label, onDone }) {
  const [phase, setPhase] = useState('rolling');
  useEffect(() => {
    const a = setTimeout(() => setPhase('done'), 1500);
    const b = setTimeout(() => setPhase('out'), 2600);
    const c = setTimeout(() => onDone?.(), 2900);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dice = roll.dice;
  const sixes = dice.filter((d) => d === 6).length;
  const total = dice.join(dice.length > 1 ? ' + ' : '');
  return (
    <div className={`dice-overlay ${fixed ? 'fixed' : ''} ${phase === 'out' ? 'out' : ''}`} onClick={onDone}>
      <div className="dice-overlay-box">
        <div className="dice-label" style={{ color, fontSize: Math.max(11, size * 0.12) }}>{label || `${roll.name} ROLOU`}</div>
        <div className="dice-row" style={{ gap: size * 0.3, paddingTop: size * 0.5 }}>
          {dice.map((d, i) => <Dice key={`${roll.id}-${i}`} value={d} size={size} accent={color} glow={color} />)}
        </div>
        <div className="dice-result" style={{ fontSize: Math.max(20, size * 0.3), '--c': color }}>
          {phase !== 'rolling' && <span className="pop-in">{total}</span>}
        </div>
        <div className="dice-bonus" style={{ fontSize: Math.max(9, size * 0.1) }}>
          {phase !== 'rolling' && sixes > 0 && <span className="pop-in">🔥 SEIS! +{POINTS.SIX * sixes} PTS · JOGA DE NOVO</span>}
        </div>
      </div>
    </div>
  );
}
