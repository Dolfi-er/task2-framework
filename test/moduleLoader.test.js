import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrder, loadModulesFromDirectory } from '../src/moduleLoader.js';
import { ModuleLoadError } from '../src/errors.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTempModules(modules) {
  const tempDir = path.join(__dirname, 'temp_modules_' + Date.now());
  await fs.mkdir(tempDir);
  for (const [name, content] of Object.entries(modules)) {
    await fs.writeFile(path.join(tempDir, name + '.js'), content, 'utf8');
  }
  return tempDir;
}

test('buildOrder: корректный линейный порядок', () => {
  const all = new Map();
  all.set('a', { name: 'A', requires: [] });
  all.set('b', { name: 'B', requires: ['A'] });
  all.set('c', { name: 'C', requires: ['B'] });

  const order = buildOrder(all, ['A', 'B', 'C']);
  assert.deepEqual(order.map(m => m.name), ['A', 'B', 'C']);
});

test('buildOrder: модули без зависимостей могут идти в любом порядке', () => {
  const all = new Map();
  all.set('a', { name: 'A', requires: [] });
  all.set('b', { name: 'B', requires: [] });
  all.set('c', { name: 'C', requires: [] });

  const order = buildOrder(all, ['A', 'B', 'C']);
  const names = order.map(m => m.name);
  assert.equal(names.length, 3);
  assert(names.includes('A'));
  assert(names.includes('B'));
  assert(names.includes('C'));
});

test('buildOrder: ошибка при отсутствии модуля', () => {
  const all = new Map();
  all.set('a', { name: 'A', requires: [] });

  assert.throws(
    () => buildOrder(all, ['A', 'B']),
    (err) => err instanceof ModuleLoadError && err.message.includes('Module not found: B')
  );
});

test('buildOrder: ошибка при отсутствии зависимости', () => {
  const all = new Map();
  all.set('a', { name: 'A', requires: ['B'] });
  all.set('b', { name: 'B', requires: [] });

  assert.throws(
    () => buildOrder(all, ['A']),
    (err) => err instanceof ModuleLoadError && err.message.includes('requires B, but it\'s not enabled or not loaded')
  );
});

test('buildOrder: обнаружение циклической зависимости', () => {
  const all = new Map();
  all.set('a', { name: 'A', requires: ['B'] });
  all.set('b', { name: 'B', requires: ['A'] });

  assert.throws(
    () => buildOrder(all, ['A', 'B']),
    (err) => err instanceof ModuleLoadError && err.message.toLowerCase().includes('circular')
  );
});

test('loadModulesFromDirectory: загружает корректные модули', async () => {
  const validModule = `
    export default {
      name: 'Test',
      contractVersion: '1.0',
      requires: [],
      register() {},
      init() {}
    };
  `;
  const tempDir = await createTempModules({ test: validModule });
  try {
    const modules = await loadModulesFromDirectory(tempDir);
    assert(modules.has('test'));
    assert.equal(modules.get('test').name, 'Test');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('loadModulesFromDirectory: ошибка при отсутствии name', async () => {
  const invalidModule = `
    export default {
      contractVersion: '1.0',
      register() {}
    };
  `;
  const tempDir = await createTempModules({ invalid: invalidModule });
  try {
    await assert.rejects(
      loadModulesFromDirectory(tempDir),
      (err) => err instanceof ModuleLoadError && err.message.includes('missing or invalid "name"')
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('loadModulesFromDirectory: ошибка при несовместимой версии контракта', async () => {
  const badVersionModule = `
    export default {
      name: 'BadVersion',
      contractVersion: '2.0',
      requires: [],
      register() {}
    };
  `;
  const tempDir = await createTempModules({ bad: badVersionModule });
  try {
    await assert.rejects(
      loadModulesFromDirectory(tempDir),
      (err) => err instanceof ModuleLoadError && err.message.includes('contract version mismatch')
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('loadModulesFromDirectory: ошибка при отсутствии register', async () => {
  const noRegisterModule = `
    export default {
      name: 'NoRegister',
      contractVersion: '1.0',
      requires: [],
      init() {}
    };
  `;
  const tempDir = await createTempModules({ noregs: noRegisterModule });
  try {
    await assert.rejects(
      loadModulesFromDirectory(tempDir),
      (err) => err instanceof ModuleLoadError && err.message.includes('missing or invalid "register" function')
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});