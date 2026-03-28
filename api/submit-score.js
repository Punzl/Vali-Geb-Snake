const { leaderboardEnabledNow, getRedisClient, getKeys } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // nach Reveal keine neuen Scores
  if (leaderboardEnabledNow()) {
    return res.status(403).json({ error: "Game closed (leaderboard revealed)" });
  }

  const { redis } = getRedisClient();
  if (!redis) return res.status(500).json({ error: "Redis not configured" });

  const { KEY_BEST, KEY_ZSET } = getKeys();

  const name = String(req.body?.name ?? "").trim().slice(0, 32);
  const scoreRaw = Number(req.body?.score);

  if (!name) return res.status(400).json({ error: "Invalid name" });
  if (!Number.isFinite(scoreRaw)) return res.status(400).json({ error: "Invalid score" });

  const score = Math.max(0, Math.min(999999, Math.floor(scoreRaw)));

  const prev = await redis.hget(KEY_BEST, name);
  const prevNum = prev === null || prev === undefined ? null : Number(prev);

  if (prevNum === null || !Number.isFinite(prevNum) || score > prevNum) {
    await redis.hset(KEY_BEST, { [name]: score });
    await redis.zadd(KEY_ZSET, { score, member: name });
    return res.status(200).json({ ok: true, best: score });
  }

  return res.status(200).json({ ok: true, best: prevNum });
};
