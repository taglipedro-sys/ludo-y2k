# LUDO Y2K — party game (TV Host + celulares)

Vite + React + Tailwind + Supabase Realtime. A TV abre `/host`; cada jogador abre `/play` no celular (QR Code).

## Rodar

```bash
npm install
cp .env.example .env        # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                 # --host: acessível na rede local
npm test                    # engine do jogo (node:test, sem dependências)
```

**Sem `.env` o jogo roda em modo LOCAL** (BroadcastChannel + localStorage): abra `/host` numa aba e `/play?room=XXXX` em outras abas do *mesmo navegador* para testar sem backend. Para jogar de verdade com celulares, configure o Supabase.

## Supabase

1. Crie um projeto e rode `supabase/schema.sql` no SQL Editor (tabela `rooms` para persistir o estado).
2. Copie a URL e a anon key para o `.env`.
3. O tempo real usa **Broadcast + Presence** (não precisa habilitar replicação de tabela).
4. Deploy (Vercel/Netlify): configure as mesmas variáveis e o fallback de SPA para `index.html`.
   O QR Code usa `window.location.origin`, então o domínio publicado é usado automaticamente.

> As policies do `schema.sql` são abertas (party game casual, acesso por código de sala). Endureça antes de expor ao público.

## Arquitetura

```
src/game/constants.js   cores, pontos, personagens, catálogo de cartas
src/game/board.js       pista, reta final, casas de bebida, geometria (cruz 4p / hexágono 6p)
src/game/engine.js      reduce(state, action, rng) -> { state, events, error }  (pura, testada)
src/game/engine.test.js testes + simulação de partidas completas com bots
src/lib/transport.js    Supabase Realtime (ou modo local) + persistência
src/lib/useRoom.js      useHostRoom (autoridade) e usePlayerRoom (controle)
src/pages/Host.jsx      TV: lobby+QR, tabuleiro, placar, CRT, roleta, alertas
src/pages/Play.jsx      celular: dado, peões, mão, loja, dose, botão do narguilé
```

**Fluxo:** o celular envia `{t:'action'}` → o **Host** aplica na engine → publica `{t:'state', state, events}` para todos e salva no banco. Os `events` disparam efeitos (K.O., alarme, roleta, vibração).

**Reconexão:** o jogador é identificado pelo **nome** (sem diferenciar maiúsculas). Entrar de novo com o mesmo nome e código devolve pontos, peões e cartas; o celular reenvia `JOIN` automaticamente se a TV não o reconhece. Se a TV recarregar, o estado volta do banco.

**Posição dos peões:** relativa ao dono — `"BASE"`, `0..ring-2` na pista, depois 5 casas de reta final e o centro. `CRITICAL_STATE` = a 5 casas ou menos do centro.

## Decisões onde o briefing era ambíguo

| Ponto | O que foi feito |
|---|---|
| **27 cartas** vs. cópias listadas | As cópias do catálogo somam **33** (6+3+3+6+3+3+4+2+3). O baralho usa as cópias listadas (`copies` em `constants.js`); para 27, ajuste esses números. |
| Estoque | Carta usada volta ao baralho. Compra direta exige estoque. |
| Escudo / Vingança | Reativas: o Escudo aparece na hora de beber; a Vingança dispara sozinha quando seu peão é comido. Não contam no limite de 1 carta por turno. |
| Dado Duplo | Só antes de rolar. Os dois dados são movimentos separados (escolha dado + peão). |
| Cinto | 2 rodadas = a atual + a seguinte. Atacante toma 1 shot e o peão não é comido nem trocado. |
| Pedágio | Barreira dura até a vez do dono voltar; um por jogador. Quem passa escolhe pagar 20 pts ao dono ou beber 1. |
| Caos Total | Peões na pista andam para trás por 2 rodadas; quem está na reta final continua avançando. Toda casa de bebida pune a mesa. |
| Imposto | Quem já é o líder não pode usar. |
| Casas de saída | Seguras (sem captura). Casas de bebida: a cada 8 casas, fora as de saída. |
| 6 + extra | Tirar 6 dá jogada extra (máx. 3 seguidas). |
| Narguilé | "100% dos ativos": votos persistem até todos os jogadores **conectados** votarem (tocar de novo retira o voto). |
| Turnos | Jogador desconectado é pulado. Doses pendentes bloqueiam a mesa até serem resolvidas. |

## Ideias para depois

Reconexão do Host por QR "controle remoto da TV", sons por jogador, ranking persistente, arte em pixel real para os personagens.
