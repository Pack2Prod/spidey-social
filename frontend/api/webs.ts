import { apiUrl } from '../config';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { WebPost } from '../types';

const baseUrl = (apiUrl || '').replace(/\/$/, '');

function checkApiUrl() {
  if (!baseUrl) throw new Error('API URL not configured. Add VITE_API_URL to .env.local and rebuild.');
}

async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error('Not authenticated');
  return token;
}

async function fetchApi(url: string, options?: RequestInit): Promise<Response> {
  checkApiUrl();
  try {
    return await fetch(url, options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('CORS'))
      throw new Error('Cannot reach API. Check CORS and network.');
    throw err;
  }
}

export async function createWeb(
  content: string,
  category: string,
  ttl: number,
  coords?: { lat: number; lng: number } | null,
  visibilityRadiusMi?: number | null
): Promise<WebPost> {
  const token = await getAuthToken();
  const body: Record<string, unknown> = { content: content.slice(0, 280), category, ttl };
  if (coords) body.lat = coords.lat;
  if (coords) body.lng = coords.lng;
  if (visibilityRadiusMi != null) body.visibilityRadius = visibilityRadiusMi;
  const res = await fetchApi(`${baseUrl}/webs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Create web failed: ${res.status}`);
  }
  return res.json();
}

export interface SwingChat {
  webId: string;
  webOwnerId: string;
  userName: string;
  userHandle: string;
  content: string;
  category: string;
  timestamp: string;
  ttl: number;
}

export async function listMySwings(): Promise<SwingChat[]> {
  const token = await getAuthToken();
  const res = await fetchApi(`${baseUrl}/users/me/swings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List my swings failed: ${res.status}`);
  const data = await res.json();
  return data.swings || [];
}

export async function listMyWebs(): Promise<WebPost[]> {
  const token = await getAuthToken();
  const res = await fetchApi(`${baseUrl}/users/me/webs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List my webs failed: ${res.status}`);
  const data = await res.json();
  return data.webs || [];
}

export async function listWebs(
  coords?: { lat: number; lng: number } | null,
  radiusMi?: number | null
): Promise<WebPost[]> {
  const params = new URLSearchParams();
  if (coords) {
    params.set('lat', String(coords.lat));
    params.set('lng', String(coords.lng));
  }
  if (radiusMi != null && radiusMi > 0) params.set('radius', String(radiusMi));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchApi(`${baseUrl}/webs${qs}`);
  if (!res.ok) throw new Error(`List webs failed: ${res.status}`);
  const data = await res.json();
  return data.webs || [];
}

export async function swingIn(
  webId: string,
  coords?: { lat: number; lng: number } | null
): Promise<{ isNew: boolean }> {
  const token = await getAuthToken();
  const body: Record<string, unknown> = {};
  if (coords) {
    body.lat = coords.lat;
    body.lng = coords.lng;
  }
  const res = await fetchApi(`${baseUrl}/webs/${webId}/swing-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Swing in failed: ${res.status}`);
  }
  return { isNew: res.status === 201 };
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
}

export async function listMessages(webId: string): Promise<ChatMessage[]> {
  const token = await getAuthToken();
  const res = await fetchApi(`${baseUrl}/chats/${webId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List messages failed: ${res.status}`);
  const data = await res.json();
  return data.messages || [];
}

export async function sendMessage(webId: string, content: string): Promise<ChatMessage> {
  const token = await getAuthToken();
  const res = await fetchApi(`${baseUrl}/chats/${webId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: content.trim().slice(0, 500) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Send message failed: ${res.status}`);
  }
  return res.json();
}
