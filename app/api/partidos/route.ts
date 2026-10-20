import type { Fase, Gol, Partido } from "@/components/LaPrevia";

/**
 * Resultados reales de la Champions: marcador, minuto y goleadores.
 * Fuente principal: el marcador público de ESPN (sin llave). Si no responde, TheSportsDB (liga 4480, solo marcador).
 * La app cruza estos datos con su calendario oficial por fecha y nombre de los equipos.
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

/* ───────── ESPN ───────── */

interface CompetidorESPN {
  homeAway: "home" | "away";
  score?: string;
  team: { id: string; displayName: string; abbreviation?: string };
}
interface DetalleESPN {
  type?: { text?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  scoringPlay?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  athletesInvolved?: { displayName?: string }[];
}
interface EventoESPN {
  id: string;
  date: string;
  competitions: {
    competitors: CompetidorESPN[];
    status: { displayClock?: string; type: { name: string; completed?: boolean } };
    details?: DetalleESPN[];
    venue?: { fullName?: string; address?: { city?: string } };
  }[];
}

function estadoESPN(nombre: string): Partido["estado"] {
  if (/FULL_TIME|FINAL|END_OF_EXTRATIME|PENALTIES_FINAL/.test(nombre)) return "final";
  if (/IN_PROGRESS|HALFTIME|FIRST_HALF|SECOND_HALF|EXTRA_TIME|SHOOTOUT|OVERTIME/.test(nombre)) return "vivo";
  return "programado";
}

async function desdeESPN(): Promise<Partido[]> {
  // Toda la temporada en una sola llamada.
  const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20260701-20270630&limit=500", {
    next: { revalidate: 60 },
  });
  if (!r.ok) return [];
  const j = (await r.json()) as { events?: EventoESPN[] };
  return (j.events ?? []).flatMap((e) => {
    const c = e.competitions?.[0];
    const casa = c?.competitors.find((x) => x.homeAway === "home");
    const fuera = c?.competitors.find((x) => x.homeAway === "away");
    if (!c || !casa || !fuera) return [];
    const st = estadoESPN(c.status.type.name);
    const goles: Gol[] = (c.details ?? [])
      .filter((d) => d.scoringPlay)
      .map((d) => ({
        min: d.clock?.displayValue ?? "",
        jugador: d.athletesInvolved?.[0]?.displayName ?? "Gol",
        lado: d.team?.id === fuera.team.id ? "V" : "L",
        ...(d.penaltyKick ? { tipo: "penal" as const } : d.ownGoal ? { tipo: "propia" as const } : {}),
      }));
    const conMarcador = st !== "programado";
    return [
      {
        id: `espn-${e.id}`,
        fase: "Fase de liga" as Fase,
        inicio: new Date(e.date).toISOString(),
        local: equipo(casa.team.id, casa.team.displayName),
        visita: equipo(fuera.team.id, fuera.team.displayName),
        estadio: c.venue?.fullName ?? "",
        ciudad: c.venue?.address?.city ?? "",
        estado: st,
        golesLocal: conMarcador ? Number(casa.score ?? 0) : undefined,
        golesVisita: conMarcador ? Number(fuera.score ?? 0) : undefined,
        minuto: st === "vivo" ? (/HALFTIME/.test(c.status.type.name) ? "Descanso" : c.status.displayClock) : undefined,
        goles,
      },
    ];
  });
}

export async function GET() {
  try {
    const espn = await desdeESPN();
    if (espn.length) return Response.json({ fuente: "espn", partidos: espn });
  } catch {
    /* sigue con TheSportsDB */
  }
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
