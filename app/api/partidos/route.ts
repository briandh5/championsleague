import type { Fase, Partido } from "@/components/LaPrevia";

/**
 * Partidos reales de la Champions desde TheSportsDB (liga 4480).
 * La llave gratuita de prueba es "123"; con una llave propia (THESPORTSDB_KEY) llegan más partidos.
 * Si la fuente no responde o trae muy pocos partidos, la app usa su calendario de ejemplo.
 */
export const revalidate = 60;

const LIGA = "4480";

interface EventoTSDB {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  strTimestamp?: string | null;
  dateEvent?: string;
  strTime?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  intRound?: string | null;
  strStatus?: string | null;
  strProgress?: string | null;
  strVenue?: string | null;
  strCity?: string | null;
}

function fase(round: number): { fase: Fase; jornada?: string } {
  if (round >= 1 && round <= 8) return { fase: "Fase de liga", jornada: `Jornada ${round}` };
  if (round === 32 || round === 125) return { fase: "Play-off" };
  if (round === 16) return { fase: "Octavos" };
  if (round === 150) return { fase: "Cuartos" };
  if (round === 160) return { fase: "Semifinal" };
  if (round === 200) return { fase: "Final" };
  return { fase: "Fase de liga" };
}

function estado(e: EventoTSDB): Partido["estado"] {
  const s = (e.strStatus ?? "").toUpperCase();
  if (["FT", "AET", "PEN", "MATCH FINISHED"].includes(s)) return "final";
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(s)) return "vivo";
  return "programado";
}

function equipo(id: string | undefined, nombre: string, escudo?: string | null) {
  return {
    id: `tsdb-${id ?? nombre}`,
    nombre,
    corto: nombre.replace(/^(FC|AC|SL|SSC|AFC)\s+/i, "").slice(0, 3).toUpperCase(),
    pais: "",
    escudo: escudo ? `${escudo}/small` : undefined,
    colores: ["#1d2560", "#00f0ff"] as [string, string],
    estadio: "",
    ciudad: "",
  };
}

async function pedir(llave: string, ruta: string): Promise<EventoTSDB[]> {
  const r = await fetch(`https://www.thesportsdb.com/api/v1/json/${llave}/${ruta}`, { next: { revalidate: 60 } });
  if (!r.ok) return [];
  const j = (await r.json()) as { events?: EventoTSDB[] | null };
  return j.events ?? [];
}

export async function GET() {
  const llave = process.env.THESPORTSDB_KEY || "123";
  try {
    const [proximos, pasados] = await Promise.all([
      pedir(llave, `eventsnextleague.php?id=${LIGA}`),
      pedir(llave, `eventspastleague.php?id=${LIGA}`),
    ]);
    const vistos = new Set<string>();
    const partidos: Partido[] = [...pasados, ...proximos]
      .filter((e) => (vistos.has(e.idEvent) ? false : (vistos.add(e.idEvent), true)))
      .map((e) => {
        const inicio = e.strTimestamp
          ? new Date(e.strTimestamp.endsWith("Z") ? e.strTimestamp : `${e.strTimestamp}Z`).toISOString()
          : new Date(`${e.dateEvent}T${e.strTime ?? "20:00:00"}Z`).toISOString();
        const st = estado(e);
        return {
          id: `tsdb-${e.idEvent}`,
          ...fase(Number(e.intRound ?? 0)),
          inicio,
          local: equipo(e.idHomeTeam, e.strHomeTeam, e.strHomeTeamBadge),
          visita: equipo(e.idAwayTeam, e.strAwayTeam, e.strAwayTeamBadge),
          estadio: e.strVenue ?? "",
          ciudad: e.strCity ?? "",
          estado: st,
          golesLocal: e.intHomeScore != null && e.intHomeScore !== "" ? Number(e.intHomeScore) : undefined,
          golesVisita: e.intAwayScore != null && e.intAwayScore !== "" ? Number(e.intAwayScore) : undefined,
          minuto: st === "vivo" ? (e.strProgress ?? e.strStatus ?? undefined) : undefined,
        };
      });
    return Response.json({ fuente: "thesportsdb", partidos });
  } catch {
    return Response.json({ fuente: "error", partidos: [] });
  }
}
