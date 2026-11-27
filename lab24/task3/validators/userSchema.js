const Joi = require('joi');

const GROUP_RE = /^\d{3}$/;

const messages = {
  'any.required': 'обязательное поле',
  'string.base': 'должно быть строкой',
  'string.empty': 'не может быть пустым',
  'string.min': 'минимум {#limit} символа',
  'string.max': 'максимум {#limit} символов',
  'string.email': 'неверный формат',
  'string.pattern.base': 'неверный формат (ожидается XXX, например 401)',
  'number.base': 'должно быть числом',
  'number.integer': 'должно быть целым числом',
  'number.min': 'должно быть не меньше {#limit}',
  'number.max': 'должно быть не больше {#limit}',
  'object.unknown': 'неизвестное поле',
  'object.min': 'нужно передать хотя бы одно поле',
  'number.positive': 'должно быть больше 0',
  'any.only': 'допустимые значения: {#valids}',
  'number.greater': 'должно быть больше {#limit}'
};

const createUser = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  group_name: Joi.string().pattern(GROUP_RE).required(),
  age: Joi.number().integer().min(16).max(100),
  course: Joi.number().integer().min(1).max(4),
  password: Joi.string().min(6).max(100)
});

const updateUser = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().trim().email(),
  group_name: Joi.string().pattern(GROUP_RE),
  age: Joi.number().integer().min(16).max(100),
  course: Joi.number().integer().min(1).max(4),
  password: Joi.string().min(6).max(100)
}).min(1);

const SORT_FIELDS = ['name', 'age', 'course', 'group_name', 'created_at'];
const SORT_VALUES = SORT_FIELDS.flatMap((f) => [f, `-${f}`]);

const listQuery = Joi.object({
  page: Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(100).default(10),
  sort: Joi.string().valid(...SORT_VALUES).default('created_at'),
  group_name: Joi.string().pattern(GROUP_RE),
  course: Joi.number().integer().min(1).max(4),
  age_min: Joi.number().integer().min(0),
  age_max: Joi.number().integer().min(0),
  search: Joi.string().trim().min(1).max(100)
});

const searchQuery = Joi.object({
  q: Joi.string().trim().min(1).max(100).required(),
  limit: Joi.number().integer().positive().max(100).default(20)
});

module.exports = { createUser, updateUser, listQuery, searchQuery, messages };
