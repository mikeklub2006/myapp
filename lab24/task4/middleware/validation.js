const { messages } = require('../validators/userSchema');

function validationMiddleware(schema, source = 'body') {
  return async (ctx, next) => {
    const input = source === 'query' ? ctx.query : ctx.request.body;
    const { error, value } = schema.validate(input || {}, { abortEarly: false, messages });

    if (error) {
      ctx.status = 400;
      ctx.body = {
        error: 'Validation failed',
        details: error.details.map((d) => ({ field: d.path.join('.') || 'body', message: d.message }))
      };
      return;
    }

    if (source === 'query') ctx.state.query = value;
    else ctx.request.body = value;
    await next();
  };
}

module.exports = validationMiddleware;
