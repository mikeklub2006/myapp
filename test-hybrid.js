const { FileManagerHybrid, FileOperationError, ValidationError } = require('./fileOperationsHybrid');

const fileManager = new FileManagerHybrid('./test-data-hybrid');

console.log('=== ТЕСТИРОВАНИЕ ГИБРИДНОГО ПОДХОДА ===\n');

// Часть 1: вызов в стиле колбэков
console.log('1. Стиль колбэков...');
fileManager.createFile('hybrid1.txt', 'Файл создан через колбэк', (err, filePath) => {
  if (err) {
    console.error('  ❌ Ошибка:', err.message);
    return;
  }
  console.log(`  ✅ Файл создан: ${filePath}`);

  fileManager.readFile('hybrid1.txt', (err, content) => {
    if (err) {
      console.error('  ❌ Ошибка:', err.message);
      return;
    }
    console.log(`  ✅ Содержимое: "${content}"`);

    // Часть 2 запускаем после первой, чтобы вывод не перемешался
    testPromiseStyle();
  });
});

// Часть 2: тот же класс, но через async/await
async function testPromiseStyle() {
  console.log('\n2. Стиль промисов (тот же класс, без колбэков)...');

  try {
    const filePath = await fileManager.createFile('hybrid2.txt', 'Файл создан через промис');
    console.log(`  ✅ Файл создан: ${filePath}`);

    const content = await fileManager.readFile('hybrid2.txt');
    console.log(`  ✅ Содержимое: "${content}"`);

    const files = await fileManager.listFiles();
    console.log(`  ✅ Файлов в директории: ${files.length}`);
    files.forEach(f => console.log(`     - ${f}`));
  } catch (err) {
    console.error('  ❌ Ошибка:', err.message);
  }

  await testErrors();
}

// Часть 3: обработка ошибок
async function testErrors() {
  console.log('\n3. Обработка ошибок...');

  // Несуществующий файл
  try {
    await fileManager.readFile('no-such-file.txt');
  } catch (err) {
    console.log(`  ✅ Поймана ${err.name}`);
    console.log(`     Сообщение: ${err.message}`);
    console.log(`     Операция: ${err.operation}`);
    console.log(`     Время: ${err.timestamp.toISOString()}`);
  }

  // Некорректное имя
  try {
    await fileManager.readFile('../secret.txt');
  } catch (err) {
    console.log(`  ✅ Поймана ${err.name}`);
    console.log(`     Сообщение: ${err.message}`);
    console.log(`     Поле: ${err.field}`);
  }

  // Та же ошибка, но в колбэк-стиле
  fileManager.deleteFile('missing.txt', (err) => {
    if (err instanceof FileOperationError) {
      console.log(`  ✅ Ошибка пришла и в колбэк: ${err.operation}`);
    }
    cleanup();
  });
}

async function cleanup() {
  console.log('\n4. Очистка...');
  const files = await fileManager.listFiles();

  for (const file of files) {
    await fileManager.deleteFile(file);
    console.log(`  ✅ ${file} удалён`);
  }

  console.log('\n✅ Один и тот же класс отработал в обоих стилях');
}
