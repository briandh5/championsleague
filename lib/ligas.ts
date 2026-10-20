/**
 * Juegos del día de MLB y NBA (cinta de abajo), leídos del marcador público de ESPN (sin llave).
 * Lo usan la ruta /api/ligas y, si esa ruta no responde, la app directamente.
 */
export type Liga = "mlb" | "nba";

export interface LadoJuego {
  nombre: string;
  abrev: string;
  logo?: string;
  marcador?: number;
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
}

export const NOMBRE_LIGA: Record<Liga, string> = { mlb: "MLB", nba: "NBA" };

const RUTAS: Record<Liga, string> = { mlb: "baseball/mlb", nba: "basketball/nba" };

interface Competidor {
  homeAway: "home" | "away";
  score?: string;
  team: { displayName: string; shortDisplayName?: string; abbreviation?: string; logo?: string };
}
interface EventoESPN {
  id: string;
  date: string;
  competitions?: {
    competitors: Competidor[];
    status: { type: { state: "pre" | "in" | "post"; shortDetail?: string } };
    notes?: { headline?: string }[];
    venue?: { fullName?: string };
  }[];
}

/** Día local como AAAAMMDD. */
export const fechaLocal = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

export const urlESPN = (liga: Liga, fecha: string) => `https://site.api.espn.com/apis/site/v2/sports/${RUTAS[liga]}/scoreboard?dates=${fecha}`;

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
      },
    ];
  });
}
