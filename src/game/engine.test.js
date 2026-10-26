import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, reduce, legalMoves } from './engine.js';
import { CARD_IDS, CARDS, freshDeck } from './constants.js';
import { drinkTiles, modeConfig, finishOf } from './board.js';

// rng que devolve uma sequência fixa (e repete o último valor).
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const dieRng = (...dice) => seq(...dice.map((d) => (d - 1) / 6 + 0.01));

function run(state, action, rng) {
  const r = reduce(state, action, rng);
  assert.equal(r.error, undefined, `erro inesperado: ${r.error}`);
  return r;
}

function lobby(names = ['Ana', 'Bia'], mode = 4) {
  let s = createRoom('LUDO', mode);
  for (const n of names) s = run(s, { type: 'JOIN', name: n }).state;
  return s;
}
function started(names, mode) {
  return run(lobby(names, mode), { type: 'START' }).state;
}
const edit = (s, fn) => { const c = structuredClone(s); fn(c); return c; };

test('deck: 9 tipos de carta, estoque conforme o catálogo', () => {
  assert.equal(CARD_IDS.length, 9);
  const d = freshDeck();
  assert.equal(Object.values(d).reduce((a, b) => a + b, 0), 33);
  assert.equal(d.escudo, 6);
  assert.equal(d.caos, 2);
});

test('lobby: entrar, cores únicas, sala cheia e reconexão pelo nome', () => {
  let s = lobby(['Ana', 'Bia']);
  assert.notEqual(s.players[0].color, s.players[1].color);
  s = run(s, { type: 'PRESENCE', names: ['Ana'] }).state;
  assert.equal(s.players[1].connected, false);
  s = run(s, { type: 'JOIN', name: 'bia' }).state; // reconexão ignora maiúsculas
  assert.equal(s.players.length, 2);
  assert.equal(s.players[1].connected, true);
  let s4 = lobby(['A', 'B', 'C', 'D']);
  assert.equal(reduce(s4, { type: 'JOIN', name: 'E' }).error, 'Sala cheia.');
});

test('reconexão no meio da partida mantém pontos, cartas e peões', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].points = 85; c.players[0].inventory = ['escudo']; c.players[0].pawns[1].position = 12; });
  s = run(s, { type: 'PRESENCE', names: ['Bia'] }).state;
  s = run(s, { type: 'JOIN', name: 'Ana' }).state;
  assert.equal(s.players[0].points, 85);
  assert.deepEqual(s.players[0].inventory, ['escudo']);
  assert.equal(s.players[0].pawns[1].position, 12);
  assert.equal(reduce(s, { type: 'JOIN', name: 'Novo' }).error, 'A partida já começou.');
});

test('modos: 4 jogadores = 4 peões; 6 jogadores = 3 peões', () => {
  assert.equal(started(['A', 'B'], 4).players[0].pawns.length, 4);
  assert.equal(started(['A', 'B'], 6).players[0].pawns.length, 3);
  assert.equal(modeConfig(6).ring, 54);
});

test('tirar 6: +5 pts, sai da base (+10) e joga de novo', () => {
  let s = started(['Ana', 'Bia']);
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(6)).state;
  assert.equal(s.players[0].points, 5);
  s = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 }).state;
  assert.equal(s.players[0].pawns[0].position, 0);
  assert.equal(s.players[0].points, 15);
  assert.equal(s.room.current_turn_player_id, 'player_1');
  assert.equal(s.room.turn.phase, 'ROLL');
});

test('sem movimentos possíveis passa a vez automaticamente', () => {
  let s = started(['Ana', 'Bia']);
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(3)).state;
  assert.equal(s.room.current_turn_player_id, 'player_2');
});

test('só joga quem tem a vez', () => {
  const s = started(['Ana', 'Bia']);
  assert.equal(reduce(s, { type: 'ROLL', playerId: 'player_2' }, dieRng(2)).error, 'Não é a sua vez.');
});

test('captura: +30 pts, peão volta à base e Vingança faz o agressor beber 2', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => {
    c.players[0].pawns[0].position = 2; // tile 3
    c.players[1].pawns[0].position = 42; // seat 1 offset 13 -> tile (13+42)%52 = 3
    c.players[1].inventory = ['vinganca'];
  });
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(1)).state;
  const r = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 });
  s = r.state;
  assert.ok(r.events.some((e) => e.type === 'CAPTURE'));
  assert.equal(s.players[0].points, 30);
  assert.equal(s.players[0].stats.captured_pawns, 1);
  assert.equal(s.players[1].pawns[0].position, 'BASE');
  assert.deepEqual(s.players[1].inventory, []);
  assert.equal(s.room.drinks.length, 1);
  assert.equal(s.room.drinks[0].shots, 2);
  assert.equal(s.room.drinks[0].playerId, 'player_1');
  // bloqueado até resolver
  assert.ok(reduce(s, { type: 'ROLL', playerId: 'player_2' }, dieRng(1)).error);
});

test('casa de saída NÃO é segura: peão inimigo parado nela é comido', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => {
    c.players[0].pawns[0].position = 12; // tile 12 (bebida) -> +1 = tile 13 (saída do player_2)
    c.players[1].pawns[0].position = 0; // tile 13
  });
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(1)).state;
  const r = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 });
  assert.equal(r.state.players[1].pawns[0].position, 'BASE');
  assert.ok(r.events.some((e) => e.type === 'CAPTURE'));
});

test('casa Beba ou Pague: beber dá +15; pagar custa 20', () => {
  let s = started(['Ana', 'Bia']);
  assert.ok(drinkTiles(modeConfig(4)).has(4));
  s = edit(s, (c) => { c.players[0].pawns[0].position = 3; c.players[0].points = 40; });
  let t = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(1)).state;
  t = run(t, { type: 'MOVE', playerId: 'player_1', pawnId: 0 }).state;
  assert.equal(t.room.drinks[0].kind, 'TILE');
  const id = t.room.drinks[0].id;
  const drank = run(t, { type: 'DRINK_RESOLVE', playerId: 'player_1', drinkId: id, choice: 'DRINK' }).state;
  assert.equal(drank.players[0].points, 55);
  assert.equal(drank.players[0].stats.shots_taken, 1);
  const paid = run(t, { type: 'DRINK_RESOLVE', playerId: 'player_1', drinkId: id, choice: 'PAY' }).state;
  assert.equal(paid.players[0].points, 20);
  assert.equal(paid.room.drinks.length, 0);
});

test('Escudo repassa a dose para outro jogador e não pode ser devolvida', () => {
  let s = started(['Ana', 'Bia', 'Caio']);
  s = edit(s, (c) => { c.players[0].pawns[0].position = 3; c.players[0].inventory = ['escudo']; });
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(1)).state;
  s = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 }).state;
  const id = s.room.drinks[0].id;
  s = run(s, { type: 'DRINK_RESOLVE', playerId: 'player_1', drinkId: id, choice: 'SHIELD', target: 'player_3' }).state;
  assert.equal(s.room.drinks.length, 1);
  assert.equal(s.room.drinks[0].playerId, 'player_3');
  assert.equal(s.room.drinks[0].shield, false);
  assert.deepEqual(s.players[0].inventory, []);
});

test('loja: sair da base por 60 pts, compra surpresa 60, direta 120, mão máx. 3', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].points = 300; });
  s = run(s, { type: 'BUY_EXIT', playerId: 'player_1', pawnId: 2 }).state;
  assert.equal(s.players[0].pawns[2].position, 0);
  assert.equal(s.players[0].points, 300 - 60 + 10);
  s = run(s, { type: 'BUY_SURPRISE', playerId: 'player_1', category: 'A' }, seq(0.5)).state;
  assert.equal(s.players[0].inventory.length, 1);
  assert.equal(CARDS[s.players[0].inventory[0]].cat, 'A');
  s = run(s, { type: 'BUY_DIRECT', playerId: 'player_1', cardId: 'caos' }).state;
  assert.equal(s.players[0].inventory[1], 'caos');
  assert.equal(s.room.deck.caos, 1);
  s = run(s, { type: 'BUY_SURPRISE', playerId: 'player_1', category: 'C' }, seq(0.1)).state;
  assert.equal(reduce(s, { type: 'BUY_SURPRISE', playerId: 'player_1', category: 'B' }).error, 'Mão cheia (3 cartas).');
});

test('1 carta por turno', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['dado_duplo', 'caos']; });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'dado_duplo' }).state;
  assert.equal(reduce(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'caos' }).error, 'Só 1 carta por turno.');
});

test('Dado Duplo: rola 2 dados e iguais obrigam 1 shot', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['dado_duplo']; c.players[0].pawns[0].position = 20; });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'dado_duplo' }).state;
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(2, 2)).state;
  assert.deepEqual(s.room.turn.rolled, [2, 2]);
  assert.equal(s.room.drinks.length, 1);
});

test('Cinto de Segurança: peão imune, agressor toma 1 shot e ninguém é comido', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => {
    c.players[0].pawns[0].position = 2;
    c.players[1].pawns[0].position = 42; // tile 3
    c.players[1].pawns[0].immune_until = 3;
  });
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(1)).state;
  s = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 }).state;
  assert.equal(s.players[1].pawns[0].position, 42);
  assert.equal(s.room.drinks[0].playerId, 'player_1');
  assert.equal(s.players[0].points, 0);
});

test('Troca de Lugar inverte posições na pista', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => {
    c.players[0].inventory = ['troca'];
    c.players[0].pawns[0].position = 5; // tile 5
    c.players[1].pawns[0].position = 10; // tile 23
  });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'troca', ownPawnId: 0, targetPlayerId: 'player_2', targetPawnId: 0 }).state;
  assert.equal(s.players[0].pawns[0].position, 23);
  assert.equal(s.players[1].pawns[0].position, 44); // tile 5 -> (5-13+52)
});

test('Pedágio sem Parar: quem passa paga 20 pts ao dono ou toma 1 shot', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['pedagio']; c.players[1].points = 50; });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'pedagio', tile: 20 }).state;
  assert.equal(s.room.toll_booths.length, 1);
  s = edit(s, (c) => {
    c.room.current_turn_player_id = 'player_2';
    c.room.turn = { phase: 'ROLL', dice: [], rolled: [], sixes: 0, cardUsed: false, double: false, extra: false };
    c.players[1].pawns[0].position = 4; // tile 17 -> +5 passa/para em 22
  });
  s = run(s, { type: 'ROLL', playerId: 'player_2' }, dieRng(5)).state;
  s = run(s, { type: 'MOVE', playerId: 'player_2', pawnId: 0 }).state;
  const toll = s.room.drinks.find((d) => d.kind === 'TOLL');
  assert.ok(toll);
  s = run(s, { type: 'DRINK_RESOLVE', playerId: 'player_2', drinkId: toll.id, choice: 'PAY' }).state;
  assert.equal(s.players[1].points, 30);
  assert.equal(s.players[0].points, 20);
});

test('Caos Total inverte o movimento e expira depois de 2 rodadas', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['caos']; c.players[0].pawns[0].position = 10; });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'caos' }).state;
  assert.equal(s.room.reversed_movement, true);
  assert.deepEqual(legalMoves(s, 'player_1', 3), [0]);
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(3)).state;
  s = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 }).state;
  assert.equal(s.players[0].pawns[0].position, 7);
  // avança turnos até expirar
  for (let i = 0; i < 12 && s.room.reversed_movement; i++) {
    const cur = s.room.current_turn_player_id;
    if (s.room.turn.phase === 'MOVE') s = run(s, { type: 'MOVE', playerId: cur, pawnId: 0 }).state;
    else s = run(s, { type: 'ROLL', playerId: cur }, dieRng(2)).state;
  }
  assert.equal(s.room.reversed_movement, false);
  assert.ok(s.room.round >= 3);
});

test('Imposto do Dado: rouba 15% do líder; com menos de 40 pts vira 1 shot', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['imposto']; c.players[1].points = 100; });
  const a = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'imposto' }).state;
  assert.equal(a.players[1].points, 85);
  assert.equal(a.players[0].points, 15);
  const b = edit(s, (c) => { c.players[1].points = 30; });
  const r = run(b, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'imposto' }).state;
  assert.equal(r.players[1].points, 30);
  assert.equal(r.room.drinks[0].playerId, 'player_2');
});

test('Brinde: modo individual e geral', () => {
  let s = started(['Ana', 'Bia', 'Caio']);
  s = edit(s, (c) => { c.players[0].inventory = ['brinde']; });
  const one = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'brinde', mode: 'ONE', targetId: 'player_2' }).state;
  assert.equal(one.room.drinks.length, 2);
  const all = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'brinde', mode: 'ALL' }).state;
  assert.equal(all.room.drinks.length, 3);
});

test('reta final: peão a 5 casas ou menos do fim entra em CRITICAL_STATE', () => {
  let s = started(['Ana', 'Bia']);
  const fin = finishOf(modeConfig(4));
  s = edit(s, (c) => { c.players[0].pawns[0].position = fin - 7; });
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(2)).state;
  const r = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 });
  assert.equal(r.state.players[0].pawns[0].status, 'CRITICAL_STATE');
  assert.ok(r.events.some((e) => e.type === 'CRITICAL'));
});

test('vitória: todos os peões no centro encerram a partida', () => {
  let s = started(['Ana', 'Bia']);
  const fin = finishOf(modeConfig(4));
  s = edit(s, (c) => {
    c.players[0].pawns.forEach((p, i) => { if (i > 0) { p.position = fin; p.status = 'FINISHED'; } });
    c.players[0].pawns[0].position = fin - 1;
  });
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(1)).state;
  const r = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 });
  assert.equal(r.state.room.status, 'FINISHED');
  assert.equal(r.state.room.winner_id, 'player_1');
});

test('narguilé: só sorteia com 100% dos jogadores ativos, dá +50 e zera votos', () => {
  let s = started(['Ana', 'Bia', 'Caio']);
  s = run(s, { type: 'HOOKAH_VOTE', playerId: 'player_1' }).state;
  s = run(s, { type: 'HOOKAH_VOTE', playerId: 'player_2' }).state;
  assert.equal(s.room.hookah_votes.length, 2);
  const r = run(s, { type: 'HOOKAH_VOTE', playerId: 'player_3' }, seq(0.5, 0.3));
  const res = r.events.find((e) => e.type === 'HOOKAH_RESULT');
  assert.equal(res.winnerId, 'player_2');
  assert.equal(r.state.players[1].points, 50);
  assert.equal(r.state.players[1].stats.hookah_wins, 1);
  assert.deepEqual(r.state.room.hookah_votes, []);
});

test('narguilé: jogadores desconectados não contam como ativos', () => {
  let s = started(['Ana', 'Bia', 'Caio']);
  s = run(s, { type: 'PRESENCE', names: ['Ana', 'Bia'] }).state;
  s = run(s, { type: 'HOOKAH_VOTE', playerId: 'player_1' }).state;
  const r = run(s, { type: 'HOOKAH_VOTE', playerId: 'player_2' }, seq(0.1, 0.1));
  assert.ok(r.events.some((e) => e.type === 'HOOKAH_RESULT'));
});

test('turno pula jogador desconectado', () => {
  let s = started(['Ana', 'Bia', 'Caio']);
  s = run(s, { type: 'PRESENCE', names: ['Ana', 'Caio'] }).state;
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(2)).state;
  assert.equal(s.room.current_turn_player_id, 'player_3');
});

// ---------------------------------------------------------------- simulação (soak test)

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function checkInvariants(s) {
  const cfg = modeConfig(s.room.mode);
  const fin = finishOf(cfg);
  for (const p of s.players) {
    assert.ok(p.points >= 0, `pontos negativos: ${p.name}`);
    assert.ok(p.inventory.length <= 3, 'mão com mais de 3 cartas');
    for (const pw of p.pawns) {
      assert.ok(pw.position === 'BASE' || (Number.isInteger(pw.position) && pw.position >= 0 && pw.position <= fin), `posição inválida ${pw.position}`);
    }
  }
  for (const id of CARD_IDS) assert.ok(s.room.deck[id] >= 0, `estoque negativo: ${id}`);
  const held = {};
  for (const p of s.players) for (const c of p.inventory) held[c] = (held[c] || 0) + 1;
  for (const id of CARD_IDS) assert.equal((held[id] || 0) + s.room.deck[id], CARDS[id].copies, `cartas perdidas/duplicadas: ${id}`);
}

function botStep(s, rnd) {
  const r = s.room;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  if (r.drinks.length) {
    const d = pick(r.drinks);
    const p = s.players.find((x) => x.id === d.playerId);
    const opts = ['DRINK'];
    if (d.canPay && p.points >= d.payCost) opts.push('PAY');
    if (d.shield && p.inventory.includes('escudo')) opts.push('SHIELD');
    const choice = pick(opts);
    const target = pick(s.players.filter((x) => x.id !== p.id)).id;
    return { type: 'DRINK_RESOLVE', playerId: p.id, drinkId: d.id, choice, target };
  }
  const me = s.players.find((p) => p.id === r.current_turn_player_id);
  const t = r.turn;
  const roll = rnd();
  if (roll < 0.05) return { type: 'HOOKAH_VOTE', playerId: pick(s.players).id };
  if (roll < 0.1 && me.points >= 60) return { type: 'BUY_SURPRISE', playerId: me.id, category: pick(['A', 'B', 'C']) };
  if (roll < 0.13 && me.points >= 120) return { type: 'BUY_DIRECT', playerId: me.id, cardId: pick(CARD_IDS) };
  if (roll < 0.2 && me.inventory.length) {
    const cardId = pick(me.inventory);
    const others = s.players.filter((x) => x.id !== me.id);
    const o = pick(others);
    return { type: 'PLAY_CARD', playerId: me.id, cardId, pawnId: pick(me.pawns).id, ownPawnId: pick(me.pawns).id,
      targetPlayerId: o.id, targetPawnId: pick(o.pawns).id, tile: Math.floor(rnd() * 52), mode: pick(['ONE', 'ALL']), targetId: o.id };
  }
  if (t.phase === 'ROLL') {
    if (roll < 0.25 && me.points >= 60) return { type: 'BUY_EXIT', playerId: me.id, pawnId: pick(me.pawns).id };
    return { type: 'ROLL', playerId: me.id };
  }
  const options = [];
  t.dice.forEach((d, di) => legalMoves(s, me.id, d).forEach((pid) => options.push({ di, pid })));
  const o = pick(options);
  return { type: 'MOVE', playerId: me.id, pawnId: o.pid, dieIndex: o.di };
}

for (const mode of [4, 6]) {
  test(`simulação: bots jogam partidas completas no modo ${mode} sem quebrar invariantes`, () => {
    let finished = 0;
    const games = 40;
    for (let g = 0; g < games; g++) {
      const rnd = mulberry32(1000 * mode + g);
      const n = 2 + Math.floor(rnd() * (mode - 1));
      let s = started(['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n), mode);
      for (let step = 0; step < 6000 && s.room.status === 'PLAYING'; step++) {
        const action = botStep(s, rnd);
        const r = reduce(s, action, rnd);
        if (!r.error) { s = r.state; checkInvariants(s); }
        // erros de ação aleatória inválida são esperados e ignorados
        assert.ok(s.room.status !== undefined);
      }
      if (s.room.status === 'FINISHED') finished++;
    }
    assert.ok(finished > 0, 'nenhuma partida terminou em 6000 passos');
    console.log(`  modo ${mode}: ${finished}/${games} partidas terminaram`);
  });
}

test('regressão: carta que invalida os dados restantes não trava o turno', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => {
    c.players[0].pawns[0].position = 2;
    c.players[0].inventory = ['caos'];
    c.room.turn = { phase: 'MOVE', dice: [3], rolled: [3], sixes: 0, cardUsed: false, double: false, extra: false };
  });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'caos' }).state;
  assert.equal(s.room.current_turn_player_id, 'player_2');
});

test('dado: 60.000 rolagens saem equilibradas (cada face perto de 1/6)', () => {
  let s = lobby(['Ana', 'Bia']);
  s = run(s, { type: 'START' }).state;
  const N = 60000;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const r = reduce(s, { type: 'ROLL', playerId: s.room.current_turn_player_id });
    const d = r.events.find((e) => e.type === 'DICE').dice[0];
    counts[d]++;
  }
  const expected = N / 6;
  for (let f = 1; f <= 6; f++) assert.ok(Math.abs(counts[f] - expected) / expected < 0.04, `face ${f}: ${counts[f]}`);
  const chi = counts.slice(1).reduce((a, c) => a + (c - expected) ** 2 / expected, 0);
  assert.ok(chi < 15.09, `qui-quadrado alto: ${chi}`); // limite 99% p/ 5 graus de liberdade
});

test('brinde: capturar ou chegar com um peão dá carta grátis; mão cheia vira pontos', () => {
  const s0 = run(lobby(['Ana', 'Bia']), { type: 'START' }).state;
  const [A] = s0.players;
  const evs = [];
  // usa o motor interno via MOVE: coloca Ana em 0 e Bia na casa 3 (relativa a Bia) e rola 3
  let s = structuredClone(s0);
  const cfg = modeConfig(s.room.mode);
  const ana = s.players[0], bia = s.players[1];
  ana.pawns[0].position = 0;
  bia.pawns[0].position = (ana.seat * cfg.spacing + 3 - bia.seat * cfg.spacing + cfg.ring) % cfg.ring;
  s.room.turn.phase = 'MOVE'; s.room.turn.dice = [3]; s.room.turn.rolled = [3];
  const r = run(s, { type: 'MOVE', playerId: ana.id, pawnId: 0, dieIndex: 0 }, dieRng(1));
  assert.ok(r.events.some((e) => e.type === 'CAPTURE'));
  assert.ok(r.events.some((e) => e.type === 'CARD_WON'));
  assert.equal(r.state.players[0].inventory.length, 1);
  // mão cheia
  s = structuredClone(s);
  s.players[0].inventory = ['escudo', 'escudo', 'escudo'];
  const r2 = run(s, { type: 'MOVE', playerId: ana.id, pawnId: 0, dieIndex: 0 }, dieRng(1));
  assert.ok(!r2.events.some((e) => e.type === 'CARD_WON'));
  assert.ok(r2.events.some((e) => e.reason === 'MAO_CHEIA'));
  void A; void evs;
});

test('encerrar sessão: termina a partida e escolhe o líder', () => {
  let s = run(lobby(['Ana', 'Bia']), { type: 'START' }).state;
  s.players[1].points = 90;
  const r = run(s, { type: 'END_SESSION' });
  assert.equal(r.state.room.status, 'FINISHED');
  assert.equal(r.state.room.winner_id, s.players[1].id);
  assert.equal(r.state.room.ended_early, true);
  assert.equal(reduce(r.state, { type: 'END_SESSION' }).error !== undefined, true);
});

test('2 dados: anda a SOMA com um único peão', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['dado_duplo']; c.players[0].pawns[0].position = 20; });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'dado_duplo' }).state;
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(3, 4)).state;
  assert.deepEqual(s.room.turn.rolled, [3, 4]);
  assert.deepEqual(s.room.turn.dice, [7]);
  const r = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 });
  assert.equal(r.state.players[0].pawns[0].position, 27);
});

test('2 dados com um 6: peão da base sai e anda o outro dado', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['dado_duplo']; });
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'dado_duplo' }).state;
  s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(6, 3)).state;
  const r = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: 0 });
  assert.equal(r.state.players[0].pawns[0].position, 3);
});

test('pedágio fica no tabuleiro até alguém passar e PAGAR; beber não remove', () => {
  let s = started(['Ana', 'Bia']);
  s = edit(s, (c) => { c.players[0].inventory = ['pedagio']; c.players[1].points = 50; });
  s = run(s, { type: 'TOLL_PICK', playerId: 'player_1', on: true, tile: 20 }).state;
  assert.equal(s.room.toll_picker.tile, 20);
  s = run(s, { type: 'PLAY_CARD', playerId: 'player_1', cardId: 'pedagio', tile: 20 }).state;
  assert.equal(s.room.toll_picker, null);
  const walk = (st) => {
    st = edit(st, (c) => {
      c.room.current_turn_player_id = 'player_2';
      c.room.turn = { phase: 'ROLL', dice: [], rolled: [], sixes: 0, cardUsed: false, double: false, extra: false };
      c.room.drinks = [];
      c.players[1].pawns[0].position = 4;
    });
    st = run(st, { type: 'ROLL', playerId: 'player_2' }, dieRng(5)).state;
    return run(st, { type: 'MOVE', playerId: 'player_2', pawnId: 0 }).state;
  };
  let t = walk(s);
  let toll = t.room.drinks.find((d) => d.kind === 'TOLL');
  t = run(t, { type: 'DRINK_RESOLVE', playerId: 'player_2', drinkId: toll.id, choice: 'DRINK' }).state;
  assert.equal(t.room.toll_booths.length, 1); // bebeu: continua lá
  for (let i = 0; i < 6; i++) t = edit(t, (c) => { c.room.round += 1; });
  t = walk(t);
  toll = t.room.drinks.find((d) => d.kind === 'TOLL');
  t = run(t, { type: 'DRINK_RESOLVE', playerId: 'player_2', drinkId: toll.id, choice: 'PAY' }).state;
  assert.equal(t.room.toll_booths.length, 0); // pagou: some
});

test('1 jogador sozinho pode iniciar e jogar vários turnos seguidos', () => {
  let s = lobby(['Ana']);
  s = run(s, { type: 'START' }).state;
  assert.equal(s.room.status, 'PLAYING');
  for (let i = 0; i < 6; i++) {
    s = run(s, { type: 'ROLL', playerId: 'player_1' }, dieRng(2)).state;
    assert.equal(s.room.current_turn_player_id, 'player_1');
    if (s.room.turn.phase === 'MOVE') {
      const m = legalMoves(s, 'player_1', s.room.turn.dice[0]);
      if (m.length) s = run(s, { type: 'MOVE', playerId: 'player_1', pawnId: m[0] }).state;
    }
  }
  assert.ok(s.room.round > 1); // o turno volta para ela e a rodada avança
  const h = run(s, { type: 'HOOKAH_VOTE', playerId: 'player_1' }, seq(0.3));
  assert.ok(h.events.some((e) => e.type === 'HOOKAH_RESULT'));
});

test('sala vazia não inicia', () => {
  assert.equal(reduce(createRoom('ZZZZ', 4), { type: 'START' }).error !== undefined, true);
});
