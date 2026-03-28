const { getPartyStartISO, leaderboardEnabledNow, getRedisClient, getKeys } = require("./_util");

module.exports = async (req, res) => {
  const start = getPartyStartISO();
  const { redis, detectedRedisUrl, detectedRedisToken } = getRedisClient();
  const { prefix } = getKeys();

  res.status(200).json({
    leaderboardEnabled: leaderboardEnabledNow(),
    partyStart: start ? start.toISOString() : null,
    serverNow: new Date().toISOString(),
    storage: redis ? "upstash-redis" : "missing-redis-env",
    prefix,
    detectedRedisUrl,
    detectedRedisToken,
  });
};
