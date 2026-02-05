// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error('API Error:', err);

  const status = err.status || 500;

  // In production, never expose internal error details to the client
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred. Please try again later.'
    : err.message || 'An unexpected error occurred. Please try again later.';

  res.status(status).json({
    error: message,
  });
}

module.exports = errorHandler;
