// Hooks de sala: o Host é a autoridade (roda a engine); os celulares enviam ações.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoom, reduce } from '../game/engine.js';
import { loadState, openChannel, saveState } from './transport.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const randomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

// ---------------------------------------------------------------- Host (TV)

export function useHostRoom(code) {
  const [state, setState] = useState(null);
  const [batch, setBatch] = useState({ id: 0, events: [] });
  const stateRef = useRef(null);
  const chRef = useRef(null);
  const saveTimer = useRef(null);
  const batchId = useRef(0);

  const apply = useCallback((action) => {
    const cur = stateRef.current;
    if (!cur) return 'Sala ainda carregando.';
    const { state: next, events, error } = reduce(cur, action);
    if (error) {
      if (action.clientId) chRef.current?.send({ t: 'error', to: action.clientId, message: error });
      return error;
    }
    stateRef.current = next;
    setState(next);
    const id = ++batchId.current;
    if (events.length) setBatch({ id, events });
    chRef.current?.send({ t: 'state', state: next, events, batchId: events.length ? id : 0 });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveState(code, next), 250);
    return null;
  }, [code]);

  useEffect(() => {
    let closed = false;
    let ch = null;
    stateRef.current = null; // sala trocada: não mostra a partida antiga enquanto carrega
    setState(null);
    (async () => {
      const saved = await loadState(code);
      if (closed) return;
      const init = structuredClone(saved || createRoom(code, 4));
      init.players.forEach((p) => { p.connected = false; }); // presença reativa reconecta
      stateRef.current = init;
      setState(init);
      ch = openChannel(code, 'HOST', {
        onMessage: (m) => {
          if (m?.t === 'action') apply(m.action);
          else if (m?.t === 'hello') ch.send({ t: 'state', state: stateRef.current, events: [], batchId: 0 });
        },
        onPresence: (keys) => {
          const names = keys.filter((k) => k.startsWith('P:')).map((k) => k.slice(2));
          apply({ type: 'PRESENCE', names });
        },
      });
      chRef.current = ch;
    })();
    return () => { closed = true; clearTimeout(saveTimer.current); ch?.close(); };
  }, [code, apply]);

  return { state, batch, apply };
}

// ---------------------------------------------------------------- Controle (celular)

export function usePlayerRoom(code, name, preferredColor) {
  const [state, setState] = useState(null);
  const [batch, setBatch] = useState({ id: 0, events: [] });
  const [toast, setToast] = useState(null);
  const chRef = useRef(null);
  const meRef = useRef(null);
  const clientId = useRef(Math.random().toString(36).slice(2));

  const me = state?.players.find((p) => p.name.toLowerCase() === name.toLowerCase()) || null;
  meRef.current = me;

  const send = useCallback((action) => {
    chRef.current?.send({ t: 'action', action: { ...action, clientId: clientId.current } });
  }, []);

  const join = useCallback(() => send({ type: 'JOIN', name, color: preferredColor }), [send, name, preferredColor]);

  useEffect(() => {
    const ch = openChannel(code, `P:${name.toLowerCase()}`, {
      onReady: () => { ch.send({ t: 'hello' }); join(); },
      onMessage: (m) => {
        if (m?.t === 'state') {
          setState(m.state);
          if (m.batchId) setBatch({ id: m.batchId, events: m.events || [] });
        } else if (m?.t === 'error' && m.to === clientId.current) {
          setToast({ id: Date.now(), text: m.message });
        }
      },
    });
    chRef.current = ch;
    // Reentrada automática enquanto a TV não nos reconhece (TV reiniciada, rede caiu...).
    const retry = setInterval(() => {
      if (!meRef.current) { ch.send({ t: 'hello' }); join(); }
    }, 2500);
    return () => { clearInterval(retry); ch.close(); };
  }, [code, name, join]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  return { state, me, batch, toast, send, connected: Boolean(state) };
}
