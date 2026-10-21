/**
 * Juegos del día de fútbol (Liga MX, Liga MX Femenil, Leagues Cup, Concacaf Champions Cup), MLB y NBA para la cinta de abajo,
 * leídos del marcador público de ESPN (sin llave). Lo usan las rutas /api/ligas y /api/ligas/noticias y, si no responden, la app directamente.
 */
export type Liga = "ligamx" | "femenil" | "leagues" | "concacaf" | "mlb" | "nba";
export type Deporte = "futbol" | "beisbol" | "basquet";

export const DEPORTES: { clave: Deporte; nombre: string; icono: string; ligas: Liga[] }[] = [
  { clave: "futbol", nombre: "Fútbol", icono: "⚽", ligas: ["ligamx", "femenil", "leagues", "concacaf"] },
  { clave: "beisbol", nombre: "Béisbol", icono: "⚾", ligas: ["mlb"] },
  { clave: "basquet", nombre: "Básquetbol", icono: "🏀", ligas: ["nba"] },
];
export const LIGAS: Liga[] = DEPORTES.flatMap((d) => d.ligas);
export const deporteDe = (l: Liga): Deporte => DEPORTES.find((d) => d.ligas.includes(l))!.clave;
export const esFutbol = (l: Liga) => deporteDe(l) === "futbol";

export interface LadoJuego {
  nombre: string;
  abrev: string;
  logo?: string;
  marcador?: number;
}

export interface GolLiga {
  min: string;
  jugador: string;
  lado: "L" | "V";
  tipo?: "penal" | "propia";
}

export interface NoticiaLiga {
  titulo: string;
  url: string;
  fecha?: string;
}

export interface JuegoLiga {
  liga: Liga;
  id: string;
  inicio: string;
  estado: "programado" | "vivo" | "final";
  /** Texto de ESPN: "Final", "Bot 7th", "Q3 5:12", "8:10 PM ET"… */
  detalle: string;
  /** Serie de postemporada, p. ej. "World Series - Game 3". */
  nota?: string;
  sede?: string;
  local: LadoJuego;
  visita: LadoJuego;
  /** Solo fútbol: quién anotó y en qué minuto. */
  goles?: GolLiga[];
  /** Página del partido en ESPN. */
  enlace?: string;
}

export const NOMBRE_LIGA: Record<Liga, string> = {
  ligamx: "Liga MX",
  femenil: "Liga MX Femenil",
  leagues: "Leagues Cup",
  concacaf: "Concacaf Champions Cup",
  mlb: "MLB",
  nba: "NBA",
};

const RUTAS: Record<Liga, string> = {
  ligamx: "soccer/mex.1",
  femenil: "soccer/mex.w.1",
  leagues: "soccer/concacaf.leagues.cup",
  concacaf: "soccer/concacaf.champions",
  mlb: "baseball/mlb",
  nba: "basketball/nba",
};

interface Competidor {
  homeAway: "home" | "away";
  score?: string;
  team: { id?: string; displayName: string; shortDisplayName?: string; abbreviation?: string; logo?: string };
}
interface EventoESPN {
  id: string;
  date: string;
  competitions?: {
    competitors: Competidor[];
    status: { type: { state: "pre" | "in" | "post"; shortDetail?: string } };
    notes?: { headline?: string }[];
    venue?: { fullName?: string };
    details?: {
      scoringPlay?: boolean;
      penaltyKick?: boolean;
      ownGoal?: boolean;
      clock?: { displayValue?: string };
      team?: { id?: string };
      athletesInvolved?: { displayName?: string }[];
    }[];
  }[];
  links?: { href?: string; rel?: string[] }[];
}

/** Día local como AAAAMMDD. */
export const fechaLocal = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

export const urlESPN = (liga: Liga, fecha: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/${RUTAS[liga]}/scoreboard?dates=${fecha}${esFutbol(liga) ? "&lang=es&region=mx" : ""}`;

export const urlResumenESPN = (liga: Liga, id: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/${RUTAS[liga]}/summary?event=${id.replace(/^[a-z]+-/, "")}${esFutbol(liga) ? "&lang=es&region=mx" : ""}`;

export function leerJuegosESPN(liga: Liga, j: { events?: EventoESPN[] }): JuegoLiga[] {
  return (j.events ?? []).flatMap((e) => {
    const c = e.competitions?.[0];
    const casa = c?.competitors.find((x) => x.homeAway === "home");
    const fuera = c?.competitors.find((x) => x.homeAway === "away");
    if (!c || !casa || !fuera) return [];
    const estado: JuegoLiga["estado"] = c.status.type.state === "in" ? "vivo" : c.status.type.state === "post" ? "final" : "programado";
    const lado = (x: Competidor): LadoJuego => ({
      nombre: x.team.shortDisplayName || x.team.displayName,
      abrev: x.team.abbreviation ?? x.team.displayName.slice(0, 3).toUpperCase(),
      logo: x.team.logo,
      marcador: estado === "programado" ? undefined : Number(x.score ?? 0),
    });
    return [
      {
        liga,
        id: `${liga}-${e.id}`,
        inicio: new Date(e.date).toISOString(),
        estado,
        detalle: c.status.type.shortDetail ?? "",
        nota: c.notes?.[0]?.headline,
        sede: c.venue?.fullName,
        local: lado(casa),
        visita: lado(fuera),
        goles: c.details
          ?.filter((d) => d.scoringPlay)
          .map((d) => ({
            min: d.clock?.displayValue ?? "",
            jugador: d.athletesInvolved?.[0]?.displayName ?? "Gol",
            lado: d.team?.id && d.team.id === fuera.team.id ? ("V" as const) : ("L" as const),
            ...(d.penaltyKick ? { tipo: "penal" as const } : d.ownGoal ? { tipo: "propia" as const } : {}),
          })),
        enlace: e.links?.find((l) => l.rel?.includes("summary") || l.rel?.includes("desktop"))?.href ?? e.links?.[0]?.href,
      },
    ];
  });
}

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Noticias de ESPN del resumen del partido que mencionan a alguno de los dos equipos (máximo 4). */
export function leerNoticiasESPN(
  j: { news?: { articles?: { headline?: string; description?: string; published?: string; links?: { web?: { href?: string } } }[] } },
  equipos: string[],
): NoticiaLiga[] {
  const claves = equipos.map(sinAcentos).filter((x) => x.length > 2);
  return (j.news?.articles ?? [])
    .filter((a) => a.headline && a.links?.web?.href)
    .filter((a) => claves.some((k) => sinAcentos(`${a.headline} ${a.description ?? ""}`).includes(k)))
    .slice(0, 4)
    .map((a) => ({ titulo: a.headline!, url: a.links!.web!.href!, fecha: a.published }));
}

/** Búsqueda de noticias del partido en Google Noticias (siempre disponible como respaldo). */
export const urlBuscarNoticias = (g: JuegoLiga) =>
  `https://news.google.com/search?q=${encodeURIComponent(`${g.local.nombre} ${g.visita.nombre}`)}&hl=es-419&gl=MX&ceid=MX:es-419`;
