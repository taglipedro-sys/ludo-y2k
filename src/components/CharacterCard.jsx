import { CHARACTERS, COLOR_HEX } from '../game/constants.js';
import Mascot from './Mascots.jsx';

const W = { sm: '104px', md: '142px', tv: '190px' };

// Carta de personagem no formato de colecionável: nome em cima, mascote no meio, bordão embaixo.
export default function CharacterCard({ color, playerName, selected, disabled, onClick, compact = false, size, ready }) {
  const ch = CHARACTERS[color];
  const Tag = onClick ? 'button' : 'div';
  const w = W[size || (compact ? 'md' : 'tv')];
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      className={`gcard ${selected ? 'sel' : ''} ${disabled ? 'dim' : ''}`}
      style={{ '--w': w, '--c': COLOR_HEX[color] }}
    >
      <div className="gcard-in">
        <div className="gcard-top"><span>{ch.name}</span><span>★★★</span></div>
        <div className="gcard-art char-art"><Mascot color={color} /></div>
        <div className="gcard-name char-name">
          {playerName ? (
            <>
              <span className="char-player">{playerName}</span>
              <span className="char-tag">{ch.tagline}</span>
              {ready !== undefined && <span className="char-state" style={{ color: ready ? '#39ff6a' : '#ff2a55' }}>{ready ? '● ONLINE' : '○ OFFLINE'}</span>}
            </>
          ) : (
            <span className="char-tag on">{ch.tagline}</span>
          )}
        </div>
      </div>
    </Tag>
  );
}
