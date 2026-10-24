import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import { PORT } from './config.ts';
import { register, login, userFromAuthHeader } from './auth.ts';
import { listRooms, createRoom, joinRoom, leaveRoom, setRoomStatus, getRoomInfo } from './rooms.ts';
import { GAMES } from './games.ts';
import { SignalHub } from './signal.ts';

const app = new Hono();

// ---- 认证 ----
app.post('/api/auth/register', async c => {
  const body = await c.req.json().catch(() => ({}));
  const r = register(String(body.name ?? ''), String(body.password ?? ''));
  return 'error' in r ? c.json({ error: r.error }, 400) : c.json(r);
});
app.post('/api/auth/login', async c => {
  const body = await c.req.json().catch(() => ({}));
  const r = login(String(body.name ?? ''), String(body.password ?? ''));
  return 'error' in r ? c.json({ error: r.error }, 401) : c.json(r);
});
app.get('/api/auth/me', c => {
  const u = userFromAuthHeader(c.req.header('authorization'));
  return u ? c.json(u) : c.json({ error: 'unauthorized' }, 401);
});

// ---- 游戏 / 房间 ----
app.get('/api/games', c => c.json(GAMES));
app.get('/api/rooms', c => c.json(listRooms()));
app.post('/api/rooms', async c => {
  const u = userFromAuthHeader(c.req.header('authorization'));
  if (!u) return c.json({ error: 'unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const r = createRoom(u.sub, String(body.name ?? ''), String(body.gameId ?? ''));
  return 'error' in r ? c.json({ error: r.error }, 400) : c.json(r);
});
app.get('/api/rooms/:id', c => {
  const u = userFromAuthHeader(c.req.header('authorization'));
  if (!u) return c.json({ error: '未登录' }, 401);
  const r = getRoomInfo(c.req.param('id'));
  return 'error' in r ? c.json({ error: r.error }, 404) : c.json(r);
});
app.post('/api/rooms/:id/join', c => {
  const u = userFromAuthHeader(c.req.header('authorization'));
  if (!u) return c.json({ error: 'unauthorized' }, 401);
  const r = joinRoom(u.sub, c.req.param('id'));
  return 'error' in r ? c.json({ error: r.error }, 400) : c.json(r);
});
app.post('/api/rooms/:id/leave', c => {
  const u = userFromAuthHeader(c.req.header('authorization'));
  if (!u) return c.json({ error: 'unauthorized' }, 401);
  const r = leaveRoom(u.sub, c.req.param('id'));
  return 'error' in r ? c.json({ error: r.error }, 400) : c.json({ ok: true });
});
app.post('/api/rooms/:id/status', async c => {
  const u = userFromAuthHeader(c.req.header('authorization'));
  if (!u) return c.json({ error: 'unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const r = setRoomStatus(u.sub, c.req.param('id'), body.status);
  return 'error' in r ? c.json({ error: r.error }, 400) : c.json(r);
});
app.get('/healthz', c => c.json({ ok: true }));

// ---- 游戏客户端静态托管（GAMES 目录挂载 RDS-Board-Core 构建产物 dist/ → /games/rds-board-core/） ----
// 生产 compose 卷：./rds-board-core-dist:/app/games/rds-board-core
app.use('/games/*', serveStatic({
  root: '../games',
  // 剥离 /games 前缀：serveStatic 以完整请求路径拼 root，不剥离会映射到 /app/games/games/... 而落到大厅 SPA fallback
  rewriteRequestPath: p => p.replace(/^\/games/, ''),
}));

// ---- 静态大厅（生产：web/dist；开发：vite 独立端口） ----
app.use('/*', serveStatic({ root: '../web/dist' }));
app.get('/*', serveStatic({ path: '../web/dist/index.html' }));

const server = serve({ fetch: app.fetch, port: PORT }, info => {
  console.log('[hub] listening on http://127.0.0.1:' + info.port);
});

// ---- /ws 信令 ----
const wss = new WebSocketServer({ noServer: true });
const hub = new SignalHub();
hub.startHeartbeat();
server.on('upgrade', (req: http.IncomingMessage, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => hub.accept(ws, url.searchParams.get('token')));
});
