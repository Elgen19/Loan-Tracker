const requestLog = new Map();

function getClientKey(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || "unknown";
}

export function rateLimit({ windowMs = 60_000, maxRequests = 120 } = {}) {
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const clientKey = getClientKey(req);
    const existingRequests = requestLog.get(clientKey) || [];
    const recentRequests = existingRequests.filter((timestamp) => now - timestamp < windowMs);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ message: "Too many requests. Please slow down and try again." });
    }

    recentRequests.push(now);
    requestLog.set(clientKey, recentRequests);
    return next();
  };
}
