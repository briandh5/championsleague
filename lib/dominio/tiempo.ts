// Lógica pura del dominio, sin React ni navegador: se prueba con Vitest.
import type { Partido } from "./tipos";

/** Hora de Madrid (CET/CEST) a ISO UTC. */
export function horaMadrid(fecha: string, hora: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const verano = (y === 2026 && (m < 10 || (m === 10 && d < 25))) || (y === 2027 && (m > 3 || (m === 3 && d >= 28)));
  return new Date(Date.UTC(y, m - 1, d, hh - (verano ? 2 : 1), mm)).toISOString();
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Estado del partido según la hora: programado, en juego (con minuto) o terminado.
 * El marcador sale del resultado oficial o de la fuente en vivo; solo en modo demo se simula.
 */
export function conEstado(p: Partido, ahora: number, demo: boolean): Partido {
  if (p.estado === "final" && p.golesLocal !== undefined) return p;
  const t = (ahora - Date.parse(p.inicio)) / 60000;
  if (t < 0) return { ...p, estado: "programado", minuto: undefined };
  if (t >= 112) {
    if (!demo) return { ...p, estado: "final", minuto: undefined };
  }
  const jugado = t <= 47 ? t : t < 62 ? 45 : Math.min(45 + (t - 62), 95);
  const minuto =
    t >= 112 ? undefined : t <= 47 ? (t > 45 ? "45+" : `${Math.floor(t) + 1}'`) : t < 62 ? "Descanso" : jugado > 90 ? "90+" : `${Math.floor(jugado) + 1}'`;
  const estado: Partido["estado"] = t >= 112 ? "final" : "vivo";
  if (!demo || p.local.id === "tbd") return { ...p, estado, minuto };
  const h = hash(p.id);
  const totalL = [0, 1, 1, 2, 2, 3, 1, 0, 2, 4][h % 10];
  const totalV = [0, 1, 0, 1, 2, 1, 3, 0, 1, 2][(h >>> 4) % 10];
  const goles = (cuantos: number, sal: string) =>
    Array.from({ length: cuantos }, (_, i) => 1 + (hash(`${p.id}${sal}${i}`) % 92)).filter((m) => m <= (t >= 112 ? 99 : jugado)).length;
  return { ...p, estado, minuto, golesLocal: goles(totalL, "L"), golesVisita: goles(totalV, "V") };
}

export const claveDia = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function faltan(iso: string, ahora: number): string {
  const min = Math.round((Date.parse(iso) - ahora) / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `en ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "mañana" : `en ${d} días`;
}
