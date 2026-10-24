import type { HubGameInfo, HubRoomInfo } from '@rds-board/room-protocol';

const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(path.startsWith('/api/auth') && !path.includes('me') ? {} : auth()), ...init.headers } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body as T;
}

export const getGames = () => api<HubGameInfo[]>('/api/games');
export const getRooms = () => api<HubRoomInfo[]>('/api/rooms');
export const createRoom = (name: string, gameId: string) =>
  api<HubRoomInfo>('/api/rooms', { method: 'POST', body: JSON.stringify({ name, gameId }) });
export const joinRoom = (id: string) => api<HubRoomInfo>('/api/rooms/' + id + '/join', { method: 'POST' });
export const me = () => api<{ sub: string; name: string }>('/api/auth/me');export const getRoom = (id: string) => api<HubRoomInfo>('/api/rooms/' + id);
export const leaveRoom = (id: string) => api<{ ok: true }>('/api/rooms/' + id + '/leave', { method: 'POST' });
export const setRoomStatus = (id: string, status: 'open' | 'playing' | 'closed') =>
  api<HubRoomInfo>('/api/rooms/' + id + '/status', { method: 'POST', body: JSON.stringify({ status }) });
