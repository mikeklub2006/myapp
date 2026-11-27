const EventEmitter = require('events');

const GROUP = '401';

class DatabaseConnection extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.connected = false;
    this.students = 50;
  }

  connect() {
    this.emit('connecting');
    this.connected = true;
    this.emit('connect', this.name);
  }

  query(sql) {
    if (!this.connected) {
      this.error(new Error('Нет соединения с БД'));
      return;
    }

    let result;
    if (sql.startsWith('SELECT')) {
      result = `найдено записей: ${this.students}`;
    } else if (sql.startsWith('INSERT')) {
      this.students++;
      result = '1 запись добавлена';
    } else {
      result = 'запрос выполнен';
    }

    this.emit('query', sql, result);
  }

  close() {
    this.emit('closing');
    this.connected = false;
    this.emit('close');
  }

  error(err) {
    this.emit('error', err);
  }
}

const db = new DatabaseConnection(`students_${GROUP}`);

db.on('connecting', () => console.log('[EVENT] Подключение к БД...'));
db.on('connect', (name) => console.log(`[EVENT] Соединение установлено (${name})`));
db.on('query', (sql, result) => {
  console.log(`[EVENT] Выполнение запроса: ${sql}`);
  console.log(`[EVENT] Результат: ${result}`);
});
db.on('closing', () => console.log('[EVENT] Закрытие соединения'));
db.on('close', () => console.log('[EVENT] Соединение закрыто'));
db.on('error', (err) => console.log(`[EVENT] Ошибка: ${err.message} (группа ${GROUP})`));

console.log(`=== DatabaseConnection (группа ${GROUP}) ===`);
db.connect();
db.query('SELECT * FROM students');
db.query('INSERT INTO students');
db.query('SELECT * FROM students');
db.close();

console.log('\n=== Демонстрация ошибки ===');
db.error(new Error('Connection timeout'));
db.query('SELECT * FROM students');

console.log('\n=== Без слушателя error ===');
const noHandler = new DatabaseConnection('test');
try {
  noHandler.error(new Error('Connection timeout'));
} catch (err) {
  console.log(`Выброшено исключение: ${err.message}`);
  console.log('(без try/catch процесс упал бы с этим исключением)');
}

// node events-class.js crash — показать реальное падение процесса
if (process.argv[2] === 'crash') {
  console.log('\nЭмитим error без слушателя...');
  new DatabaseConnection('crash').error(new Error('Connection timeout'));
  console.log('эта строка не выведется');
}
