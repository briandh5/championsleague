import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { VAPID_PUBLICA } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL_NUBE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const LLAVE_NUBE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PRIVADA = process.env.VAPID_PRIVATE_KEY ?? "";

/** Manda el aviso al cel de cada amigo invitado a un plan recién creado. Solo funciona con la llave del plan y una vez. */
export async function POST(req: Request) {
  if (!URL_NUBE || !LLAVE_NUBE || !PRIVADA) return Response.json({ enviados: 0, motivo: "sin-configurar" });
  let plan = "";
  let clave = "";
  try {
    const b = (await req.json()) as { plan?: unknown; clave?: unknown };
    plan = typeof b.plan === "string" ? b.plan.slice(0, 80) : "";
    clave = typeof b.clave === "string" ? b.clave.slice(0, 200) : "";
  } catch {
    /* cuerpo inválido */
  }
  if (!plan || !clave) return Response.json({ error: "faltan datos" }, { status: 400 });

  const nube = createClient(URL_NUBE, LLAVE_NUBE, { auth: { persistSession: false } });
  const [subs, info] = await Promise.all([
    nube.rpc("suscripciones_para_plan", { p_plan: plan, p_clave: clave }),
    nube.from("planes").select("anfitrion, snap, lugar, ciudad, hashtag").eq("id", plan).maybeSingle(),
  ]);
  if (subs.error) return Response.json({ error: subs.error.message }, { status: 500 });
  const lista = (subs.data ?? []) as { endpoint: string; sub: webpush.PushSubscription }[];
  const pl = info.data as { anfitrion: string; snap: { local: string; visita: string }; lugar: string; ciudad: string; hashtag: string } | null;
  if (!lista.length || !pl) return Response.json({ enviados: 0 });

  webpush.setVapidDetails("https://championsleague-coral.vercel.app", VAPID_PUBLICA, PRIVADA);
  const aviso = JSON.stringify({
    title: `${pl.anfitrion} te invitó a ver la Champions`,
    body: `${pl.snap.local} vs ${pl.snap.visita} en ${pl.lugar}, ${pl.ciudad} ${pl.hashtag}`,
    url: `/?abrir=${encodeURIComponent(plan)}`,
    tag: `plan-${plan}`,
  });
  const res = await Promise.allSettled(lista.map((s) => webpush.sendNotification(s.sub, aviso, { TTL: 60 * 60 * 24 })));
  // Los cels que ya cancelaron los avisos se borran de la lista.
  await Promise.all(
    res.map((r, i) => {
      const st = r.status === "rejected" ? (r.reason as { statusCode?: number })?.statusCode : 0;
      return st === 404 || st === 410 ? nube.rpc("borrar_suscripcion", { p_endpoint: lista[i].endpoint }) : null;
    }),
  );
  return Response.json({ enviados: res.filter((r) => r.status === "fulfilled").length });
}
