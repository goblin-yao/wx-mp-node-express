import { LRUCache } from 'lru-cache';

export const webLoginLRUCache = new LRUCache({ max: 10000, ttl: 1000 * 60 * 60 * 24 * 30 });
