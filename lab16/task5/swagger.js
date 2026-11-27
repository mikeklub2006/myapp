const j2s = require('joi-to-swagger');
const { schemas } = require('./validation');
const { GENRES } = require('./data');

// схемы тел запросов собираем из тех же joi-схем, что и валидация
const components = {};
for (const [name, schema] of Object.entries(schemas)) {
  if (name === 'bookQuery') continue;
  components[name] = j2s(schema).swagger;
}

components.Error = {
  type: 'object',
  properties: { error: { type: 'string' }, status: { type: 'integer' } },
  example: { error: 'Книга не найдена', status: 404 }
};
components.Book = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    author: { type: 'string' },
    year: { type: 'integer' },
    genre: { type: 'string', enum: GENRES },
    isbn: { type: 'string', example: '978-5-401-12345-6' },
    pages: { type: 'integer' },
    copies: { type: 'integer' },
    available: { type: 'integer' },
    rating: { type: 'number', nullable: true },
    reviewsCount: { type: 'integer' }
  }
};
components.Review = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    userId: { type: 'integer' },
    userName: { type: 'string' },
    rating: { type: 'integer' },
    text: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};
components.BookPage = {
  type: 'object',
  properties: {
    total: { type: 'integer' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
    pages: { type: 'integer' },
    data: { type: 'array', items: { $ref: '#/components/schemas/Book' } }
  }
};

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, description = 'OK') => ({ description, content: { 'application/json': { schema } } });
const body = (name) => ({ required: true, content: { 'application/json': { schema: ref(name) } } });
const err = (description) => json(ref('Error'), description);
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const query = (name, type, description, extra = {}) => ({ name, in: 'query', description, schema: { type, ...extra } });

const authErrors = { 401: err('Нет токена или токен недействителен') };
const adminErrors = { ...authErrors, 403: err('Нужна роль admin') };

const paths = {
  '/auth/register': {
    post: {
      tags: ['Auth'], summary: 'Регистрация пользователя', security: [],
      requestBody: body('register'),
      responses: { 201: json({ type: 'object' }, 'Регистрация прошла успешно'), 400: err('Ошибка валидации'), 409: err('Email занят') }
    }
  },
  '/auth/login': {
    post: {
      tags: ['Auth'], summary: 'Вход, возвращает JWT', security: [],
      requestBody: body('login'),
      responses: {
        200: json({ type: 'object', properties: { token: { type: 'string' }, expiresIn: { type: 'string' } } }),
        401: err('Неверный email или пароль')
      }
    }
  },
  '/api/books': {
    get: {
      tags: ['Books'], summary: 'Список книг с фильтрацией, пагинацией, сортировкой и поиском',
      parameters: [
        query('author', 'string', 'Часть имени автора'),
        query('genre', 'string', 'Жанр', { enum: GENRES }),
        query('year', 'integer', 'Точный год издания'),
        query('yearFrom', 'integer', 'Год от'),
        query('yearTo', 'integer', 'Год до'),
        query('search', 'string', 'Поиск по названию или автору'),
        query('available', 'boolean', 'Только доступные / только выданные'),
        query('sort', 'string', 'Поле сортировки, "-" для обратного порядка',
          { enum: ['id', '-id', 'title', '-title', 'author', '-author', 'year', '-year', 'rating', '-rating'] }),
        query('page', 'integer', 'Номер страницы', { default: 1 }),
        query('limit', 'integer', 'Книг на странице', { default: 10, maximum: 100 })
      ],
      responses: { 200: json(ref('BookPage')), 400: err('Неверные параметры'), ...authErrors }
    },
    post: {
      tags: ['Books'], summary: 'Добавить книгу (только admin)',
      requestBody: body('bookCreate'),
      responses: { 201: json(ref('Book'), 'Книга создана'), 400: err('Ошибка валидации'), 409: err('Дубликат'), ...adminErrors }
    }
  },
  '/api/books/export': {
    get: {
      tags: ['Books'], summary: 'Экспорт всех книг в CSV или JSON',
      parameters: [query('format', 'string', 'Формат файла', { enum: ['json', 'csv'], default: 'json' })],
      responses: {
        200: { description: 'Файл', content: { 'application/json': {}, 'text/csv': {} } },
        400: err('Неизвестный формат'), ...authErrors
      }
    }
  },
  '/api/books/import': {
    post: {
      tags: ['Books'], summary: 'Импорт книг из CSV (только admin)',
      description: 'Колонки: title,author,year,genre,isbn,pages,copies,available. Колонка id игнорируется.',
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } }
      },
      responses: { 201: json({ type: 'object' }, 'Книги импортированы'), 400: err('Нет файла или плохой CSV'), ...adminErrors }
    }
  },
  '/api/books/recommendations': {
    get: {
      tags: ['Books'], summary: 'Рекомендации по жанру',
      description: 'Без genre берутся жанры книг, на которые пользователь оставлял отзывы',
      parameters: [query('genre', 'string', 'Жанр', { enum: GENRES }), query('limit', 'integer', 'Сколько книг', { default: 5 })],
      responses: { 200: json({ type: 'object' }), ...authErrors }
    }
  },
  '/api/books/available': {
    get: {
      tags: ['Books'], summary: 'Книги, которые есть в наличии',
      responses: { 200: json({ type: 'object', properties: { total: { type: 'integer' }, data: { type: 'array', items: ref('Book') } } }), ...authErrors }
    }
  },
  '/api/books/{id}': {
    get: {
      tags: ['Books'], summary: 'Книга с отзывами', parameters: [idParam],
      responses: {
        200: json({ allOf: [ref('Book'), { type: 'object', properties: { reviews: { type: 'array', items: ref('Review') } } }] }),
        404: err('Книга не найдена'), ...authErrors
      }
    },
    put: {
      tags: ['Books'], summary: 'Обновить книгу', parameters: [idParam], requestBody: body('bookUpdate'),
      responses: { 200: json(ref('Book')), 400: err('Ошибка валидации'), 404: err('Книга не найдена'), 409: err('Конфликт'), ...authErrors }
    },
    delete: {
      tags: ['Books'], summary: 'Удалить книгу (только admin)', parameters: [idParam],
      responses: { 200: json({ type: 'object' }, 'Книга удалена'), 404: err('Книга не найдена'), ...adminErrors }
    }
  },
  '/api/books/{id}/reviews': {
    post: {
      tags: ['Books'], summary: 'Оставить отзыв', parameters: [idParam], requestBody: body('review'),
      responses: { 201: json({ type: 'object' }, 'Отзыв добавлен'), 400: err('Ошибка валидации'), 404: err('Книга не найдена'), 409: err('Отзыв уже есть'), ...authErrors }
    }
  },
  '/api/admin/users': {
    get: { tags: ['Admin'], summary: 'Список пользователей', responses: { 200: json({ type: 'array', items: { type: 'object' } }), ...adminErrors } }
  },
  '/api/admin/users/{id}/role': {
    patch: {
      tags: ['Admin'], summary: 'Сменить роль пользователя', parameters: [idParam], requestBody: body('role'),
      responses: { 200: json({ type: 'object' }), 400: err('Ошибка'), 404: err('Пользователь не найден'), ...adminErrors }
    }
  },
  '/api/admin/stats': {
    get: { tags: ['Admin'], summary: 'Статистика библиотеки', responses: { 200: json({ type: 'object' }), ...adminErrors } }
  }
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Library API - ЛР16',
    version: '1.0.0',
    description: 'REST API библиотеки. Клубович Михаил, группа 401, вариант 8. ' +
      'Сначала POST /auth/login, потом кнопка Authorize и вставить токен.'
  },
  servers: [{ url: '/' }],
  components: {
    schemas: components,
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
  },
  security: [{ bearerAuth: [] }],
  paths
};
