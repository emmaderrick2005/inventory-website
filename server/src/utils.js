/** Wraps async route handlers so errors reach the error middleware. */
export const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Express 404 for unknown /api routes. */
export function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
}

/** Central error handler — always returns JSON. */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || (err.name === 'ValidationError' ? 400 : err.name === 'CastError' ? 400 : 500);
  const message = err.code === 11000
    ? `${Object.keys(err.keyValue || {}).join(', ')} already exists`
    : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ message });
}

/** Raises an HTTP error from inside a handler. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
