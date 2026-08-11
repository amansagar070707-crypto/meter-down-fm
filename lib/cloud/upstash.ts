import "server-only";

type RedisResult<T> = { result?: T; error?: string };

function getRedisConfiguration() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisRequest<T>(path: string, body: unknown): Promise<T> {
  const config = getRedisConfiguration();
  if (!config) throw new Error("Upstash Redis is not configured.");

  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  const payload = (await response.json()) as RedisResult<T>;
  if (!response.ok || payload.error) throw new Error("Upstash Redis request failed.");
  return payload.result as T;
}

async function redisPipeline<T>(commands: Array<Array<string | number>>) {
  const config = getRedisConfiguration();
  if (!config) throw new Error("Upstash Redis is not configured.");

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  const payload = (await response.json()) as Array<RedisResult<T>>;
  if (!response.ok || !Array.isArray(payload) || payload.some((item) => item.error)) {
    throw new Error("Upstash Redis pipeline failed.");
  }
  return payload.map((item) => item.result as T);
}

const PRESENCE_INDEX = "presence:listeners";
const PRESENCE_TTL_SECONDS = 90;

export async function heartbeatListener(sessionId: string) {
  const now = Date.now();
  await redisPipeline([
    ["SET", `presence:listener:${sessionId}`, "1", "EX", PRESENCE_TTL_SECONDS],
    ["ZADD", PRESENCE_INDEX, now, sessionId],
    ["EXPIRE", PRESENCE_INDEX, PRESENCE_TTL_SECONDS * 2],
  ]);
  return countListeners(now);
}

export async function countListeners(now = Date.now()) {
  const cutoff = now - PRESENCE_TTL_SECONDS * 1_000;
  const [, count] = await redisPipeline<number>([
    ["ZREMRANGEBYSCORE", PRESENCE_INDEX, 0, cutoff],
    ["ZCOUNT", PRESENCE_INDEX, cutoff, "+inf"],
  ]);
  return Number(count) || 0;
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const count = await redisRequest<number>("", ["INCR", key]);
  if (count === 1) await redisRequest("", ["EXPIRE", key, windowSeconds]);
  return count <= limit;
}

