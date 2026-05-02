/**
 * Global error handler middleware
 * Hides stack traces in production for security
 */
export function errorHandler(err, req, res, next) {
  console.error(err);

  const isProduction = process.env.NODE_ENV === "production";

  const errorResponse = {
    message: err.message || "Internal Server Error",
    status: err.status || 500,
  };

  // Only include stack trace in development
  if (!isProduction && err.stack) {
    errorResponse.stack = err.stack;
  }

  const status = errorResponse.status || 500;

  // Handle different error types appropriately
  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res
      .status(status)
      .json(isProduction ? { error: errorResponse.message } : errorResponse);
  }

  res.status(status).render("error", {
    err: errorResponse,
  });
}
