const express = require("express");
const path = require("path");
const { Redis } = require("@upstash/redis");

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ---------- Reveal Time ----------
function getPartyStart() {
  const iso = process.env.PARTY_START_ISO;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setHours(22, 30, 0, 0);
  return d;
}
const PARTY_START = getPartyStart();
function leaderboardEnabledNow() {
  return Date.now() >= PARTY_START.getTime();
}

// ---------- Find Upstash REST envs (supports prefixed vars like valigebsnake_KV_REST_API_URL) ----------
function findEnvEnding(suffix) {
  // prefer exact names if they exist
  if (process.env[suffix]) return process.env[suffix];

  // otherwise find any env var that ends with suffix
  const keys = Object.keys(process.env);
  const k = keys.find((x) => x.endsWith(suffix));
  return k ? process.env[k] : undefined;
}

// Your screenshot shows: valigebsnake_KV_REST_API_URL / valigebsnake_KV_REST_API_TOKEN
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ||
  findEnvEnding("_KV_REST_API_URL") ||
  process.env.KV_REST_API_URL;

const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  findEnvEnding("_KV_REST_API_TOKEN") ||
  process.env.KV_REST_API_TOKEN;

const PREFIX = process.env.KV_PREFIX || "valigebsnake";
const KEY_BEST = `${PREFIX}:bestByName`;
const KEY_ZSET = `${PREFIX}:leaderboard`;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Local fallback (wenn Redis nicht gefunden wird)
let memBest = new Map();
let memRows = [];

async function upsertScore(name, score) {
  if (redis) {
    const prev = await redis.hget(KEY_BEST, name);
    const prevNum = prev === null || prev === undefined ? null : Number(prev);

    if (prevNum === null || !Number.isFinite(prevNum) || score > prevNum) {
      await redis.hset(KEY_BEST, { [name]: score });
      await redis.zadd(KEY_ZSET, { score, member: name });
      return score;
    }
    return prevNum;
  }

  const prev = memBest.get(name);
  if (prev === undefined || score > prev) {
    memBest.set(name, score);
    memRows.push({ name, score, ts: Date.now() });
    memRows.sort((a, b) => b.score - a.score || a.ts - b.ts);
    memRows = memRows.slice(0, 500);
  }
  return memBest.get(name);
}

async function getTop(n) {
  if (redis) {
    const entries = await redis.zrange(KEY_ZSET, 0, n - 1, { rev: true, withScores: true });
    return (entries || []).map((e) => ({ name: e.member, score: e.score }));
  }
  return memRows.slice(0, n).map((r) => ({ name: r.name, score: r.score }));
}

// ---------- Routes ----------
app.get("/api/status", (req, res) => {
  res.json({
    leaderboardEnabled: leaderboardEnabledNow(),
    partyStart: PARTY_START.toISOString(),
    serverNow: new Date().toISOString(),
    storage: redis ? "upstash-redis" : "memory",
    prefix: PREFIX,
    detectedRedisUrl: !!redisUrl,
    detectedRedisToken: !!redisToken,
  });
});

app.post("/api/submit-score", async (req, res) => {
  // nach Reveal keine neuen Scores
  if (leaderboardEnabledNow()) {
    return res.status(403).json({ error: "Game closed (leaderboard revealed)" });
  }

  const name = String(req.body?.name ?? "").trim().slice(0, 32);
  const scoreRaw = Number(req.body?.score);

  if (!name) return res.status(400).json({ error: "Invalid name" });
  if (!Number.isFinite(scoreRaw)) return res.status(400).json({ error: "Invalid score" });

  const score = Math.max(0, Math.min(999999, Math.floor(scoreRaw)));

  try {
    const best = await upsertScore(name, score);
    return res.json({ ok: true, best });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  if (!leaderboardEnabledNow()) {
    return res.status(403).json({ error: "Not available yet", partyStart: PARTY_START.toISOString() });
  }
  try {
    const rows = await getTop(50);
    return res.json({ rows, partyStart: PARTY_START.toISOString() });
  } catch (e) {
    return res.status(500).json({ error: "Storage error" });
  }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/play", (req, res) => res.sendFile(path.join(__dirname, "public/play.html")));
app.get("/leaderboard", (req, res) => res.sendFile(path.join(__dirname, "public/leaderboard.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.log(`party start: ${PARTY_START.toISOString()}`);
  console.log(`storage: ${redis ? "upstash-redis" : "memory"} prefix=${PREFIX}`);
});
