import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Tv, Users } from 'lucide-react';
import CrtFrame from '../components/CrtFrame.jsx';
import Board from '../components/Board.jsx';
import CharacterCard from '../components/CharacterCard.jsx';
import Mascot from '../components/Mascots.jsx';
import Roulette from '../components/Roulette.jsx';
import Dice, { DiceOverlay } from '../components/Dice.jsx';
import { GameCard } from '../components/GameCard.jsx';
import { COLOR_HEX } from '../game/constants.js';
import { layoutFor, modeConfig, seatOffset } from '../game/board.js';
import { describe, reasonLabel } from '../lib/log.js';
import { sfx, unlockAudio } from '../lib/sfx.js';
import { randomCode, useHostRoom } from '../lib/useRoom.js';
import { TRANSPORT_MODE } from '../lib/transport.js';

function getHostCode() {
  const q = new URLSearchParams(window.location.search).get('room');
  if (q && /^[A-Za-z]{4}$/.test(q)) return q.toUpperCase();
  const saved = localStorage.getItem('ludo:host-room');
  if (saved) return saved;
  const c = randomCode();
  localStorage.setItem('ludo:host-room', c);
  return c;
}

export default function Host() {
  const [code, setCode] = useState(getHostCode);
  const { state, batch, apply } = useHostRoom(code);
  const stateRef = useRef(null);
  stateRef.current = state;

  const [shake, setShake] = useState(false);
  const [booms, setBooms] = useState([]);
  const [log, setLog] = useState([]);
  const [dice, setDice] = useState(null);
  const [roulette, setRoulette] = useState(null);
  const [banner, setBanner] = useState(null);
  const [diceShow, setDiceShow] = useState(null);
  const [cardShow, setCardShow] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  // Animação dos peões: "chave" -> posição exibida enquanto o peão caminha casa por casa.
  const [anim, setAnim] = useState({});
  const timers = useRef({});
  const STEP_MS = 230;
  const clearKey = (k) => { (timers.current[k] || []).forEach(clearTimeout); delete timers.current[k]; };
  useEffect(() => () => Object.keys(timers.current).forEach(clearKey), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Começa a caminhada de um peão; devolve a duração total em ms.
  const walk = (key, from, to, cfg) => {
    clearKey(key);
    const path = [];
    if (from === 'BASE') path.push(to);
    else if (to > from) for (let p = from + 1; p <= to; p++) path.push(p);
    else for (let p = from - 1; p >= to; p--) path.push(p);
    if (!path.length) return 0;
    const t0 = 80;
    setAnim((a) => ({ ...a, [key]: from === 'BASE' ? 'BASE' : from }));
    const list = [];
    path.forEach((pos, i) => {
      const last = i === path.length - 1;
      list.push(setTimeout(() => {
        setAnim((a) => ({ ...a, [key]: pos }));
        if (from === 'BASE') sfx.pop(); else if (last) sfx.land(); else sfx.step(i);
      }, t0 + i * STEP_MS));
    });
    const total = t0 + (path.length - 1) * STEP_MS + 260;
    list.push(setTimeout(() => {
      setAnim((a) => { const n = { ...a }; delete n[key]; return n; });
      delete timers.current[key];
    }, total));
    timers.current[key] = list;
    return total;
  };

  // Reage aos eventos da engine: sons, tremor de tela, explosões, roleta...
  useLayoutEffect(() => {
    const st = stateRef.current;
    if (!batch.id || !st) return;
    const L = layoutFor(st.room.mode);
    const cfg = modeConfig(st.room.mode);
    const lines = [];
    let delay = 0; // eventos depois de um MOVE esperam o peão chegar
    const later = (fn) => (delay ? setTimeout(fn, delay) : fn());

    // peões capturados ficam visíveis na casa até o atacante chegar
    const mv = batch.events.find((e) => e.type === 'MOVE');
    if (mv) {
      const cap = batch.events.find((e) => e.type === 'CAPTURE');
      const walkMs = walk(`${mv.playerId}:${mv.pawnId}`, mv.from, mv.to, cfg);
      if (walkMs && cap) {
        const victim = st.players.find((p) => p.id === cap.victimId);
        if (victim) {
          const vk = `${victim.id}:${cap.pawnId}`;
          clearKey(vk);
          setAnim((a) => ({ ...a, [vk]: (cap.tile - seatOffset(cfg, victim.seat) + cfg.ring) % cfg.ring }));
          timers.current[vk] = [setTimeout(() => {
            setAnim((a) => { const n = { ...a }; delete n[vk]; return n; });
            delete timers.current[vk];
          }, walkMs)];
        }
      }
      if (walkMs) { delay = walkMs; setDiceShow(null); setCardShow(null); }
    }

    for (const ev of batch.events) {
      const line = describe(ev, st);
      if (line) lines.push(line);
      switch (ev.type) {
        case 'DICE': {
          const who = st.players.find((p) => p.id === ev.playerId);
          setDice({ id: batch.id, playerId: ev.playerId, dice: ev.dice });
          setDiceShow({ id: batch.id, name: who?.name, color: COLOR_HEX[who?.color] || '#ffe62a', dice: ev.dice });
          sfx.dice();
          break;
        }
        case 'CARD_PLAYED': {
          const who = st.players.find((p) => p.id === ev.playerId);
          setCardShow({ id: batch.id, cardId: ev.cardId, name: who?.name, color: COLOR_HEX[who?.color] || '#ffe62a' });
          break;
        }
        case 'CAPTURE': {
          const t = L.tiles[ev.tile];
          const id = `${batch.id}-${ev.pawnId}`;
          later(() => {
            setShake(true); setTimeout(() => setShake(false), 750);
            if (t) { setBooms((b) => [...b, { id, x: t.x, y: t.y }]); setTimeout(() => setBooms((b) => b.filter((x) => x.id !== id)), 1000); }
            sfx.ko();
          });
          break;
        }
        case 'CARD_WON': later(() => { sfx.coin(); setBanner({ id: batch.id, text: `🎁 ${line.replace('🎁 ', '')}` }); setTimeout(() => setBanner(null), 3000); }); break;
        case 'CRITICAL': later(() => sfx.alarm()); break;
        case 'BEBA_OU_PAGUE': case 'DRINK_ALERT': later(() => sfx.drink()); break;
        case 'POINTS': later(() => sfx.coin()); break;
        case 'TURN': later(() => sfx.turn()); break;
        case 'WIN': later(() => sfx.win()); break;
        case 'HOOKAH_RESULT': setRoulette({ id: batch.id, ...ev }); sfx.hookah(); break;
        case 'CAOS': case 'BRINDE_GERAL': case 'IMMUNE_BLOCK':
          setBanner({ id: batch.id, text: line }); setTimeout(() => setBanner(null), 3000); break;
        default: break;
      }
    }
    if (lines.length) {
      const put = () => setLog((l) => [...lines.reverse(), ...l].slice(0, 9));
      later(put);
    }
  }, [batch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const walking = Object.keys(anim).length > 0;

  if (!state) return <CrtFrame><div className="h-full grid place-items-center font-pixel text-neon-blue glow blink">CARREGANDO...</div></CrtFrame>;

  const joinUrl = `${window.location.origin}/play?room=${code}`;
  const r = state.room;

  const newRoom = () => {
    if (!window.confirm('Criar uma sala nova? A partida atual será abandonada.')) return;
    const c = randomCode();
    localStorage.setItem('ludo:host-room', c);
    window.history.replaceState(null, '', `/host?room=${c}`);
    setCode(c);
    setLog([]);
  };

  return (
    <div className="h-full p-2 bg-black">
      <CrtFrame shake={shake}>
        {r.status === 'LOBBY' ? (
          <Lobby state={state} code={code} joinUrl={joinUrl} apply={apply} newRoom={newRoom} />
        ) : (
          <Game state={state} booms={booms} log={log} dice={dice} anim={anim} onEnd={() => setConfirmEnd(true)} />
        )}

        {/* alertas globais */}
        {r.status === 'PLAYING' && !walking && r.drinks.length > 0 && <DrinkAlert state={state} />}
        {cardShow && <CardPlayed key={cardShow.id} show={cardShow} onDone={() => setCardShow(null)} />}
        {diceShow && <DiceOverlay key={diceShow.id} roll={diceShow} color={diceShow.color} size={130} onDone={() => setDiceShow(null)} />}
        {banner && (
          <div key={banner.id} className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pop-in font-pixel text-neon-yellow glow text-lg bg-black/80 border-4 border-neon-yellow px-6 py-3">
            {banner.text}
          </div>
        )}
        {roulette && (
          <Roulette key={roulette.id} players={state.players} candidates={roulette.candidates} winnerId={roulette.winnerId}
            spin={roulette.spin} onDone={() => setRoulette(null)} />
        )}
        {confirmEnd && r.status === 'PLAYING' && (
          <div className="absolute inset-0 z-50 grid place-items-center" style={{ background: 'rgba(5,2,13,.85)' }}>
            <div className="pop-in border-4 border-neon-red bg-black p-8 text-center max-w-md">
              <div className="font-pixel text-lg text-neon-red glow">ENCERRAR A SESSÃO?</div>
              <div className="text-sm opacity-80 mt-3">A partida termina agora e o placar final aparece na tela.</div>
              <div className="flex gap-4 justify-center mt-6">
                <button className="pixel-btn ghost" onClick={() => setConfirmEnd(false)}>VOLTAR</button>
                <button className="pixel-btn" style={{ '--c': '#ff2a55' }} onClick={() => { setConfirmEnd(false); apply({ type: 'END_SESSION' }); }}>ENCERRAR</button>
              </div>
            </div>
          </div>
        )}
        {r.status === 'FINISHED' && !walking && <Winner state={state} apply={apply} newRoom={newRoom} />}
        {r.status !== 'LOBBY' && (
          <div className="absolute bottom-3 right-5 z-20 font-pixel text-[9px] opacity-60">SALA {code} · {TRANSPORT_MODE === 'local' ? 'MODO LOCAL' : 'ONLINE'}</div>
        )}
      </CrtFrame>
    </div>
  );
}

// ---------------------------------------------------------------- lobby

function Lobby({ state, code, joinUrl, apply, newRoom }) {
  const { players, room } = state;
  const slots = Array.from({ length: room.mode }, (_, i) => players[i] || null);
  return (
    <div className="h-full flex gap-8 p-10 items-center">
      <div className="flex flex-col items-center gap-5 shrink-0" style={{ width: 340 }}>
        <div className="font-pixel text-neon-purple glow text-2xl flex items-center gap-3"><Tv size={30} /> LUDO Y2K</div>
        <div className="bg-white p-3 rounded-lg" style={{ boxShadow: '0 0 28px #2ab7ff' }}>
          <QRCodeSVG value={joinUrl} size={240} />
        </div>
        <div className="text-center">
          <div className="text-xs opacity-70">ENTRE PELO CELULAR · CÓDIGO</div>
          <div className="font-pixel text-neon-yellow glow text-5xl tracking-widest mt-2">{code}</div>
          <div className="text-[10px] opacity-60 mt-2 break-all">{joinUrl}</div>
        </div>
        <div className="flex gap-3">
          {[4, 6].map((m) => (
            <button key={m} className={`pixel-btn ${room.mode === m ? '' : 'ghost'}`} style={{ '--c': '#2ab7ff' }}
              onClick={() => apply({ type: 'SET_MODE', mode: m })}>{m} JOG.</button>
          ))}
        </div>
        <button className="pixel-btn w-full text-base" style={{ '--c': '#39ff6a' }} disabled={players.length < 2}
          onClick={() => { unlockAudio(); sfx.turn(); apply({ type: 'START' }); }}>
          ▶ COMEÇAR
        </button>
        <button className="text-[10px] underline opacity-50" onClick={newRoom}>criar sala nova</button>
      </div>

      <div className="flex-1 h-full flex flex-col justify-center">
        <div className="font-pixel text-sm mb-4 flex items-center gap-2 text-neon-blue glow">
          <Users size={18} /> JOGADORES {players.length}/{room.mode} · {room.mode === 6 ? 'HEXÁGONO (3 PEÕES)' : 'CRUZ (4 PEÕES)'}
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {slots.map((p, i) => p
            ? <CharacterCard key={p.id} color={p.color} playerName={p.name} ready={p.connected} />
            : (
              <div key={i} className="rounded-xl border-4 border-dashed border-white/20 grid place-items-center font-pixel text-[10px] opacity-60 blink" style={{ minHeight: 190 }}>
                AGUARDANDO...
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- jogo

function Game({ state, booms, log, dice, anim, onEnd }) {
  const r = state.room;
  const cur = state.players.find((p) => p.id === r.current_turn_player_id);
  const sorted = [...state.players].sort((a, b) => b.points - a.points);
  return (
    <div className="h-full flex gap-4 p-6">
      <div className="h-full aspect-square shrink-0 relative">
        <Board state={state} explosions={booms} anim={anim} />
        {r.reversed_movement && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 font-pixel text-[10px] text-neon-purple glow blink">⟲ CAOS: MOVIMENTO INVERTIDO ⟲</div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="border-2 p-3 glow-box" style={{ color: cur ? COLOR_HEX[cur.color] : '#fff' }}>
          <div className="font-pixel text-[10px] opacity-80">RODADA {r.round} · VEZ DE</div>
          <div className="font-pixel text-xl mt-1">▶ {cur?.name}</div>
          <div className="flex items-center gap-2 mt-2 min-h-[44px]">
            {dice && dice.playerId === r.current_turn_player_id
              ? dice.dice.map((d, i) => (
                <Dice key={`${dice.id}-${i}`} value={d} size={44} animate={false} accent={COLOR_HEX[cur.color]} glow={COLOR_HEX[cur.color]} />
              ))
              : <span className="text-xs opacity-60">aguardando dado…</span>}
            {r.turn?.double && <span className="text-[10px] text-neon-yellow">DADO DUPLO!</span>}
          </div>
        </div>

        <div className="border-2 border-white/20 p-2">
          <div className="font-pixel text-[10px] mb-2 text-neon-yellow">PLACAR</div>
          {sorted.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 py-1 text-xs" style={{ color: COLOR_HEX[p.color] }}>
              <span className="w-4">{i + 1}º</span>
              <span className="w-3">{p.id === r.current_turn_player_id ? '▶' : ''}</span>
              <span className="flex-1 truncate font-pixel text-[10px]">{p.name}{!p.connected ? ' ✕' : ''}</span>
              <span className="text-white">🪙{p.points}</span>
              <span className="text-white/70">🎴{p.inventory.length}</span>
              <span className="text-white/60 text-[10px]">☠{p.stats.captured_pawns} 🍺{p.stats.shots_taken} 💨{p.stats.hookah_wins}</span>
            </div>
          ))}
        </div>

        <div className="border-2 border-neon-purple/50 p-2 text-[11px]">
          💨 NARGUILÉ: {r.hookah_votes.length}/{state.players.filter((p) => p.connected).length || state.players.length} prontos
          {r.toll_booths.length > 0 && <span className="ml-3">🚧 {r.toll_booths.length}</span>}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden border-2 border-white/10 p-2 text-[11px] leading-tight">
          {log.map((l, i) => <div key={i} className={i === 0 ? 'text-neon-green' : 'opacity-60'} style={{ marginBottom: 4 }}>{l}</div>)}
        </div>

        <button className="pixel-btn ghost text-[10px]" style={{ '--c': '#ff2a55' }} onClick={onEnd}>■ ENCERRAR SESSÃO</button>
      </div>
    </div>
  );
}

function DrinkAlert({ state }) {
  const items = state.room.drinks;
  const isTile = items.some((d) => d.kind === 'TILE');
  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 py-5 text-center" style={{ background: 'rgba(255,42,85,.92)', borderTop: '6px solid #fff', borderBottom: '6px solid #fff' }}>
      <div className="font-pixel text-4xl blink text-white glow">{isTile ? '🍺 BEBA OU PAGUE 🍺' : '🍺 DOSE! 🍺'}</div>
      <div className="flex justify-center gap-8 mt-3 flex-wrap px-6">
        {items.map((d) => {
          const p = state.players.find((x) => x.id === d.playerId);
          return (
            <div key={d.id} className="font-pixel text-xs text-white">
              <span style={{ color: COLOR_HEX[p?.color], background: '#000', padding: '2px 6px' }}>{p?.name}</span>
              {' '}{d.shots} dose{d.shots > 1 ? 's' : ''} · {reasonLabel(d.reason)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Winner({ state, apply, newRoom }) {
  const w = state.players.find((p) => p.id === state.room.winner_id);
  const ended = state.room.ended_early;
  const rank = [...state.players].sort((a, b) => b.points - a.points);
  return (
    <div className="absolute inset-0 z-40 grid place-items-center text-center" style={{ background: 'rgba(5,2,13,.9)' }}>
      <div className="pop-in flex flex-col items-center gap-3">
        <div style={{ width: 180, height: 188 }}><Mascot color={w?.color} /></div>
        <div className="text-4xl -mt-2">{ended ? '🏁' : '🏆'}</div>
        <div className="font-pixel text-3xl glow" style={{ color: COLOR_HEX[w?.color] }}>
          {ended ? `SESSÃO ENCERRADA · LÍDER: ${w?.name}` : `${w?.name} VENCEU!`}
        </div>
        <div className="border-2 border-white/20 p-3 min-w-[320px]">
          {rank.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 py-1 text-xs" style={{ color: COLOR_HEX[p.color] }}>
              <span className="w-5">{i + 1}º</span>
              <span className="flex-1 text-left font-pixel text-[10px]">{p.name}</span>
              <span className="text-white">🪙{p.points}</span>
              <span className="text-white/70">🏁{p.pawns.filter((x) => x.status === 'FINISHED').length}</span>
              <span className="text-white/60">☠{p.stats.captured_pawns} 🍺{p.stats.shots_taken}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <button className="pixel-btn" onClick={() => apply({ type: 'REMATCH' })}>JOGAR DE NOVO</button>
          <button className="pixel-btn ghost" style={{ '--c': '#ff2a55' }} onClick={newRoom}>SALA NOVA</button>
        </div>
      </div>
    </div>
  );
}

// Carta usada por alguém aparece grande na TV por alguns segundos.
function CardPlayed({ show, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="dice-overlay" style={{ background: 'rgba(5,2,13,.8)', zIndex: 35 }} onClick={onDone}>
      <div className="dice-overlay-box" style={{ gap: 18 }}>
        <div className="font-pixel text-xl glow" style={{ color: show.color }}>{show.name} USOU</div>
        <div className="pop-in"><GameCard cardId={show.cardId} size="xl" showDesc /></div>
      </div>
    </div>
  );
}
