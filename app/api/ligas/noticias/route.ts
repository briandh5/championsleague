import { LIGAS, leerNoticiasESPN, urlResumenESPN, type Liga } from "@/lib/ligas";

/** Noticias de ESPN sobre un partido: `?liga=ligamx&id=ligamx-123&eq=América|Chivas`. */
export const revalidate = 300;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const liga = q.get("liga") as Liga;
  const id = q.get("id") ?? "";
  if (!LIGAS.includes(liga) || !/^[a-z]+-\d+$/.test(id)) return Response.json({ noticias: [] }, { status: 400 });
  try {
    const r = await fetch(urlResumenESPN(liga, id), { next: { revalidate: 300 } });
    if (!r.ok) return Response.json({ noticias: null });
    return Response.json({ noticias: leerNoticiasESPN(await r.json(), (q.get("eq") ?? "").split("|")) });
  } catch {
    return Response.json({ noticias: null });
  }
}
