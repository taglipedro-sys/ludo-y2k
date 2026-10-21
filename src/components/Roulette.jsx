import { useEffect, useState } from 'react';
import { COLOR_HEX } from '../game/constants.js';

// Roleta estilo programa de auditório dos anos 2000.
export default function Roulette({ players, candidates, winnerId, spin = 0.5, onDone }) {
  const list = candidates.map((id) => players.find((p) => p.id === id)).filter(Boolean);
  const n = list.length;
  const seg = 360 / n;
  const wi = Math.max(0, list.findIndex((p) => p.id === winnerId));
  // o ponteiro fica no topo; o centro do setor vencedor precisa parar nele (com pequeno desvio aleatório)
  const jitter = (spin - 0.5) * seg * 0.6;
  const target = 360 * 6 - (wi + 0.5) * seg - jitter;
  const [rot, setRot] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setRot(target), 80);
    const t2 = setTimeout(() => setDone(true), 5300);
    const t3 = setTimeout(() => onDone?.(), 10500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gradient = `conic-gradient(${list.map((p, i) => `${COLOR_HEX[p.color]} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ')})`;
  const winner = list[wi];

  return (
    <div className="absolute inset-0 z-40 grid place-items-center" style={{ background: 'rgba(5,2,13,.88)' }}>
      <div className="flex flex-col items-center gap-5">
        <div className="font-pixel text-neon-yellow glow text-xl blink">💨 SORTEIO DO NARGUILÉ 💨</div>
        <div className="relative" style={{ width: 'min(62vh, 520px)', height: 'min(62vh, 520px)' }}>
          <div className="absolute inset-[-18px] rounded-full marquee" />
          <div className="absolute inset-0 rounded-full border-[8px] border-white overflow-hidden wheel"
            style={{ background: gradient, transform: `rotate(${rot}deg)` }}>
            {list.map((p, i) => (
              <div key={p.id} className="absolute left-1/2 top-1/2 font-pixel text-[#08031a]"
                style={{
                  fontSize: 14, transformOrigin: '0 0',
                  transform: `rotate(${(i + 0.5) * seg - 90}deg) translate(60px, -7px)`,
                }}>
                {p.name}
              </div>
            ))}
          </div>
          <div className="absolute left-1/2 -top-6 -translate-x-1/2 text-5xl" style={{ filter: 'drop-shadow(0 0 8px #fff)' }}>▼</div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white grid place-items-center text-3xl">💨</div>
        </div>
        <div className="h-24 text-center">
          {done && winner && (
            <div className="pop-in">
              <div className="font-pixel text-2xl glow" style={{ color: COLOR_HEX[winner.color] }}>{winner.name}</div>
              <div className="font-pixel text-sm mt-2 text-white">PREPARE O NARGUILÉ! +50 PTS</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
