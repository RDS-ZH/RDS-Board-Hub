import './style.css';
import { getGames, getRooms, createRoom, joinRoom, me } from './api.ts';
import type { HubGameInfo, HubRoomInfo } from '@rds-board/room-protocol';

const app = document.getElementById('app')!;
let user: { sub: string; name: string } | null = null;
let games: HubGameInfo[] = [];

function render() {
  app.innerHTML = user ? lobbyHtml() : authHtml();
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

  $('logout')?.addEventListener('click', () => { localStorage.removeItem('token'); user = null; render(); });
  $('create')?.addEventListener('click', async () => {
    try {
      const room = await createRoom(($('room-name') as HTMLInputElement).value, ($('game') as HTMLSelectElement).value);
      await refreshRooms();
      enterRoom(room);
    } catch (e: any) { alert(e.message); }
  });
  document.querySelectorAll('[data-join]').forEach(btn =>
    btn.addEventListener('click', async () => {
      try { enterRoom(await joinRoom((btn as HTMLElement).dataset.join!)); } catch (e: any) { alert(e.message); }
    }));
  refreshRooms();
  setInterval(refreshRooms, 5000);
}

/** M2：这里将挂 WebSocket 信令 + WebRTC，拉起游戏客户端。 */
function enterRoom(room: HubRoomInfo) {
  alert('已进入房间「' + room.name + '」\n联机对局（WebRTC + 璀璨宝石）在 M2 里程碑接入。');
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
