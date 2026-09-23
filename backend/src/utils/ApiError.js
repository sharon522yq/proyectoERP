class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'INTERNAL_ERROR';
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, asyncHandler };
