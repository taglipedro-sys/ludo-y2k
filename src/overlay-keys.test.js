// Regressão do bug "Caos Total fica preso na TV": a carta e o aviso usavam a MESMA key (o id do lote de eventos).
// Com keys repetidas entre irmãos o React perde o controle e deixa o elemento na tela para sempre.
// Este teste garante que os avisos da TV e do celular tenham keys com prefixos diferentes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const overlayKeys = (file) => {
  const src = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  // keys dos avisos sobrepostos (os que aparecem/somem por estado)
  const found = [...src.matchAll(/\{(\w+) && (?:\(\s*)?<(\w+)[^>]*?key=\{([^}]+)\}/g)].map((m) => ({ state: m[1], key: m[3] }));
  return found;
};

for (const file of ['./pages/Host.jsx', './pages/Play.jsx']) {
  test(`avisos sobrepostos de ${file} usam prefixos de key diferentes`, () => {
    const keys = overlayKeys(file);
    assert.ok(keys.length >= 1, 'nenhum aviso encontrado');
    const prefixes = keys.map((k) => k.key.replace(/\$\{.*$/, '').replace(/[`'"]/g, ''));
    for (const k of keys) assert.ok(/^`[a-z]+-\$\{/.test(k.key), `key "${k.key}" precisa de prefixo próprio (ex.: card-\${id})`);
    assert.equal(new Set(prefixes).size, prefixes.length, `prefixos repetidos: ${prefixes.join(', ')}`);
  });
}

test('banner e carta do Host nunca compartilham o mesmo prefixo', () => {
  const src = fs.readFileSync(new URL('./pages/Host.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('key={`card-${cardShow.id}`}'));
  assert.ok(src.includes('key={`banner-${banner.id}`}'));
});
