// Egyszerű, memóriabeli fix ablakos rate limiter (IP-nként).
// Korlát: egy példányon belül működik; több példány / újraindítás esetén nullázódik.
// Egy ingyenes Render instance-nál ez elég.
export function createRateLimiter({ limit = 5, windowMs = 60_000 } = {}) {
  const hits = new Map(); // ip -> {count, resetAt}
  // Takarítás, hogy a Map ne nőjön a végtelenségig.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs);
  timer.unref();

  return function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(ip, h);
    }
    h.count++;
    if (h.count > limit) {
      res.set('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Túl sok beküldés, próbáld újra egy perc múlva.' });
    }
    next();
  };
}
