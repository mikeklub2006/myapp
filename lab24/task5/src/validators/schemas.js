const Joi = require('joi');

const GROUP_RE = /^\d{3}$/;
const SORT_FIELDS = ['name', 'age', 'course', 'group_name', 'created_at'];

const messages = {
  'any.required': 'обязательное поле',
  'any.only': 'допустимые значения: {#valids}',
  'string.base': 'должно быть строкой',
  'string.empty': 'не может быть пустым',
  'string.min': 'минимум {#limit} символа',
  'string.max': 'максимум {#limit} символов',
  'string.email': 'неверный формат',
  'string.pattern.base': 'неверный формат (ожидается XXX, например 401)',
  'number.base': 'должно быть числом',
  'number.integer': 'должно быть целым числом',
  'number.positive': 'должно быть больше 0',
  'number.min': 'должно быть не меньше {#limit}',
  'number.max': 'должно быть не больше {#limit}',
  'object.unknown': 'неизвестное поле',
  'object.min': 'нужно передать хотя бы одно поле',
  'array.base': 'ожидается массив',
  'array.min': 'массив не может быть пустым',
  'array.max': 'не больше {#limit} элементов'
};

const userFields = {
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().trim().lowercase().email(),
  group_name: Joi.string().pattern(GROUP_RE),
  age: Joi.number().integer().min(16).max(100),
  course: Joi.number().integer().min(1).max(4)
};

const createUser = Joi.object({
  ...userFields,
  name: userFields.name.required(),
  email: userFields.email.required(),
  group_name: userFields.group_name.required()
});

const updateUser = Joi.object(userFields).min(1);

const importUsers = Joi.array().items(createUser).min(1).max(1000);

const listQuery = Joi.object({
  page: Joi.number().integer().positive().default(1),
  limit: Joi.number().integer().positive().max(100).default(10),
  sort: Joi.string().valid(...SORT_FIELDS.flatMap((f) => [f, `-${f}`])).default('created_at'),
  group_name: Joi.string().pattern(GROUP_RE),
  course: Joi.number().integer().min(1).max(4),
  age_min: Joi.number().integer().min(0),
  age_max: Joi.number().integer().min(0),
  search: Joi.string().trim().min(1).max(100),
  format: Joi.string().valid('csv', 'json'),
  withDeleted: Joi.boolean()
});

const searchQuery = Joi.object({
  q: Joi.string().trim().min(1).max(100).required(),
  limit: Joi.number().integer().positive().max(100).default(20)
});

const register = Joi.object({
  ...userFields,
  name: userFields.name.required(),
  email: userFields.email.required(),
  group_name: userFields.group_name.default('401'),
  password: Joi.string().min(6).max(100).required()
});

const login = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().max(100).required()
});

const refresh = Joi.object({
  refreshToken: Joi.string().required()
});

const role = Joi.object({
  role: Joi.string().valid('user', 'moderator', 'admin').required()
});

module.exports = { messages, createUser, updateUser, importUsers, listQuery, searchQuery, register, login, refresh, role };
