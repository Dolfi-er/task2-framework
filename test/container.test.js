import test from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../src/container.js';

test('Container: регистрация и получение синглтона', () => {
  const container = new Container();
  let callCount = 0;
  container.addSingleton('test', () => {
    callCount++;
    return { value: callCount };
  });

  const inst1 = container.get('test');
  const inst2 = container.get('test');
  assert.equal(inst1.value, 1);
  assert.equal(inst2.value, 1);
  assert.equal(callCount, 1);
  assert(inst1 === inst2);
});

test('Container: регистрация и получение transient', () => {
  const container = new Container();
  let callCount = 0;
  container.addTransient('test', () => {
    callCount++;
    return { value: callCount };
  });

  const inst1 = container.get('test');
  const inst2 = container.get('test');
  assert.equal(inst1.value, 1);
  assert.equal(inst2.value, 2);
  assert(inst1 !== inst2);
});

test('Container: ошибка при отсутствии службы', () => {
  const container = new Container();
  assert.throws(
    () => container.get('unknown'),
    /not registered/   // изменено: ищем любое сообщение с "not registered"
  );
});

test('Container: getMany по префиксу', () => {
  const container = new Container();
  container.addSingleton('action.a', () => ({ name: 'A' }));
  container.addSingleton('action.b', () => ({ name: 'B' }));
  container.addSingleton('other.c', () => ({ name: 'C' }));

  const actions = container.getMany('action.');
  assert.equal(actions.length, 2);
  assert.deepEqual(actions.map(a => a.name), ['A', 'B']);
});