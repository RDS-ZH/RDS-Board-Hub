import crypto from 'node:crypto';

const env = process.env;
function secret(): string {
  // 首次启动生成并落盘，运维可用 HUB_SECRET 覆盖
  if (env.HUB_SECRET) return env.HUB_SECRET;
  return 'dev-secret-do-not-use-in-prod';
}
export const PORT = Number(env.PORT || 8787);
export const JWT_SECRET = secret();
export const TOKEN_TTL_SEC = 7 * 24 * 3600;
export const DATA_DIR = env.HUB_DATA_DIR || new URL('../data/', import.meta.url).pathname.replace(/^\//, '');

export function randomId(prefix = ''): string {
  return prefix + crypto.randomBytes(8).toString('hex');
}
