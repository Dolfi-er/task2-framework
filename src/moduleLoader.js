import fs from 'node:fs/promises';
import path from 'node:path';
import { ModuleLoadError } from './errors.js';

const EXPECTED_CONTRACT_VERSION = '1.0';

export async function loadModulesFromDirectory(modulesDir) {
  const modules = new Map();

  let files;
  try {
    files = await fs.readdir(modulesDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new ModuleLoadError(`Modules directory not found: ${modulesDir}`);
    }
    throw err;
  }

  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

  for (const file of jsFiles) {
    const fullPath = path.resolve(modulesDir, file);
    let moduleExports;
    try {
      moduleExports = await import(fullPath);
    } catch (err) {
      throw new ModuleLoadError(`Failed to load module from ${file}: ${err.message}`);
    }

    const mod = moduleExports.default;
    if (!mod) {
      throw new ModuleLoadError(`Module ${file} does not export a default object`);
    }

    // Проверка обязательных полей
    if (typeof mod.name !== 'string' || mod.name.trim() === '') {
      throw new ModuleLoadError(`Module ${file}: missing or invalid "name" (must be non-empty string)`);
    }
    if (typeof mod.register !== 'function') {
      throw new ModuleLoadError(`Module ${mod.name}: missing or invalid "register" function`);
    }
    // requires опционально, но если есть, должен быть массивом
    if (mod.requires !== undefined && !Array.isArray(mod.requires)) {
      throw new ModuleLoadError(`Module ${mod.name}: "requires" must be an array`);
    }
    // init опционально, но если есть, должен быть функцией
    if (mod.init !== undefined && typeof mod.init !== 'function') {
      throw new ModuleLoadError(`Module ${mod.name}: "init" must be a function`);
    }

    // Проверка версии контракта
    if (mod.contractVersion !== undefined && mod.contractVersion !== EXPECTED_CONTRACT_VERSION) {
      throw new ModuleLoadError(
        `Module ${mod.name}: contract version mismatch (expected ${EXPECTED_CONTRACT_VERSION}, got ${mod.contractVersion})`
      );
    }

    const key = mod.name.toLowerCase();
    if (modules.has(key)) {
      throw new ModuleLoadError(`Duplicate module name: ${mod.name} (from ${file} and another file)`);
    }

    modules.set(key, mod);
  }

  return modules;
}

export function buildOrder(allModules, enabledNames) {
  const enabled = new Map();

  for (const name of enabledNames) {
    const key = name.toLowerCase();
    const mod = allModules.get(key);
    if (!mod) {
      throw new ModuleLoadError(`Module not found: ${name}`);
    }
    enabled.set(key, mod);
  }

  // Проверка, что все зависимости присутствуют среди включённых модулей
  for (const mod of enabled.values()) {
    const reqs = mod.requires ?? [];
    for (const req of reqs) {
      const reqKey = req.toLowerCase();
      if (!enabled.has(reqKey)) {
        throw new ModuleLoadError(`Module ${mod.name} requires ${req}, but it's not enabled or not loaded`);
      }
    }
  }

  // Построение графа
  const indeg = new Map();
  const edges = new Map();

  for (const [k] of enabled) {
    indeg.set(k, 0);
    edges.set(k, []);
  }

  for (const [k, mod] of enabled) {
    const reqs = mod.requires ?? [];
    for (const r of reqs) {
      const rKey = r.toLowerCase();
      edges.get(rKey).push(k);
      indeg.set(k, indeg.get(k) + 1);
    }
  }

  const queue = [];
  for (const [k, deg] of indeg) {
    if (deg === 0) queue.push(k);
  }

  const result = [];
  while (queue.length) {
    const k = queue.shift();
    result.push(enabled.get(k));
    for (const to of edges.get(k)) {
      indeg.set(to, indeg.get(to) - 1);
      if (indeg.get(to) === 0) queue.push(to);
    }
  }

  if (result.length !== enabled.size) {
    const stuck = [];
    for (const [k, deg] of indeg) {
      if (deg > 0) stuck.push(enabled.get(k).name);
    }
    throw new ModuleLoadError(`Circular dependency detected among modules: ${stuck.join(', ')}`);
  }

  return result;
}