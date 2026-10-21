// Converte eventos da engine em linhas de texto para o feed da TV.
import { CARDS } from '../game/constants.js';

const REASON = {
  CASA_BEBIDA: 'Casa de bebida',
  DADO_DUPLO: 'Dados iguais',
  VINGANCA: 'Vingança Instantânea',
  CINTO: 'Cinto de Segurança',
  PEDAGIO: 'Pedágio',
  BEBA_JUNTO: 'Beba Junto',
  BRINDE_GERAL: 'Brinde Geral',
  IMPOSTO: 'Imposto do Dado',
  ESCUDO: 'Dose repassada',
};
export const reasonLabel = (r) => REASON[r] || r;

export function describe(ev, state) {
  const nm = (id) => state.players.find((p) => p.id === id)?.name ?? '???';
  switch (ev.type) {
    case 'GAME_START': return 'A partida começou!';
    case 'DICE': return `${nm(ev.playerId)} tirou ${ev.dice.join(' + ')}`;
    case 'NO_MOVES': return `${nm(ev.playerId)} não tem jogada`;
    case 'EXTRA_ROLL': return `${nm(ev.playerId)} joga de novo!`;
    case 'CAPTURE': return `💥 ${nm(ev.attackerId)} comeu um peão de ${nm(ev.victimId)}!`;
    case 'IMMUNE_BLOCK': return `🪢 Peão de ${nm(ev.victimId)} é imune! ${nm(ev.attackerId)} bebe 1`;
    case 'BEBA_OU_PAGUE': return `🍺 ${nm(ev.playerId)}: BEBA OU PAGUE!`;
    case 'DRINK_ALERT': return `🍺 ${nm(ev.playerId)} deve beber ${ev.shots} (${reasonLabel(ev.reason)})`;
    case 'DRANK': return `${nm(ev.playerId)} bebeu ${ev.shots}`;
    case 'PAID': return `💰 ${nm(ev.playerId)} pagou ${ev.amount} pts`;
    case 'SHIELDED': return `🛡️ ${nm(ev.playerId)} passou a dose para ${nm(ev.targetId)}`;
    case 'CARD_BOUGHT': return `🎴 ${nm(ev.playerId)} comprou uma carta`;
    case 'CARD_WON': return `🎁 ${nm(ev.playerId)} ganhou uma carta (${ev.reason === 'CAPTURA' ? 'captura' : 'peão na chegada'})`;
    case 'SESSION_END': return '🏁 Sessão encerrada';
    case 'CARD_PLAYED': return `🎴 ${nm(ev.playerId)} usou ${CARDS[ev.cardId]?.name}`;
    case 'CARD_TRIGGER': return `😈 ${nm(ev.playerId)} ativou ${CARDS[ev.cardId]?.name}`;
    case 'SWAP': return `🔁 ${nm(ev.playerId)} trocou de lugar com ${nm(ev.targetId)}`;
    case 'TOLL_PLACED': return `🚧 ${nm(ev.playerId)} montou um pedágio`;
    case 'CAOS': return `🌀 CAOS TOTAL por ${nm(ev.playerId)}!`;
    case 'CAOS_END': return 'O caos acabou';
    case 'BRINDE_GERAL': return `🥂 BRINDE GERAL de ${nm(ev.playerId)}!`;
    case 'IMPOSTO': return `💸 ${nm(ev.playerId)} tomou ${ev.amount} pts de ${nm(ev.targetId)}`;
    case 'CRITICAL': return `🚨 Peão de ${nm(ev.playerId)} na reta final!`;
    case 'PAWN_FINISHED': return `🏁 ${nm(ev.playerId)} levou um peão ao centro`;
    case 'HOOKAH_RESULT': return `💨 Narguilé: ${nm(ev.winnerId)} foi sorteado!`;
    case 'WIN': return `🏆 ${nm(ev.playerId)} VENCEU!`;
    case 'RECONNECTED': return `${nm(ev.playerId)} voltou`;
    case 'JOINED': return `${nm(ev.playerId)} entrou`;
    default: return null;
  }
}
