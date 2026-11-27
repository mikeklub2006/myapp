const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ЛР24 - Users API (группа 401)',
      version: '1.0.0',
      description: 'REST API для работы с пользователями на Koa.js и MongoDB. Клубович Михаил, группа 401, вариант 8.'
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        UserInput: {
          type: 'object',
          required: ['name', 'email', 'group_name'],
          properties: {
            name: { type: 'string', example: 'Петр Петров' },
            email: { type: 'string', example: 'petr@example.com' },
            group_name: { type: 'string', example: '401' },
            age: { type: 'integer', example: 20 },
            course: { type: 'integer', example: 2 }
          }
        },
        UserList: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/UserInput' } },
            pagination: {
              type: 'object',
              properties: { total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, pages: { type: 'integer' } }
            }
          }
        }
      }
    }
  },
  // glob понимает только прямые слэши, на windows их приходится заменять
  apis: [path.join(__dirname, 'controllers', '*.js').split(path.sep).join('/')]
});

module.exports = spec;
