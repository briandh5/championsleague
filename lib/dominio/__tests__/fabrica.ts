import type { Equipo, Partido } from "../tipos";

export const equipo = (id: string, nombre: string): Equipo => ({
  id,
  nombre,
  corto: id.toUpperCase(),
  pais: "",
  colores: ["#000000", "#ffffff"],
  estadio: "",
  ciudad: "",
});

export const partido = (local: Equipo, visita: Equipo, extra: Partial<Partido> = {}): Partido => ({
  id: `${local.id}-${visita.id}`,
  fase: "Fase de liga",
  inicio: "2026-11-04T20:00:00.000Z",
  local,
  visita,
  estadio: "",
  ciudad: "",
  estado: "final",
  ...extra,
});

export const resultado = (local: Equipo, visita: Equipo, gl: number, gv: number, extra: Partial<Partido> = {}) =>
  partido(local, visita, { golesLocal: gl, golesVisita: gv, ...extra });
