// ключи вида $ne, $where или a.b в пользовательских данных - признак nosql-инъекции
function findBadKey(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const bad = findBadKey(item);
      if (bad) return bad;
    }
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) return key;
      const bad = findBadKey(value[key]);
      if (bad) return bad;
    }
  }
  return null;
}

async function sanitize(ctx, next) {
  const bad = findBadKey(ctx.request.body) || findBadKey(ctx.query);
  if (bad) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid input', details: [{ field: bad, message: 'недопустимый ключ' }] };
    return;
  }
  await next();
}

module.exports = { sanitize, findBadKey };
