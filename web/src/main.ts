import './style.css';
import { getGames, getRooms, createRoom, joinRoom, leaveRoom, setRoomStatus, getRoom, me } from './api.ts';
import type { HubGameInfo, HubRoomInfo } from '@rds-board/room-protocol';

const app = document.getElementById('app')!;
let user: { sub: string; name: string } | null = null;
let games: HubGameInfo[] = [];
let currentRoom: HubRoomInfo | null = null;
let roomTimer: ReturnType<typeof setInterval> | null = null;

function render() {
  app.innerHTML = !user ? authHtml() : currentRoom ? roomHtml() : lobbyHtml();
  bind();
}

function authHtml() {
  return `
  <main><div class="card" style="max-width:380px;margin:60px auto">
    <h2 style="margin-top:0">RDS Board Hub</h2>
    <p class="muted">桌游联机中心 · 账号</p>
    <div style="display:grid;gap:10px">
      <input id="name" placeholder="用户名（2-24 位字母数字下划线）" />
      <input id="pass" type="password" placeholder="密码（至少 6 位）" />
      <div class="row">
        <button id="login">登录</button>
        <button id="register" class="secondary">注册</button>
      </div>
      <div id="err" class="error"></div>
    </div>
  </div></main>`;
}

function lobbyHtml() {
  return `
  <header><h1>RDS Board Hub</h1><div class="row"><span class="muted">${user!.name}</span><button id="logout" class="secondary">退出</button></div></header>
  <main>
    <div class="card">
      <b>创建房间</b>
      <div class="row" style="margin-top:10px">
        <input id="room-name" placeholder="房间名" style="flex:1;min-width:160px" />
        <select id="game">${games.map(g => `<option value="${g.id}">${g.name}（${g.minPlayers}-${g.maxPlayers}人）</option>`).join('')}</select>
        <button id="create">创建</button>
      </div>
    </div>
    <div class="card"><b>房间列表</b><div id="rooms" class="muted" style="margin-top:8px">加载中…</div></div>
  </main>`;
}

function roomRow(r: HubRoomInfo) {
  const g = games.find(x => x.id === r.gameId);
  return `<tr>
    <td>${r.name}</td><td>${g?.name ?? r.gameId}</td>
    <td>${r.players.map(p => p.name).join('、')}${r.hostId === user!.sub ? '（你是房主）' : ''}</td>
    <td><span class="badge ${r.status}">${r.status === 'open' ? '等待中' : '游戏中'}</span></td>
    <td><button data-join="${r.id}" ${r.status !== 'open' ? 'disabled' : ''}>加入</button></td>
  </tr>`;
}

async function refreshRooms() {
  const el = document.getElementById('rooms');
  if (!el) return;
  try {
    const rooms = await getRooms();
    el.innerHTML = rooms.length
      ? '<table><tr><th>房间</th><th>游戏</th><th>玩家</th><th>状态</th><th></th></tr>' + rooms.map(roomRow).join('') + '</table>'
      : '暂无房间，创建一个吧';
  } catch (e: any) { el.innerHTML = '<span class="error">' + e.message + '</span>'; }
}

function bind() {
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const err = (m: string) => { const e = $('err'); if (e) e.textContent = m; };

  if (!user) {
    const doAuth = async (path: string) => {
      try {
        const res = await fetch('/api/auth/' + path, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: ($('name') as HTMLInputElement).value, password: ($('pass') as HTMLInputElement).value }),
        });
        const body = await res.json();
        if (!res.ok) return err(body.error);
        localStorage.setItem('token', body.token);
        await boot();
      } catch (e: any) { err(e.message); }
    };
    $('login')?.addEventListener('click', () => doAuth('login'));
    $('register')?.addEventListener('click', () => doAuth('register'));
    return;
  }

  $('logout')?.addEventListener('click', () => { localStorage.removeItem('token'); user = null; currentRoom = null; render(); });

  if (currentRoom) {
    const r0 = currentRoom;
    $('exit-room')?.addEventListener('click', async () => {
      try { await leaveRoom(r0.id); } catch (e: any) { alert(e.message); return; }
      currentRoom = null; render();
    });
    $('start-game')?.addEventListener('click', async () => {
      try {
        currentRoom = await setRoomStatus(r0.id, 'playing');
        window.open(gameClientUrl(currentRoom, 'host'), '_blank');
        render();
      } catch (e: any) { alert(e.message); }
    });
    $('reopen-game')?.addEventListener('click', () => window.open(gameClientUrl(r0, 'host'), '_blank'));
    $('join-game')?.addEventListener('click', () => window.open(gameClientUrl(r0, 'guest'), '_blank'));
    clearInterval(roomTimer!);
    roomTimer = setInterval(refreshRoom, 3000);
    return;
  }

  $('create')?.addEventListener('click', async () => {
    try {
      const room = await createRoom(($('room-name') as HTMLInputElement).value, ($('game') as HTMLSelectElement).value);
      enterRoom(room);
    } catch (e: any) { alert(e.message); }
  });
  // 事件委托：refreshRooms 每 5s 重建表格 innerHTML，直接绑在按钮上的监听器会随之丢失
  $('rooms')?.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-join]');
    if (!btn) return;
    try { enterRoom(await joinRoom(btn.dataset.join!)); } catch (e: any) { alert(e.message); }
  });
  refreshRooms();
  clearInterval(roomTimer!);
  roomTimer = setInterval(refreshRooms, 5000);
}

function seatOf(r: HubRoomInfo, userId: string): number {
  return r.players.findIndex(p => p.id === userId);
}

/** 网络对局启动参数契约见 RDS-Board-Core docs/LOBBY-INTEGRATION.md */
function gameClientUrl(r: HubRoomInfo, role: 'host' | 'guest'): string {
  const game = games.find(g => g.id === r.gameId)!;
  const seat = seatOf(r, user!.sub);
  const q = new URLSearchParams({
    game: r.gameId,
    hub: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws',
    roomId: r.id,
    token: localStorage.getItem('token') ?? '',
    role,
    playerId: 'p' + (seat + 1),
  });
  if (role === 'guest') q.set('hostId', r.hostId);
  return game.clientUrl + '?' + q.toString();
}

function roomHtml() {
  const r = currentRoom!;
  const g = games.find(x => x.id === r.gameId);
  const isHost = r.hostId === user!.sub;
  const seat = seatOf(r, user!.sub);
  return `
  <header><h1>${r.name}</h1><div class="row"><span class="muted">${user!.name}</span><button id="exit-room" class="secondary">离开房间</button></div></header>
  <main>
    <div class="card">
      <b>${g?.name ?? r.gameId}（${r.players.length}/${r.maxPlayers}人）</b>
      <span class="badge ${r.status}">${r.status === 'open' ? '等待中' : '游戏中'}</span>
      <ol style="margin:12px 0 0 18px">${r.players.map((p, i) => `<li>${p.name}${p.id === r.hostId ? ' 🏠房主' : ''} · 座位 p${i + 1}${p.id === user!.sub ? '（你）' : ''}</li>`).join('')}</ol>
      <div class="row" style="margin-top:14px">
        ${isHost ? `<button id="start-game" ${r.players.length < (g?.minPlayers ?? 1) ? 'disabled' : ''}>开始游戏（${g?.minPlayers ?? ''}人起）</button>` : ''}
        ${isHost && r.status === 'playing' ? '<button id="reopen-game">再次打开对局窗口</button>' : ''}
        ${!isHost && r.status === 'playing' ? '<button id="join-game">进入对局</button>' : ''}
        ${!isHost && r.status === 'open' ? '<span class="muted">等待房主开始游戏…</span>' : ''}
      </div>
      <p class="muted" style="margin-bottom:0">对局为 P2P（WebRTC）：房主浏览器是对局权威，房主关闭对局窗口则对局中断。你的座位：p${seat + 1}。</p>
    </div>
  </main>`;
}

function enterRoom(room: HubRoomInfo) {
  currentRoom = room;
  render();
}

async function refreshRoom() {
  if (!currentRoom) return;
  try {
    currentRoom = await getRoom(currentRoom.id);
    render();
  } catch (e: any) {
    currentRoom = null; render(); alert(e.message);
  }
}

async function boot() {
  games = await getGames();
  const token = localStorage.getItem('token');
  if (token) {
    try { user = await me(); } catch { localStorage.removeItem('token'); }
  }
  render();
}
boot();