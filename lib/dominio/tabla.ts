// Lógica pura del dominio, sin React ni navegador: se prueba con Vitest.
import type { Equipo, FilaTabla, Partido } from "./tipos";

/** Tabla de la fase de liga con los partidos terminados y los que están en juego (cuenta el marcador del momento). */
export function calcularTabla(partidos: Partido[]): FilaTabla[] {
  const filas = new Map<string, FilaTabla>();
  const fila = (eq: Equipo) => {
    let f = filas.get(eq.id);
    if (!f) filas.set(eq.id, (f = { equipo: eq, pos: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }));
    return f;
  };
  for (const m of partidos) {
    if (m.fase !== "Fase de liga" || m.local.id === "tbd") continue;
    const l = fila(m.local);
    const v = fila(m.visita);
    if (m.estado === "programado" || m.golesLocal === undefined || m.golesVisita === undefined) continue;
    const a = m.golesLocal;
    const b = m.golesVisita;
    l.pj++, v.pj++;
    l.gf += a, l.gc += b, v.gf += b, v.gc += a;
    if (a > b) (l.g++, l.pts += 3, v.p++);
    else if (a < b) (v.g++, v.pts += 3, l.p++);
    else (l.e++, v.e++, l.pts++, v.pts++);
  }
  const orden = [...filas.values()].sort(
    (x, y) => y.pts - x.pts || y.gf - y.gc - (x.gf - x.gc) || y.gf - x.gf || x.equipo.nombre.localeCompare(y.equipo.nombre, "es"),
  );
  orden.forEach((f, i) => (f.pos = i + 1));
  return orden;
}

export const zonaTabla = (pos: number) => (pos <= 8 ? "octavos" : pos <= 24 ? "playoff" : "fuera");
