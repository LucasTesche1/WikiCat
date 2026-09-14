import assert from 'node:assert/strict';
import { documentLinks, lineDiff, parseDocument } from '../packages/shared/dist/index.js';

const markdown = [
  '# Backup do PostgreSQL',
  '',
  'Veja [runbook nginx](/s/linux/p/abc-123#restart) e [externo](https://example.invalid).',
  '',
  '## Reiniciar servico',
  '',
  '```bash',
  'sudo systemctl restart postgresql',
  '```',
  '',
  '## Reiniciar servico',
].join('\n');

const parsed = parseDocument(markdown);
assert.deepEqual(
  parsed.headings.map((h) => [h.level, h.text, h.id]),
  [
    [1, 'Backup do PostgreSQL', 'backup-do-postgresql'],
    [2, 'Reiniciar servico', 'reiniciar-servico'],
    [2, 'Reiniciar servico', 'reiniciar-servico-1'],
  ],
);

assert.deepEqual(documentLinks(markdown), ['/s/linux/p/abc-123#restart', 'https://example.invalid']);

assert.deepEqual(
  lineDiff('a\nb\nc', 'a\nc\nd').map((line) => `${line.type}:${line.content}`),
  ['unchanged:a', 'removed:b', 'unchanged:c', 'added:d'],
);

console.log('ui smoke checks passed');
