import { useEffect, useState } from 'react';
import { CARDS, CARD_IDS, CATEGORIES, COLOR_HEX, MAX_HAND, POINTS } from '../game/constants.js';
import { absTile, isRingProgress, modeConfig } from '../game/board.js';
import { CardBack, GameCard } from './GameCard.jsx';
import { Chip, Sheet } from './Sheet.jsx';

// ---------------------------------------------------------------- loja

export function ShopSheet({ state, me, send, onClose }) {
  const [kind, setKind] = useState(null);
  const [cat, setCat] = useState(null);
  const [pick, setPick] = useState(null);
  const full = me.inventory.length >= MAX_HAND;

  if (!kind) {
    return (
      <Sheet title="🛒 LOJA DE CARTAS" onClose={onClose}>
        {full && <div className="text-neon-red text-xs mb-3">Mão cheia ({MAX_HAND}/{MAX_HAND}). Use uma carta antes de comprar.</div>}
        <div className="grid gap-3">
          <button className="pixel-btn" style={{ '--c': '#b44dff' }} disabled={full || me.points < POINTS.SURPRISE} onClick={() => setKind('SURPRISE')}>
            🎁 COMPRA SURPRESA · {POINTS.SURPRISE} PTS
          </button>
          <button className="pixel-btn" style={{ '--c': '#ffe62a' }} disabled={full || me.points < POINTS.DIRECT} onClick={() => setKind('DIRECT')}>
            🎯 COMPRA DIRETA · {POINTS.DIRECT} PTS
          </button>
        </div>
        <p className="text-[10px] opacity-60 mt-4">Surpresa: você escolhe o tipo e recebe 1 carta aleatória. Direta: você escolhe a carta exata.</p>
      </Sheet>
    );
  }

  if (!cat) {
    const surprise = kind === 'SURPRISE';
    return (
      <Sheet title={surprise ? `ESCOLHA UMA CARTA · ${POINTS.SURPRISE} PTS` : `ESCOLHA O TIPO · ${POINTS.DIRECT} PTS`} onClose={onClose}>
        <p className="text-[11px] opacity-70 mb-4">
          {surprise ? 'Toque numa carta virada. Você recebe uma carta aleatória daquele tipo.' : 'Toque num tipo para ver todas as cartas dele.'}
        </p>
        <div className="deck-row">
          {Object.values(CATEGORIES).map((c) => (
            <div key={c.id} className="deck-item">
              <CardBack category={c.id} size="sm" onClick={() => {
                if (surprise) { send({ type: 'BUY_SURPRISE', playerId: me.id, category: c.id }); onClose(); } else setCat(c.id);
              }} />
              <div className="text-[9px] opacity-70 text-center">{c.label}</div>
            </div>
          ))}
        </div>
        <button className="text-xs underline opacity-60 mt-5" onClick={() => setKind(null)}>← voltar</button>
      </Sheet>
    );
  }

  const ids = CARD_IDS.filter((id) => CARDS[id].cat === cat);
  const can = pick && state.room.deck[pick] > 0 && me.points >= POINTS.DIRECT && !full;
  return (
    <Sheet title={`CATÁLOGO · ${CATEGORIES[cat].label}`} onClose={onClose}>
      <div className="shop-grid">
        {ids.map((id) => {
          const stock = state.room.deck[id];
          return (
            <div key={id} className="shop-item">
              <GameCard cardId={id} size="md" selected={pick === id} dim={stock <= 0} onClick={() => stock > 0 && setPick(id)} />
              <div className="text-[10px] opacity-60">estoque: {stock}</div>
            </div>
          );
        })}
      </div>
      <div className="text-xs min-h-[3em] mt-3 opacity-90" style={{ fontFamily: 'system-ui, sans-serif' }}>
        {pick ? CARDS[pick].desc : 'Toque numa carta para ver o que ela faz.'}
      </div>
      <button className="pixel-btn w-full mt-3" style={{ '--c': '#39ff6a' }} disabled={!can}
        onClick={() => { send({ type: 'BUY_DIRECT', playerId: me.id, cardId: pick }); onClose(); }}>
        COMPRAR · {POINTS.DIRECT} PTS
      </button>
      <button className="text-xs underline opacity-60 mt-4" onClick={() => { setCat(null); setPick(null); }}>← voltar</button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- usar carta

export function CardSheet({ cardId, state, me, myTurn, send, onClose }) {
  const card = CARDS[cardId];
  const r = state.room;
  const cfg = modeConfig(r.mode);
  const others = state.players.filter((p) => p.id !== me.id);
  const myRing = me.pawns.filter((p) => isRingProgress(cfg, p.position));
  const firstOpp = others.flatMap((o) => o.pawns.filter((p) => isRingProgress(cfg, p.position)).map((p) => absTile(cfg, o.seat, p.position)))[0];

  const [own, setOwn] = useState(null);
  const [tp, setTp] = useState(null);
  const [tpawn, setTpawn] = useState(null);
  const [mode, setMode] = useState('ONE');
  const [target, setTarget] = useState(null);
  const [tile, setTile] = useState(firstOpp != null ? (firstOpp + 3) % cfg.ring : 10);

  let blocked = null;
  if (card.reactive) blocked = card.id === 'escudo' ? 'Usado automaticamente quando você tiver que beber.' : 'Ativa sozinha quando seu peão for comido.';
  else if (!myTurn) blocked = 'Só dá para usar na sua vez.';
  else if (r.turn.cardUsed) blocked = 'Você já usou uma carta neste turno.';
  else if (cardId === 'dado_duplo' && r.turn.phase !== 'ROLL') blocked = 'Use antes de rolar o dado.';

  // enquanto escolhe a casa do pedágio, a TV mostra os números das casas
  const pickingToll = cardId === 'pedagio' && !blocked;
  useEffect(() => {
    if (!pickingToll) return undefined;
    send({ type: 'TOLL_PICK', playerId: me.id, on: true, tile });
    return undefined;
  }, [pickingToll, tile]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (pickingToll) send({ type: 'TOLL_PICK', playerId: me.id, on: false }); }, [pickingToll]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetPawns = tp ? state.players.find((p) => p.id === tp).pawns.filter((p) => isRingProgress(cfg, p.position)) : [];
  const ready = {
    dado_duplo: true,
    cinto: own != null,
    troca: own != null && tp && tpawn != null,
    pedagio: Number.isInteger(tile) && tile >= 0 && tile < cfg.ring,
    brinde: mode === 'ALL' || Boolean(target),
    caos: true,
    imposto: true,
  }[cardId];

  const play = () => {
    const base = { type: 'PLAY_CARD', playerId: me.id, cardId };
    const extra = {
      cinto: { pawnId: own },
      troca: { ownPawnId: own, targetPlayerId: tp, targetPawnId: tpawn },
      pedagio: { tile },
      brinde: { mode, targetId: target },
    }[cardId] || {};
    send({ ...base, ...extra });
    onClose();
  };

  const PawnChips = ({ pawns, value, onPick }) => (
    <div className="flex flex-wrap gap-2">
      {pawns.length === 0 && <span className="text-[10px] opacity-60">nenhum peão na pista</span>}
      {pawns.map((p) => <Chip key={p.id} active={value === p.id} onClick={() => onPick(p.id)}>Peão {p.id + 1}</Chip>)}
    </div>
  );

  return (
    <Sheet title="SUA CARTA" onClose={onClose}>
      <div className="grid place-items-center mb-5 pt-1">
        <GameCard cardId={cardId} size="lg" showDesc className="pop-in" />
      </div>
      {blocked ? (
        <div className="text-xs text-neon-orange text-center">{blocked}</div>
      ) : (
        <div className="grid gap-4">
          {(cardId === 'cinto' || cardId === 'troca') && (
            <div><div className="text-[10px] opacity-70 mb-2">SEU PEÃO</div><PawnChips pawns={myRing} value={own} onPick={setOwn} /></div>
          )}
          {cardId === 'troca' && (
            <>
              <div>
                <div className="text-[10px] opacity-70 mb-2">ADVERSÁRIO</div>
                <div className="flex flex-wrap gap-2">
                  {others.map((o) => <Chip key={o.id} color={COLOR_HEX[o.color]} active={tp === o.id} onClick={() => { setTp(o.id); setTpawn(null); }}>{o.name}</Chip>)}
                </div>
              </div>
              {tp && <div><div className="text-[10px] opacity-70 mb-2">PEÃO DELE</div><PawnChips pawns={targetPawns} value={tpawn} onPick={setTpawn} /></div>}
            </>
          )}
          {cardId === 'pedagio' && (
            <div>
              <div className="text-[10px] opacity-70 mb-2">NÚMERO DA CASA (0–{cfg.ring - 1}) · os números aparecem no tabuleiro da TV. O pedágio fica até alguém passar e pagar</div>
              <div className="flex items-center gap-3">
                <button className="pixel-btn px-3 py-2" onClick={() => setTile((t) => (t + cfg.ring - 5) % cfg.ring)}>−5</button>
                <button className="pixel-btn px-3 py-2" onClick={() => setTile((t) => (t + cfg.ring - 1) % cfg.ring)}>−</button>
                <div className="font-pixel text-2xl w-16 text-center">{tile}</div>
                <button className="pixel-btn px-3 py-2" onClick={() => setTile((t) => (t + 1) % cfg.ring)}>+</button>
                <button className="pixel-btn px-3 py-2" onClick={() => setTile((t) => (t + 5) % cfg.ring)}>+5</button>
              </div>
            </div>
          )}
          {cardId === 'brinde' && (
            <>
              <div className="flex gap-2">
                <Chip active={mode === 'ONE'} onClick={() => setMode('ONE')}>Beba junto</Chip>
                <Chip active={mode === 'ALL'} onClick={() => setMode('ALL')}>Brinde geral</Chip>
              </div>
              {mode === 'ONE' && (
                <div className="flex flex-wrap gap-2">
                  {others.map((o) => <Chip key={o.id} color={COLOR_HEX[o.color]} active={target === o.id} onClick={() => setTarget(o.id)}>{o.name}</Chip>)}
                </div>
              )}
            </>
          )}
          <button className="pixel-btn" style={{ '--c': '#39ff6a' }} disabled={!ready} onClick={play}>USAR CARTA</button>
        </div>
      )}
    </Sheet>
  );
}
