/**
 * Request Logger Middleware
 * --------------------------
 * Logs every incoming HTTP request with method, URL, status code,
 * and response time for debugging and monitoring.
 */

/**
 * Express middleware that logs request details and timing.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Listen for the response finish event to log the complete request
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? "🔴" : "🟢";

    console.log(
      `${statusColor} ${req.method.padEnd(6)} ${req.originalUrl.padEnd(35)} → ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}
