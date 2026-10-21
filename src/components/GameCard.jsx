import { CARDS, CATEGORIES } from '../game/constants.js';

// Largura de cada tamanho; a fonte e tudo dentro da carta escalam a partir dela.
export const CARD_W = { sm: '104px', md: '142px', lg: 'min(62vw, 236px)', xl: 'min(43vh, 400px)' };

const SHORT = {
  escudo: 'Escudo', vinganca: 'Vingança', cinto: 'Cinto de Segurança',
  dado_duplo: 'Dado Duplo', troca: 'Troca de Lugar', pedagio: 'Pedágio sem Parar',
  brinde: 'Brinde Geral', caos: 'Caos Total', imposto: 'Imposto do Dado',
};

// Carta de frente: faixa da categoria, arte grande, nome e (opcional) a regra.
export function GameCard({ cardId, size = 'md', selected, dim, showDesc, onClick, style, className = '' }) {
  const card = CARDS[cardId];
  const cat = CATEGORIES[card.cat];
  const Tag = onClick ? 'button' : 'div';
  const full = size === 'lg' || size === 'xl';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`gcard ${selected ? 'sel' : ''} ${dim ? 'dim' : ''} ${className}`}
      style={{ '--w': CARD_W[size], '--c': cat.color, ...style }}
    >
      <div className="gcard-in">
        <div className="gcard-top"><span>{cat.emoji} {cat.short}</span><span>{card.reactive ? 'AUTO' : '★'}</span></div>
        <div className="gcard-art"><span>{card.emoji}</span></div>
        <div className="gcard-name">{full ? card.name : SHORT[cardId]}</div>
        {showDesc && <div className="gcard-desc">{card.desc}</div>}
      </div>
    </Tag>
  );
}

// Carta virada para baixo (usada na compra surpresa).
export function CardBack({ category, size = 'md', label, onClick, selected, style }) {
  const cat = CATEGORIES[category];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`gcard back ${selected ? 'sel' : ''}`}
      style={{ '--w': CARD_W[size], '--c': cat.color, ...style }}
    >
      <div className="gcard-in">
        <div className="gcard-back-mid">
          <div className="gcard-back-emoji">{cat.emoji}</div>
          <div className="gcard-back-q">?</div>
        </div>
        <div className="gcard-name">{label ?? cat.short}</div>
      </div>
    </Tag>
  );
}

// Carta que vira: começa de costas e gira mostrando a frente.
export function FlipCard({ cardId, size = 'lg', delay = 450 }) {
  const card = CARDS[cardId];
  return (
    <div className="flip" style={{ '--w': CARD_W[size], '--delay': `${delay}ms` }}>
      <div className="flip-inner">
        <div className="flip-face flip-back"><CardBack category={card.cat} size={size} /></div>
        <div className="flip-face"><GameCard cardId={cardId} size={size} showDesc /></div>
      </div>
    </div>
  );
}

export function EmptySlot({ size = 'sm' }) {
  return <div className="gcard-empty" style={{ '--w': CARD_W[size] }}>VAZIO</div>;
}
