import test from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../src/container.js';

test('Модули используют контейнер для получения зависимостей', async () => {
  const container = new Container();
  // Регистрируем тестовую службу
  container.addSingleton('storage', () => ({ test: true }));

  // Создаём фейковый модуль, который в register получает storage из контейнера
  const module = {
    name: 'TestModule',
    register(cont) {
      const storage = cont.get('storage');
      // Сохраняем факт использования контейнера
      this.usedStorage = storage;
    }
  };

  module.register(container);
  assert(module.usedStorage, 'Модуль не получил storage из контейнера');
  assert.equal(module.usedStorage.test, true);
});