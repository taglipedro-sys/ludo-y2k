import { useEffect, useRef, useState } from 'react';
import { CARDS, CARD_IDS, CATEGORIES, COLORS, COLOR_HEX, MAX_HAND, POINTS } from '../game/constants.js';
import { absTile, finishOf, isRingProgress, modeConfig } from '../game/board.js';
import { legalMoves } from '../game/engine.js';
import { reasonLabel } from '../lib/log.js';
import { usePlayerRoom } from '../lib/useRoom.js';
import CharacterCard from '../components/CharacterCard.jsx';
import Dice, { DiceOverlay } from '../components/Dice.jsx';
import { EmptySlot, FlipCard, GameCard } from '../components/GameCard.jsx';
import { CardSheet, ShopSheet } from '../components/CardUI.jsx';
import { Sheet } from '../components/Sheet.jsx';

const SAVED_KEY = 'ludo:player';
const vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };

function readSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); } catch { return null; }
}

// ---------------------------------------------------------------- entrada

export default function Play() {
  const urlRoom = (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().slice(0, 4);
  const saved = readSaved();
  const [session, setSession] = useState(() => {
    const room = urlRoom || saved?.room || '';
    return room.length === 4 && saved?.name ? { room, name: saved.name } : null;
  });

  if (!session) {
    return <JoinForm initialRoom={urlRoom || saved?.room || ''} initialName={saved?.name || ''}
      onJoin={(s) => { localStorage.setItem(SAVED_KEY, JSON.stringify(s)); setSession(s); }} />;
  }
  return <Controller room={session.room} name={session.name}
    onLeave={() => { localStorage.removeItem(SAVED_KEY); setSession(null); }} />;
}

function JoinForm({ initialRoom, initialName, onJoin }) {
  const [room, setRoom] = useState(initialRoom);
  const [name, setName] = useState(initialName);
  const ok = room.length === 4 && name.trim().length > 0;
  return (
    <div className="min-h-full p-6 flex flex-col justify-center gap-5" style={{ background: 'radial-gradient(circle at 50% 10%, #2a1060, #05020d 70%)' }}>
      <div className="text-center">
        <div className="font-pixel text-3xl text-neon-purple glow">LUDO</div>
        <div className="font-pixel text-4xl text-neon-yellow glow mt-1">Y2K</div>
      </div>
      <label className="text-xs">CÓDIGO DA SALA
        <input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
          className="w-full mt-1 p-3 bg-black border-4 border-neon-blue text-neon-blue font-pixel text-2xl text-center tracking-widest" placeholder="LUDO" autoCapitalize="characters" />
      </label>
      <label className="text-xs">SEU NOME
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 12))}
          className="w-full mt-1 p-3 bg-black border-4 border-neon-green text-neon-green font-pixel text-lg text-center" placeholder="Pedro" />
      </label>
      <button className="pixel-btn" style={{ '--c': '#39ff6a' }} disabled={!ok} onClick={() => onJoin({ room, name: name.trim() })}>
        ENTRAR
      </button>
      <p className="text-[10px] opacity-60 text-center">Caiu a conexão? Entre de novo com o mesmo nome e código para voltar ao seu estado.</p>
    </div>
  );
}

// ---------------------------------------------------------------- controle

function Controller({ room, name, onLeave }) {
  const { state, me, batch, toast, send, connected } = usePlayerRoom(room, name);
  const [sheet, setSheet] = useState(null); // 'shop' | { card } | { shield: drinkId }
  const [dieSel, setDieSel] = useState(0);
  const [reveal, setReveal] = useState(null);
  const [hookahWin, setHookahWin] = useState(null);
  const [rollShow, setRollShow] = useState(null);
  const meRef = useRef(null);
  meRef.current = me;

  // Reações a eventos: vibração, carta comprada, prêmio do narguilé.
  useEffect(() => {
    const m = meRef.current;
    if (!batch.id || !m) return;
    for (const ev of batch.events) {
      if (ev.type === 'TURN' && ev.playerId === m.id) vibrate([120, 60, 120]);
      if (ev.type === 'CRITICAL' && ev.playerId === m.id) vibrate([200, 80, 200, 80, 200]);
      if (ev.type === 'CAPTURE' && ev.victimId === m.id) vibrate(600);
      if ((ev.type === 'BEBA_OU_PAGUE' || ev.type === 'DRINK_ALERT') && ev.playerId === m.id) vibrate([300, 100, 300]);
      if ((ev.type === 'CARD_BOUGHT' || ev.type === 'CARD_WON') && ev.playerId === m.id) setReveal(ev.cardId);
      if (ev.type === 'CARD_WON' && ev.playerId === m.id) vibrate([80, 40, 80]);
      if (ev.type === 'DICE' && ev.playerId === m.id) setRollShow({ id: batch.id, dice: ev.dice, name: m.name });
      if (ev.type === 'HOOKAH_RESULT' && ev.winnerId === m.id) { setHookahWin(batch.id); vibrate([100, 50, 100, 50, 400]); }
    }
  }, [batch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Peão em estado crítico: vibração tátil periódica.
  const anyCritical = Boolean(me?.pawns.some((p) => p.status === 'CRITICAL_STATE')) && state?.room.status === 'PLAYING';
  useEffect(() => {
    if (!anyCritical) return undefined;
    const t = setInterval(() => vibrate(70), 1500);
    return () => clearInterval(t);
  }, [anyCritical]);

  const diceKey = state?.room.turn?.dice.join(',');
  useEffect(() => { setDieSel(0); }, [diceKey]);

  if (!connected) {
    return <Center><div className="font-pixel text-neon-blue glow blink text-sm text-center">PROCURANDO A TV<br />DA SALA {room}…</div>
      <button className="text-xs underline opacity-60" onClick={onLeave}>trocar sala/nome</button></Center>;
  }
  if (!me) {
    return <Center><div className="font-pixel text-sm text-center">ENTRANDO…</div>
      {toast && <div className="text-neon-red text-xs text-center">{toast.text}</div>}
      <button className="text-xs underline opacity-60" onClick={onLeave}>voltar</button></Center>;
  }

  const r = state.room;
  const hex = COLOR_HEX[me.color];
  const cfg = modeConfig(r.mode);
  const finish = finishOf(cfg);
  const cur = state.players.find((p) => p.id === r.current_turn_player_id);
  const myTurn = r.status === 'PLAYING' && r.current_turn_player_id === me.id;
  const turn = r.turn;
  const myDrinks = r.drinks.filter((d) => d.playerId === me.id);
  const waitingOn = r.drinks.filter((d) => d.playerId !== me.id).map((d) => state.players.find((p) => p.id === d.playerId)?.name);
  const canAct = myTurn && myDrinks.length === 0 && r.drinks.length === 0;
  const activeCount = state.players.filter((p) => p.connected).length || state.players.length;
  const voted = r.hookah_votes.includes(me.id);

  return (
    <div className="min-h-full flex flex-col" style={{ background: `radial-gradient(circle at 50% 0%, ${hex}33, #05020d 60%)` }}>
      {/* topo */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-black/80 border-b-4" style={{ borderColor: hex }}>
        <div className="w-4 h-4 rounded-full" style={{ background: hex, boxShadow: `0 0 10px ${hex}` }} />
        <div className="font-pixel text-xs flex-1 truncate" style={{ color: hex }}>{me.name}</div>
        <div className="font-pixel text-sm text-neon-yellow">🪙 {me.points}</div>
        <button className="font-pixel text-[9px] border-2 border-white/40 px-2 py-1" onClick={() => { if (window.confirm('Sair da partida? Você pode voltar depois com o mesmo nome e código.')) onLeave(); }}>SAIR</button>
      </div>

      {toast && (
        <div key={`toast-${toast.id}`} className="fixed top-14 inset-x-3 z-50 pop-in bg-neon-red text-black font-pixel text-[10px] p-3 border-2 border-white">{toast.text}</div>
      )}

      <div className="flex-1 p-4 pb-28 flex flex-col gap-4">
        {r.status === 'LOBBY' && <LobbyPicker state={state} me={me} send={send} />}

        {r.status === 'FINISHED' && (
          <div className="text-center font-pixel text-lg text-neon-yellow glow mt-10">
            {r.ended_early ? '🏁 SESSÃO ENCERRADA' : `🏆 ${state.players.find((p) => p.id === r.winner_id)?.name} VENCEU!`}
            <div className="text-[10px] text-white/70 mt-4">Olhe a TV.</div>
            <button className="pixel-btn mt-8" onClick={onLeave}>SAIR DA SALA</button>
          </div>
        )}

        {r.status === 'PLAYING' && (
          <>
            <div className={`text-center font-pixel py-3 border-4 ${myTurn ? 'pulse-ring' : ''}`}
              style={{ '--c': hex, borderColor: myTurn ? hex : '#ffffff22', color: myTurn ? hex : '#fff', fontSize: myTurn ? 18 : 11 }}>
              {myTurn ? 'SUA VEZ!' : `Vez de ${cur?.name}`}
              {r.reversed_movement && <div className="text-[9px] text-neon-purple mt-1 blink">⟲ CAOS: MOVIMENTO INVERTIDO</div>}
            </div>

            {/* doses pendentes */}
            {myDrinks.length > 0 && (
              <DrinkPanel d={myDrinks[0]} me={me} send={send} onShield={() => setSheet({ shield: myDrinks[0].id })} />
            )}
            {waitingOn.length > 0 && myDrinks.length === 0 && (
              <div className="text-center text-xs text-neon-orange blink">🍺 Aguardando {[...new Set(waitingOn)].join(', ')} cumprir a dose…</div>
            )}

            {/* ação principal */}
            {canAct && turn.phase === 'ROLL' && (
              <>
                <button className="pixel-btn text-lg py-6" style={{ '--c': hex }} onClick={() => send({ type: 'ROLL', playerId: me.id })}>
                  🎲 ROLAR DADO{turn.double ? ' x2' : ''}
                </button>
                {me.pawns.some((p) => p.position === 'BASE') && (
                  <button className="pixel-btn ghost text-[10px]" style={{ '--c': '#ffe62a' }} disabled={me.points < POINTS.BUY_EXIT}
                    onClick={() => send({ type: 'BUY_EXIT', playerId: me.id, pawnId: me.pawns.find((p) => p.position === 'BASE').id })}>
                    SAIR DA BASE · {POINTS.BUY_EXIT} PTS
                  </button>
                )}
              </>
            )}
            {canAct && turn.phase === 'MOVE' && (
              <div>
                {turn.rolled.length === 2 && turn.dice.length === 1 ? (
                  <>
                    <div className="text-[10px] opacity-70 mb-2">2 DADOS SOMADOS — escolha o peão que anda tudo</div>
                    <div className="flex items-center gap-3">
                      <Dice value={turn.rolled[0]} size={40} animate={false} accent={hex} glow="transparent" />
                      <span className="font-pixel text-lg">+</span>
                      <Dice value={turn.rolled[1]} size={40} animate={false} accent={hex} glow="transparent" />
                      <span className="font-pixel text-lg">=</span>
                      <span className="font-pixel text-4xl glow" style={{ color: hex }}>{turn.dice[0]}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] opacity-70 mb-2">DADOS — escolha um e depois o peão</div>
                    <div className="flex gap-3">
                      {turn.dice.map((d, i) => (
                        <button key={`${batch.id}-${i}`} type="button" onClick={() => setDieSel(i)} className="grid place-items-center p-2 rounded-md"
                          style={{ background: i === dieSel ? hex + '55' : '#ffffff10', outline: i === dieSel ? `3px solid ${hex}` : '3px solid transparent' }}>
                          <Dice value={d} size={44} animate={false} accent={hex} glow={i === dieSel ? hex : 'transparent'} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* peões */}
            <div>
              <div className="text-[10px] opacity-70 mb-2">SEUS PEÕES</div>
              <div className="grid grid-cols-2 gap-3">
                {me.pawns.map((pw) => {
                  const legal = canAct && turn.phase === 'MOVE' && legalMoves(state, me.id, turn.dice[dieSel] ?? 0).includes(pw.id);
                  const crit = pw.status === 'CRITICAL_STATE';
                  const immune = pw.immune_until != null && pw.immune_until > r.round;
                  return (
                    <button key={pw.id} disabled={!legal}
                      onClick={() => send({ type: 'MOVE', playerId: me.id, pawnId: pw.id, dieIndex: dieSel })}
                      className={`text-left p-3 border-4 rounded-md ${crit ? 'blink pulse-ring' : ''}`}
                      style={{ '--c': hex, borderColor: legal ? '#fff' : hex + '55', background: legal ? hex + '55' : '#00000055', opacity: pw.status === 'FINISHED' ? 0.5 : 1 }}>
                      <div className="font-pixel text-[10px]" style={{ color: hex }}>PEÃO {pw.id + 1} {immune && '🪢'}</div>
                      <div className="text-[11px] mt-1">{pawnLabel(pw, cfg, finish)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* mão */}
            <div>
              <div className="text-[10px] opacity-70 mb-2">SUA MÃO ({me.inventory.length}/{MAX_HAND})</div>
              <div className="hand">
                {Array.from({ length: MAX_HAND }, (_, i) => {
                  const id = me.inventory[i];
                  const rot = MAX_HAND === 3 ? [-7, 0, 7][i] : 0;
                  return (
                    <div key={i} className="hand-slot" style={{ transform: `translateY(${i === 1 ? -8 : 0}px) rotate(${rot}deg)`, zIndex: i }}>
                      {id ? <GameCard cardId={id} size="sm" onClick={() => setSheet({ card: id })} /> : <EmptySlot size="sm" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* menu inferior fixo */}
      {r.status === 'PLAYING' && (
        <div className="fixed bottom-0 inset-x-0 z-30 grid grid-cols-[1fr_2fr] gap-2 p-3 bg-black/90 border-t-4 border-white/20">
          <button className="pixel-btn text-[10px]" style={{ '--c': '#ffe62a' }} onClick={() => setSheet('shop')}>🛒 LOJA</button>
          <button className={`pixel-btn text-[10px] ${voted ? '' : 'ghost'}`} style={{ '--c': '#b44dff' }}
            onClick={() => send({ type: 'HOOKAH_VOTE', playerId: me.id })}>
            💨 Sortear Narguilé ({r.hookah_votes.length}/{activeCount})
          </button>
        </div>
      )}

      {/* sheets */}
      {sheet === 'shop' && <ShopSheet state={state} me={me} send={send} onClose={() => setSheet(null)} />}
      {sheet?.card && <CardSheet cardId={sheet.card} state={state} me={me} myTurn={canAct} send={send} onClose={() => setSheet(null)} />}
      {sheet?.shield && (
        <Sheet title="🛡️ PASSAR A DOSE PARA…" onClose={() => setSheet(null)}>
          <div className="grid gap-2">
            {state.players.filter((p) => p.id !== me.id).map((p) => (
              <button key={p.id} className="pixel-btn" style={{ '--c': COLOR_HEX[p.color] }}
                onClick={() => { send({ type: 'DRINK_RESOLVE', playerId: me.id, drinkId: sheet.shield, choice: 'SHIELD', target: p.id }); setSheet(null); }}>
                {p.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {rollShow && (
        <DiceOverlay key={`roll-${rollShow.id}`} roll={rollShow} label="VOCÊ ROLOU" color={hex} size={92} fixed onDone={() => setRollShow(null)} />
      )}
      {reveal && (
        <Overlay onClose={() => setReveal(null)}>
          <div className="font-pixel text-neon-yellow glow text-sm mb-5">NOVA CARTA!</div>
          <div className="grid place-items-center"><FlipCard key={reveal} cardId={reveal} /></div>
        </Overlay>
      )}
      {hookahWin && (
        <Overlay onClose={() => setHookahWin(null)}>
          <div className="text-7xl pop-in">💨</div>
          <div className="font-pixel text-neon-purple glow text-base mt-4">PREPARE O NARGUILÉ!</div>
          <div className="font-pixel text-neon-yellow text-sm mt-3">+{POINTS.HOOKAH} PONTOS</div>
        </Overlay>
      )}
    </div>
  );
}

function pawnLabel(pw, cfg, finish) {
  if (pw.position === 'BASE') return 'Na base';
  if (pw.status === 'FINISHED') return 'Chegou 🏁';
  const left = finish - pw.position;
  if (pw.status === 'CRITICAL_STATE') return `🚨 RETA FINAL · faltam ${left}`;
  if (pw.position > cfg.ring - 2) return `Reta final · faltam ${left}`;
  return `Casa ${pw.position + 1} · faltam ${left}`;
}

// ---------------------------------------------------------------- pedaços de UI

function Center({ children }) {
  return <div className="min-h-full flex flex-col items-center justify-center gap-4 p-6">{children}</div>;
}

function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6 text-center" style={{ background: 'rgba(5,2,13,.92)' }} onClick={onClose}>
      <div>{children}<div className="text-[10px] opacity-50 mt-8">toque para fechar</div></div>
    </div>
  );
}

function LobbyPicker({ state, me, send }) {
  return (
    <div>
      <div className="font-pixel text-[11px] text-neon-yellow mb-3">ESCOLHA SEU PERSONAGEM</div>
      <div className="grid grid-cols-2 gap-3 justify-items-center">
        {COLORS.map((c) => {
          const taken = state.players.some((p) => p.id !== me.id && p.color === c);
          return <CharacterCard key={c} color={c} compact selected={me.color === c} disabled={taken}
            onClick={() => send({ type: 'SET_COLOR', playerId: me.id, color: c })} />;
        })}
      </div>
      <div className="text-center text-xs opacity-70 mt-6 blink">Aguardando a TV iniciar a partida… ({state.players.length} na sala)</div>
    </div>
  );
}

function DrinkPanel({ d, me, send, onShield }) {
  const isTile = d.kind === 'TILE';
  const hasShield = d.shield && me.inventory.includes('escudo');
  return (
    <div className="border-4 border-white p-4 text-center pop-in" style={{ background: '#ff2a55' }}>
      <div className="font-pixel text-lg blink text-white">{isTile ? 'BEBA OU PAGUE' : 'DOSE!'}</div>
      <div className="text-xs text-white mt-1">{d.shots} dose{d.shots > 1 ? 's' : ''} · {reasonLabel(d.reason)}</div>
      <div className="grid gap-2 mt-3">
        <button className="pixel-btn" style={{ '--c': '#ffe62a' }}
          onClick={() => send({ type: 'DRINK_RESOLVE', playerId: me.id, drinkId: d.id, choice: 'DRINK' })}>
          🍺 BEBER{d.reward ? ` (+${d.reward} PTS)` : ''}
        </button>
        {hasShield && <button className="pixel-btn" style={{ '--c': '#2ab7ff' }} onClick={onShield}>🛡️ ESCUDO · PASSAR A DOSE</button>}
        {d.canPay && (
          <button className="pixel-btn" style={{ '--c': '#39ff6a' }} disabled={me.points < d.payCost}
            onClick={() => send({ type: 'DRINK_RESOLVE', playerId: me.id, drinkId: d.id, choice: 'PAY' })}>
            💰 PAGAR {d.payCost} PTS
          </button>
        )}
      </div>
    </div>
  );
}
