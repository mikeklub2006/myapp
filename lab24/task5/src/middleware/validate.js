const { messages } = require('../validators/schemas');
const HttpError = require('../utils/httpError');

function check(schema, input) {
  const { error, value } = schema.validate(input, { abortEarly: false, messages });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.') || 'body', message: d.message }));
    throw new HttpError(400, 'Validation failed', details);
  }
  return value;
}

function validate(schema, source = 'body') {
  return async (ctx, next) => {
    if (source === 'query') {
      ctx.state.query = check(schema, ctx.query);
    } else {
      ctx.request.body = check(schema, ctx.request.body === undefined ? {} : ctx.request.body);
    }
    await next();
  };
}

module.exports = { validate, check };
