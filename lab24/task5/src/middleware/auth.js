const jwt = require('jsonwebtoken');
const config = require('../config');

function unauthorized(ctx, body) {
  ctx.status = 401;
  ctx.set('WWW-Authenticate', 'Bearer');
  ctx.body = { status: 401, ...body };
}

async function authMiddleware(ctx, next) {
  const [scheme, token] = ctx.get('Authorization').split(' ');
  if (scheme !== 'Bearer' || !token) return unauthorized(ctx, { error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    ctx.user = { userId: payload.userId, email: payload.email, role: payload.role };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(ctx, { error: 'Token expired', message: 'Обновите токен через POST /api/auth/refresh' });
    }
    return unauthorized(ctx, { error: 'Invalid token' });
  }
  await next();
}

function requireRole(...roles) {
  return async (ctx, next) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      ctx.status = 403;
      ctx.body = { error: `Forbidden: ${roles.join(' or ')} role required`, status: 403 };
      return;
    }
    await next();
  };
}

function requireOwnerOrRole(...roles) {
  return async (ctx, next) => {
    if (ctx.user && (ctx.user.userId === ctx.params.id || roles.includes(ctx.user.role))) {
      await next();
      return;
    }
    ctx.status = 403;
    ctx.body = { error: `Forbidden: only owner or ${roles.join('/')} allowed`, status: 403 };
  };
}

module.exports = { authMiddleware, requireRole, requireOwnerOrRole };
