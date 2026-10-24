/** M1 自检：不依赖浏览器，直接调用各模块断言核心行为。 */
import { register, login, verifyJwt } from './auth.ts';
import { createRoom, joinRoom, listRooms, setRoomStatus } from './rooms.ts';
import { GAMES } from './games.ts';

let failed = 0;
const ok = (cond: boolean, name: string) => { if (!cond) { failed++; console.error('FAIL', name); } else console.log('ok -', name); };

const name = 'tester_' + Date.now();
const reg: any = register(name, 'secret123');
ok(reg.token && reg.user.id, 'register issues token');
ok((register(name, 'x').toString as any), 'duplicate name rejected');
ok(verifyJwt(reg.token)?.sub === reg.user.id, 'jwt roundtrip');
const login_r: any = login(name, 'secret123');
ok(login_r.token, 'login works');
ok((login(name, 'wrong!!') as any).error, 'wrong password rejected');

const room: any = createRoom(reg.user.id, '测试房', 'splendor');
ok(room.id && room.maxPlayers === 4, 'create room uses game maxPlayers');
const other: any = register(name + 'b', 'secret123');
ok((joinRoom(other.user.id, room.id) as any).players.length === 2, 'guest joins');
ok((createRoom(reg.user.id, 'x', 'nope') as any).error, 'unknown game rejected');
const st: any = setRoomStatus(reg.user.id, room.id, 'playing');
ok(st.status === 'playing', 'host sets status');
ok((setRoomStatus(other.user.id, room.id, 'open') as any).error, 'non-host cannot set status');
ok(listRooms().some((r: any) => r.id === room.id), 'room listed');
ok(GAMES.some(g => g.id === 'splendor'), 'splendor in catalog (first P2P test game)');

console.log(failed ? failed + ' FAILURES' : 'ALL PASS');
process.exit(failed ? 1 : 0);
