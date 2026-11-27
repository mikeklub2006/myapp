function httpError(status, message, code = status === 404 ? 'NOT_FOUND' : `HTTP_${status}`) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.expose = true;
  return err;
}

module.exports = { httpError };
