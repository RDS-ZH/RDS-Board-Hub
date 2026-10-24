/** 极简 JSON 文件存储。接口按同步 KV 设计，未来可原样换 SQLite。 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.ts';

export interface UserRecord { id: string; name: string; passHash: string; salt: string; createdAt: number; }
export interface RoomRecord {
  id: string; name: string; gameId: string; hostId: string; status: 'open' | 'playing' | 'closed';
  maxPlayers: number; players: string[]; createdAt: number;
}

interface DbShape { users: UserRecord[]; rooms: RoomRecord[]; }

const FILE = path.join(DATA_DIR, 'hub.json');

function load(): DbShape {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); }
  catch { return { users: [], rooms: [] }; }
}

let db: DbShape = load();

export function save(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, FILE);
}

export const users = {
  all: () => db.users,
  byName: (name: string) => db.users.find(u => u.name === name),
  byId: (id: string) => db.users.find(u => u.id === id),
  add(u: UserRecord) { db.users.push(u); save(); },
};

export const rooms = {
  all: () => db.rooms,
  byId: (id: string) => db.rooms.find(r => r.id === id),
  add(r: RoomRecord) { db.rooms.push(r); save(); },
  update(id: string, patch: Partial<RoomRecord>) {
    const r = db.rooms.find(x => x.id === id);
    if (r) Object.assign(r, patch);
    save();
    return r;
  },
  remove(id: string) { db.rooms = db.rooms.filter(r => r.id !== id); save(); },
};
