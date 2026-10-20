"use client";

/**
 * La Previa · Champions con tus amigos
 * App #4 del reto 100 apps — componente único: mapa ilustrado con pines y hashtags,
 * calendario por fases con marcador en vivo, recordatorios, compartir plan y chat por evento.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import {
  Bell,
  BellRing,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Hash,
  Home,
  Layers,
  ListChecks,
  LocateFixed,
  Map as MapaIcon,
  MapPin,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";

/* ────────────────────────────── Tipos ────────────────────────────── */

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
}

type TipoLugar = "bar" | "restaurante" | "casa";

interface Mensaje {
  id: string;
  autor: string;
  texto: string;
  hora: string;
}

interface Plan {
  id: string;
  partidoId: string;
  /** Copia de los datos del partido, por si la fuente cambia o el plan llega por enlace. */
  snap: { local: string; visita: string; inicio: string };
  lat: number;
  lng: number;
  pais: string;
  estado: string;
  ciudad: string;
  lugar: string;
  tipo: TipoLugar;
  hashtag: string;
  anfitrion: string;
  confirmados: string[];
  chat: Mensaje[];
  recordatorios: { dia: boolean; hora: boolean };
  creado: string;
}

type Vista = "mapa" | "partidos" | "planes";
type Fuente = "cargando" | "real" | "ejemplo";

interface Aviso {
  id: string;
  titulo: string;
  texto?: string;
  tono?: "neon" | "oro" | "vivo";
}

/* ─────────────────────── Datos de ejemplo (capa de datos) ─────────────────────── */

const FASES: Fase[] = ["Fase de liga", "Play-off", "Octavos", "Cuartos", "Semifinal", "Final"];

// Escudos en alta resolución desde el CDN público de API-Football; si alguno falla se dibuja un escudo con los colores del club.
const esc = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

const EQUIPOS: Equipo[] = [
  { id: "rma", nombre: "Real Madrid", corto: "RMA", pais: "ESP", escudo: esc(541), colores: ["#ffffff", "#febe10"], estadio: "Santiago Bernabéu", ciudad: "Madrid" },
  { id: "bar", nombre: "Barcelona", corto: "BAR", pais: "ESP", escudo: esc(529), colores: ["#a50044", "#004d98"], estadio: "Spotify Camp Nou", ciudad: "Barcelona" },
  { id: "atm", nombre: "Atlético de Madrid", corto: "ATM", pais: "ESP", escudo: esc(530), colores: ["#cb3524", "#272e61"], estadio: "Metropolitano", ciudad: "Madrid" },
  { id: "ath", nombre: "Athletic Club", corto: "ATH", pais: "ESP", escudo: esc(531), colores: ["#ee2523", "#ffffff"], estadio: "San Mamés", ciudad: "Bilbao" },
  { id: "vil", nombre: "Villarreal", corto: "VIL", pais: "ESP", escudo: esc(533), colores: ["#ffe667", "#005187"], estadio: "La Cerámica", ciudad: "Villarreal" },
  { id: "mci", nombre: "Manchester City", corto: "MCI", pais: "ENG", escudo: esc(50), colores: ["#6cabdd", "#1c2c5b"], estadio: "Etihad Stadium", ciudad: "Mánchester" },
  { id: "liv", nombre: "Liverpool", corto: "LIV", pais: "ENG", escudo: esc(40), colores: ["#c8102e", "#00b2a9"], estadio: "Anfield", ciudad: "Liverpool" },
  { id: "ars", nombre: "Arsenal", corto: "ARS", pais: "ENG", escudo: esc(42), colores: ["#ef0107", "#063672"], estadio: "Emirates Stadium", ciudad: "Londres" },
  { id: "che", nombre: "Chelsea", corto: "CHE", pais: "ENG", escudo: esc(49), colores: ["#034694", "#dba111"], estadio: "Stamford Bridge", ciudad: "Londres" },
  { id: "tot", nombre: "Tottenham", corto: "TOT", pais: "ENG", escudo: esc(47), colores: ["#132257", "#ffffff"], estadio: "Tottenham Hotspur Stadium", ciudad: "Londres" },
  { id: "new", nombre: "Newcastle", corto: "NEW", pais: "ENG", escudo: esc(34), colores: ["#241f20", "#ffffff"], estadio: "St James' Park", ciudad: "Newcastle" },
  { id: "bay", nombre: "Bayern Múnich", corto: "BAY", pais: "GER", escudo: esc(157), colores: ["#dc052d", "#0066b2"], estadio: "Allianz Arena", ciudad: "Múnich" },
  { id: "bvb", nombre: "Borussia Dortmund", corto: "BVB", pais: "GER", escudo: esc(165), colores: ["#fde100", "#000000"], estadio: "Signal Iduna Park", ciudad: "Dortmund" },
  { id: "b04", nombre: "Bayer Leverkusen", corto: "B04", pais: "GER", escudo: esc(168), colores: ["#e32221", "#000000"], estadio: "BayArena", ciudad: "Leverkusen" },
  { id: "sge", nombre: "Eintracht Frankfurt", corto: "SGE", pais: "GER", escudo: esc(169), colores: ["#e1000f", "#000000"], estadio: "Deutsche Bank Park", ciudad: "Fráncfort" },
  { id: "psg", nombre: "Paris Saint-Germain", corto: "PSG", pais: "FRA", escudo: esc(85), colores: ["#004170", "#da291c"], estadio: "Parc des Princes", ciudad: "París" },
  { id: "om", nombre: "Olympique de Marsella", corto: "OM", pais: "FRA", escudo: esc(81), colores: ["#2faee0", "#ffffff"], estadio: "Vélodrome", ciudad: "Marsella" },
  { id: "asm", nombre: "AS Monaco", corto: "ASM", pais: "FRA", escudo: esc(91), colores: ["#e51b22", "#ffffff"], estadio: "Stade Louis II", ciudad: "Mónaco" },
  { id: "int", nombre: "Inter", corto: "INT", pais: "ITA", escudo: esc(505), colores: ["#0068a8", "#000000"], estadio: "San Siro", ciudad: "Milán" },
  { id: "mil", nombre: "AC Milan", corto: "MIL", pais: "ITA", escudo: esc(489), colores: ["#fb090b", "#000000"], estadio: "San Siro", ciudad: "Milán" },
  { id: "juv", nombre: "Juventus", corto: "JUV", pais: "ITA", escudo: esc(496), colores: ["#000000", "#ffffff"], estadio: "Allianz Stadium", ciudad: "Turín" },
  { id: "nap", nombre: "Napoli", corto: "NAP", pais: "ITA", escudo: esc(492), colores: ["#12a0d7", "#ffffff"], estadio: "Diego Armando Maradona", ciudad: "Nápoles" },
  { id: "ata", nombre: "Atalanta", corto: "ATA", pais: "ITA", escudo: esc(499), colores: ["#1e71b8", "#000000"], estadio: "Gewiss Stadium", ciudad: "Bérgamo" },
  { id: "ben", nombre: "Benfica", corto: "BEN", pais: "POR", escudo: esc(211), colores: ["#e83030", "#ffffff"], estadio: "Estádio da Luz", ciudad: "Lisboa" },
  { id: "por", nombre: "Porto", corto: "POR", pais: "POR", escudo: esc(212), colores: ["#00428c", "#ffffff"], estadio: "Estádio do Dragão", ciudad: "Oporto" },
  { id: "scp", nombre: "Sporting CP", corto: "SCP", pais: "POR", escudo: esc(228), colores: ["#008057", "#ffffff"], estadio: "José Alvalade", ciudad: "Lisboa" },
  { id: "psv", nombre: "PSV", corto: "PSV", pais: "NED", escudo: esc(197), colores: ["#ed1c24", "#ffffff"], estadio: "Philips Stadion", ciudad: "Eindhoven" },
  { id: "aja", nombre: "Ajax", corto: "AJA", pais: "NED", escudo: esc(194), colores: ["#d2122e", "#ffffff"], estadio: "Johan Cruijff ArenA", ciudad: "Ámsterdam" },
  { id: "bru", nombre: "Club Brujas", corto: "BRU", pais: "BEL", escudo: esc(569), colores: ["#0067ce", "#000000"], estadio: "Jan Breydel", ciudad: "Brujas" },
  { id: "gal", nombre: "Galatasaray", corto: "GAL", pais: "TUR", escudo: esc(645), colores: ["#a90432", "#fdb912"], estadio: "RAMS Park", ciudad: "Estambul" },
];

const POR_DEFINIR: Equipo = {
  id: "tbd",
  nombre: "Por definir",
  corto: "?",
  pais: "",
  colores: ["#2a347c", "#7d86c7"],
  estadio: "Por definir",
  ciudad: "",
};

/** Hora de Madrid (CET/CEST) a ISO UTC. */
function horaMadrid(fecha: string, hora: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const verano = (y === 2026 && (m < 10 || (m === 10 && d < 25))) || (y === 2027 && (m > 3 || (m === 3 && d >= 28)));
  return new Date(Date.UTC(y, m - 1, d, hh - (verano ? 2 : 1), mm)).toISOString();
}

const JORNADAS: { n: number; dias: string[] }[] = [
  { n: 1, dias: ["2026-09-15", "2026-09-16"] },
  { n: 2, dias: ["2026-09-29", "2026-09-30"] },
  { n: 3, dias: ["2026-10-20", "2026-10-21"] },
  { n: 4, dias: ["2026-11-03", "2026-11-04"] },
  { n: 5, dias: ["2026-11-24", "2026-11-25"] },
  { n: 6, dias: ["2026-12-08", "2026-12-09"] },
  { n: 7, dias: ["2027-01-19", "2027-01-20"] },
  { n: 8, dias: ["2027-01-27"] },
];

const ELIMINATORIAS: { fase: Fase; ronda: string; dias: string[]; porDia: number }[] = [
  { fase: "Play-off", ronda: "Ida", dias: ["2027-02-16", "2027-02-17"], porDia: 2 },
  { fase: "Play-off", ronda: "Vuelta", dias: ["2027-02-23", "2027-02-24"], porDia: 2 },
  { fase: "Octavos", ronda: "Ida", dias: ["2027-03-09", "2027-03-10"], porDia: 2 },
  { fase: "Octavos", ronda: "Vuelta", dias: ["2027-03-16", "2027-03-17"], porDia: 2 },
  { fase: "Cuartos", ronda: "Ida", dias: ["2027-04-06", "2027-04-07"], porDia: 2 },
  { fase: "Cuartos", ronda: "Vuelta", dias: ["2027-04-13", "2027-04-14"], porDia: 2 },
  { fase: "Semifinal", ronda: "Ida", dias: ["2027-04-27", "2027-04-28"], porDia: 1 },
  { fase: "Semifinal", ronda: "Vuelta", dias: ["2027-05-04", "2027-05-05"], porDia: 1 },
];

/** Calendario de ejemplo de la temporada 2026/27 (fase de liga por método de rotación, sin repetir cruces). */
function calendarioEjemplo(): Partido[] {
  const partidos: Partido[] = [];
  const n = EQUIPOS.length;
  for (const j of JORNADAS) {
    const r = j.n - 1;
    const resto = EQUIPOS.slice(1);
    const rotados = [...resto.slice(r % resto.length), ...resto.slice(0, r % resto.length)];
    const lista = [EQUIPOS[0], ...rotados];
    const cruces: [Equipo, Equipo][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i];
      const b = lista[n - 1 - i];
      cruces.push((r + i) % 2 ? [b, a] : [a, b]);
    }
    cruces.forEach(([local, visita], i) => {
      let dia: string;
      let hora: string;
      if (j.dias.length === 1) {
        dia = j.dias[0];
        hora = "21:00";
      } else {
        const primerDia = i < 7;
        dia = primerDia ? j.dias[0] : j.dias[1];
        const k = primerDia ? i : i - 7;
        hora = k < 2 ? "18:45" : "21:00";
      }
      partidos.push({
        id: `j${j.n}-${local.id}-${visita.id}`,
        fase: "Fase de liga",
        jornada: `Jornada ${j.n}`,
        inicio: horaMadrid(dia, hora),
        local,
        visita,
        estadio: local.estadio,
        ciudad: local.ciudad,
        estado: "programado",
      });
    });
  }
  for (const e of ELIMINATORIAS) {
    e.dias.forEach((dia) => {
      for (let k = 0; k < e.porDia; k++) {
        partidos.push({
          id: `${e.fase}-${e.ronda}-${dia}-${k}`.toLowerCase().replace(/\s+/g, "-"),
          fase: e.fase,
          jornada: e.ronda,
          inicio: horaMadrid(dia, k === 0 && e.porDia > 1 ? "18:45" : "21:00"),
          local: POR_DEFINIR,
          visita: POR_DEFINIR,
          estadio: "Por definir",
          ciudad: "",
          estado: "programado",
        });
      }
    });
  }
  partidos.push({
    id: "final-2027",
    fase: "Final",
    jornada: "Final",
    inicio: horaMadrid("2027-05-29", "18:00"),
    local: POR_DEFINIR,
    visita: POR_DEFINIR,
    estadio: "Estadio Metropolitano",
    ciudad: "Madrid",
    estado: "programado",
  });
  return partidos.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Simula el marcador del calendario de ejemplo según la hora actual (determinista: todos ven lo mismo). */
function simular(p: Partido, ahora: number): Partido {
  const t = (ahora - Date.parse(p.inicio)) / 60000;
  if (t < 0) return { ...p, estado: "programado", golesLocal: undefined, golesVisita: undefined, minuto: undefined };
  const h = hash(p.id);
  const totalL = [0, 1, 1, 2, 2, 3, 1, 0, 2, 4][h % 10];
  const totalV = [0, 1, 0, 1, 2, 1, 3, 0, 1, 2][(h >>> 4) % 10];
  const minutos = (cuantos: number, sal: string) =>
    Array.from({ length: cuantos }, (_, i) => 1 + (hash(`${p.id}${sal}${i}`) % 92));
  const golesL = minutos(totalL, "L");
  const golesV = minutos(totalV, "V");
  if (t >= 112) return { ...p, estado: "final", golesLocal: totalL, golesVisita: totalV, minuto: undefined };
  const jugado = t <= 47 ? t : t < 62 ? 45 : Math.min(45 + (t - 62), 95);
  const minuto =
    t <= 47 ? (t > 45 ? "45+" : `${Math.floor(t) + 1}'`) : t < 62 ? "Descanso" : jugado > 90 ? "90+" : `${Math.floor(jugado) + 1}'`;
  return {
    ...p,
    estado: "vivo",
    golesLocal: golesL.filter((m) => m <= jugado).length,
    golesVisita: golesV.filter((m) => m <= jugado).length,
    minuto,
  };
}

/* ────────────────────────────── Utilidades ────────────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 10);

const fmtHora = (iso: string) => new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const fmtDiaLargo = (iso: string) =>
  new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const fmtDiaCorto = (d: Date) => ({
  semana: new Intl.DateTimeFormat("es", { weekday: "short" }).format(d).replace(".", ""),
  dia: d.getDate(),
  mes: new Intl.DateTimeFormat("es", { month: "short" }).format(d).replace(".", ""),
});
const claveDia = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const zonaLocal = () => Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");

function faltan(iso: string, ahora: number): string {
  const min = Math.round((Date.parse(iso) - ahora) / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `en ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "mañana" : `en ${d} días`;
}

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
  }
}

const aBase64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deBase64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

const fechaGoogle = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");

function enlaceGoogleCalendar(titulo: string, inicio: string, lugar: string, detalles: string) {
  const ini = new Date(inicio);
  const fin = new Date(ini.getTime() + 2 * 60 * 60 * 1000);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${fechaGoogle(ini)}/${fechaGoogle(fin)}`,
    details: detalles,
    location: lugar,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Archivo .ics con alarmas 1 día y 1 hora antes: los recordatorios llegan aunque la app esté cerrada. */
function descargarIcs(titulo: string, inicio: string, lugar: string, detalles: string, alarmas: { dia: boolean; hora: boolean }) {
  const ini = new Date(inicio);
  const fin = new Date(ini.getTime() + 2 * 60 * 60 * 1000);
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const alarma = (trigger: string, txt: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(txt)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Previa//Champions//ES",
    "BEGIN:VEVENT",
    `UID:${uid()}@laprevia`,
    `DTSTAMP:${fechaGoogle(new Date())}`,
    `DTSTART:${fechaGoogle(ini)}`,
    `DTEND:${fechaGoogle(fin)}`,
    `SUMMARY:${esc(titulo)}`,
    `LOCATION:${esc(lugar)}`,
    `DESCRIPTION:${esc(detalles)}`,
    ...(alarmas.dia ? alarma("-P1D", `Mañana: ${titulo}`) : []),
    ...(alarmas.hora ? alarma("-PT1H", `En 1 hora: ${titulo}`) : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lineas.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${titulo.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const HASHTAG_OK = /^#[\p{L}\p{N}_]{3,30}$/u;
const limpiarHashtag = (s: string) => `#${s.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`;
const sugerirHashtag = (ciudad: string, existentes: string[]) => {
  const base = limpiarHashtag(`Champions${ciudad.replace(/\s+/g, "")}`).slice(0, 28);
  let tag = base;
  let i = 2;
  const usados = new Set(existentes.map((t) => t.toLowerCase()));
  while (usados.has(tag.toLowerCase())) tag = `${base}${i++}`;
  return tag;
};

const EMOJI: Record<TipoLugar, string> = { bar: "🍺", restaurante: "🌮", casa: "🏠" };
const NOMBRE_TIPO: Record<TipoLugar, string> = { bar: "Bar", restaurante: "Restaurante", casa: "Casa" };

/* ─────────────────────────── Planes de muestra ─────────────────────────── */

const BASE_SEMILLAS: (Omit<Plan, "id" | "partidoId" | "snap" | "chat" | "recordatorios" | "creado"> & { mensajes: [string, string][] })[] = [
  {
    lugar: "La Cantina del Gol", tipo: "bar", pais: "México", estado: "Ciudad de México", ciudad: "Ciudad de México",
    lat: 19.4194, lng: -99.1627, hashtag: "#ChampionsCDMX", anfitrion: "Brian", confirmados: ["Brian", "Sofía", "Diego", "Mariana"],
    mensajes: [["Sofía", "¿Aparto mesa para 6?"], ["Brian", "Sí, junto a la pantalla grande 📺"], ["Diego", "Llego al medio tiempo, guárdenme alitas"]],
  },
  {
    lugar: "Tacos El Güero", tipo: "restaurante", pais: "México", estado: "Jalisco", ciudad: "Guadalajara",
    lat: 20.6736, lng: -103.344, hashtag: "#TacosYUEFA", anfitrion: "Diego", confirmados: ["Diego", "Pau", "Toño"],
    mensajes: [["Toño", "Llevo la bufanda de la suerte 🧣"], ["Pau", "Yo invito las aguas frescas"]],
  },
  {
    lugar: "Casa de Memo", tipo: "casa", pais: "México", estado: "Nuevo León", ciudad: "Monterrey",
    lat: 25.6866, lng: -100.3161, hashtag: "#RegiosChampions", anfitrion: "Memo", confirmados: ["Memo", "Ana"],
    mensajes: [["Memo", "Yo pongo la carne asada, ustedes las bebidas 🔥"]],
  },
  {
    lugar: "Bar El Larguero", tipo: "bar", pais: "España", estado: "Comunidad de Madrid", ciudad: "Madrid",
    lat: 40.4237, lng: -3.7016, hashtag: "#MadridEnLaPrevia", anfitrion: "Lucía", confirmados: ["Lucía", "Javi", "Carmen"],
    mensajes: [["Javi", "Abren a las 20:00, hay que llegar pronto"]],
  },
  {
    lugar: "Parrilla La Gambeta", tipo: "restaurante", pais: "Argentina", estado: "Buenos Aires", ciudad: "Buenos Aires",
    lat: -34.5871, lng: -58.4253, hashtag: "#ChampionsBA", anfitrion: "Nico", confirmados: ["Nico", "Flor", "Brian"],
    mensajes: [["Flor", "¿Quién trae el mate?"]],
  },
  {
    lugar: "Casa de Vale", tipo: "casa", pais: "Colombia", estado: "Bogotá D.C.", ciudad: "Bogotá",
    lat: 4.6533, lng: -74.0836, hashtag: "#ChampionsBogota", anfitrion: "Vale", confirmados: ["Vale", "Santi"],
    mensajes: [["Santi", "Pongo la pantalla del cuarto, se ve brutal"]],
  },
];
function planesDeMuestra(partidos: Partido[], ahora: number): Plan[] {
  const futuros = partidos.filter((p) => p.local.id !== "tbd" && Date.parse(p.inicio) + 112 * 60000 > ahora);
  if (!futuros.length) return [];
  // Preferimos los cruces con más cartel para la muestra.
  const grandes = ["rma", "bar", "mci", "liv", "bay", "psg", "ars", "int"];
  const orden = [...futuros.slice(0, 15)].sort(
    (a, b) =>
      Number(grandes.includes(b.local.id) || grandes.includes(b.visita.id)) -
      Number(grandes.includes(a.local.id) || grandes.includes(a.visita.id)),
  );
  return BASE_SEMILLAS.map(({ mensajes, ...s }, i) => {
    const p = orden[i % orden.length];
    return {
      ...s,
      id: `demo-${i}`,
      partidoId: p.id,
      snap: { local: p.local.nombre, visita: p.visita.nombre, inicio: p.inicio },
      chat: mensajes.map(([autor, texto], k) => ({
        id: uid(),
        autor,
        texto,
        hora: new Date(ahora - (mensajes.length - k) * 17 * 60000).toISOString(),
      })),
      recordatorios: { dia: true, hora: true },
      creado: new Date(ahora).toISOString(),
    };
  });
}

/* ─────────────────────────── Hooks de estado ─────────────────────────── */

function useAhora(desfase: number) {
  const [ahora, setAhora] = useState(() => Date.now() + desfase);
  useEffect(() => {
    setAhora(Date.now() + desfase);
    const t = setInterval(() => setAhora(Date.now() + desfase), 15000);
    return () => clearInterval(t);
  }, [desfase]);
  return ahora;
}

const BASE_EJEMPLO = calendarioEjemplo();

/** Partidos reales si la API responde con suficientes datos; si no, el calendario de ejemplo con marcador simulado. */
function usePartidos(ahora: number) {
  const [reales, setReales] = useState<Partido[] | null>(null);
  const [fuente, setFuente] = useState<Fuente>("cargando");

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch("/api/partidos", { cache: "no-store" });
        const j = (await r.json()) as { partidos: Partido[] };
        if (!vivo) return;
        if (j.partidos?.length >= 8) {
          setReales(j.partidos);
          setFuente("real");
        } else setFuente((f) => (f === "real" ? f : "ejemplo"));
      } catch {
        if (vivo) setFuente((f) => (f === "real" ? f : "ejemplo"));
      }
    };
    cargar();
    const t = setInterval(cargar, 60000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const partidos = useMemo(
    () => (fuente === "real" && reales ? reales : BASE_EJEMPLO.map((p) => simular(p, ahora))),
    [fuente, reales, ahora],
  );
  return { partidos, fuente };
}

/* ─────────────────────────── Piezas visuales ─────────────────────────── */

function Escudo({ equipo, tam = 40 }: { equipo: Equipo; tam?: number }) {
  const [fallo, setFallo] = useState(false);
  if (equipo.escudo && !fallo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={equipo.escudo}
        alt={`Escudo de ${equipo.nombre}`}
        width={tam}
        height={tam}
        loading="lazy"
        onError={() => setFallo(true)}
        className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]"
        style={{ width: tam, height: tam }}
      />
    );
  }
  const [a, b] = equipo.colores;
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 44" className="shrink-0" role="img" aria-label={`Escudo de ${equipo.nombre}`}>
      <defs>
        <clipPath id={`c-${equipo.id}`}>
          <path d="M20 2 36 7v13c0 11-7 18-16 22C11 38 4 31 4 20V7z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c-${equipo.id})`}>
        <rect width="40" height="44" fill={a} />
        <rect x="20" width="20" height="44" fill={b} />
      </g>
      <path d="M20 2 36 7v13c0 11-7 18-16 22C11 38 4 31 4 20V7z" fill="none" stroke="#f2c94c" strokeWidth="2" />
      <text x="20" y="27" textAnchor="middle" fontSize={equipo.corto.length > 2 ? 10 : 14} fontWeight="800" fill="#fff" stroke="#0b0e28" strokeWidth="2.5" paintOrder="stroke">
        {equipo.corto}
      </text>
    </svg>
  );
}

function EtiquetaEstado({ p, ahora }: { p: Partido; ahora: number }) {
  if (p.estado === "vivo")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-vivo/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-vivo">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vivo opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-vivo" />
        </span>
        En vivo · {p.minuto}
      </span>
    );
  if (p.estado === "final")
    return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/60">Final</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-neon">
      <Clock className="h-3 w-3" /> Próximamente · {faltan(p.inicio, ahora)}
    </span>
  );
}

function Marcador({ p, grande = false }: { p: Partido; grande?: boolean }) {
  const cls = grande ? "text-5xl" : "text-3xl";
  if (p.estado === "programado")
    return (
      <div className="text-center">
        <div className={`font-display font-bold leading-none text-white ${grande ? "text-4xl" : "text-2xl"}`}>{fmtHora(p.inicio)}</div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-white/45">hora local</div>
      </div>
    );
  return (
    <motion.div
      key={`${p.golesLocal}-${p.golesVisita}`}
      initial={{ scale: 1.4, color: "#00f0ff" }}
      animate={{ scale: 1, color: p.estado === "vivo" ? "#ffffff" : "rgba(255,255,255,.75)" }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      className={`font-display font-extrabold tabular-nums leading-none ${cls}`}
    >
      {p.golesLocal ?? 0}
      <span className="mx-1.5 text-white/30">:</span>
      {p.golesVisita ?? 0}
    </motion.div>
  );
}

function Boton({
  children,
  onClick,
  tono = "suave",
  className = "",
  href,
  titulo,
  disabled,
  tipo = "button",
}: {
  tipo?: "button" | "submit";
  children: React.ReactNode;
  onClick?: () => void;
  tono?: "neon" | "oro" | "suave" | "vivo";
  className?: string;
  href?: string;
  titulo?: string;
  disabled?: boolean;
}) {
  const estilos = {
    neon: "bg-neon text-noche hover:bg-neon-300 shadow-neon",
    oro: "bg-oro text-noche hover:bg-oro-300",
    suave: "bg-white/[.07] text-white hover:bg-white/[.13] ring-1 ring-white/10",
    vivo: "bg-vivo text-white hover:brightness-110",
  }[tono];
  const base = `inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${estilos} ${className}`;
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={base} title={titulo}>
        {children}
      </a>
    );
  return (
    <button type={tipo} onClick={onClick} className={base} title={titulo} aria-label={titulo} disabled={disabled}>
      {children}
    </button>
  );
}

/* ─────────────────────────── Tarjeta de partido ─────────────────────────── */

function TarjetaPartido({
  p,
  ahora,
  planes,
  onArmar,
  onVerPlan,
  onCompartir,
}: {
  p: Partido;
  ahora: number;
  planes: Plan[];
  onArmar: (p: Partido) => void;
  onVerPlan: (pl: Plan) => void;
  onCompartir: (p: Partido) => void;
}) {
  const tbd = p.local.id === "tbd";
  const titulo = `${p.local.nombre} vs ${p.visita.nombre}`;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        p.estado === "vivo" ? "border-vivo/50 bg-gradient-to-br from-vivo/15 via-noche-800 to-noche-800" : "border-white/10 bg-noche-800/80"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <EtiquetaEstado p={p} ahora={ahora} />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/40">{p.jornada ?? p.fase}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <Escudo equipo={p.local} tam={44} />
          <span className="line-clamp-2 text-sm font-bold leading-tight">{p.local.nombre}</span>
        </div>
        <Marcador p={p} />
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <Escudo equipo={p.visita} tam={44} />
          <span className="line-clamp-2 text-sm font-bold leading-tight">{p.visita.nombre}</span>
        </div>
      </div>

      <p className="mt-3 truncate text-center text-xs text-white/45">
        {p.estadio}
        {p.ciudad ? ` · ${p.ciudad}` : ""}
      </p>

      {planes.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {planes.map((pl) => (
            <button
              key={pl.id}
              onClick={() => onVerPlan(pl)}
              className="shrink-0 rounded-full bg-oro/15 px-2.5 py-1 text-xs font-bold text-oro ring-1 ring-oro/30 transition hover:bg-oro/25"
            >
              {EMOJI[pl.tipo]} {pl.hashtag}
            </button>
          ))}
        </div>
      )}

      {tbd && <p className="mt-3 text-center text-xs font-semibold text-white/40">Los cruces se conocen al terminar la fase anterior.</p>}

      {p.estado !== "final" && !tbd && (
        <div className="mt-3 flex gap-2">
          <Boton tono="neon" className="flex-1" onClick={() => onArmar(p)}>
            <MapPin className="h-4 w-4" /> Armar plan
          </Boton>
          <Boton onClick={() => onCompartir(p)} titulo="Compartir plan" disabled={tbd}>
            <Share2 className="h-4 w-4" />
          </Boton>
          <Boton
            href={tbd ? undefined : enlaceGoogleCalendar(`⚽ ${titulo}`, p.inicio, p.estadio, `${p.fase}${p.jornada ? ` · ${p.jornada}` : ""}`)}
            titulo="Añadir a Google Calendar"
            disabled={tbd}
          >
            <CalendarPlus className="h-4 w-4" />
          </Boton>
        </div>
      )}
    </motion.article>
  );
}

/* ─────────────────────────── Calendario ─────────────────────────── */

function Calendario({
  partidos,
  ahora,
  planes,
  foco,
  onArmar,
  onVerPlan,
  onCompartir,
}: {
  partidos: Partido[];
  ahora: number;
  planes: Plan[];
  foco: string | null;
  onArmar: (p: Partido) => void;
  onVerPlan: (pl: Plan) => void;
  onCompartir: (p: Partido) => void;
}) {
  const proximo = useMemo(
    () => partidos.find((p) => p.estado === "vivo") ?? partidos.find((p) => p.estado === "programado") ?? partidos[partidos.length - 1],
    [partidos],
  );
  const enfocado = foco ? partidos.find((p) => p.id === foco) : undefined;
  const [fase, setFase] = useState<Fase>(enfocado?.fase ?? proximo?.fase ?? "Fase de liga");
  const [dia, setDia] = useState<string>(claveDia((enfocado ?? proximo)?.inicio ?? new Date().toISOString()));
  const tira = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enfocado) return;
    setFase(enfocado.fase);
    setDia(claveDia(enfocado.inicio));
  }, [enfocado]);

  const fases = FASES.filter((f) => partidos.some((p) => p.fase === f));
  const deFase = partidos.filter((p) => p.fase === fase);
  const dias = Array.from(new Set(deFase.map((p) => claveDia(p.inicio))));
  const diaActivo = dias.includes(dia) ? dia : dias.find((d) => d >= claveDia(new Date(ahora).toISOString())) ?? dias[0];
  const delDia = deFase.filter((p) => claveDia(p.inicio) === diaActivo);
  const vivos = partidos.filter((p) => p.estado === "vivo").length;

  useEffect(() => {
    tira.current?.querySelector<HTMLElement>('[data-activo="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [diaActivo, fase]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-white/10 px-4 pb-3 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Calendario</h2>
            <p className="text-xs text-white/50">Horarios en tu zona: {zonaLocal()}</p>
          </div>
          {vivos > 0 && (
            <span className="rounded-full bg-vivo px-2.5 py-1 text-xs font-extrabold uppercase text-white shadow-[0_0_18px_rgba(255,59,107,.55)]">
              {vivos} en vivo
            </span>
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {fases.map((f) => (
            <button
              key={f}
              onClick={() => setFase(f)}
              className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider transition ${
                f === fase ? "text-noche" : "text-white/60 hover:text-white"
              }`}
            >
              {f === fase && <motion.span layoutId="fase-activa" className="absolute inset-0 rounded-full bg-oro" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative inline-flex items-center gap-1">
                {f === "Final" && <Trophy className="h-3.5 w-3.5" />}
                {f}
              </span>
            </button>
          ))}
        </div>

        <div ref={tira} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {dias.map((d) => {
            const fecha = new Date(`${d}T12:00:00`);
            const f = fmtDiaCorto(fecha);
            const ps = deFase.filter((p) => claveDia(p.inicio) === d);
            const enVivo = ps.some((p) => p.estado === "vivo");
            const activo = d === diaActivo;
            const conPlan = ps.some((p) => planes.some((pl) => pl.partidoId === p.id));
            return (
              <motion.button
                key={d}
                data-activo={activo}
                whileTap={{ scale: 0.92 }}
                onClick={() => setDia(d)}
                className={`relative flex w-[60px] shrink-0 flex-col items-center rounded-2xl border py-2 transition ${
                  activo ? "border-neon bg-neon/15 shadow-neon" : "border-white/10 bg-white/[.04] hover:border-white/25"
                }`}
              >
                <span className="text-[10px] font-bold uppercase text-white/50">{f.semana}</span>
                <span className={`font-display text-2xl font-extrabold leading-none ${activo ? "text-neon" : ""}`}>{f.dia}</span>
                <span className="text-[10px] uppercase text-white/50">{f.mes}</span>
                <span className="mt-1 flex gap-0.5">
                  {Array.from({ length: Math.min(ps.length, 4) }).map((_, i) => (
                    <span key={i} className={`h-1 w-1 rounded-full ${enVivo ? "bg-vivo" : "bg-white/40"}`} />
                  ))}
                </span>
                {conPlan && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-noche bg-oro" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-3 lg:pb-6">
        {diaActivo && (
          <p className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-white/50 first-letter:uppercase">
            {fmtDiaLargo(`${diaActivo}T12:00:00`)} · {delDia.length} {delDia.length === 1 ? "partido" : "partidos"}
          </p>
        )}
        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {delDia.map((p) => (
              <TarjetaPartido
                key={p.id}
                p={p}
                ahora={ahora}
                planes={planes.filter((pl) => pl.partidoId === p.id)}
                onArmar={onArmar}
                onVerPlan={onVerPlan}
                onCompartir={onCompartir}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Mapa ─────────────────────────── */

const ICONOS = new Map<string, L.DivIcon>();
function iconoPin(tipo: TipoLugar | "nuevo", color: string, activo: boolean, etiqueta?: string) {
  const clave = `${tipo}-${color}-${activo}-${etiqueta ?? ""}`;
  const guardado = ICONOS.get(clave);
  if (guardado) return guardado;
  const emoji = tipo === "nuevo" ? "⚽" : EMOJI[tipo];
  const html = `
    <div class="pin-cuerpo" style="position:relative;width:44px;height:54px">
      <svg width="44" height="54" viewBox="0 0 44 54"><path d="M22 2C11 2 2 10.6 2 21.4 2 36 22 52 22 52s20-16 20-30.6C42 10.6 33 2 22 2z" fill="${color}" stroke="#0b0e28" stroke-width="3.5" stroke-linejoin="round"/><circle cx="22" cy="21" r="12.5" fill="#fff" stroke="#0b0e28" stroke-width="2.5"/></svg>
      <span style="position:absolute;left:0;top:10px;width:44px;text-align:center;font-size:16px;line-height:22px">${emoji}</span>
      ${
        etiqueta
          ? `<span style="position:absolute;top:56px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#0b0e28;color:#f2c94c;border:2px solid #f2c94c;border-radius:999px;padding:1px 8px;font:800 11px var(--font-cuerpo),sans-serif;box-shadow:2px 2px 0 #06081a">${etiqueta}</span>`
          : ""
      }
    </div>`;
  const icono = L.divIcon({
    html,
    className: `pin-previa ${activo ? "activo" : ""} ${tipo === "nuevo" ? "nuevo" : ""}`,
    iconSize: [44, 54],
    iconAnchor: [22, 52],
  });
  ICONOS.set(clave, icono);
  return icono;
}

function EventosMapa({ modoPin, onElegir }: { modoPin: boolean; onElegir: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (modoPin) onElegir(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ControlMapa({ foco, visible }: { foco: { lat: number; lng: number; zoom: number; n: number } | null; visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (foco) map.flyTo([foco.lat, foco.lng], foco.zoom, { duration: 1.2 });
  }, [foco, map]);
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [visible, map]);
  return null;
}

function Mapa({
  planes,
  partidosPorId,
  yo,
  activo,
  modoPin,
  borrador,
  foco,
  visible,
  estilo,
  onElegir,
  onAbrir,
}: {
  planes: Plan[];
  partidosPorId: Map<string, Partido>;
  yo: string;
  activo: string | null;
  modoPin: boolean;
  borrador: { lat: number; lng: number } | null;
  foco: { lat: number; lng: number; zoom: number; n: number } | null;
  visible: boolean;
  estilo: "caricatura" | "noche";
  onElegir: (lat: number, lng: number) => void;
  onAbrir: (pl: Plan) => void;
}) {
  const color = (pl: Plan) => {
    const p = partidosPorId.get(pl.partidoId);
    if (p?.estado === "vivo") return "#ff3b6b";
    if (p?.estado === "final") return "#7d86c7";
    if (yo && (pl.anfitrion === yo || pl.confirmados.includes(yo))) return "#f2c94c";
    return "#00f0ff";
  };
  return (
    <MapContainer
      center={[24, -45]}
      zoom={3}
      minZoom={2}
      worldCopyJump
      zoomControl={false}
      className={`h-full w-full ${estilo === "caricatura" ? "mapa-caricatura" : "mapa-noche"} ${modoPin ? "cursor-crosshair" : ""}`}
    >
      <TileLayer
        key={estilo}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={
          estilo === "caricatura"
            ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        }
      />
      <EventosMapa modoPin={modoPin} onElegir={onElegir} />
      <ControlMapa foco={foco} visible={visible} />
      {planes.map((pl) => (
        <Marker
          key={pl.id}
          position={[pl.lat, pl.lng]}
          icon={iconoPin(pl.tipo, color(pl), activo === pl.id, activo === pl.id ? pl.hashtag : undefined)}
          eventHandlers={{ click: () => onAbrir(pl) }}
          zIndexOffset={activo === pl.id ? 1000 : 0}
        />
      ))}
      {borrador && <Marker position={[borrador.lat, borrador.lng]} icon={iconoPin("nuevo", "#f2c94c", true)} />}
    </MapContainer>
  );
}

/* ─────────────────────────── Buscador flotante ─────────────────────────── */

function Buscador({
  texto,
  setTexto,
  resultados,
  populares,
  onElegir,
}: {
  texto: string;
  setTexto: (s: string) => void;
  resultados: Plan[];
  populares: string[];
  onElegir: (pl: Plan) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="pointer-events-auto relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-2xl border-2 border-noche bg-white px-3 py-2.5 text-noche shadow-comic">
        <Search className="h-5 w-5 shrink-0 text-noche/60" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Busca #hashtag o el nombre de un amigo"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold placeholder:text-noche/45 focus:outline-none"
          aria-label="Buscar pines por hashtag o amigo"
        />
        {texto && (
          <button onClick={() => setTexto("")} aria-label="Limpiar búsqueda" className="rounded-full p-0.5 hover:bg-noche/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-white/10 bg-noche-800/95 shadow-2xl backdrop-blur"
          >
            {!texto && (
              <div className="flex flex-wrap gap-1.5 p-3">
                {populares.map((t) => (
                  <button
                    key={t}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTexto(t)}
                    className="rounded-full bg-neon/10 px-2.5 py-1 text-xs font-bold text-neon ring-1 ring-neon/30 hover:bg-neon/20"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            {texto && resultados.length === 0 && <p className="p-4 text-sm text-white/60">Nadie se junta con ese hashtag o nombre todavía.</p>}
            {texto &&
              resultados.slice(0, 6).map((pl) => (
                <button
                  key={pl.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onElegir(pl);
                    setAbierto(false);
                  }}
                  className="flex w-full items-center gap-3 border-t border-white/5 px-3 py-2.5 text-left hover:bg-white/5"
                >
                  <span className="text-xl">{EMOJI[pl.tipo]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-oro">{pl.hashtag}</span>
                    <span className="block truncate text-xs text-white/60">
                      {pl.lugar} · {pl.ciudad} · con {pl.confirmados.slice(0, 3).join(", ")}
                    </span>
                  </span>
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────── Formulario del pin ─────────────────────────── */

function Hoja({ children, onCerrar, titulo }: { children: React.ReactNode; onCerrar: () => void; titulo: string }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center lg:items-stretch lg:justify-end">
      <motion.div className="absolute inset-0 bg-noche-950/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar} />
      <motion.section
        role="dialog"
        aria-label={titulo}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t-2 border-neon/40 bg-noche-900 shadow-2xl lg:max-h-none lg:w-[460px] lg:rounded-none lg:border-l-2 lg:border-t-0"
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/20 lg:hidden" />
        <header className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="font-display text-xl font-extrabold uppercase tracking-wide">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </motion.section>
    </div>
  );
}

function Campo({ etiqueta, children, nota }: { etiqueta: string; children: React.ReactNode; nota?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">{etiqueta}</span>
      {children}
      {nota && <span className="mt-1 block text-xs">{nota}</span>}
    </label>
  );
}

const claseInput =
  "w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/30 focus:border-neon focus:outline-none focus:ring-2 focus:ring-neon/30";

function FormularioPin({
  punto,
  partidos,
  partidoInicial,
  hashtagsUsados,
  yo,
  onGuardar,
  onCerrar,
}: {
  punto: { lat: number; lng: number };
  partidos: Partido[];
  partidoInicial: string | null;
  hashtagsUsados: string[];
  yo: string;
  onGuardar: (pl: Plan) => void;
  onCerrar: () => void;
}) {
  const disponibles = partidos.filter((p) => p.estado !== "final" && p.local.id !== "tbd").slice(0, 40);
  const [partidoId, setPartidoId] = useState(partidoInicial && disponibles.some((p) => p.id === partidoInicial) ? partidoInicial : disponibles[0]?.id ?? "");
  const [pais, setPais] = useState("");
  const [estado, setEstado] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [lugar, setLugar] = useState("");
  const [tipo, setTipo] = useState<TipoLugar>("bar");
  const [hashtag, setHashtag] = useState("#");
  const [tocadoTag, setTocadoTag] = useState(false);
  const [anfitrion, setAnfitrion] = useState(yo);
  const [buscando, setBuscando] = useState(true);

  // Prellenado con geocodificación inversa (OpenStreetMap Nominatim); si falla, se llena a mano.
  useEffect(() => {
    let vivo = true;
    setBuscando(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${punto.lat}&lon=${punto.lng}&accept-language=es&zoom=14`)
      .then((r) => r.json())
      .then((j: { address?: Record<string, string> }) => {
        if (!vivo || !j.address) return;
        const a = j.address;
        setPais((v) => v || a.country || "");
        setEstado((v) => v || a.state || a.region || a.province || "");
        setCiudad((v) => v || a.city || a.town || a.village || a.municipality || a.county || "");
      })
      .catch(() => undefined)
      .finally(() => vivo && setBuscando(false));
    return () => {
      vivo = false;
    };
  }, [punto.lat, punto.lng]);

  useEffect(() => {
    if (!tocadoTag && ciudad) setHashtag(sugerirHashtag(ciudad, hashtagsUsados));
  }, [ciudad, tocadoTag, hashtagsUsados]);

  const repetido = hashtagsUsados.some((t) => t.toLowerCase() === hashtag.toLowerCase());
  const tagValido = HASHTAG_OK.test(hashtag) && !repetido;
  const listo = partidoId && pais.trim() && estado.trim() && ciudad.trim() && lugar.trim() && anfitrion.trim() && tagValido;
  const partido = disponibles.find((p) => p.id === partidoId);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo || !partido) return;
    onGuardar({
      id: uid(),
      partidoId,
      snap: { local: partido.local.nombre, visita: partido.visita.nombre, inicio: partido.inicio },
      lat: punto.lat,
      lng: punto.lng,
      pais: pais.trim(),
      estado: estado.trim(),
      ciudad: ciudad.trim(),
      lugar: lugar.trim(),
      tipo,
      hashtag,
      anfitrion: anfitrion.trim(),
      confirmados: [anfitrion.trim()],
      chat: [],
      recordatorios: { dia: true, hora: true },
      creado: new Date().toISOString(),
    });
  };

  return (
    <Hoja titulo="Nuevo pin" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4 pb-2">
        <Campo etiqueta="¿Qué partido van a ver?">
          <select value={partidoId} onChange={(e) => setPartidoId(e.target.value)} className={claseInput}>
            {disponibles.map((p) => (
              <option key={p.id} value={p.id} className="bg-noche">
                {p.estado === "vivo" ? "🔴 " : ""}
                {p.local.nombre} vs {p.visita.nombre} · {new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(p.inicio))} {fmtHora(p.inicio)}
              </option>
            ))}
          </select>
        </Campo>

        {partido && (
          <div className="flex items-center justify-center gap-4 rounded-2xl bg-white/[.04] py-3">
            <Escudo equipo={partido.local} tam={36} />
            <span className="font-display text-lg font-bold text-white/60">VS</span>
            <Escudo equipo={partido.visita} tam={36} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="País">
            <input value={pais} onChange={(e) => setPais(e.target.value)} className={claseInput} placeholder={buscando ? "Buscando…" : "México"} />
          </Campo>
          <Campo etiqueta="Estado">
            <input value={estado} onChange={(e) => setEstado(e.target.value)} className={claseInput} placeholder={buscando ? "Buscando…" : "Jalisco"} />
          </Campo>
        </div>
        <Campo etiqueta="Ciudad">
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={claseInput} placeholder={buscando ? "Buscando…" : "Guadalajara"} />
        </Campo>

        <Campo etiqueta="¿Dónde se juntan?">
          <div className="mb-2 grid grid-cols-3 gap-2">
            {(Object.keys(EMOJI) as TipoLugar[]).map((t) => (
              <motion.button
                key={t}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setTipo(t)}
                className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs font-bold transition ${
                  tipo === t ? "border-oro bg-oro/15 text-oro" : "border-white/10 bg-white/[.04] text-white/70"
                }`}
              >
                <span className="text-xl">{EMOJI[t]}</span>
                {NOMBRE_TIPO[t]}
              </motion.button>
            ))}
          </div>
          <input
            value={lugar}
            onChange={(e) => setLugar(e.target.value)}
            className={claseInput}
            placeholder={tipo === "casa" ? "Casa de Memo" : tipo === "bar" ? "La Cantina del Gol" : "Tacos El Güero"}
          />
        </Campo>

        <Campo
          etiqueta="Hashtag del pin"
          nota={
            repetido ? (
              <span className="text-vivo">Ese hashtag ya existe, prueba otro.</span>
            ) : !HASHTAG_OK.test(hashtag) ? (
              <span className="text-white/50">De 3 a 30 letras o números, sin espacios. Ej: #TacosYUEFA</span>
            ) : (
              <span className="text-neon">¡Disponible! Tus amigos lo usarán para encontrarte.</span>
            )
          }
        >
          <div className="relative">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-oro" />
            <input
              value={hashtag.replace(/^#/, "")}
              onChange={(e) => {
                setTocadoTag(true);
                setHashtag(limpiarHashtag(e.target.value));
              }}
              className={`${claseInput} pl-9 font-extrabold text-oro`}
              placeholder="ChampionsCDMX"
            />
          </div>
        </Campo>

        <Campo etiqueta="Anfitrión">
          <input value={anfitrion} onChange={(e) => setAnfitrion(e.target.value)} className={claseInput} placeholder="Tu nombre" />
        </Campo>

        <Boton tipo="submit" tono="neon" className="w-full py-3 text-base" disabled={!listo}>
          <MapPin className="h-5 w-5" /> Clavar pin
        </Boton>
      </form>
    </Hoja>
  );
}

/* ─────────────────────────── Detalle del plan ─────────────────────────── */

function DetallePlan({
  plan,
  partido,
  ahora,
  yo,
  permisoAvisos,
  onPedirNombre,
  onActualizar,
  onCompartir,
  onPedirPermiso,
  onCerrar,
}: {
  plan: Plan;
  partido?: Partido;
  ahora: number;
  yo: string;
  permisoAvisos: NotificationPermission | "no-soportado";
  onPedirNombre: (luego: (nombre: string) => void) => void;
  onActualizar: (pl: Plan) => void;
  onCompartir: (pl: Plan) => void;
  onPedirPermiso: () => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const fin = useRef<HTMLDivElement>(null);
  const voy = !!yo && plan.confirmados.includes(yo);
  const inicio = partido?.inicio ?? plan.snap.inicio;
  const titulo = `${partido?.local.nombre ?? plan.snap.local} vs ${partido?.visita.nombre ?? plan.snap.visita}`;
  const direccion = `${plan.lugar}, ${plan.ciudad}, ${plan.estado}, ${plan.pais}`;
  const detalles = `Plan ${plan.hashtag} con ${plan.confirmados.join(", ")}. Organiza: ${plan.anfitrion}.`;

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [plan.chat.length]);

  const alternarVoy = () =>
    onPedirNombre((nombre) =>
      onActualizar({
        ...plan,
        confirmados: plan.confirmados.includes(nombre) ? plan.confirmados.filter((n) => n !== nombre) : [...plan.confirmados, nombre],
      }),
    );

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    onPedirNombre((nombre) => {
      onActualizar({ ...plan, chat: [...plan.chat, { id: uid(), autor: nombre, texto: t, hora: new Date().toISOString() }] });
      setTexto("");
    });
  };

  return (
    <Hoja titulo={plan.hashtag} onCerrar={onCerrar}>
      <div className="space-y-5 pb-2">
        {/* Partido */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-noche-700 to-noche-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            {partido ? <EtiquetaEstado p={partido} ahora={ahora} /> : <span className="text-xs text-white/50">{fmtDiaLargo(inicio)}</span>}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{partido?.jornada ?? partido?.fase}</span>
          </div>
          {partido ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex flex-col items-center gap-1 text-center">
                <Escudo equipo={partido.local} tam={52} />
                <span className="text-sm font-bold leading-tight">{partido.local.nombre}</span>
              </div>
              <Marcador p={partido} grande />
              <div className="flex flex-col items-center gap-1 text-center">
                <Escudo equipo={partido.visita} tam={52} />
                <span className="text-sm font-bold leading-tight">{partido.visita.nombre}</span>
              </div>
            </div>
          ) : (
            <p className="text-center font-display text-2xl font-bold">{titulo}</p>
          )}
          <p className="mt-3 text-center text-xs text-white/50 first-letter:uppercase">
            {fmtDiaLargo(inicio)} · {fmtHora(inicio)}
          </p>
        </div>

        {/* Lugar */}
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-oro/15 text-2xl ring-1 ring-oro/30">{EMOJI[plan.tipo]}</span>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-tight">{plan.lugar}</p>
            <p className="text-sm text-white/60">
              {plan.ciudad}, {plan.estado} · {plan.pais}
            </p>
            <p className="mt-0.5 text-xs text-white/40">Organiza {plan.anfitrion}</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2">
          <Boton tono="neon" onClick={() => onCompartir(plan)}>
            <Share2 className="h-4 w-4" /> Compartir plan
          </Boton>
          <Boton tono="oro" href={enlaceGoogleCalendar(`⚽ ${titulo} · ${plan.hashtag}`, inicio, direccion, detalles)}>
            <CalendarPlus className="h-4 w-4" /> Google Calendar
          </Boton>
        </div>

        {/* Recordatorios */}
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold">
              <BellRing className="h-4 w-4 text-neon" /> Recordatorios
            </p>
            {permisoAvisos !== "granted" && permisoAvisos !== "no-soportado" && (
              <button onClick={onPedirPermiso} className="text-xs font-bold text-neon underline-offset-2 hover:underline">
                Activar avisos
              </button>
            )}
          </div>
          {(
            [
              ["dia", "1 día antes"],
              ["hora", "1 hora antes"],
            ] as const
          ).map(([k, txt]) => {
            const on = plan.recordatorios[k];
            return (
              <button
                key={k}
                onClick={() => onActualizar({ ...plan, recordatorios: { ...plan.recordatorios, [k]: !on } })}
                className="flex w-full items-center justify-between py-1.5 text-sm"
                role="switch"
                aria-checked={on}
              >
                <span className="text-white/80">{txt}</span>
                <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-neon" : "bg-white/15"}`}>
                  <motion.span layout className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${on ? "right-0.5" : "left-0.5"}`} />
                </span>
              </button>
            );
          })}
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Te avisamos aquí mientras la app esté abierta. Para que te llegue aunque la cierres, descarga el evento con alarmas.
          </p>
          <button
            onClick={() => descargarIcs(`⚽ ${titulo} · ${plan.hashtag}`, inicio, direccion, detalles, plan.recordatorios)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-oro hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Descargar .ics con alarmas
          </button>
        </div>

        {/* Confirmados */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-neon" /> Confirmados ({plan.confirmados.length})
            </p>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={alternarVoy}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                voy ? "bg-neon text-noche" : "bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              {voy ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {voy ? "Voy" : "¡Me apunto!"}
            </motion.button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence>
              {plan.confirmados.map((n) => (
                <motion.span
                  key={n}
                  layout
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-bold ${
                    n === yo ? "bg-oro/20 text-oro" : "bg-white/[.07] text-white/85"
                  }`}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-noche-600 text-[10px] font-extrabold">{n[0]?.toUpperCase()}</span>
                  {n}
                  {n === plan.anfitrion && <span className="text-[10px] text-white/40">anfitrión</span>}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Chat */}
        <div className="rounded-2xl border border-white/10 bg-noche-950/50">
          <p className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-bold">
            <MessageCircle className="h-4 w-4 text-neon" /> Chat rápido
          </p>
          <div className="max-h-60 space-y-2 overflow-y-auto p-3">
            {plan.chat.length === 0 && <p className="py-4 text-center text-xs text-white/40">Sin mensajes. ¡Rompe el hielo!</p>}
            {plan.chat.map((m) => {
              const mio = m.autor === yo;
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mio ? "rounded-br-md bg-neon text-noche" : "rounded-bl-md bg-white/[.08]"}`}>
                    {!mio && <p className="text-[11px] font-extrabold text-oro">{m.autor}</p>}
                    <p className="font-medium">{m.texto}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${mio ? "text-noche/60" : "text-white/40"}`}>{fmtHora(m.hora)}</p>
                  </div>
                </motion.div>
              );
            })}
            <div ref={fin} />
          </div>
          <form onSubmit={enviar} className="flex gap-2 border-t border-white/10 p-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe al grupo…" className={`${claseInput} py-2`} aria-label="Mensaje" />
            <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon text-noche transition active:scale-90 disabled:opacity-40" disabled={!texto.trim()} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] text-white/35">Los pines, confirmados y el chat se guardan en este dispositivo.</p>
      </div>
    </Hoja>
  );
}

/* ─────────────────────────── Lista de planes ─────────────────────────── */

function ListaPlanes({
  planes,
  partidosPorId,
  ahora,
  yo,
  onAbrir,
  onNuevo,
}: {
  planes: Plan[];
  partidosPorId: Map<string, Partido>;
  ahora: number;
  yo: string;
  onAbrir: (pl: Plan) => void;
  onNuevo: () => void;
}) {
  const [soloMios, setSoloMios] = useState(false);
  const lista = planes
    .filter((pl) => !soloMios || (yo && (pl.anfitrion === yo || pl.confirmados.includes(yo))))
    .sort((a, b) => (partidosPorId.get(a.partidoId)?.inicio ?? a.snap.inicio).localeCompare(partidosPorId.get(b.partidoId)?.inicio ?? b.snap.inicio));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end justify-between border-b border-white/10 px-4 pb-3 pt-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Planes</h2>
          <p className="text-xs text-white/50">{planes.length} pines en el mapa</p>
        </div>
        <div className="flex rounded-full bg-white/[.06] p-1 text-xs font-bold">
          {[false, true].map((v) => (
            <button key={String(v)} onClick={() => setSoloMios(v)} className={`rounded-full px-3 py-1 transition ${soloMios === v ? "bg-neon text-noche" : "text-white/60"}`}>
              {v ? "Míos" : "Todos"}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-28 pt-3 lg:pb-6">
        {lista.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center">
            <p className="text-sm text-white/60">{soloMios ? "Aún no te apuntas a ningún plan." : "Todavía no hay pines."}</p>
            <Boton tono="neon" className="mt-3" onClick={onNuevo}>
              <Plus className="h-4 w-4" /> Poner mi pin
            </Boton>
          </div>
        )}
        {lista.map((pl) => {
          const p = partidosPorId.get(pl.partidoId);
          const inicio = p?.inicio ?? pl.snap.inicio;
          return (
            <motion.button
              key={pl.id}
              layout
              whileTap={{ scale: 0.98 }}
              onClick={() => onAbrir(pl)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-noche-800/80 p-3 text-left transition hover:border-neon/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.06] text-xl">{EMOJI[pl.tipo]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-extrabold text-oro">{pl.hashtag}</span>
                  {p?.estado === "vivo" && <span className="rounded bg-vivo px-1.5 text-[10px] font-extrabold uppercase">Vivo</span>}
                </span>
                <span className="block truncate text-sm font-semibold">
                  {p?.local.nombre ?? pl.snap.local} vs {p?.visita.nombre ?? pl.snap.visita}
                </span>
                <span className="block truncate text-xs text-white/50">
                  {pl.lugar} · {pl.ciudad} · {p?.estado === "final" ? "terminado" : p?.estado === "vivo" ? "ahora" : faltan(inicio, ahora)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-white/60">
                <Users className="h-3.5 w-3.5" />
                {pl.confirmados.length}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Modales menores ─────────────────────────── */

function ModalNombre({ onListo, onCerrar }: { onListo: (n: string) => void; onCerrar: () => void }) {
  const [n, setN] = useState("");
  return (
    <div className="fixed inset-0 z-[1300] grid place-items-center p-4">
      <motion.div className="absolute inset-0 bg-noche-950/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar} />
      <motion.form
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (n.trim()) onListo(n.trim());
        }}
        className="relative w-full max-w-sm rounded-3xl border-2 border-oro/50 bg-noche-800 p-6 shadow-2xl"
      >
        <UserRound className="mb-3 h-8 w-8 text-oro" />
        <h3 className="font-display text-2xl font-extrabold uppercase">¿Cómo te dicen?</h3>
        <p className="mb-4 text-sm text-white/60">Así te verán tus amigos en los confirmados y el chat.</p>
        <input autoFocus value={n} onChange={(e) => setN(e.target.value)} className={claseInput} placeholder="Brian" maxLength={24} />
        <Boton tipo="submit" tono="oro" className="mt-4 w-full" disabled={!n.trim()}>
          Listo
        </Boton>
      </motion.form>
    </div>
  );
}

function ModalCompartir({ mensaje, url, onCerrar, onCopiado }: { mensaje: string; url: string; onCerrar: () => void; onCopiado: () => void }) {
  const completo = `${mensaje}\n${url}`;
  return (
    <Hoja titulo="Compartir plan" onCerrar={onCerrar}>
      <div className="space-y-4 pb-2">
        <div className="rounded-2xl bg-white p-4 text-noche shadow-comic">
          <p className="whitespace-pre-line text-base font-bold">{mensaje}</p>
          <p className="mt-2 break-all text-xs font-semibold text-blue-700">{url}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Boton href={`https://wa.me/?text=${encodeURIComponent(completo)}`} tono="neon">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Boton>
          <Boton
            onClick={() => {
              navigator.clipboard?.writeText(completo).then(onCopiado, onCopiado);
            }}
          >
            <Copy className="h-4 w-4" /> Copiar enlace
          </Boton>
          <Boton href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(mensaje)}`}>Telegram</Boton>
          <Boton href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(completo)}`}>X / Twitter</Boton>
        </div>
        <p className="text-xs text-white/45">Quien abra el enlace verá el plan con su pin en el mapa y podrá apuntarse.</p>
      </div>
    </Hoja>
  );
}

/* ─────────────────────────── App principal ─────────────────────────── */

export default function LaPrevia() {
  const [desfase, setDesfase] = useState(0);
  const ahora = useAhora(desfase);
  const { partidos, fuente } = usePartidos(ahora);
  const partidosPorId = useMemo(() => new Map(partidos.map((p) => [p.id, p])), [partidos]);

  const [planes, setPlanes] = useState<Plan[]>([]);
  const [yo, setYo] = useState("");
  const [vista, setVista] = useState<Vista>("mapa");
  const [busqueda, setBusqueda] = useState("");
  const [modoPin, setModoPin] = useState(false);
  const [borrador, setBorrador] = useState<{ lat: number; lng: number } | null>(null);
  const [partidoPin, setPartidoPin] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [foco, setFoco] = useState<{ lat: number; lng: number; zoom: number; n: number } | null>(null);
  const [focoPartido, setFocoPartido] = useState<string | null>(null);
  const [estiloMapa, setEstiloMapa] = useState<"caricatura" | "noche">("caricatura");
  const [compartir, setCompartir] = useState<{ mensaje: string; url: string } | null>(null);
  const [pedirNombre, setPedirNombre] = useState<((n: string) => void) | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">("default");
  const listo = useRef(false);

  const avisar = useCallback((a: Omit<Aviso, "id">) => {
    const id = uid();
    setAvisos((xs) => [...xs, { ...a, id }]);
    setTimeout(() => setAvisos((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);

  // Carga inicial: datos guardados, planes de muestra y enlaces compartidos.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let des = 0;
    if (params.get("demo") === "vivo") {
      // Modo demostración: adelanta el reloj al siguiente partido para ver el marcador en vivo.
      const sig = BASE_EJEMPLO.find((p) => Date.parse(p.inicio) > Date.now() && p.local.id !== "tbd");
      if (sig) des = Date.parse(sig.inicio) + 38 * 60000 - Date.now();
      setDesfase(des);
    }
    const guardados = leer<Plan[] | null>("previa:planes", null);
    let iniciales = guardados ?? planesDeMuestra(BASE_EJEMPLO.map((p) => simular(p, Date.now() + des)), Date.now() + des);
    setYo(leer<string>("previa:yo", ""));
    setPermiso(typeof Notification === "undefined" ? "no-soportado" : Notification.permission);

    const compartido = params.get("plan");
    if (compartido) {
      try {
        const pl = JSON.parse(deBase64(compartido)) as Plan;
        if (pl?.id && typeof pl.lat === "number") {
          const ya = iniciales.find((x) => x.id === pl.id);
          if (!ya) iniciales = [...iniciales, { ...pl, chat: pl.chat ?? [] }];
          setAbierto(pl.id);
          setFoco({ lat: pl.lat, lng: pl.lng, zoom: 12, n: Date.now() });
          setTimeout(() => avisar({ titulo: `Te invitaron a ${pl.hashtag}`, texto: `${pl.snap.local} vs ${pl.snap.visita} en ${pl.lugar}`, tono: "oro" }), 400);
        }
      } catch {
        /* enlace dañado: se ignora */
      }
    }
    const partidoCompartido = params.get("partido");
    if (partidoCompartido) {
      setFocoPartido(partidoCompartido);
      setVista("partidos");
    }
    if (compartido || partidoCompartido) window.history.replaceState(null, "", window.location.pathname + (params.get("demo") ? "?demo=vivo" : ""));
    setPlanes(iniciales);
    listo.current = true;
  }, [avisar]);

  useEffect(() => {
    if (listo.current) guardar("previa:planes", planes);
  }, [planes]);

  // Sincroniza entre pestañas abiertas del mismo dispositivo.
  useEffect(() => {
    const f = (e: StorageEvent) => {
      if (e.key === "previa:planes" && e.newValue) setPlanes(JSON.parse(e.newValue) as Plan[]);
    };
    window.addEventListener("storage", f);
    return () => window.removeEventListener("storage", f);
  }, []);

  // Recordatorios automáticos: 1 día y 1 hora antes del partido de cada plan.
  // Solo avisa si el momento pasó hace poco (ventana de 20 min), para no disparar avisos viejos al abrir la app.
  useEffect(() => {
    if (!listo.current) return;
    const avisados = new Set(leer<string[]>("previa:avisados", []));
    const pendientes: { pl: Plan; cuando: string; clave: string; k: keyof Plan["recordatorios"] }[] = [];
    for (const pl of planes) {
      const inicio = Date.parse(partidosPorId.get(pl.partidoId)?.inicio ?? pl.snap.inicio);
      if (ahora >= inicio) continue;
      const reglas: [keyof Plan["recordatorios"], number, string][] = [
        ["dia", 24 * 60, "Mañana"],
        ["hora", 60, "En 1 hora"],
      ];
      for (const [k, min, cuando] of reglas) {
        const clave = `${pl.id}:${k}:${inicio}`;
        const momento = inicio - min * 60000;
        if (!pl.recordatorios[k] || avisados.has(clave) || ahora < momento) continue;
        avisados.add(clave);
        if (ahora - momento <= 20 * 60000) pendientes.push({ pl, cuando, clave, k });
      }
    }
    guardar("previa:avisados", [...avisados].slice(-300));
    if (!pendientes.length) return;
    const urgente = pendientes.some((x) => x.k === "hora");
    if (pendientes.length === 1) {
      const { pl, cuando } = pendientes[0];
      avisar({ titulo: `⏰ ${cuando} juega la Champions`, texto: `${pl.snap.local} vs ${pl.snap.visita} · ${pl.lugar} ${pl.hashtag}`, tono: urgente ? "vivo" : "neon" });
    } else {
      avisar({ titulo: `⏰ Tienes ${pendientes.length} planes de Champions pronto`, texto: pendientes.map((x) => x.pl.hashtag).join(" · "), tono: urgente ? "vivo" : "neon" });
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      for (const { pl, cuando, clave } of pendientes) {
        try {
          new Notification(`${cuando}: ${pl.snap.local} vs ${pl.snap.visita}`, { body: `${pl.lugar}, ${pl.ciudad} ${pl.hashtag}`, icon: "/icon.svg", tag: clave });
        } catch {
          /* algunos móviles solo permiten avisos desde un service worker */
        }
      }
    }
  }, [ahora, planes, partidosPorId, avisar]);

  const pedirPermiso = async () => {
    if (typeof Notification === "undefined") return;
    const r = await Notification.requestPermission();
    setPermiso(r);
    avisar(r === "granted" ? { titulo: "Avisos activados", texto: "Te avisaremos 1 día y 1 hora antes.", tono: "neon" } : { titulo: "Avisos bloqueados", texto: "Puedes activarlos en los ajustes del navegador." });
  };

  const conNombre = (luego: (n: string) => void) => {
    if (yo) luego(yo);
    else setPedirNombre(() => luego);
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase().replace(/^#/, "");
    if (!q) return planes;
    return planes.filter(
      (pl) =>
        pl.hashtag.toLowerCase().includes(q) ||
        pl.anfitrion.toLowerCase().includes(q) ||
        pl.confirmados.some((n) => n.toLowerCase().includes(q)) ||
        pl.lugar.toLowerCase().includes(q) ||
        pl.ciudad.toLowerCase().includes(q),
    );
  }, [planes, busqueda]);

  const populares = useMemo(() => [...planes].sort((a, b) => b.confirmados.length - a.confirmados.length).slice(0, 6).map((p) => p.hashtag), [planes]);
  const planAbierto = planes.find((p) => p.id === abierto);
  const vivos = partidos.filter((p) => p.estado === "vivo");

  const abrirPlan = (pl: Plan) => {
    setAbierto(pl.id);
    setFoco({ lat: pl.lat, lng: pl.lng, zoom: 12, n: Date.now() });
  };

  const empezarPin = (partidoId: string | null = null) => {
    setPartidoPin(partidoId);
    setModoPin(true);
    setVista("mapa");
    setAbierto(null);
  };

  const elegirPunto = (lat: number, lng: number) => {
    setBorrador({ lat, lng });
    setModoPin(false);
  };

  const miUbicacion = () => {
    if (!navigator.geolocation) return avisar({ titulo: "Tu navegador no comparte ubicación" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFoco({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 14, n: Date.now() });
        if (modoPin) elegirPunto(pos.coords.latitude, pos.coords.longitude);
      },
      () => avisar({ titulo: "No pudimos obtener tu ubicación" }),
    );
  };

  const guardarPin = (pl: Plan) => {
    setPlanes((xs) => [...xs, pl]);
    setBorrador(null);
    setAbierto(pl.id);
    if (!yo) {
      setYo(pl.anfitrion);
      guardar("previa:yo", pl.anfitrion);
    }
    avisar({ titulo: `¡Pin clavado! ${pl.hashtag}`, texto: "Compártelo para que tus amigos se apunten.", tono: "oro" });
  };

  const actualizar = (pl: Plan) => setPlanes((xs) => xs.map((x) => (x.id === pl.id ? pl : x)));

  const compartirTexto = async (mensaje: string, url: string) => {
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "La Previa", text: mensaje, url });
        return;
      } catch {
        /* el usuario canceló: mostramos las opciones */
      }
    }
    setCompartir({ mensaje, url });
  };

  const compartirPlan = (pl: Plan) => {
    const p = partidosPorId.get(pl.partidoId);
    const a = p?.local.nombre ?? pl.snap.local;
    const b = p?.visita.nombre ?? pl.snap.visita;
    const ligero = { ...pl, chat: [] };
    const url = `${window.location.origin}/?plan=${aBase64(JSON.stringify(ligero))}`;
    compartirTexto(`¿Qué plan para ${a} vs ${b}? ⚽\n📍 ${pl.lugar}, ${pl.ciudad} · ${pl.hashtag}\n🕘 ${fmtDiaLargo(p?.inicio ?? pl.snap.inicio)}, ${fmtHora(p?.inicio ?? pl.snap.inicio)}`, url);
  };

  const compartirPartido = (p: Partido) => {
    const url = `${window.location.origin}/?partido=${encodeURIComponent(p.id)}`;
    compartirTexto(`¿Qué plan para ${p.local.nombre} vs ${p.visita.nombre}? ⚽\n🕘 ${fmtDiaLargo(p.inicio)}, ${fmtHora(p.inicio)}`, url);
  };

  const panelLateral =
    vista === "planes" ? (
      <ListaPlanes planes={planes} partidosPorId={partidosPorId} ahora={ahora} yo={yo} onAbrir={(pl) => (abrirPlan(pl), window.innerWidth < 1024 && setVista("mapa"))} onNuevo={() => empezarPin()} />
    ) : (
      <Calendario
        partidos={partidos}
        ahora={ahora}
        planes={planes}
        foco={focoPartido}
        onArmar={(p) => empezarPin(p.id)}
        onVerPlan={(pl) => (abrirPlan(pl), window.innerWidth < 1024 && setVista("mapa"))}
        onCompartir={compartirPartido}
      />
    );

  return (
    <div className="cielo flex h-dvh flex-col overflow-hidden">
      {/* Encabezado */}
      <header className="z-[1000] flex items-center gap-3 border-b border-white/10 bg-noche/80 px-4 py-2.5 backdrop-blur pt-[max(.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <motion.div whileHover={{ rotate: 20 }} className="grid h-9 w-9 place-items-center rounded-xl bg-neon text-noche shadow-neon">
            <Sparkles className="h-5 w-5" />
          </motion.div>
          <div className="leading-none">
            <p className="font-display text-xl font-extrabold uppercase tracking-wide">
              La <span className="text-neon">Previa</span>
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-oro">Champions con tus amigos</p>
          </div>
        </div>

        {vivos.length > 0 && (
          <button
            onClick={() => {
              setFocoPartido(vivos[0].id);
              setVista("partidos");
            }}
            className="no-scrollbar ml-2 hidden max-w-[40vw] items-center gap-3 overflow-x-auto rounded-full bg-vivo/15 px-3 py-1.5 ring-1 ring-vivo/40 md:flex"
          >
            <Radio className="h-4 w-4 shrink-0 animate-pulse text-vivo" />
            {vivos.slice(0, 3).map((p) => (
              <span key={p.id} className="shrink-0 text-xs font-bold">
                {p.local.corto} <span className="tabular-nums text-neon">{p.golesLocal}-{p.golesVisita}</span> {p.visita.corto}
                <span className="ml-1 text-white/50">{p.minuto}</span>
              </span>
            ))}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span
            title={fuente === "real" ? "Partidos reales desde TheSportsDB" : "Calendario de ejemplo 2026/27 con marcador simulado"}
            className={`hidden rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider sm:inline ${
              fuente === "real" ? "bg-neon/15 text-neon" : "bg-oro/15 text-oro"
            }`}
          >
            {fuente === "real" ? "Datos en vivo" : fuente === "cargando" ? "Cargando…" : "Datos de ejemplo"}
          </span>
          <button
            onClick={pedirPermiso}
            className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ring-white/10 transition hover:bg-white/10 ${permiso === "granted" ? "text-neon" : "text-white/70"}`}
            aria-label="Activar recordatorios"
            title={permiso === "granted" ? "Recordatorios activados" : "Activar recordatorios"}
          >
            {permiso === "granted" ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setPedirNombre(() => (n: string) => n)}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white/[.07] px-2.5 text-sm font-bold ring-1 ring-white/10 hover:bg-white/10"
          >
            <UserRound className="h-4 w-4 text-oro" />
            <span className="max-w-[80px] truncate">{yo || "Entrar"}</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Mapa */}
        <section className={`${vista === "mapa" ? "flex" : "hidden"} relative min-w-0 flex-1 lg:flex`}>
          <Mapa
            planes={filtrados}
            partidosPorId={partidosPorId}
            yo={yo}
            activo={abierto}
            modoPin={modoPin}
            borrador={borrador}
            foco={foco}
            visible={vista === "mapa"}
            estilo={estiloMapa}
            onElegir={elegirPunto}
            onAbrir={abrirPlan}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col items-center gap-2 p-3">
            <Buscador texto={busqueda} setTexto={setBusqueda} resultados={filtrados} populares={populares} onElegir={abrirPlan} />
            {busqueda && (
              <span className="pointer-events-auto rounded-full bg-noche/90 px-3 py-1 text-xs font-bold text-white/80 ring-1 ring-white/15">
                {filtrados.length} {filtrados.length === 1 ? "pin" : "pines"} encontrados
              </span>
            )}
          </div>

          <div className="absolute left-3 top-20 z-[500] flex flex-col gap-2">
            <button
              onClick={() => setEstiloMapa((e) => (e === "caricatura" ? "noche" : "caricatura"))}
              className="grid h-10 w-10 place-items-center rounded-xl border-2 border-noche bg-white text-noche shadow-comic transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              aria-label="Cambiar estilo del mapa"
              title={estiloMapa === "caricatura" ? "Mapa de noche" : "Mapa caricatura"}
            >
              <Layers className="h-5 w-5" />
            </button>
            <button
              onClick={miUbicacion}
              className="grid h-10 w-10 place-items-center rounded-xl border-2 border-noche bg-white text-noche shadow-comic transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              aria-label="Ir a mi ubicación"
              title="Mi ubicación"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          </div>

          <AnimatePresence>
            {modoPin && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="absolute inset-x-3 top-[4.5rem] z-[600] mx-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-noche bg-oro p-3 text-noche shadow-comic"
              >
                <motion.span animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-2xl">
                  📍
                </motion.span>
                <p className="flex-1 text-sm font-extrabold leading-tight">Toca el mapa donde se van a juntar</p>
                <button onClick={miUbicacion} className="rounded-lg bg-noche px-2 py-1.5 text-xs font-bold text-oro">
                  Aquí estoy
                </button>
                <button onClick={() => setModoPin(false)} aria-label="Cancelar" className="rounded-lg p-1 hover:bg-noche/10">
                  <X className="h-5 w-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!modoPin && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.9, rotate: -8 }}
              onClick={() => empezarPin()}
              className="absolute bottom-24 right-4 z-[500] flex items-center gap-2 rounded-2xl border-2 border-noche bg-neon px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wide text-noche shadow-comic lg:bottom-6"
            >
              <MapPin className="h-5 w-5" /> Poner mi pin
            </motion.button>
          )}

          <div className="absolute bottom-24 left-3 z-[500] hidden rounded-xl bg-noche/85 p-2.5 text-[11px] font-semibold ring-1 ring-white/10 backdrop-blur sm:block lg:bottom-6">
            {[
              ["#00f0ff", "Próximo"],
              ["#ff3b6b", "En vivo"],
              ["#f2c94c", "Voy yo"],
              ["#7d86c7", "Terminado"],
            ].map(([c, t]) => (
              <span key={t} className="flex items-center gap-1.5 py-0.5">
                <span className="h-2.5 w-2.5 rounded-full border border-noche" style={{ background: c }} />
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* Panel lateral (escritorio) / vista completa (móvil) */}
        <aside className={`${vista === "mapa" ? "hidden" : "flex"} min-h-0 w-full flex-col border-white/10 bg-noche/70 backdrop-blur lg:flex lg:w-[440px] lg:border-l`}>
          <div className="hidden gap-1 border-b border-white/10 p-2 lg:flex">
            {(
              [
                ["partidos", "Calendario", CalendarDays],
                ["planes", "Planes", ListChecks],
              ] as const
            ).map(([v, t, Icono]) => {
              const activo = v === "planes" ? vista === "planes" : vista !== "planes";
              return (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold transition ${activo ? "text-noche" : "text-white/60 hover:text-white"}`}
                >
                  {activo && <motion.span layoutId="tab-escritorio" className="absolute inset-0 rounded-xl bg-neon" />}
                  <span className="relative flex items-center gap-2">
                    <Icono className="h-4 w-4" /> {t}
                  </span>
                </button>
              );
            })}
          </div>
          {panelLateral}
        </aside>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="fixed inset-x-3 bottom-3 z-[1050] flex rounded-2xl border border-white/10 bg-noche-800/95 p-1.5 shadow-2xl backdrop-blur pb-[max(.375rem,env(safe-area-inset-bottom))] lg:hidden">
        {(
          [
            ["mapa", "Mapa", MapaIcon],
            ["partidos", "Partidos", CalendarDays],
            ["planes", "Planes", Home],
          ] as const
        ).map(([v, t, Icono]) => (
          <button key={v} onClick={() => setVista(v)} className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold ${vista === v ? "text-noche" : "text-white/60"}`}>
            {vista === v && <motion.span layoutId="tab-movil" className="absolute inset-0 rounded-xl bg-neon" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <Icono className="relative h-5 w-5" />
            <span className="relative">{t}</span>
            {v === "partidos" && vivos.length > 0 && vista !== v && <span className="absolute right-[30%] top-1 h-2 w-2 rounded-full bg-vivo" />}
          </button>
        ))}
      </nav>

      {/* Hojas y modales */}
      <AnimatePresence>
        {borrador && (
          <FormularioPin
            key="form"
            punto={borrador}
            partidos={partidos}
            partidoInicial={partidoPin}
            hashtagsUsados={planes.map((p) => p.hashtag)}
            yo={yo}
            onGuardar={guardarPin}
            onCerrar={() => setBorrador(null)}
          />
        )}
        {planAbierto && !borrador && (
          <DetallePlan
            key={planAbierto.id}
            plan={planAbierto}
            partido={partidosPorId.get(planAbierto.partidoId)}
            ahora={ahora}
            yo={yo}
            permisoAvisos={permiso}
            onPedirNombre={conNombre}
            onActualizar={actualizar}
            onCompartir={compartirPlan}
            onPedirPermiso={pedirPermiso}
            onCerrar={() => setAbierto(null)}
          />
        )}
        {compartir && (
          <ModalCompartir
            key="compartir"
            mensaje={compartir.mensaje}
            url={compartir.url}
            onCerrar={() => setCompartir(null)}
            onCopiado={() => avisar({ titulo: "Enlace copiado", texto: "Pégalo en el grupo de tus amigos.", tono: "neon" })}
          />
        )}
        {pedirNombre && (
          <ModalNombre
            key="nombre"
            onCerrar={() => setPedirNombre(null)}
            onListo={(n) => {
              setYo(n);
              guardar("previa:yo", n);
              const luego = pedirNombre;
              setPedirNombre(null);
              luego(n);
            }}
          />
        )}
      </AnimatePresence>

      {/* Avisos */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-[1400] flex flex-col items-center gap-2 px-3">
        <AnimatePresence>
          {avisos.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ y: -30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`pointer-events-auto w-full max-w-sm rounded-2xl border-2 bg-noche-800 px-4 py-3 shadow-2xl ${
                a.tono === "oro" ? "border-oro" : a.tono === "vivo" ? "border-vivo" : "border-neon"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-extrabold">
                {a.tono === "vivo" ? <Radio className="h-4 w-4 text-vivo" /> : <ChevronRight className="h-4 w-4 text-neon" />}
                {a.titulo}
              </p>
              {a.texto && <p className="mt-0.5 pl-6 text-xs text-white/65">{a.texto}</p>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
