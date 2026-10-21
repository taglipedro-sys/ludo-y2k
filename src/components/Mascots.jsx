// Seis mascotes originais desenhados em SVG (estilo desenho animado dos anos 2000).
// Cada um combina com uma cor de jogador. Todos têm contorno grosso, olhos grandes e uma "pose".

const INK = '#14062e';
const S = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round', strokeLinecap: 'round' };
const SW = (w) => ({ ...S, strokeWidth: w });

// Olho grande e brilhante que pisca de vez em quando.
function Eye({ x, y, r = 8, px = 0, py = 0, d = 0 }) {
  return (
    <g className="m-blink" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${d}s` }}>
      <circle cx={x} cy={y} r={r} fill="#fff" {...SW(3)} />
      <circle cx={x + px} cy={y + py} r={r * 0.55} fill={INK} />
      <circle cx={x + px - r * 0.2} cy={y + py - r * 0.22} r={r * 0.2} fill="#fff" />
    </g>
  );
}

function Sparkle({ x, y, s = 5, fill = '#fff', d = 0 }) {
  return (
    <path className="m-twinkle" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${d}s` }} fill={fill}
      d={`M${x},${y - s} Q${x},${y} ${x + s},${y} Q${x},${y} ${x},${y + s} Q${x},${y} ${x - s},${y} Q${x},${y} ${x},${y - s} Z`} />
  );
}

// ------------------------------------------------------------ TURBO · piloto de corrida (vermelho)
function Turbo({ c }) {
  return (
    <>
      {/* macacão */}
      <path d="M10,122 C12,104 28,96 60,96 C92,96 108,104 110,122 Z" fill={c} {...S} />
      <path d="M48,97 L60,112 L72,97 Z" fill="#fff" {...SW(3)} />
      <rect x="52" y="82" width="16" height="16" rx="4" fill="#e9a577" {...S} />
      {/* orelhas e rosto */}
      <circle cx="27" cy="64" r="7" fill="#f4b98c" {...S} />
      <circle cx="93" cy="64" r="7" fill="#f4b98c" {...S} />
      <ellipse cx="60" cy="62" rx="33" ry="30" fill="#f4b98c" {...S} />
      {/* capacete */}
      <path d="M25,60 C20,14 100,14 95,60 C88,50 76,46 60,46 C44,46 32,50 25,60 Z" fill={c} {...S} />
      <path d="M54,22 C58,20 62,20 66,22 L65,44 L55,44 Z" fill="#fff" opacity=".85" />
      <path d="M31,52 C26,44 28,36 34,30 C34,38 38,40 40,36 C42,44 40,50 31,52 Z" fill="#ffb21f" {...SW(2.5)} />
      <path d="M89,52 C94,44 92,36 86,30 C86,38 82,40 80,36 C78,44 80,50 89,52 Z" fill="#ffb21f" {...SW(2.5)} />
      {/* óculos de corrida na testa */}
      <path d="M30,50 Q60,38 90,50" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <circle cx="46" cy="46" r="10" fill="#ffe62a" {...S} />
      <circle cx="74" cy="46" r="10" fill="#ffe62a" {...S} />
      <path d="M40,42 Q44,38 49,40" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M68,42 Q72,38 77,40" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      {/* carinha */}
      <path d="M36,60 L54,64" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M84,60 L66,64" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <Eye x={46} y={70} r={7} px={2} py={-1} />
      <Eye x={74} y={70} r={7} px={-2} py={-1} d={0.2} />
      <path d="M58,76 Q60,80 63,77" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M44,82 Q60,102 78,82 Z" fill="#6b0f2c" {...SW(3)} />
      <path d="M47,83.5 Q61,90 76,83.5 L75,88 Q61,94 48,88 Z" fill="#fff" />
      <ellipse cx="61" cy="95" rx="6" ry="3.5" fill="#ff6b94" />
      <circle cx="36" cy="80" r="5" fill="#ff7b8a" opacity=".55" />
      <circle cx="84" cy="80" r="5" fill="#ff7b8a" opacity=".55" />
    </>
  );
}

// ------------------------------------------------------------ CYBER · robô simpático (azul)
function Cyber({ c }) {
  return (
    <>
      <line x1="60" y1="24" x2="60" y2="12" {...SW(4)} />
      <circle className="m-pulse" cx="60" cy="10" r="6" fill="#7dffff" {...SW(3)} />
      {/* ombros */}
      <path d="M12,122 C14,104 30,98 60,98 C90,98 106,104 108,122 Z" fill="#1d7fb8" {...S} />
      <rect x="49" y="86" width="22" height="14" rx="3" fill="#8aa0b8" {...S} />
      <path d="M52,90 H68 M52,94 H68" stroke={INK} strokeWidth="2.5" />
      <circle cx="60" cy="112" r="5" fill="#7dffff" {...SW(2.5)} />
      <circle cx="40" cy="112" r="3" fill="#ffe62a" {...SW(2)} />
      <circle cx="80" cy="112" r="3" fill="#ff2a55" {...SW(2)} />
      {/* orelhas */}
      <rect x="10" y="44" width="16" height="30" rx="6" fill="#1d7fb8" {...S} />
      <rect x="94" y="44" width="16" height="30" rx="6" fill="#1d7fb8" {...S} />
      <circle cx="18" cy="59" r="3" fill="#7dffff" />
      <circle cx="102" cy="59" r="3" fill="#7dffff" />
      {/* cabeça */}
      <rect x="22" y="22" width="76" height="66" rx="22" fill={c} {...S} />
      <path d="M32,34 Q34,28 44,27 L62,27" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
      <circle cx="31" cy="78" r="2.5" fill={INK} />
      <circle cx="89" cy="78" r="2.5" fill={INK} />
      {/* tela do rosto */}
      <rect x="31" y="36" width="58" height="38" rx="14" fill="#0b1b3a" {...S} />
      <path d="M38,42 Q44,39 52,40" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".35" />
      <g className="m-blink" style={{ transformOrigin: '60px 54px' }}>
        <rect x="40" y="46" width="14" height="16" rx="6" fill="#7dffff" />
        <rect x="66" y="46" width="14" height="16" rx="6" fill="#7dffff" />
        <circle cx="45" cy="51" r="2.6" fill="#fff" />
        <circle cx="71" cy="51" r="2.6" fill="#fff" />
      </g>
      <path d="M48,66 Q60,74 72,66" fill="none" stroke="#7dffff" strokeWidth="3.5" strokeLinecap="round" />
    </>
  );
}

// ------------------------------------------------------------ TOXIC · gosma radioativa (verde)
function Toxic({ c }) {
  return (
    <>
      <path d="M14,98 C6,58 26,22 60,22 C94,22 114,58 106,98 C104,112 86,114 76,108 C70,118 52,118 46,108 C34,114 16,112 14,98 Z" fill={c} {...S} />
      <path d="M26,52 C28,40 38,32 50,30" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".55" />
      <path d="M90,10 Q97,22 90,28 Q83,22 90,10 Z" fill={c} {...SW(3)} />
      <path d="M17,104 Q15,124 22,126 Q28,124 25,108" fill={c} {...SW(3)} />
      <circle cx="98" cy="40" r="6" fill="#fff" opacity=".4" {...SW(2.5)} />
      <circle cx="22" cy="42" r="4" fill="#fff" opacity=".4" {...SW(2.5)} />
      <circle cx="104" cy="70" r="3.5" fill="#fff" opacity=".4" {...SW(2)} />
      {/* olhos desencontrados */}
      <Eye x={44} y={58} r={13} px={4} py={2} />
      <Eye x={78} y={54} r={9} px={-3} py={2} d={0.3} />
      <path d="M32,40 L52,46" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M90,38 L72,43" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      {/* boca cheia de dentes */}
      <path d="M32,78 Q60,112 90,78 Q60,86 32,78 Z" fill="#0f4a1f" {...SW(3.5)} />
      <ellipse cx="62" cy="98" rx="11" ry="6" fill="#ff5a8a" />
      <path d="M34,79 L41,89 L48,81 L55,91 L62,82 L69,91 L76,81 L83,89 L88,79 Z" fill="#fff" {...SW(2.5)} />
      <circle cx="48" cy="72" r="4" fill="#0d7a2c" opacity=".5" />
      <circle cx="84" cy="70" r="3" fill="#0d7a2c" opacity=".5" />
    </>
  );
}

// ------------------------------------------------------------ SPARK · garoto elétrico (amarelo)
function Spark({ c }) {
  return (
    <>
      {/* raios ao redor */}
      <path className="m-zap" d="M8,40 L18,46 L10,54 L20,60" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="m-zap" style={{ animationDelay: '.4s' }} d="M112,40 L102,46 L110,54 L100,60" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* moletom */}
      <path d="M10,122 C12,104 28,96 60,96 C92,96 108,104 110,122 Z" fill={c} {...S} />
      <path d="M44,98 Q60,110 76,98" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M52,106 L50,118 M68,106 L70,118" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M62,100 L52,114 L60,114 L56,124 L70,108 L62,108 Z" fill="#ff8a1f" {...SW(2.5)} />
      <rect x="52" y="82" width="16" height="16" rx="4" fill="#7a4a2e" {...S} />
      {/* rosto */}
      <circle cx="28" cy="64" r="7" fill="#8d5a3b" {...S} />
      <circle cx="92" cy="64" r="7" fill="#8d5a3b" {...S} />
      <ellipse cx="60" cy="64" rx="31" ry="29" fill="#8d5a3b" {...S} />
      {/* cabelo de raio */}
      <path d="M26,56 L14,32 L34,40 L32,12 L50,32 L60,4 L70,32 L88,12 L86,40 L106,32 L94,56 L88,46 L80,56 L72,46 L64,56 L56,46 L48,56 L40,46 L32,56 Z" fill={c} {...S} />
      <path d="M52,14 L60,26 L56,28 L62,38" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <path d="M38,58 Q46,52 54,58" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M66,58 Q74,52 82,58" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <Eye x={46} y={68} r={8} px={0} py={-1} />
      <Eye x={74} y={68} r={8} px={0} py={-1} d={0.25} />
      <ellipse cx="60" cy="86" rx="9" ry="8" fill="#5a1030" {...SW(3)} />
      <ellipse cx="60" cy="90" rx="5" ry="3" fill="#ff6b94" />
      <path d="M34,76 L40,74 L37,80 L43,78" fill="none" stroke="#ffe62a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M86,76 L80,74 L83,80 L77,78" fill="none" stroke="#ffe62a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

// ------------------------------------------------------------ MYSTIC · gato mago (roxo)
function Mystic({ c }) {
  return (
    <>
      {/* manto */}
      <path d="M12,122 C14,104 30,98 60,98 C90,98 106,104 108,122 Z" fill="#5b1fa8" {...S} />
      <path d="M46,100 Q60,112 74,100" fill="none" stroke="#ffe62a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="110" r="5" fill="#ffe62a" {...SW(2.5)} />
      <Sparkle x={30} y={112} s={4} fill="#ffe62a" />
      <Sparkle x={92} y={110} s={4} fill="#ffe62a" d={0.5} />
      {/* orelhas */}
      <path d="M24,68 L18,32 L46,52 Z" fill={c} {...S} />
      <path d="M96,68 L102,32 L74,52 Z" fill={c} {...S} />
      <path d="M26,60 L23,42 L38,52 Z" fill="#ff9bd0" />
      <path d="M94,60 L97,42 L82,52 Z" fill="#ff9bd0" />
      {/* cabeça */}
      <ellipse cx="60" cy="70" rx="36" ry="29" fill={c} {...S} />
      <path d="M32,78 Q40,92 60,92 Q80,92 88,78" fill="#e7c3ff" opacity=".55" />
      {/* chapéu de mago */}
      <path d="M32,50 C40,34 52,18 72,4 C74,18 80,34 90,50 Z" fill="#5b1fa8" {...S} />
      <path d="M34,48 Q60,40 88,48 L89,53 Q60,45 33,53 Z" fill="#ffe62a" {...SW(2.5)} />
      <ellipse cx="60" cy="52" rx="42" ry="9" fill="#7a2fd6" {...S} />
      <path d="M64,22 L66.5,28 L73,28.5 L68,32.5 L70,39 L64,35.5 L58,39 L60,32.5 L55,28.5 L61.5,28 Z" fill="#ffe62a" {...SW(2)} />
      {/* olhos de gato */}
      <g className="m-blink" style={{ transformOrigin: '60px 70px' }}>
        <ellipse cx="46" cy="70" rx="10" ry="11" fill="#d6ff4a" {...SW(3)} />
        <ellipse cx="74" cy="70" rx="10" ry="11" fill="#d6ff4a" {...SW(3)} />
        <ellipse cx="46" cy="70" rx="3" ry="8.5" fill={INK} />
        <ellipse cx="74" cy="70" rx="3" ry="8.5" fill={INK} />
        <circle cx="49" cy="65" r="2.4" fill="#fff" />
        <circle cx="77" cy="65" r="2.4" fill="#fff" />
      </g>
      <path d="M56,80 L64,80 L60,85 Z" fill="#ff5a9a" {...SW(2)} />
      <path d="M60,85 Q55,92 48,87 M60,85 Q65,92 72,87" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M26,78 L10,74 M26,84 L10,86 M94,78 L110,74 M94,84 L110,86" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".85" />
      <Sparkle x={104} y={24} s={6} fill="#fff" />
      <Sparkle x={12} y={20} s={5} fill="#ffe62a" d={0.8} />
    </>
  );
}

// ------------------------------------------------------------ BLAZE · punk de cabelo em chamas (laranja)
function Blaze({ c }) {
  return (
    <>
      {/* chamas de trás */}
      <path className="m-flame" d="M20,70 C10,52 22,38 28,30 C30,40 38,40 40,30 C42,18 50,12 56,2 C58,16 66,20 70,28 C74,22 78,18 82,8 C90,24 102,38 100,54 C104,60 102,66 100,72 Z" fill={c} {...S} />
      <path className="m-flame" style={{ animationDelay: '.3s' }} d="M36,50 C32,40 40,34 44,28 C48,36 52,38 56,32 C60,40 66,40 70,34 C74,40 80,44 78,52 Z" fill="#ffe62a" />
      {/* jaqueta */}
      <path d="M10,122 C12,104 28,98 60,98 C92,98 108,104 110,122 Z" fill="#2a1840" {...S} />
      <path d="M44,99 L60,120 L50,122 L36,102 Z M76,99 L60,120 L70,122 L84,102 Z" fill={c} {...SW(2.5)} />
      <path d="M60,108 V124" stroke="#ffe62a" strokeWidth="2.5" strokeDasharray="3 3" />
      <rect x="52" y="84" width="16" height="16" rx="4" fill="#cf8a5a" {...S} />
      {/* rosto */}
      <circle cx="29" cy="70" r="6.5" fill="#e6a574" {...S} />
      <circle cx="91" cy="70" r="6.5" fill="#e6a574" {...S} />
      <circle cx="28" cy="82" r="4.5" fill="none" stroke="#ffe62a" strokeWidth="2.5" />
      <ellipse cx="60" cy="66" rx="31" ry="29" fill="#e6a574" {...S} />
      {/* franja de fogo */}
      <path d="M30,56 C28,42 38,36 44,36 C44,44 50,46 54,40 C56,48 62,48 66,42 C68,48 74,48 78,42 C84,44 92,50 90,60 C82,52 72,48 60,48 C48,48 38,50 30,56 Z" fill={c} {...S} />
      {/* óculos escuros */}
      <path d="M32,64 L88,64" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M33,62 Q34,76 46,76 Q58,76 58,64 Z" fill="#1a0b2e" {...S} />
      <path d="M87,62 Q86,76 74,76 Q62,76 62,64 Z" fill="#1a0b2e" {...S} />
      <path d="M38,66 L44,66 M40,70 L46,70" stroke="#ff8a1f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M68,66 L74,66 M70,70 L76,70" stroke="#ff8a1f" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36,58 Q46,52 54,57" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M66,57 Q76,50 84,56" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {/* sorriso de lado */}
      <path d="M48,87 Q64,96 78,82" fill="none" stroke="#8f2a1c" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M74,86 L77,92 L80,84" fill="#fff" {...SW(2)} />
      <circle cx="40" cy="82" r="4.5" fill="#ff7b6a" opacity=".5" />
      <Sparkle x={106} y={30} s={5} fill="#ffe62a" />
    </>
  );
}

const ART = { neon_red: Turbo, neon_blue: Cyber, neon_green: Toxic, neon_yellow: Spark, neon_purple: Mystic, neon_orange: Blaze };
const BODY = { neon_red: '#ff2a55', neon_blue: '#2ab7ff', neon_green: '#39ff6a', neon_yellow: '#ffe62a', neon_purple: '#b44dff', neon_orange: '#ff8a1f' };

export default function Mascot({ color, size = '100%', still = false }) {
  const Art = ART[color] || Turbo;
  return (
    <svg viewBox="0 0 120 124" width={size} height={size} className={`mascot ${still ? '' : 'm-bob'}`} role="img" aria-label="personagem">
      <Art c={BODY[color] || '#ff2a55'} />
    </svg>
  );
}
