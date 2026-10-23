// Efeitos sonoros 16-bit sintetizados com WebAudio (sem arquivos de áudio).
let ctx = null;

export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* sem áudio */ }
}

function tone(freq, dur, { type = 'square', vol = 0.06, at = 0, slide = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur, vol = 0.08, at = 0) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + at);
}

const PENTA = [0, 2, 4, 7, 9];

export const sfx = {
  dice() { [300, 420, 520, 660, 520, 760].forEach((f, i) => tone(f, 0.06, { at: i * 0.05 })); },
  // um "tic" por casa: sobe a escala a cada passo (k = número do passo)
  step(k = 0) { const semi = PENTA[k % 5] + 12 * Math.floor(k / 5); tone(392 * 2 ** (semi / 12), 0.09, { type: 'square', vol: 0.05 }); },
  // pouso final: batidinha grave (substitui o último tic)
  land() { tone(150, 0.14, { type: 'triangle', vol: 0.12, slide: -60 }); noise(0.07, 0.05); },
  // peão saindo da base
  pop() { tone(330, 0.1, { type: 'square', vol: 0.06, slide: 500 }); },
  // "cha-ching" de caixa registradora + moedas caindo
  cash() {
    tone(1568, 0.09, { type: 'triangle', vol: 0.09 });
    tone(2093, 0.28, { type: 'triangle', vol: 0.09, at: 0.09 });
    noise(0.12, 0.05, 0.09);
    for (let i = 0; i < 6; i++) tone(2400 + (i % 3) * 300, 0.05, { type: 'square', vol: 0.03, at: 0.3 + i * 0.07 });
  },
  coin() { tone(988, 0.07); tone(1319, 0.16, { at: 0.07 }); },
  ko() { noise(0.5, 0.1); tone(220, 0.5, { type: 'sawtooth', vol: 0.09, slide: -180 }); tone(110, 0.6, { at: 0.05, slide: -70 }); },
  alarm() { for (let i = 0; i < 6; i++) tone(i % 2 ? 880 : 660, 0.12, { at: i * 0.14, vol: 0.05 }); },
  drink() { tone(180, 0.18, { type: 'sawtooth' }); tone(140, 0.25, { type: 'sawtooth', at: 0.18 }); },
  hookah() { for (let i = 0; i < 16; i++) tone(500 + (i % 4) * 120, 0.05, { at: i * 0.18, vol: 0.04 }); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.18, { at: i * 0.16 })); },
  turn() { tone(660, 0.07); tone(880, 0.09, { at: 0.07 }); },
};
