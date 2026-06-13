import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';

let redisClient: RedisClientType;

export function getRedis(): RedisClientType {
  if (!redisClient) throw new Error('Redis not connected. Call connectRedis() first.');
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  redisClient = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' }) as RedisClientType;

  redisClient.on('error', (err) => logger.error('Redis client error', err));
  redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await redisClient.connect();
  logger.info('✅ Redis connected');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const serialised = JSON.stringify(value);
  if (ttlSeconds) {
    await getRedis().setEx(key, ttlSeconds, serialised);
  } else {
    await getRedis().set(key, serialised);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const keys = await getRedis().keys(pattern);
  if (keys.length > 0) await getRedis().del(keys);
}
