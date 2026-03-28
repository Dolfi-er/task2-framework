import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { Container } from './container.js';
import { loadModulesFromDirectory, buildOrder } from './moduleLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Определяем путь к папке modules (на уровень выше src)
const modulesDir = path.resolve(__dirname, '../modules');

async function main() {
  try {
    console.log('Загрузка модулей из директории:', modulesDir);
    // 1. Загружаем все модули из папки modules
    const allModules = await loadModulesFromDirectory(modulesDir);
    
    // 2. Берём имена всех загруженных модулей для включения
    const enabledNames = Array.from(allModules.keys());
    
    // 3. Строим порядок инициализации с учётом зависимостей
    const orderedModules = buildOrder(allModules, enabledNames);
    
    console.log('Порядок инициализации модулей:');
    orderedModules.forEach(m => console.log(`  - ${m.name}`));
    
    // 4. Создаём контейнер
    const container = new Container();
    
    // 5. Регистрируем службы модулей
    console.log('\nРегистрация служб модулей...');
    for (const module of orderedModules) {
      if (typeof module.register === 'function') {
        module.register(container);
      }
    }
    
    // 6. Инициализируем модули (если есть init)
    console.log('\nИнициализация модулей...');
    for (const module of orderedModules) {
      if (typeof module.init === 'function') {
        await module.init(container);
      }
    }
    
    // 7. Получаем все зарегистрированные действия (с префиксом "action.")
    const actions = container.getMany('action.');
    
    console.log(`\nВыполнение действий модулей (найдено ${actions.length} действий):`);
    for (const action of actions) {
      console.log(`\n➤ ${action.title}`);
      await action.execute();
    }
    
    // 8. Проверка результата работы модуля Export (если он был загружен)
    const exportPath = path.resolve(process.cwd(), 'export.txt');
    try {
      await fs.access(exportPath);
      console.log('\n✅ Файл экспорта создан:', exportPath);
    } catch {
      console.log('\n⚠️ Файл экспорта не найден (возможно, модуль Export не был загружен)');
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка при запуске приложения:');
    if (error.name === 'ModuleLoadError') {
      console.error('   Модульная ошибка:', error.message);
    } else {
      console.error('   ', error.message);
    }
    process.exit(1);
  }
}

main();