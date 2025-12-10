// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error('API Error:', err);

  const status = err.status || 500;
  const message =
    err.message || 'An unexpected error occurred. Please try again later.';

  res.status(status).json({
    error: message,
  });
}

module.exports = errorHandler;
