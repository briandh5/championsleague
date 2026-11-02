/** Tipos del dominio compartidos por la interfaz y las rutas de la API. */

export type Fase = "Fase de liga" | "Play-off" | "Octavos" | "Cuartos" | "Semifinal" | "Final";

export interface Equipo {
  id: string;
  nombre: string;
  corto: string;
  pais: string;
  escudo?: string;
  colores: [string, string];
  estadio: string;
  ciudad: string;
}

export interface Partido {
  id: string;
  fase: Fase;
  jornada?: string;
  inicio: string; // ISO en UTC
  local: Equipo;
  visita: Equipo;
  estadio: string;
  ciudad: string;
  estado: "programado" | "vivo" | "final";
  golesLocal?: number;
  golesVisita?: number;
  minuto?: string;
  goles?: Gol[];
}

/** Gol con minuto y autor; `lado` dice si lo anotó el local (L) o la visita (V). */
export interface Gol {
  min: string;
  jugador: string;
  lado: "L" | "V";
  tipo?: "penal" | "propia";
}

/** Mensaje al que se contesta (se guarda una copia corta para mostrarla citada). */
export interface Respuesta {
  autor: string;
  texto: string;
}

export interface FilaTabla {
  equipo: Equipo;
  pos: number;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  pts: number;
}

