const { leaderboardEnabledNow, getRedisClient, getKeys } = require("./_util");

module.exports = async (req, res) => {
  if (!leaderboardEnabledNow()) {
    return res.status(403).json({ error: "Not available yet" });
  }

  const { redis } = getRedisClient();
  if (!redis) return res.status(500).json({ error: "Redis not configured" });

  const { KEY_ZSET } = getKeys();

  const entries = await redis.zrange(KEY_ZSET, 0, 49, { rev: true, withScores: true });
  const rows = (entries || []).map((e) => ({ name: e.member, score: e.score }));

  res.status(200).json({ rows });
};
