const Joi = require('joi');

const register = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).max(100).required(),
  group_name: Joi.string().pattern(/^\d{3}$/).default('401'),
  age: Joi.number().integer().min(16).max(100),
  course: Joi.number().integer().min(1).max(4)
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

module.exports = { register, login, refresh, role };
