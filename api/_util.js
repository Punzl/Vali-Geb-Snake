const { Redis } = require("@upstash/redis");

function getPartyStartISO() {
  const iso = process.env.PARTY_START_ISO;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function leaderboardEnabledNow() {
  const d = getPartyStartISO();
  if (!d) return false;
  return Date.now() >= d.getTime();
}

function findEnvEnding(suffix) {
  const keys = Object.keys(process.env);
  const k = keys.find((x) => x.endsWith(suffix));
  return k ? process.env[k] : undefined;
}

function getRedisClient() {
  const redisUrl =
    process.env.UPSTASH_REDIS_REST_URL ||
    findEnvEnding("_KV_REST_API_URL") ||
    process.env.KV_REST_API_URL;

  const redisToken =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    findEnvEnding("_KV_REST_API_TOKEN") ||
    process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    return { redis: null, detectedRedisUrl: !!redisUrl, detectedRedisToken: !!redisToken };
  }

  return {
    redis: new Redis({ url: redisUrl, token: redisToken }),
    detectedRedisUrl: true,
    detectedRedisToken: true,
  };
}

function getKeys() {
  const prefix = process.env.KV_PREFIX || "valigebsnake";
  return {
    prefix,
    KEY_BEST: `${prefix}:bestByName`,
    KEY_ZSET: `${prefix}:leaderboard`,
  };
}

module.exports = {
  getPartyStartISO,
  leaderboardEnabledNow,
  getRedisClient,
  getKeys,
};
