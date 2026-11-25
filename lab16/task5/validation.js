const Joi = require('joi');
const { GENRES } = require('./data');

const currentYear = new Date().getFullYear();

function isValidIsbn(value) {
  const digits = value.replace(/[-\s]/g, '').toUpperCase();

  if (/^\d{13}$/.test(digits)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(digits)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const d = digits[i] === 'X' ? 10 : Number(digits[i]);
      sum += d * (10 - i);
    }
    return sum % 11 === 0;
  }
  return false;
}

const isbn = Joi.string().trim().custom((value, helpers) => {
  if (!isValidIsbn(value)) return helpers.message('ISBN некорректный: нужен ISBN-10 или ISBN-13 с верной контрольной цифрой');
  return value;
});

const year = Joi.number().integer().min(1450).max(currentYear)
  .messages({ 'number.max': `год издания не может быть больше ${currentYear}`, 'number.min': 'год издания не раньше 1450' });

const genre = Joi.string().trim().lowercase().valid(...GENRES)
  .messages({ 'any.only': `жанр должен быть одним из: ${GENRES.join(', ')}` });

const bookCreate = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  author: Joi.string().trim().min(2).max(100).required(),
  year: year.required(),
  genre: genre.required(),
  isbn: isbn.required(),
  pages: Joi.number().integer().min(1).max(5000),
  copies: Joi.number().integer().min(0).max(100).default(1),
  available: Joi.number().integer().min(0).max(Joi.ref('copies'))
    .messages({ 'number.max': 'available не может быть больше copies' })
});

const bookUpdate = Joi.object({
  title: Joi.string().trim().min(1).max(200),
  author: Joi.string().trim().min(2).max(100),
  year,
  genre,
  isbn,
  pages: Joi.number().integer().min(1).max(5000),
  copies: Joi.number().integer().min(0).max(100),
  available: Joi.number().integer().min(0)
}).min(1).messages({ 'object.min': 'нужно передать хотя бы одно поле' });

const bookQuery = Joi.object({
  author: Joi.string().trim(),
  genre,
  year: Joi.number().integer(),
  yearFrom: Joi.number().integer(),
  yearTo: Joi.number().integer(),
  search: Joi.string().trim(),
  available: Joi.boolean(),
  sort: Joi.string().valid('id', '-id', 'title', '-title', 'author', '-author', 'year', '-year', 'rating', '-rating'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

const review = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  text: Joi.string().trim().min(3).max(1000).required()
});

const register = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(6).max(100).required(),
  name: Joi.string().trim().min(2).max(100).required()
});

const login = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required()
});

const role = Joi.object({
  role: Joi.string().valid('user', 'admin').required()
});

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source] || {}, { abortEarly: false, convert: true });
    if (error) {
      return res.status(400).json({
        error: 'Ошибка валидации',
        status: 400,
        details: error.details.map((d) => d.message)
      });
    }
    // в express 4 req.query можно переприсвоить, сохраняем уже приведенные типы
    req[source] = value;
    next();
  };
}

module.exports = {
  schemas: { bookCreate, bookUpdate, bookQuery, review, register, login, role },
  validate,
  isValidIsbn
};
