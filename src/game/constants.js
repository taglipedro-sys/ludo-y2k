// Constantes centrais do jogo: cores, pontuação, personagens e catálogo de cartas.

export const COLORS = ['neon_red', 'neon_blue', 'neon_green', 'neon_yellow', 'neon_purple', 'neon_orange'];

export const COLOR_HEX = {
  neon_red: '#ff2a55',
  neon_blue: '#2ab7ff',
  neon_green: '#39ff6a',
  neon_yellow: '#ffe62a',
  neon_purple: '#b44dff',
  neon_orange: '#ff8a1f',
};

export const COLOR_LABEL = {
  neon_red: 'Vermelho',
  neon_blue: 'Azul',
  neon_green: 'Verde',
  neon_yellow: 'Amarelo',
  neon_purple: 'Roxo',
  neon_orange: 'Laranja',
};

// Cada cor tem um "personagem" de carta de coleção.
export const CHARACTERS = {
  neon_red: { name: 'TURBO', tagline: 'Pé no fundo!' },
  neon_blue: { name: 'CYBER', tagline: 'Bip bop, eu ganho!' },
  neon_green: { name: 'TOXIC', tagline: 'Cuidado, é tóxico!' },
  neon_yellow: { name: 'SPARK', tagline: 'Energia infinita!' },
  neon_purple: { name: 'MYSTIC', tagline: 'Eu já previ isso…' },
  neon_orange: { name: 'BLAZE', tagline: 'Tá pegando fogo!' },
};

export const POINTS = {
  SIX: 5,
  EXIT_BASE: 10,
  CAPTURE: 30,
  DRINK_TILE: 15,
  HOOKAH: 50,
  BUY_EXIT: 60,
  SURPRISE: 60,
  DIRECT: 120,
  TOLL: 20,
  CARD_FULL: 20, // prêmio em pontos quando ganha carta com a mão cheia
  DODGE: 20, // custo de "pagar pontos de esquiva" na casa Beba ou Pague
};

export const MAX_HAND = 3;
export const IMPOSTO_RATE = 0.15;
export const IMPOSTO_MIN = 40;

export const CATEGORIES = {
  A: { id: 'A', label: 'Defesa & Esquiva', short: 'DEFESA', emoji: '🛡️', color: '#2ab7ff' },
  B: { id: 'B', label: 'Avanço & Estratégia', short: 'AVANÇO', emoji: '🚀', color: '#39ff6a' },
  C: { id: 'C', label: 'Agressão & Zoeira', short: 'ZOEIRA', emoji: '💥', color: '#ff2a55' },
};

// copies = cópias no baralho (estoque). Soma = 33 (o prompt cita "27", mas as cópias listadas somam 33).
export const CARDS = {
  escudo: { id: 'escudo', cat: 'A', name: 'Escudo / Passa a Dose', emoji: '🛡️', copies: 6, reactive: true,
    desc: 'Nega a punição de beber e transfere a dose para qualquer jogador.' },
  vinganca: { id: 'vinganca', cat: 'A', name: 'Vingança Instantânea', emoji: '😈', copies: 3, reactive: true,
    desc: 'Se seu peão for comido, quem comeu toma 2 doses na hora.' },
  cinto: { id: 'cinto', cat: 'A', name: 'Cinto de Segurança', emoji: '🪢', copies: 3,
    desc: 'Imunidade de 1 peão por 2 rodadas. Quem atacar toma 1 shot.' },
  dado_duplo: { id: 'dado_duplo', cat: 'B', name: 'Dado Duplo', emoji: '🎲', copies: 6,
    desc: 'Rola 2 dados na rodada. Se saírem iguais, você toma 1 shot.' },
  troca: { id: 'troca', cat: 'B', name: 'Troca de Lugar', emoji: '🔁', copies: 3,
    desc: 'Troca um peão seu de posição com o de um adversário.' },
  pedagio: { id: 'pedagio', cat: 'B', name: 'Pedágio sem Parar', emoji: '🚧', copies: 3,
    desc: 'Barreira numa casa por 1 rodada: quem passar paga 20 pts ou toma 1 shot.' },
  brinde: { id: 'brinde', cat: 'C', name: 'Beba Junto / Brinde Geral', emoji: '🥂', copies: 4,
    desc: 'Um adversário bebe com você OU brinde geral: a mesa toda toma 1 gole.' },
  caos: { id: 'caos', cat: 'C', name: 'Caos Total', emoji: '🌀', copies: 2,
    desc: 'Inverte a movimentação por 2 rodadas e toda casa de bebida pune a mesa.' },
  imposto: { id: 'imposto', cat: 'C', name: 'Imposto do Dado (15%)', emoji: '💸', copies: 3,
    desc: 'Rouba 15% do líder em pontos. Se ele tiver menos de 40, toma 1 shot.' },
};

export const CARD_IDS = Object.keys(CARDS);

export function freshDeck() {
  const d = {};
  for (const id of CARD_IDS) d[id] = CARDS[id].copies;
  return d;
}
