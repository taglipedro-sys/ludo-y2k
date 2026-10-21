// Engine pura do jogo: reduce(state, action, rng) -> { state, events, error }
// Sem dependências de React/Supabase, roda no navegador do Host (autoridade) e em testes Node.

import { CARDS, CARD_IDS, CATEGORIES, COLORS, IMPOSTO_MIN, IMPOSTO_RATE, MAX_HAND, POINTS, freshDeck } from './constants.js';
import { absTile, drinkTiles, finishOf, isRingProgress, isStartTile, modeConfig, seatOffset } from './board.js';

// ---------------------------------------------------------------- estado

export function createRoom(code, mode = 4) {
  return {
    room: {
      code,
      status: 'LOBBY', // LOBBY | PLAYING | FINISHED
      mode,
      current_turn_player_id: null,
      reversed_movement: false,
      toll_booths: [], // { tile_index, owner_id, until_round }
      hookah_votes: [],
      // extensões do esquema base:
      round: 1,
      turn: null, // { phase, dice, rolled, sixes, cardUsed, double, extra }
      drinks: [], // obrigações de beber/pagar pendentes
      drink_counter: 0,
      deck: freshDeck(),
      chaos_until: 0,
      winner_id: null,
      ended_early: false,
      seq: 0,
    },
    players: [],
  };
}

const newTurn = () => ({ phase: 'ROLL', dice: [], rolled: [], sixes: 0, cardUsed: false, double: false, extra: false });

const byId = (s, id) => s.players.find((p) => p.id === id);
const cfgOf = (s) => modeConfig(s.room.mode);
const isImmune = (s, pawn) => pawn.immune_until != null && pawn.immune_until > s.room.round;

export const rngDefault = Math.random;
const randInt = (rng, n) => Math.floor(rng() * n);

// ---------------------------------------------------------------- movimento

// Resultado de mover `pawn` com o dado `die`, ou null se for inválido.
export function computeMove(s, player, pawn, die) {
  const cfg = cfgOf(s);
  const finish = finishOf(cfg);
  if (pawn.status === 'FINISHED') return null;
  if (pawn.position === 'BASE') return die === 6 ? { from: 'BASE', to: 0, kind: 'EXIT' } : null;
  const p = pawn.position;
  if (s.room.reversed_movement && isRingProgress(cfg, p)) {
    const np = p - die;
    return np >= 0 ? { from: p, to: np, kind: 'STEP' } : null;
  }
  const np = p + die;
  return np <= finish ? { from: p, to: np, kind: 'STEP' } : null;
}

export function legalMoves(s, playerId, die) {
  const player = byId(s, playerId);
  if (!player) return [];
  return player.pawns.filter((pw) => computeMove(s, player, pw, die)).map((pw) => pw.id);
}

function hasLegal(s, player, dice) {
  return dice.some((d) => player.pawns.some((pw) => computeMove(s, player, pw, d)));
}

// ---------------------------------------------------------------- obrigações de beber

function addDrink(s, events, playerId, shots, reason, opts = {}) {
  const d = {
    id: ++s.room.drink_counter,
    playerId,
    shots,
    reason,
    kind: opts.kind || 'PUNISH', // TILE | TOLL | PUNISH
    shield: opts.shield !== false,
    canPay: !!opts.canPay,
    payCost: opts.payCost || 0,
    payTo: opts.payTo || null,
    reward: opts.reward || 0,
  };
  s.room.drinks.push(d);
  events.push({ type: d.kind === 'TILE' ? 'BEBA_OU_PAGUE' : 'DRINK_ALERT', playerId, drinkId: d.id, reason, shots });
  return d;
}

// ---------------------------------------------------------------- turnos

function activeIds(s) {
  const con = s.players.filter((p) => p.connected);
  return (con.length ? con : s.players).map((p) => p.id);
}

function nextTurn(s, events) {
  const idx = s.players.findIndex((p) => p.id === s.room.current_turn_player_id);
  const active = new Set(activeIds(s));
  let n = idx;
  for (let i = 0; i < s.players.length; i++) {
    n = (n + 1) % s.players.length;
    if (active.has(s.players[n].id)) break;
  }
  if (n <= idx) s.room.round += 1;
  const round = s.room.round;
  s.room.toll_booths = s.room.toll_booths.filter((b) => b.until_round > round);
  if (s.room.reversed_movement && s.room.chaos_until <= round) {
    s.room.reversed_movement = false;
    events.push({ type: 'CAOS_END' });
  }
  for (const p of s.players) for (const pw of p.pawns) if (pw.immune_until != null && pw.immune_until <= round) pw.immune_until = null;
  s.room.current_turn_player_id = s.players[n].id;
  s.room.turn = newTurn();
  events.push({ type: 'TURN', playerId: s.players[n].id, round });
}

function endStep(s, events) {
  const t = s.room.turn;
  if (s.room.status !== 'PLAYING') return;
  if (t.extra) {
    t.phase = 'ROLL';
    t.dice = [];
    t.rolled = [];
    t.extra = false;
    t.double = false;
    events.push({ type: 'EXTRA_ROLL', playerId: s.room.current_turn_player_id });
  } else {
    nextTurn(s, events);
  }
}

// ---------------------------------------------------------------- aplicar movimento

function refreshStatus(s, player) {
  const cfg = cfgOf(s);
  const finish = finishOf(cfg);
  for (const pw of player.pawns) {
    if (pw.position === 'BASE' || pw.status === 'FINISHED') continue;
    pw.status = finish - pw.position <= 5 && pw.position < finish ? 'CRITICAL_STATE' : 'NORMAL';
  }
}

// Carta de brinde (grátis). Com a mão cheia, vira pontos.
function rewardCard(s, events, p, rng, reason) {
  if (p.inventory.length >= MAX_HAND) {
    p.points += POINTS.CARD_FULL;
    events.push({ type: 'POINTS', playerId: p.id, amount: POINTS.CARD_FULL, reason: 'MAO_CHEIA' });
    return;
  }
  const pool = [];
  for (const id of CARD_IDS) for (let i = 0; i < s.room.deck[id]; i++) pool.push(id);
  if (!pool.length) return;
  const cardId = pool[randInt(rng, pool.length)];
  s.room.deck[cardId] -= 1;
  p.inventory.push(cardId);
  events.push({ type: 'CARD_WON', playerId: p.id, cardId, reason });
}

function applyMove(s, events, player, pawn, mv, rng = rngDefault) {
  const cfg = cfgOf(s);
  const finish = finishOf(cfg);
  const wasCritical = pawn.status === 'CRITICAL_STATE';
  const round = s.room.round;
  pawn.position = mv.to;
  events.push({ type: 'MOVE', playerId: player.id, pawnId: pawn.id, from: mv.from, to: mv.to });

  if (mv.kind === 'EXIT') {
    player.points += POINTS.EXIT_BASE;
    events.push({ type: 'POINTS', playerId: player.id, amount: POINTS.EXIT_BASE, reason: 'SAIU_DA_BASE' });
  }

  // Pedágios no caminho (sem parar o peão).
  if (typeof mv.to === 'number' && isRingProgress(cfg, mv.to)) {
    const from = mv.from === 'BASE' ? mv.to : mv.from;
    const step = mv.to >= from ? 1 : -1;
    for (let q = mv.from === 'BASE' ? mv.to : from + step; step > 0 ? q <= mv.to : q >= mv.to; q += step) {
      if (!isRingProgress(cfg, q)) break;
      const tile = absTile(cfg, player.seat, q);
      const booth = s.room.toll_booths.find((b) => b.tile_index === tile && b.owner_id !== player.id && b.until_round > round);
      if (booth) {
        addDrink(s, events, player.id, 1, 'PEDAGIO', { kind: 'TOLL', canPay: true, payCost: POINTS.TOLL, payTo: booth.owner_id });
      }
      if (mv.from === 'BASE') break;
    }
  }

  // Captura e casa de bebida (somente na pista).
  if (isRingProgress(cfg, mv.to)) {
    const tile = absTile(cfg, player.seat, mv.to);
    if (!isStartTile(cfg, tile)) {
      for (const other of s.players) {
        if (other.id === player.id) continue;
        for (const op of other.pawns) {
          if (!isRingProgress(cfg, op.position) || absTile(cfg, other.seat, op.position) !== tile) continue;
          if (isImmune(s, op)) {
            events.push({ type: 'IMMUNE_BLOCK', attackerId: player.id, victimId: other.id, pawnId: op.id });
            addDrink(s, events, player.id, 1, 'CINTO');
            continue;
          }
          op.position = 'BASE';
          op.status = 'NORMAL';
          op.immune_until = null;
          player.points += POINTS.CAPTURE;
          player.stats.captured_pawns += 1;
          events.push({ type: 'CAPTURE', attackerId: player.id, victimId: other.id, pawnId: op.id, tile });
          events.push({ type: 'POINTS', playerId: player.id, amount: POINTS.CAPTURE, reason: 'CAPTURA' });
          rewardCard(s, events, player, rng, 'CAPTURA');
          const vi = other.inventory.indexOf('vinganca');
          if (vi >= 0) {
            other.inventory.splice(vi, 1);
            s.room.deck.vinganca += 1;
            events.push({ type: 'CARD_TRIGGER', playerId: other.id, cardId: 'vinganca' });
            addDrink(s, events, player.id, 2, 'VINGANCA');
          }
        }
      }
      if (drinkTiles(cfg).has(tile)) {
        const targets = s.room.reversed_movement ? s.players.map((p) => p.id) : [player.id];
        for (const id of targets) {
          addDrink(s, events, id, 1, 'CASA_BEBIDA', { kind: 'TILE', canPay: true, payCost: POINTS.DODGE, reward: POINTS.DRINK_TILE });
        }
      }
    }
  }

  if (mv.to === finish) {
    pawn.status = 'FINISHED';
    events.push({ type: 'PAWN_FINISHED', playerId: player.id, pawnId: pawn.id });
    if (player.pawns.every((p) => p.status === 'FINISHED')) {
      s.room.status = 'FINISHED';
      s.room.winner_id = player.id;
      events.push({ type: 'WIN', playerId: player.id });
    } else {
      rewardCard(s, events, player, rng, 'PEAO_CHEGOU');
    }
  }
  refreshStatus(s, player);
  if (!wasCritical && pawn.status === 'CRITICAL_STATE') {
    events.push({ type: 'CRITICAL', playerId: player.id, pawnId: pawn.id });
  }
}

// ---------------------------------------------------------------- guards

function turnGuard(s, a, phases) {
  if (s.room.status !== 'PLAYING') return 'A partida não está em andamento.';
  if (s.room.current_turn_player_id !== a.playerId) return 'Não é a sua vez.';
  if (s.room.drinks.length) return 'Resolva as doses pendentes primeiro.';
  if (phases && !phases.includes(s.room.turn.phase)) return 'Ação indisponível agora.';
  return null;
}

// ---------------------------------------------------------------- handlers

const H = {};

H.JOIN = (s, a, ev) => {
  const name = String(a.name || '').trim().slice(0, 12);
  if (!name) return 'Digite um nome.';
  const existing = s.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.connected = true;
    ev.push({ type: 'RECONNECTED', playerId: existing.id });
    return null;
  }
  if (s.room.status !== 'LOBBY') return 'A partida já começou.';
  if (s.players.length >= s.room.mode) return 'Sala cheia.';
  const taken = new Set(s.players.map((p) => p.color));
  const color = COLORS.includes(a.color) && !taken.has(a.color) ? a.color : COLORS.find((c) => !taken.has(c));
  const id = `player_${s.players.length + 1}`;
  s.players.push({
    id, name, color, points: 0, inventory: [], pawns: [], seat: null, connected: true,
    stats: { captured_pawns: 0, shots_taken: 0, hookah_wins: 0 },
  });
  ev.push({ type: 'JOINED', playerId: id });
  return null;
};

H.SET_COLOR = (s, a) => {
  if (s.room.status !== 'LOBBY') return 'Só no lobby.';
  const p = byId(s, a.playerId);
  if (!p || !COLORS.includes(a.color)) return 'Cor inválida.';
  if (s.players.some((o) => o.id !== p.id && o.color === a.color)) return 'Cor já escolhida.';
  p.color = a.color;
  return null;
};

H.SET_MODE = (s, a) => {
  if (s.room.status !== 'LOBBY') return 'Só no lobby.';
  if (![4, 6].includes(a.mode)) return 'Modo inválido.';
  if (s.players.length > a.mode) return 'Jogadores demais para esse modo.';
  s.room.mode = a.mode;
  return null;
};

H.START = (s, a, ev) => {
  if (s.room.status !== 'LOBBY') return 'Já iniciado.';
  if (s.players.length < 2) return 'Mínimo de 2 jogadores.';
  const cfg = cfgOf(s);
  s.players.forEach((p, i) => {
    p.seat = i;
    p.points = 0;
    p.inventory = [];
    p.pawns = Array.from({ length: cfg.pawns }, (_, id) => ({ id, position: 'BASE', status: 'NORMAL', immune_until: null }));
  });
  s.room.status = 'PLAYING';
  s.room.round = 1;
  s.room.deck = freshDeck();
  s.room.drinks = [];
  s.room.toll_booths = [];
  s.room.hookah_votes = [];
  s.room.reversed_movement = false;
  s.room.winner_id = null;
  s.room.current_turn_player_id = s.players[0].id;
  s.room.turn = newTurn();
  ev.push({ type: 'GAME_START' });
  return null;
};

// Encerra a sessão pela TV: quem tem mais peões na chegada (e depois mais pontos) fica em 1º.
H.END_SESSION = (s, a, ev) => {
  if (s.room.status !== 'PLAYING') return 'Não há partida em andamento.';
  const score = (p) => p.pawns.filter((x) => x.status === 'FINISHED').length * 1000 + p.points;
  const best = [...s.players].sort((x, y) => score(y) - score(x))[0];
  s.room.status = 'FINISHED';
  s.room.winner_id = best?.id ?? null;
  s.room.ended_early = true;
  s.room.drinks = [];
  ev.push({ type: 'SESSION_END', playerId: best?.id ?? null });
  return null;
};

H.REMATCH = (s, a, ev) => {
  s.room.ended_early = false;
  for (const p of s.players) { p.pawns = []; p.inventory = []; p.points = 0; p.seat = null; p.stats = { captured_pawns: 0, shots_taken: 0, hookah_wins: 0 }; }
  s.room.status = 'LOBBY';
  s.room.turn = null;
  s.room.drinks = [];
  s.room.toll_booths = [];
  s.room.hookah_votes = [];
  s.room.current_turn_player_id = null;
  s.room.winner_id = null;
  s.room.reversed_movement = false;
  ev.push({ type: 'REMATCH' });
  return null;
};

H.PRESENCE = (s, a) => {
  const names = new Set((a.names || []).map((n) => String(n).toLowerCase()));
  for (const p of s.players) p.connected = names.has(p.name.toLowerCase());
  return null;
};

H.ROLL = (s, a, ev, rng) => {
  const err = turnGuard(s, a, ['ROLL']);
  if (err) return err;
  const p = byId(s, a.playerId);
  const t = s.room.turn;
  const n = t.double ? 2 : 1;
  const dice = Array.from({ length: n }, () => 1 + randInt(rng, 6));
  t.rolled = [...dice];
  t.dice = [...dice];
  t.phase = 'MOVE';
  const sixes = dice.filter((d) => d === 6).length;
  if (sixes) t.sixes += 1;
  t.extra = sixes > 0 && t.sixes < 3;
  t.double = false;
  ev.push({ type: 'DICE', playerId: p.id, dice });
  if (sixes) {
    p.points += POINTS.SIX * sixes;
    ev.push({ type: 'POINTS', playerId: p.id, amount: POINTS.SIX * sixes, reason: 'SEIS' });
  }
  if (n === 2 && dice[0] === dice[1]) addDrink(s, ev, p.id, 1, 'DADO_DUPLO');
  if (!hasLegal(s, p, t.dice)) {
    ev.push({ type: 'NO_MOVES', playerId: p.id });
    endStep(s, ev);
  }
  return null;
};

H.MOVE = (s, a, ev, rng) => {
  const err = turnGuard(s, a, ['MOVE']);
  if (err) return err;
  const p = byId(s, a.playerId);
  const t = s.room.turn;
  const di = Number.isInteger(a.dieIndex) ? a.dieIndex : 0;
  const die = t.dice[di];
  const pawn = p.pawns.find((pw) => pw.id === a.pawnId);
  if (die == null || !pawn) return 'Movimento inválido.';
  const mv = computeMove(s, p, pawn, die);
  if (!mv) return 'Esse peão não pode andar com esse dado.';
  t.dice.splice(di, 1);
  applyMove(s, ev, p, pawn, mv, rng);
  if (s.room.status !== 'PLAYING') return null;
  if (t.dice.length === 0 || !hasLegal(s, p, t.dice)) endStep(s, ev);
  return null;
};

H.BUY_EXIT = (s, a, ev) => {
  const err = turnGuard(s, a, ['ROLL']);
  if (err) return err;
  const p = byId(s, a.playerId);
  const pawn = p.pawns.find((pw) => pw.id === a.pawnId);
  if (!pawn || pawn.position !== 'BASE') return 'Esse peão não está na base.';
  if (p.points < POINTS.BUY_EXIT) return `Faltam pontos (${POINTS.BUY_EXIT}).`;
  p.points -= POINTS.BUY_EXIT;
  pawn.position = 0;
  p.points += POINTS.EXIT_BASE;
  ev.push({ type: 'BUY_EXIT', playerId: p.id, pawnId: pawn.id });
  ev.push({ type: 'POINTS', playerId: p.id, amount: POINTS.EXIT_BASE, reason: 'SAIU_DA_BASE' });
  return null;
};

function gainCard(s, ev, p, cardId, mode, cost) {
  p.points -= cost;
  s.room.deck[cardId] -= 1;
  p.inventory.push(cardId);
  ev.push({ type: 'CARD_BOUGHT', playerId: p.id, cardId, mode });
}

H.BUY_SURPRISE = (s, a, ev, rng) => {
  if (s.room.status !== 'PLAYING') return 'Partida não iniciada.';
  const p = byId(s, a.playerId);
  if (!CATEGORIES[a.category]) return 'Categoria inválida.';
  if (p.inventory.length >= MAX_HAND) return `Mão cheia (${MAX_HAND} cartas).`;
  if (p.points < POINTS.SURPRISE) return `Faltam pontos (${POINTS.SURPRISE}).`;
  const pool = [];
  for (const id of CARD_IDS) if (CARDS[id].cat === a.category) for (let i = 0; i < s.room.deck[id]; i++) pool.push(id);
  if (!pool.length) return 'Categoria sem estoque.';
  gainCard(s, ev, p, pool[randInt(rng, pool.length)], 'SURPRISE', POINTS.SURPRISE);
  return null;
};

H.BUY_DIRECT = (s, a, ev) => {
  if (s.room.status !== 'PLAYING') return 'Partida não iniciada.';
  const p = byId(s, a.playerId);
  if (!CARDS[a.cardId]) return 'Carta inválida.';
  if (p.inventory.length >= MAX_HAND) return `Mão cheia (${MAX_HAND} cartas).`;
  if (p.points < POINTS.DIRECT) return `Faltam pontos (${POINTS.DIRECT}).`;
  if (s.room.deck[a.cardId] <= 0) return 'Carta esgotada.';
  gainCard(s, ev, p, a.cardId, 'DIRECT', POINTS.DIRECT);
  return null;
};

H.PLAY_CARD = (s, a, ev) => {
  const err = turnGuard(s, a, ['ROLL', 'MOVE']);
  if (err) return err;
  const p = byId(s, a.playerId);
  const t = s.room.turn;
  const cfg = cfgOf(s);
  const card = CARDS[a.cardId];
  if (!card || !p.inventory.includes(a.cardId)) return 'Você não tem essa carta.';
  if (card.reactive) return 'Essa carta é usada automaticamente na hora certa.';
  if (t.cardUsed) return 'Só 1 carta por turno.';

  switch (a.cardId) {
    case 'dado_duplo':
      if (t.phase !== 'ROLL') return 'Use antes de rolar o dado.';
      t.double = true;
      break;
    case 'cinto': {
      const pw = p.pawns.find((x) => x.id === a.pawnId);
      if (!pw || !isRingProgress(cfg, pw.position)) return 'Escolha um peão na pista.';
      pw.immune_until = s.room.round + 2;
      break;
    }
    case 'troca': {
      const other = byId(s, a.targetPlayerId);
      const mine = p.pawns.find((x) => x.id === a.ownPawnId);
      const theirs = other && other.pawns.find((x) => x.id === a.targetPawnId);
      if (!other || other.id === p.id || !mine || !theirs) return 'Alvo inválido.';
      if (!isRingProgress(cfg, mine.position) || !isRingProgress(cfg, theirs.position)) return 'Ambos os peões precisam estar na pista.';
      if (isImmune(s, theirs)) {
        ev.push({ type: 'IMMUNE_BLOCK', attackerId: p.id, victimId: other.id, pawnId: theirs.id });
        addDrink(s, ev, p.id, 1, 'CINTO');
        break;
      }
      const tm = absTile(cfg, p.seat, mine.position);
      const tt = absTile(cfg, other.seat, theirs.position);
      const nm = (tt - seatOffset(cfg, p.seat) + cfg.ring) % cfg.ring;
      const nt = (tm - seatOffset(cfg, other.seat) + cfg.ring) % cfg.ring;
      if (!isRingProgress(cfg, nm) || !isRingProgress(cfg, nt)) return 'Troca impossível entre esses peões.';
      mine.position = nm;
      theirs.position = nt;
      refreshStatus(s, p);
      refreshStatus(s, other);
      ev.push({ type: 'SWAP', playerId: p.id, targetId: other.id });
      break;
    }
    case 'pedagio': {
      const tile = a.tile;
      if (!Number.isInteger(tile) || tile < 0 || tile >= cfg.ring) return 'Casa inválida.';
      if (isStartTile(cfg, tile)) return 'Não dá para pôr pedágio em casa de saída.';
      if (s.room.toll_booths.some((b) => b.tile_index === tile)) return 'Já existe um pedágio nessa casa.';
      s.room.toll_booths = s.room.toll_booths.filter((b) => b.owner_id !== p.id);
      s.room.toll_booths.push({ tile_index: tile, owner_id: p.id, until_round: s.room.round + 1 });
      ev.push({ type: 'TOLL_PLACED', playerId: p.id, tile });
      break;
    }
    case 'brinde': {
      if (a.mode === 'ALL') {
        for (const o of s.players) addDrink(s, ev, o.id, 1, 'BRINDE_GERAL');
        ev.push({ type: 'BRINDE_GERAL', playerId: p.id });
      } else {
        const target = byId(s, a.targetId);
        if (!target || target.id === p.id) return 'Escolha um adversário.';
        addDrink(s, ev, target.id, 1, 'BEBA_JUNTO');
        addDrink(s, ev, p.id, 1, 'BEBA_JUNTO', { shield: false });
      }
      break;
    }
    case 'caos':
      s.room.reversed_movement = true;
      s.room.chaos_until = s.room.round + 2;
      ev.push({ type: 'CAOS', playerId: p.id });
      break;
    case 'imposto': {
      const top = Math.max(...s.players.map((x) => x.points));
      const leaders = s.players.filter((x) => x.points === top);
      if (leaders.some((x) => x.id === p.id)) return 'Você já está em 1º lugar.';
      const leader = leaders[0];
      if (leader.points < IMPOSTO_MIN) {
        addDrink(s, ev, leader.id, 1, 'IMPOSTO');
      } else {
        const amt = Math.floor(leader.points * IMPOSTO_RATE);
        leader.points -= amt;
        p.points += amt;
        ev.push({ type: 'IMPOSTO', playerId: p.id, targetId: leader.id, amount: amt });
      }
      break;
    }
    default:
      return 'Carta desconhecida.';
  }
  p.inventory.splice(p.inventory.indexOf(a.cardId), 1);
  s.room.deck[a.cardId] += 1;
  t.cardUsed = true;
  ev.push({ type: 'CARD_PLAYED', playerId: p.id, cardId: a.cardId });
  // Caos/Troca no meio da jogada podem invalidar os dados que sobraram: não deixa o turno travar.
  if (t.phase === 'MOVE' && !hasLegal(s, p, t.dice)) {
    ev.push({ type: 'NO_MOVES', playerId: p.id });
    endStep(s, ev);
  }
  return null;
};

H.DRINK_RESOLVE = (s, a, ev) => {
  if (s.room.status !== 'PLAYING') return 'Partida não iniciada.';
  const d = s.room.drinks.find((x) => x.id === a.drinkId);
  if (!d || d.playerId !== a.playerId) return 'Dose não encontrada.';
  const p = byId(s, d.playerId);
  const drop = () => { s.room.drinks = s.room.drinks.filter((x) => x.id !== d.id); };

  if (a.choice === 'DRINK') {
    p.stats.shots_taken += d.shots;
    if (d.reward) {
      p.points += d.reward;
      ev.push({ type: 'POINTS', playerId: p.id, amount: d.reward, reason: 'BEBEU' });
    }
    ev.push({ type: 'DRANK', playerId: p.id, shots: d.shots });
    drop();
    return null;
  }
  if (a.choice === 'SHIELD') {
    const target = byId(s, a.target);
    const ci = p.inventory.indexOf('escudo');
    if (!d.shield) return 'Essa dose não pode ser repassada.';
    if (ci < 0) return 'Você não tem Escudo.';
    if (!target || target.id === p.id) return 'Escolha outro jogador.';
    p.inventory.splice(ci, 1);
    s.room.deck.escudo += 1;
    drop();
    addDrink(s, ev, target.id, d.shots, 'ESCUDO', { shield: false });
    ev.push({ type: 'SHIELDED', playerId: p.id, targetId: target.id });
    return null;
  }
  if (a.choice === 'PAY') {
    if (!d.canPay) return 'Não dá para pagar essa.';
    if (p.points < d.payCost) return 'Pontos insuficientes.';
    p.points -= d.payCost;
    if (d.payTo) {
      const owner = byId(s, d.payTo);
      if (owner) owner.points += d.payCost;
    }
    ev.push({ type: 'PAID', playerId: p.id, amount: d.payCost, toId: d.payTo });
    drop();
    return null;
  }
  return 'Escolha inválida.';
};

H.HOOKAH_VOTE = (s, a, ev, rng) => {
  if (s.room.status !== 'PLAYING') return 'Partida não iniciada.';
  const p = byId(s, a.playerId);
  if (!p) return 'Jogador inválido.';
  const votes = new Set(s.room.hookah_votes);
  if (votes.has(p.id)) votes.delete(p.id); else votes.add(p.id);
  s.room.hookah_votes = [...votes];
  const active = activeIds(s);
  if (active.length >= 2 && active.every((id) => votes.has(id))) {
    const winnerId = active[randInt(rng, active.length)];
    const w = byId(s, winnerId);
    w.points += POINTS.HOOKAH;
    w.stats.hookah_wins += 1;
    s.room.hookah_votes = [];
    ev.push({ type: 'HOOKAH_RESULT', winnerId, candidates: active, spin: rng() });
    ev.push({ type: 'POINTS', playerId: winnerId, amount: POINTS.HOOKAH, reason: 'NARGUILE' });
  }
  return null;
};

// ---------------------------------------------------------------- reduce

export function reduce(state, action, rng = rngDefault) {
  const h = H[action.type];
  if (!h) return { state, events: [], error: 'Ação desconhecida.' };
  const s = structuredClone(state);
  const events = [];
  const error = h(s, action, events, rng);
  if (error) return { state, events: [], error };
  s.room.seq += 1;
  return { state: s, events };
}
