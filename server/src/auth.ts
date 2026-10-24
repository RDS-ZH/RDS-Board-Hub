import crypto from 'node:crypto';
import { users } from './storage.ts';
import { randomId, JWT_SECRET, TOKEN_TTL_SEC } from './config.ts';

// ---- 密码：scrypt（node:crypto 内置，零依赖） ----
export function hashPassword(password: string, salt?: string) {
  const s = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 32).toString('hex');
  return { salt: s, passHash: hash };
}
function verify(password: string, salt: string, expected: string) {
  return crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt).passHash), Buffer.from(expected));
}

// ---- JWT：HMAC-SHA256，手写避免依赖 ----
const b64u = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
export function signJwt(payload: Record<string, unknown>): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}
export function verifyJwt(token: string): { sub: string; name: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expect = crypto.createHmac('sha256', JWT_SECRET).update(parts[0] + '.' + parts[1]).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expect))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

// ---- 账号接口 ----
export function register(name: string, password: string): { token: string; user: { id: string; name: string } } | { error: string } {
  if (!/^\w{2,24}$/.test(name)) return { error: '用户名需 2-24 位字母数字下划线' };
  if (password.length < 6) return { error: '密码至少 6 位' };
  if (users.byName(name)) return { error: '用户名已存在' };
  const { salt, passHash } = hashPassword(password);
  const id = randomId('u_');
  users.add({ id, name, passHash, salt, createdAt: Date.now() });
  return issue(id, name);
}
export function login(name: string, password: string) {
  const u = users.byName(name);
  if (!u || !verify(password, u.salt, u.passHash)) return { error: '用户名或密码错误' };
  return issue(u.id, u.name);
}
function issue(id: string, name: string) {
  return { token: signJwt({ sub: id, name }), user: { id, name } };
}
export function userFromAuthHeader(header?: string) {
  if (!header?.startsWith('Bearer ')) return null;
  return verifyJwt(header.slice(7));
}
