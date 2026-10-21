import { LIGAS, leerJuegosESPN, urlESPN, type Liga } from "@/lib/ligas";

/** Juegos de MLB, NBA y Liga MX de un día (`?fecha=AAAAMMDD`, el día local de quien abre la app). null = ESPN no respondió. */
export const revalidate = 60;

async function juegos(liga: Liga, fecha: string) {
  const r = await fetch(urlESPN(liga, fecha), { next: { revalidate: 60 } });
  if (!r.ok) throw new Error(`ESPN ${r.status}`);
  return leerJuegosESPN(liga, await r.json());
}

export async function GET(req: Request) {
  const pedida = new URL(req.url).searchParams.get("fecha") ?? "";
  const fecha = /^\d{8}$/.test(pedida) ? pedida : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const res = await Promise.allSettled(LIGAS.map((l) => juegos(l, fecha)));
  return Response.json({ fecha, ...Object.fromEntries(LIGAS.map((l, i) => [l, res[i].status === "fulfilled" ? res[i].value : null])) });
}
