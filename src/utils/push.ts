import type { PushStatus } from '../components/AccountMenu';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function serverPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/public-key');
    const json = await res.json();
    return json.enabled ? json.publicKey : null;
  } catch {
    return null;
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (!(await serverPublicKey())) return 'unavailable';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw-push.js') || (await navigator.serviceWorker.getRegistration());
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function enablePush(customerId: string): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported';
  const key = await serverPublicKey();
  if (!key) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  try {
    const reg = await navigator.serviceWorker.register('/sw-push.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource });
    }
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, subscription: sub.toJSON() }),
    });
    return res.ok ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function fetchPushPrefs(customerId: string): Promise<{ marketing: boolean }> {
  try {
    const res = await fetch(`/api/push/prefs?customerId=${encodeURIComponent(customerId)}`);
    const json = await res.json();
    return { marketing: json?.prefs?.marketing !== false };
  } catch {
    return { marketing: true };
  }
}

export async function savePushPrefs(customerId: string, marketing: boolean): Promise<void> {
  try {
    await fetch('/api/push/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, marketing }),
    });
  } catch {
    /* the toggle stays local until the next try */
  }
}
