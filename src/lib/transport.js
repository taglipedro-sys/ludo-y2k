// Camada de transporte em tempo real.
//  - Com VITE_SUPABASE_URL/ANON_KEY: Supabase Realtime (Broadcast + Presence) e tabela `rooms` para persistência.
//  - Sem configuração: modo LOCAL (BroadcastChannel + localStorage) — dá para testar TV e celular
//    em abas do mesmo navegador sem backend.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(url && anon && !String(url).includes('SEU-PROJETO'));

export const supabase = configured ? createClient(url, anon, { realtime: { params: { eventsPerSecond: 20 } } }) : null;
export const TRANSPORT_MODE = configured ? 'supabase' : 'local';

// ------------------------------------------------------------ canal

function openSupabase(code, presenceKey, h) {
  const ch = supabase.channel(`ludo:${code}`, {
    config: { broadcast: { self: false, ack: false }, presence: { key: presenceKey } },
  });
  ch.on('broadcast', { event: 'msg' }, ({ payload }) => h.onMessage?.(payload));
  ch.on('presence', { event: 'sync' }, () => h.onPresence?.(Object.keys(ch.presenceState())));
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ch.track({ at: Date.now() });
      h.onReady?.();
    }
  });
  return {
    send: (payload) => ch.send({ type: 'broadcast', event: 'msg', payload }),
    close: () => supabase.removeChannel(ch),
  };
}

function openLocal(code, presenceKey, h) {
  const bc = new BroadcastChannel(`ludo:${code}`);
  const peers = new Set([presenceKey]);
  const emit = () => h.onPresence?.([...peers]);
  bc.onmessage = (e) => {
    const m = e.data;
    if (m && m.__p === 'join') { peers.add(m.key); bc.postMessage({ __p: 'here', key: presenceKey }); emit(); }
    else if (m && m.__p === 'here') { peers.add(m.key); emit(); }
    else if (m && m.__p === 'leave') { peers.delete(m.key); emit(); }
    else h.onMessage?.(m);
  };
  const leave = () => bc.postMessage({ __p: 'leave', key: presenceKey });
  window.addEventListener('beforeunload', leave);
  bc.postMessage({ __p: 'join', key: presenceKey });
  setTimeout(() => { h.onReady?.(); emit(); }, 0);
  return {
    send: (payload) => bc.postMessage(payload),
    close: () => { leave(); window.removeEventListener('beforeunload', leave); bc.close(); },
  };
}

export function openChannel(code, presenceKey, handlers) {
  return configured ? openSupabase(code, presenceKey, handlers) : openLocal(code, presenceKey, handlers);
}

// ------------------------------------------------------------ persistência

export async function loadState(code) {
  try {
    if (supabase) {
      const { data } = await supabase.from('rooms').select('state').eq('code', code).maybeSingle();
      return data?.state ?? null;
    }
    return JSON.parse(localStorage.getItem(`ludo:state:${code}`) || 'null');
  } catch {
    return null;
  }
}

export async function saveState(code, state) {
  try {
    if (supabase) await supabase.from('rooms').upsert({ code, state });
    else localStorage.setItem(`ludo:state:${code}`, JSON.stringify(state));
  } catch {
    /* persistência é best-effort */
  }
}
