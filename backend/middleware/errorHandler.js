/**
 * Global Error Handler Middleware
 * ---------------------------------
 * Catches all unhandled errors thrown by route handlers.
 * Returns a consistent JSON error response with appropriate status codes.
 *
 * Must be registered AFTER all routes with app.use(errorHandler).
 */

/**
 * Express error-handling middleware (4 arguments required).
 *
 * @param {Error} err - The error object
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function errorHandler(err, req, res, next) {
  // Log full error details server-side
  console.error("═══════════════════════════════════");
  console.error("❌ UNHANDLED ERROR");
  console.error(`   Path: ${req.method} ${req.originalUrl}`);
  console.error(`   Time: ${new Date().toISOString()}`);
  console.error(`   Error: ${err.message}`);
  if (err.stack) {
    console.error(`   Stack: ${err.stack.split("\n").slice(0, 3).join("\n        ")}`);
  }
  console.error("═══════════════════════════════════");

  // Determine the appropriate status code
  const statusCode = err.statusCode || err.status || 500;

  // Return a structured JSON error response
  // In production, don't expose internal error details
  const isProduction = process.env.NODE_ENV === "production";

  res.status(statusCode).json({
    error: err.message || "Internal server error",
    ...(isProduction ? {} : { stack: err.stack }),
    statusCode,
    timestamp: new Date().toISOString(),
  });
}
