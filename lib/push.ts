// Avisos al cel (Web Push): suscribe este navegador para que le lleguen invitaciones aunque la página esté cerrada.

/** Llave pública VAPID. La privada vive solo en Vercel (VAPID_PRIVATE_KEY). */
export const VAPID_PUBLICA =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BAt8312s127cSKPWCcxkU7BKLWF3mu6kVjtdj3vS1hJUKyIWwjuBROKaty8Q9N_eAFyGLOIZ26PfIR0r7WbRBRs";

export const pushSoportado = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";

function aBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Registra el service worker (sirve también para mostrar recordatorios en Android). */
export async function registrarSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Devuelve la suscripción push de este cel, creándola si hace falta. Requiere permiso de notificaciones. */
export async function suscribirCel(): Promise<PushSubscriptionJSON | null> {
  if (!pushSoportado() || Notification.permission !== "granted") return null;
  const reg = await registrarSW();
  if (!reg) return null;
  try {
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID_PUBLICA) }));
    return sub.toJSON();
  } catch {
    return null;
  }
}

/** Muestra un aviso local; en Android solo funciona desde el service worker. */
export async function mostrarAviso(titulo: string, opciones: NotificationOptions) {
  try {
    const reg = typeof navigator !== "undefined" && "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) return await reg.showNotification(titulo, opciones);
  } catch {
    /* se intenta abajo */
  }
  try {
    new Notification(titulo, opciones);
  } catch {
    /* sin avisos en este navegador */
  }
}
