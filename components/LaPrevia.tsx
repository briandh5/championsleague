"use client";

/**
 * La Previa · Champions con tus amigos
 * App #4 del reto 100 apps — componente único: mapa ilustrado con pines y hashtags,
 * calendario por fases con marcador en vivo, recordatorios, compartir plan y chat por evento.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature, merge, neighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import mundoTopo from "world-atlas/countries-110m.json";
import eeuuTopo from "us-atlas/states-10m.json";
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
  Globe2,
  Map as MapaIcon,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
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

type Vista = "mapa" | "partidos" | "planes" | "chat";
type Fuente = "oficial" | "envivo" | "demo";

interface Aviso {
  id: string;
  titulo: string;
  texto?: string;
  tono?: "neon" | "oro" | "vivo";
}

/* ─────────────────── Calendario oficial UEFA 2026/27 (capa de datos) ─────────────────── */

const FASES: Fase[] = ["Fase de liga", "Play-off", "Octavos", "Cuartos", "Semifinal", "Final"];

// Escudos en alta resolución desde el CDN público de API-Football; si alguno falla se dibuja un escudo con los colores del club.
const esc = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

type FilaEquipo = [id: string, nombre: string, corto: string, pais: string, escudo: number | null, c1: string, c2: string, estadio: string, ciudad: string];

// Los 36 clubes de la fase de liga 2026/27 según uefa.com.
const FILAS_EQUIPOS: FilaEquipo[] = [
  ["ars", "Arsenal", "ARS", "ENG", 42, "#ef0107", "#063672", "Emirates Stadium", "Londres"],
  ["avl", "Aston Villa", "AVL", "ENG", 66, "#670e36", "#95bfe5", "Villa Park", "Birmingham"],
  ["liv", "Liverpool", "LIV", "ENG", 40, "#c8102e", "#00b2a9", "Anfield", "Liverpool"],
  ["mci", "Manchester City", "MCI", "ENG", 50, "#6cabdd", "#1c2c5b", "Etihad Stadium", "Mánchester"],
  ["mun", "Manchester United", "MUN", "ENG", 33, "#da291c", "#000000", "Old Trafford", "Mánchester"],
  ["len", "Lens", "RCL", "FRA", 116, "#ffd700", "#e30613", "Stade Bollaert-Delelis", "Lens"],
  ["lil", "Lille", "LIL", "FRA", 79, "#e01e13", "#0d1e3f", "Stade Pierre-Mauroy", "Lille"],
  ["psg", "Paris Saint-Germain", "PSG", "FRA", 85, "#004170", "#da291c", "Parc des Princes", "París"],
  ["bay", "Bayern München", "BAY", "GER", 157, "#dc052d", "#0066b2", "Allianz Arena", "Múnich"],
  ["bvb", "Borussia Dortmund", "BVB", "GER", 165, "#fde100", "#000000", "Signal Iduna Park", "Dortmund"],
  ["rbl", "Leipzig", "RBL", "GER", 173, "#dd0741", "#ffffff", "Red Bull Arena", "Leipzig"],
  ["vfb", "Stuttgart", "VFB", "GER", 172, "#e32219", "#ffffff", "MHPArena", "Stuttgart"],
  ["int", "Inter", "INT", "ITA", 505, "#0068a8", "#000000", "San Siro", "Milán"],
  ["nap", "Napoli", "NAP", "ITA", 492, "#12a0d7", "#ffffff", "Diego Armando Maradona", "Nápoles"],
  ["rom", "Roma", "ROM", "ITA", 497, "#8e1f2f", "#f0bc42", "Stadio Olimpico", "Roma"],
  ["com", "Como", "COM", "ITA", 895, "#1b3d8f", "#ffffff", "Giuseppe Sinigaglia", "Como"],
  ["fey", "Feyenoord", "FEY", "NED", 209, "#e30613", "#ffffff", "De Kuip", "Róterdam"],
  ["psv", "PSV Eindhoven", "PSV", "NED", 197, "#ed1c24", "#ffffff", "Philips Stadion", "Eindhoven"],
  ["bod", "Bodø/Glimt", "BOD", "NOR", 327, "#ffd200", "#000000", "Aspmyra Stadion", "Bodø"],
  ["vik", "Viking", "VIK", "NOR", null, "#003b7b", "#ffffff", "Viking Stadion", "Stavanger"],
  ["por", "Porto", "POR", "POR", 212, "#00428c", "#ffffff", "Estádio do Dragão", "Oporto"],
  ["scp", "Sporting CP", "SCP", "POR", 228, "#008057", "#ffffff", "José Alvalade", "Lisboa"],
  ["slo", "Slovan Bratislava", "SLO", "SVK", null, "#0058a3", "#ffffff", "Tehelné pole", "Bratislava"],
  ["atm", "Atlético de Madrid", "ATM", "ESP", 530, "#cb3524", "#272e61", "Metropolitano", "Madrid"],
  ["bar", "Barcelona", "BAR", "ESP", 529, "#a50044", "#004d98", "Spotify Camp Nou", "Barcelona"],
  ["bet", "Real Betis", "BET", "ESP", 543, "#00954c", "#ffffff", "Benito Villamarín", "Sevilla"],
  ["rma", "Real Madrid", "RMA", "ESP", 541, "#ffffff", "#febe10", "Santiago Bernabéu", "Madrid"],
  ["vil", "Villarreal", "VIL", "ESP", 533, "#ffe667", "#005187", "La Cerámica", "Villarreal"],
  ["fen", "Fenerbahçe", "FEN", "TUR", 611, "#163962", "#ffed00", "Şükrü Saracoğlu", "Estambul"],
  ["gal", "Galatasaray", "GAL", "TUR", 645, "#a90432", "#fdb912", "RAMS Park", "Estambul"],
  ["sha", "Shakhtar Donetsk", "SHA", "UKR", 550, "#f26522", "#000000", "Sede por confirmar", ""],
  ["cbr", "Club Brugge", "BRU", "BEL", 569, "#0067ce", "#000000", "Jan Breydel", "Brujas"],
  ["sla", "Slavia Praha", "SLA", "CZE", 560, "#c8102e", "#ffffff", "Fortuna Arena", "Praga"],
  ["aek", "AEK Athens", "AEK", "GRE", 575, "#ffd200", "#000000", "OPAP Arena", "Atenas"],
  ["lask", "LASK", "LASK", "AUT", null, "#000000", "#ffffff", "Raiffeisen Arena", "Linz"],
  ["sab", "Sabah", "SAB", "AZE", null, "#ff6600", "#1b2a5c", "Bank Respublika Arena", "Bakú"],
];

const EQUIPOS: Record<string, Equipo> = Object.fromEntries(
  FILAS_EQUIPOS.map(([id, nombre, corto, pais, escudo, c1, c2, estadio, ciudad]) => [
    id,
    { id, nombre, corto, pais, escudo: escudo ? esc(escudo) : undefined, colores: [c1, c2] as [string, string], estadio, ciudad },
  ]),
);

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

/**
 * Fase de liga 2026/27 tal como la publica uefa.com (horario de Madrid).
 * Formato: "local-visita" (21:00), "local-visita@18:45", o "local-visita=2:1" con resultado.
 */
const FASE_LIGA: { jornada: number; dias: [string, string[]][] }[] = [
  {
    jornada: 1,
    dias: [
      ["2026-09-08", ["aek-lask=1:0", "cbr-avl=2:3", "bvb-vil=3:2", "por-mci=0:2", "lil-bet=2:3", "rma-int=2:1"]],
      ["2026-09-09", ["bar-fey=5:1", "vfb-vik=3:1", "liv-atm=2:1", "psg-slo=6:1", "scp-gal=3:1", "nap-ars=0:1"]],
      ["2026-09-10", ["fen-rom=1:1", "psv-sha=1:1", "com-rbl=4:1", "bay-bod=5:0", "mun-sab=4:0", "sla-len=2:3"]],
    ],
  },
  {
    jornada: 2,
    dias: [
      ["2026-10-13", ["len-scp=0:2", "sab-sla=2:0", "ars-lil=3:0", "atm-mun=2:0", "int-cbr=3:4", "gal-bar=1:4", "rbl-psv=1:0", "vik-bay=3:3", "vil-nap=3:1"]],
      ["2026-10-14", ["fey-com=3:2", "lask-liv=3:6", "rom-rma=3:4", "avl-fen=6:0", "sha-aek=3:1", "bod-bvb=1:0", "mci-psg=2:4", "bet-por=3:2", "slo-vfb=0:3"]],
    ],
  },
  {
    jornada: 3,
    dias: [
      ["2026-10-20", ["fen-sla@18:45", "sab-bvb@18:45", "rom-slo", "por-psv", "liv-vil", "mci-aek", "psg-bar", "nap-bod", "vfb-atm"]],
      ["2026-10-21", ["com-mun@18:45", "lil-gal@18:45", "avl-vik", "cbr-len", "bay-ars", "int-sha", "rma-rbl", "bet-fey", "scp-lask"]],
    ],
  },
  {
    jornada: 4,
    dias: [
      ["2026-11-03", ["sha-scp@18:45", "gal-vfb@18:45", "atm-bay", "bar-avl", "fey-int", "bod-lil", "lask-slo", "mun-rom", "vil-psg"]],
      ["2026-11-04", ["aek-rma@18:45", "fen-liv@18:45", "bvb-bet", "por-nap", "psv-cbr", "rbl-mci", "len-com", "sla-ars", "vik-sab"]],
    ],
  },
  {
    jornada: 5,
    dias: [
      ["2026-11-24", ["bod-lask@18:45", "gal-avl@18:45", "ars-bvb", "com-aek", "fey-por", "mci-nap", "rbl-len", "rma-psv", "slo-bet"]],
      ["2026-11-25", ["sab-bar@18:45", "sla-vil@18:45", "atm-vik", "cbr-liv", "int-vfb", "sha-fen", "lil-bay", "psg-rom", "scp-mun"]],
    ],
  },
  {
    jornada: 6,
    dias: [
      ["2026-12-08", ["vik-fey@18:45", "vil-sab@18:45", "aek-gal", "rom-scp", "avl-psg", "bar-mci", "bay-sla", "mun-rbl", "nap-cbr"]],
      ["2026-12-09", ["bet-com@18:45", "slo-sha@18:45", "ars-rma", "bvb-int", "lask-fen", "liv-por", "len-bod", "psv-atm", "vfb-lil"]],
    ],
  },
  {
    jornada: 7,
    dias: [
      ["2027-01-19", ["bod-atm@18:45", "gal-fey@18:45", "aek-rom", "avl-bvb", "int-liv", "por-sla", "lil-slo", "rma-lask", "vfb-cbr"]],
      ["2027-01-20", ["fen-vil@18:45", "sab-nap@18:45", "com-psg", "mun-bay", "rbl-sha", "len-mci", "bet-ars", "scp-bar", "vik-psv"]],
    ],
  },
  {
    jornada: 8,
    dias: [
      [
        "2027-01-27",
        ["ars-sab", "rom-lil", "atm-fen", "bvb-aek", "cbr-bod", "bay-bet", "bar-com", "sha-rma", "fey-rbl", "lask-por", "liv-len", "mci-scp", "psg-gal", "psv-vfb", "sla-avl", "nap-vik", "vil-mun", "slo-int"],
      ],
    ],
  },
];

// Eliminatorias: fechas oficiales; los cruces se conocen tras cada sorteo.
const ELIMINATORIAS: { fase: Fase; ronda: string; dias: string[]; porDia: number }[] = [
  { fase: "Play-off", ronda: "Ida", dias: ["2027-02-16", "2027-02-17"], porDia: 4 },
  { fase: "Play-off", ronda: "Vuelta", dias: ["2027-02-23", "2027-02-24"], porDia: 4 },
  { fase: "Octavos", ronda: "Ida", dias: ["2027-03-09", "2027-03-10"], porDia: 4 },
  { fase: "Octavos", ronda: "Vuelta", dias: ["2027-03-16", "2027-03-17"], porDia: 4 },
  { fase: "Cuartos", ronda: "Ida", dias: ["2027-04-06", "2027-04-07"], porDia: 2 },
  { fase: "Cuartos", ronda: "Vuelta", dias: ["2027-04-13", "2027-04-14"], porDia: 2 },
  { fase: "Semifinal", ronda: "Ida", dias: ["2027-04-27", "2027-04-28"], porDia: 1 },
  { fase: "Semifinal", ronda: "Vuelta", dias: ["2027-05-04", "2027-05-05"], porDia: 1 },
];

function calendarioOficial(): Partido[] {
  const partidos: Partido[] = [];
  for (const j of FASE_LIGA) {
    for (const [dia, cruces] of j.dias) {
      for (const txt of cruces) {
        const [, l, v, hora = "21:00", gl, gv] = /^([a-z]+)-([a-z]+)(?:@(\d\d:\d\d))?(?:=(\d+):(\d+))?$/.exec(txt) ?? [];
        const local = EQUIPOS[l];
        const visita = EQUIPOS[v];
        if (!local || !visita) continue;
        partidos.push({
          id: `j${j.jornada}-${l}-${v}`,
          fase: "Fase de liga",
          jornada: `Jornada ${j.jornada}`,
          inicio: horaMadrid(dia, hora),
          local,
          visita,
          estadio: local.estadio,
          ciudad: local.ciudad,
          estado: gl !== undefined ? "final" : "programado",
          golesLocal: gl !== undefined ? Number(gl) : undefined,
          golesVisita: gv !== undefined ? Number(gv) : undefined,
        });
      }
    }
  }
  for (const e of ELIMINATORIAS) {
    for (const dia of e.dias) {
      for (let k = 0; k < e.porDia; k++) {
        partidos.push({
          id: `${e.fase}-${e.ronda}-${dia}-${k}`.toLowerCase().replace(/\s+/g, "-"),
          fase: e.fase,
          jornada: e.ronda,
          inicio: horaMadrid(dia, "21:00"),
          local: POR_DEFINIR,
          visita: POR_DEFINIR,
          estadio: "Por definir",
          ciudad: "",
          estado: "programado",
        });
      }
    }
  }
  partidos.push({
    id: "final-2027",
    fase: "Final",
    jornada: "Final",
    inicio: horaMadrid("2027-06-05", "21:00"),
    local: POR_DEFINIR,
    visita: POR_DEFINIR,
    estadio: "Estadio Metropolitano",
    ciudad: "Madrid",
    estado: "programado",
  });
  return partidos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id));
}

function hash(s: string): number {
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
function conEstado(p: Partido, ahora: number, demo: boolean): Partido {
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

const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|ac|ssc|sl|sk|rc|rb|afc|as|vfb)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
const mismoEquipo = (a: string, b: string) => {
  const x = normal(a);
  const y = normal(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x) || x.slice(0, 5) === y.slice(0, 5));
};

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

const CALENDARIO = calendarioOficial();

/**
 * Calendario oficial UEFA; los marcadores de partidos en juego o recién terminados se completan con la fuente en vivo
 * (TheSportsDB vía /api/partidos) cuando responde. En modo demo el marcador se simula.
 */
function usePartidos(ahora: number, demo: boolean) {
  const [envivo, setEnvivo] = useState<Partido[]>([]);

  useEffect(() => {
    if (demo) return;
    let activo = true;
    const cargar = async () => {
      try {
        const r = await fetch("/api/partidos", { cache: "no-store" });
        const j = (await r.json()) as { partidos?: Partido[] };
        if (activo && j.partidos?.length) setEnvivo(j.partidos);
      } catch {
        /* sin fuente en vivo: se muestra el estado por horario */
      }
    };
    cargar();
    const t = setInterval(cargar, 60000);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [demo]);

  const partidos = useMemo(
    () =>
      CALENDARIO.map((base) => {
        const p = conEstado(base, ahora, demo);
        if (demo || p.estado === "programado" || p.golesLocal !== undefined || p.local.id === "tbd") return p;
        const x = envivo.find(
          (e) => claveDia(e.inicio) === claveDia(p.inicio) && mismoEquipo(e.local.nombre, p.local.nombre) && mismoEquipo(e.visita.nombre, p.visita.nombre),
        );
        if (!x || x.golesLocal === undefined) return p;
        return { ...p, golesLocal: x.golesLocal, golesVisita: x.golesVisita, estado: x.estado === "final" ? "final" : p.estado, minuto: x.estado === "vivo" ? x.minuto ?? p.minuto : p.minuto };
      }),
    [ahora, demo, envivo],
  );
  const fuente: Fuente = demo ? "demo" : envivo.length ? "envivo" : "oficial";
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
  if (p.golesLocal === undefined)
    return (
      <div className="text-center">
        <div className={`font-display font-bold leading-none text-white/70 ${grande ? "text-4xl" : "text-2xl"}`}>VS</div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-white/45">{p.estado === "vivo" ? "en juego" : "resultado pendiente"}</div>
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

/* ─────────────────────────── Mapa ilustrado (SVG) ─────────────────────────── */

// Dibujo del mundo hecho con datos de Natural Earth y del censo de EE. UU. incluidos en la app:
// no llama a ninguna API ni usa ubicación en tiempo real; el pin se pone libremente en el dibujo.
type TopoPaises = Topology<{ countries: GeometryCollection<{ name: string }> }>;
type TopoEstados = Topology<{ states: GeometryCollection<{ name: string }> }>;
const TOPO_MUNDO = mundoTopo as unknown as TopoPaises;
const TOPO_EEUU = eeuuTopo as unknown as TopoEstados;
const MUNDO = feature(TOPO_MUNDO, TOPO_MUNDO.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const ESFERA = { type: "Sphere" } as const;
const PASTEL = ["#ffd166", "#a8e6a1", "#ffb4a2", "#bde0fe", "#f7c8e0", "#c3f0ca", "#ffe29a", "#cdb4db", "#9ad1d4"];
const ID_FRANCIA = "250";
const ID_ESPANA = "724";
const ID_MEXICO = "484";
const ID_EEUU = "840";

// Colores sin repetir entre vecinos para que cada país (sobre todo en Europa) se distinga a simple vista.
const COLOR_PAIS: Record<string, string> = (() => {
  const geos = TOPO_MUNDO.objects.countries.geometries;
  const vecinos = neighbors(geos as Parameters<typeof neighbors>[0]);
  const elegido: number[] = [];
  const orden = geos.map((_, i) => i).sort((a, b) => vecinos[b].length - vecinos[a].length);
  for (const i of orden) {
    const usados = new Set(vecinos[i].map((j) => elegido[j]));
    let c = hash(String(geos[i].id)) % PASTEL.length;
    for (let n = 0; n < PASTEL.length && usados.has(c); n++) c = (c + 1) % PASTEL.length;
    elegido[i] = c;
  }
  return Object.fromEntries(geos.map((g, i) => [String(g.id), PASTEL[elegido[i]]]));
})();

/** Regiones de Estados Unidos (agrupando estados por código FIPS). */
const REGIONES_EEUU: { nombre: string; color: string; fips: string[]; lon: number; lat: number }[] = [
  { nombre: "West Coast", color: "#9ad1d4", fips: ["53", "41", "16", "30", "56", "02", "15"], lon: -116.5, lat: 45.5 },
  { nombre: "Lo robado", color: "#ff9f6e", fips: ["06", "32", "49", "04", "35", "48", "08"], lon: -108, lat: 34 },
  { nombre: "Norte", color: "#bde0fe", fips: ["38", "46", "31", "20", "27", "19", "29", "55", "17", "26", "18", "39", "40"], lon: -95.5, lat: 43 },
  {
    nombre: "East Coast",
    color: "#c3f0ca",
    fips: ["23", "33", "50", "25", "44", "09", "36", "34", "42", "10", "24", "11", "51", "54", "37", "45", "13", "12", "01", "28", "47", "21", "22", "05"],
    lon: -80.5,
    lat: 36,
  },
];
const GEO_REGIONES_EEUU = REGIONES_EEUU.map((r) => ({
  ...r,
  geo: merge(TOPO_EEUU, TOPO_EEUU.objects.states.geometries.filter((g) => r.fips.includes(String(g.id))) as Parameters<typeof merge>[1]),
}));

/** Regiones de México: polígonos aproximados (lon, lat) recortados con la silueta del país. El primero es la base. */
const REGIONES_MEXICO: { nombre: string; color: string; puntos: [number, number][]; lon: number; lat: number; minK: number }[] = [
  { nombre: "Resto del sur", color: "#ffd166", puntos: [[-110, 22.6], [-97.3, 22.4], [-85, 22.6], [-85, 13], [-110, 13]], lon: -103, lat: 19.6, minK: 3.5 },
  { nombre: "El norte", color: "#ffb4a2", puntos: [[-120, 34], [-95, 34], [-97.4, 22.4], [-105.6, 22.6], [-120, 22.6]], lon: -106, lat: 28.5, minK: 2.6 },
  {
    nombre: "Veracruz",
    color: "#a8e6a1",
    puntos: [[-98.5, 22.4], [-97.4, 22.4], [-96.2, 19.6], [-95.2, 18.6], [-94, 18.2], [-93.6, 17.7], [-94.6, 17.2], [-95.6, 17.8], [-96.6, 18.6], [-97.4, 19.6], [-98, 20.6], [-98.6, 21.4]],
    lon: -96.6,
    lat: 19.8,
    minK: 4.2,
  },
  { nombre: "CDMX", color: "#f7c8e0", puntos: [[-99.75, 20.05], [-98.75, 20.05], [-98.75, 18.95], [-99.75, 18.95]], lon: -99.25, lat: 19.5, minK: 5.5 },
  {
    nombre: "Oaxaca y sus playas",
    color: "#9ad1d4",
    puntos: [[-98.6, 18.6], [-96.7, 18.5], [-95.6, 17.8], [-94.6, 17.2], [-93.9, 16.4], [-94.2, 15.6], [-96.4, 15.4], [-98.6, 16.2]],
    lon: -96.7,
    lat: 16.9,
    minK: 4,
  },
  {
    nombre: "Riviera Maya y alrededores",
    color: "#cdb4db",
    puntos: [[-92.6, 22.6], [-85, 22.6], [-85, 17.8], [-89.2, 17.8], [-90.9, 17.8], [-91.4, 18.4], [-92.6, 18.7]],
    lon: -88.6,
    lat: 20,
    minK: 3,
  },
];

/** Nombres en español para ubicar el mapa: [id ISO, nombre, lon, lat, zoom mínimo]. Europa aparece al acercar. */
const NOMBRES_PAISES: [string, string, number, number, number][] = [
  ["124", "Canadá", -105, 58, 1], ["840", "Estados Unidos", -99, 39.5, 1], ["484", "México", -102.5, 24, 1], ["076", "Brasil", -52, -10, 1],
  ["032", "Argentina", -65, -35, 1], ["643", "Rusia", 95, 62, 1], ["156", "China", 103, 34, 1], ["356", "India", 79, 22, 1],
  ["036", "Australia", 134, -25, 1], ["304", "Groenlandia", -41, 73, 1], ["398", "Kazajistán", 67, 48, 1.4], ["012", "Argelia", 2.5, 27, 1.4],
  ["682", "Arabia Saudita", 45, 24, 1.4], ["710", "Sudáfrica", 24, -30, 1.4], ["170", "Colombia", -73.5, 3.5, 1.6], ["604", "Perú", -75, -9.5, 1.6],
  ["152", "Chile", -71, -30, 2], ["862", "Venezuela", -66, 7.5, 2], ["068", "Bolivia", -64.5, -17, 2], ["192", "Cuba", -79, 21.8, 2.5],
  ["818", "Egipto", 29.8, 26.5, 1.6], ["566", "Nigeria", 8, 9.5, 2], ["180", "R. D. del Congo", 23.5, -3, 1.8], ["231", "Etiopía", 39.5, 8.5, 2],
  ["504", "Marruecos", -6.5, 31.5, 2], ["364", "Irán", 54, 32.5, 1.8], ["360", "Indonesia", 117, -1.5, 1.8], ["392", "Japón", 138.5, 36.5, 2],
  ["496", "Mongolia", 103, 47, 1.8], ["434", "Libia", 17.5, 27, 1.8],
  // Europa
  ["724", "España", -4.3, 41.9, 1.6], ["250", "Francia", 2.4, 46.6, 1.4], ["620", "Portugal", -8.1, 39.6, 3], ["826", "Reino Unido", -2.2, 53.4, 2.2],
  ["372", "Irlanda", -8, 53.2, 4], ["276", "Alemania", 10.4, 51.1, 2], ["380", "Italia", 12.6, 42.8, 2.2], ["528", "Países Bajos", 5.6, 52.4, 4.2],
  ["056", "Bélgica", 4.6, 50.6, 4.6], ["756", "Suiza", 8.2, 46.8, 4.4], ["040", "Austria", 14.5, 47.6, 3.6], ["616", "Polonia", 19.4, 52.1, 2.4],
  ["203", "Chequia", 15.4, 49.8, 3.6], ["703", "Eslovaquia", 19.6, 48.7, 4.4], ["348", "Hungría", 19.4, 47.1, 3.8], ["191", "Croacia", 16.2, 45.3, 4.4],
  ["688", "Serbia", 20.8, 44, 4.2], ["642", "Rumanía", 25, 45.9, 3], ["100", "Bulgaria", 25.4, 42.7, 3.8], ["300", "Grecia", 22, 39.4, 3.2],
  ["792", "Turquía", 35, 39, 2], ["804", "Ucrania", 31.5, 49, 2.2], ["578", "Noruega", 9, 61.5, 2.2], ["752", "Suecia", 15, 62.5, 2.2],
  ["246", "Finlandia", 26, 63.5, 2.4], ["208", "Dinamarca", 9.3, 56.1, 3.8], ["031", "Azerbaiyán", 47.7, 40.3, 4], ["112", "Bielorrusia", 28, 53.5, 3],
];

/** Estadio de cada club de la fase de liga (lat, lon). Shakhtar juega en sede neutral, por eso no aparece. */
const ESTADIOS: Record<string, [number, number]> = {
  ars: [51.5549, -0.1084], avl: [52.5092, -1.8848], liv: [53.4308, -2.9608], mci: [53.4831, -2.2004], mun: [53.4631, -2.2913],
  len: [50.4328, 2.815], lil: [50.6119, 3.1305], psg: [48.8414, 2.253], bay: [48.2188, 11.6247], bvb: [51.4926, 7.4519],
  rbl: [51.3458, 12.3483], vfb: [48.7922, 9.232], int: [45.4781, 9.124], nap: [40.828, 14.193], rom: [41.9339, 12.4547],
  com: [45.8137, 9.0722], fey: [51.8939, 4.5231], psv: [51.4417, 5.4675], bod: [67.2766, 14.3953], vik: [58.9469, 5.7353],
  por: [41.1617, -8.5839], scp: [38.7612, -9.1609], slo: [48.1636, 17.1367], atm: [40.4362, -3.5995], bar: [41.3809, 2.1228],
  bet: [37.3565, -5.9817], rma: [40.4531, -3.6883], vil: [39.9441, -0.1035], fen: [40.9877, 29.037], gal: [41.1034, 28.9908],
  cbr: [51.1933, 3.1806], sla: [50.0677, 14.4716], aek: [38.0363, 23.7544], lask: [48.2944, 14.3086], sab: [40.44, 49.851],
};

type Foco = { lat: number; lng: number; zoom: number; n: number } | null;
interface VistaMapa {
  k: number;
  x: number;
  y: number;
}

function PinSvg({ tipo, color, activo, etiqueta, nuevo }: { tipo: TipoLugar | "nuevo"; color: string; activo: boolean; etiqueta?: string; nuevo?: boolean }) {
  const ancho = etiqueta ? etiqueta.length * 7.4 + 20 : 0;
  return (
    <motion.g
      initial={nuevo ? { y: -50, opacity: 0, scale: 0.6 } : false}
      animate={{ y: 0, opacity: 1, scale: activo ? 1.18 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      style={{ originX: "50%", originY: "100%" }}
    >
      <g transform="translate(-22 -52)" style={{ filter: "drop-shadow(3px 4px 0 rgba(6,8,26,.55))" }}>
        <path d="M22 2C11 2 2 10.6 2 21.4 2 36 22 52 22 52s20-16 20-30.6C42 10.6 33 2 22 2z" fill={color} stroke="#0b0e28" strokeWidth="3.5" strokeLinejoin="round" />
        <circle cx="22" cy="21" r="12.5" fill="#fff" stroke="#0b0e28" strokeWidth="2.5" />
        <text x="22" y="27" textAnchor="middle" fontSize="16">
          {tipo === "nuevo" ? "⚽" : EMOJI[tipo]}
        </text>
      </g>
      {etiqueta && (
        <g transform={`translate(${-ancho / 2} 6)`}>
          <rect width={ancho} height="22" rx="11" fill="#0b0e28" stroke="#f2c94c" strokeWidth="2" />
          <text x={ancho / 2} y="15" textAnchor="middle" fill="#f2c94c" fontSize="12" fontWeight="800" fontFamily="var(--font-cuerpo), sans-serif">
            {etiqueta}
          </text>
        </g>
      )}
    </motion.g>
  );
}

/** Copa estilizada (dibujo propio) que se pinta de fondo en España. Caja de 100 × 160. */
function CopaDibujo() {
  return (
    <g>
      <path d="M22 160h56l-4-22H26z" fill="#0f7a45" stroke="#0b0e28" strokeWidth="2.5" />
      <path d="M26 148h48" stroke="#f2c94c" strokeWidth="4" />
      <path
        d="M30 138c2-18 10-30 14-44-9-8-22-14-24-30-1-10 4-18 10-22 4 10 8 20 18 26 2-10 0-18-6-26 8 2 14 8 16 16 4-8 10-14 18-16-6 8-8 16-6 26 10-6 14-16 18-26 6 4 11 12 10 22-2 16-15 22-24 30 4 14 12 26 14 44z"
        fill="#f2c94c"
        stroke="#0b0e28"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="26" r="20" fill="#f8df8e" stroke="#0b0e28" strokeWidth="2.5" />
      <path d="M33 18c10 4 24 4 34 0M31 30c12 5 26 5 38 0M50 6c-6 8-6 32 0 40M50 6c6 8 6 32 0 40" fill="none" stroke="#c99a1e" strokeWidth="2" />
      <path d="M40 100c4 10 16 10 20 0" fill="none" stroke="#c99a1e" strokeWidth="2.5" />
    </g>
  );
}

function Estrella({ x, y, r }: { x: number; y: number; r: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill="#f2c94c" stroke="#0b0e28" strokeWidth="1.5" strokeLinejoin="round" />;
}

function MapaSvg({
  planes,
  partidosPorId,
  yo,
  activo,
  modoPin,
  borrador,
  foco,
  estilo,
  orden,
  onElegir,
  onAbrir,
}: {
  planes: Plan[];
  partidosPorId: Map<string, Partido>;
  yo: string;
  activo: string | null;
  modoPin: boolean;
  borrador: { lat: number; lng: number } | null;
  foco: Foco;
  estilo: "caricatura" | "noche";
  orden: { tipo: "mas" | "menos" | "todo"; n: number } | null;
  onElegir: (lat: number, lng: number) => void;
  onAbrir: (pl: Plan) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [vista, setVista] = useState<VistaMapa>({ k: 1, x: 0, y: 0 });
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ x: number; y: number; vista: VistaMapa; movido: boolean; dist?: number; k?: number } | null>(null);
  const animacion = useRef<number | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const proy = useMemo(() => geoNaturalEarth1().fitExtent([[10, 10], [Math.max(tam.w - 10, 20), Math.max(tam.h - 10, 20)]], ESFERA), [tam]);
  const camino = useMemo(() => geoPath(proy), [proy]);
  const formas = useMemo(
    () => MUNDO.features.map((f, i) => ({ id: String(f.id ?? i), nombre: f.properties?.name ?? "", d: camino(f) ?? "" })),
    [camino],
  );
  const esfera = useMemo(() => camino(ESFERA) ?? "", [camino]);
  const reticula = useMemo(() => camino(geoGraticule10()) ?? "", [camino]);
  const regionesEeuu = useMemo(() => GEO_REGIONES_EEUU.map((r) => ({ ...r, d: camino(r.geo) ?? "" })), [camino]);
  const regionesMexico = useMemo(
    () =>
      REGIONES_MEXICO.map((r) => ({
        ...r,
        d:
          r.puntos
            .map((p, i) => {
              const q = proy(p) ?? [0, 0];
              return `${i ? "L" : "M"}${q[0].toFixed(2)},${q[1].toFixed(2)}`;
            })
            .join("") + "Z",
      })),
    [proy],
  );
  const mexico = formas.find((f) => f.id === ID_MEXICO)?.d ?? "";
  const espana = useMemo(() => {
    const f = MUNDO.features.find((x) => String(x.id) === ID_ESPANA);
    if (!f) return null;
    const [[x0, y0], [x1, y1]] = camino.bounds(f);
    const alto = (y1 - y0) * 0.92;
    const s = alto / 160;
    return { d: camino(f) ?? "", transform: `translate(${(x0 + x1) / 2 - 50 * s} ${y0 + (y1 - y0) * 0.04}) scale(${s})` };
  }, [camino]);

  const limitar = useCallback(
    (v: VistaMapa): VistaMapa => {
      const k = Math.min(16, Math.max(1, v.k));
      const { w, h } = tam;
      return { k, x: Math.min(w * 0.6, Math.max(w - w * k - w * 0.6, v.x)), y: Math.min(h * 0.6, Math.max(h - h * k - h * 0.6, v.y)) };
    },
    [tam],
  );

  const irA = useCallback(
    (destino: VistaMapa) => {
      if (animacion.current) cancelAnimationFrame(animacion.current);
      const desde = vistaRef.current;
      const hasta = limitar(destino);
      const t0 = performance.now();
      const paso = (t: number) => {
        const u = Math.min(1, (t - t0) / 650);
        const e = 1 - Math.pow(1 - u, 3);
        setVista({ k: desde.k + (hasta.k - desde.k) * e, x: desde.x + (hasta.x - desde.x) * e, y: desde.y + (hasta.y - desde.y) * e });
        if (u < 1) animacion.current = requestAnimationFrame(paso);
      };
      animacion.current = requestAnimationFrame(paso);
    },
    [limitar],
  );

  const centrarEn = useCallback(
    (lng: number, lat: number, k: number) => {
      const p = proy([lng, lat]);
      if (!p) return;
      irA({ k, x: tam.w / 2 - p[0] * k, y: tam.h / 2 - p[1] * k });
    },
    [proy, tam, irA],
  );

  // Vista inicial: el mapa llena el alto en pantallas verticales y se centra en el Atlántico.
  const iniciado = useRef(false);
  useEffect(() => {
    if (!tam.w || iniciado.current) return;
    iniciado.current = true;
    const b = camino.bounds(ESFERA);
    const alto = b[1][1] - b[0][1];
    const k = Math.min(2.2, Math.max(1.3, (tam.h * 0.95) / alto));
    const p = proy([tam.w < 640 ? -70 : -38, 26]) ?? [tam.w / 2, tam.h / 2];
    setVista(limitar({ k, x: tam.w / 2 - p[0] * k, y: tam.h / 2 - p[1] * k }));
  }, [tam, camino, proy, limitar]);

  useEffect(() => {
    if (foco) centrarEn(foco.lng, foco.lat, Math.max(vistaRef.current.k, foco.zoom));
  }, [foco, centrarEn]);

  useEffect(() => {
    if (!orden) return;
    const v = vistaRef.current;
    if (orden.tipo === "todo") {
      irA({ k: 1, x: 0, y: 0 });
      return;
    }
    const nk = orden.tipo === "mas" ? v.k * 1.6 : v.k / 1.6;
    const cx = tam.w / 2;
    const cy = tam.h / 2;
    irA({ k: nk, x: cx - (cx - v.x) * (nk / v.k), y: cy - (cy - v.y) * (nk / v.k) });
  }, [orden, irA, tam]);

  const zoomEn = useCallback(
    (sx: number, sy: number, nk: number) => {
      const v = vistaRef.current;
      const k = Math.min(16, Math.max(1, nk));
      setVista(limitar({ k, x: sx - (sx - v.x) * (k / v.k), y: sy - (sy - v.y) * (k / v.k) }));
    },
    [limitar],
  );

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomEn(e.clientX - r.left, e.clientY - r.top, vistaRef.current.k * Math.exp(-e.deltaY * 0.0018));
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [zoomEn]);

  const local = (e: React.PointerEvent) => {
    const r = caja.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const alBajar = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-pin]")) return;
    if (animacion.current) cancelAnimationFrame(animacion.current);
    punteros.current.set(e.pointerId, local(e));
    const pts = [...punteros.current.values()];
    if (pts.length === 1) gesto.current = { ...pts[0], vista: vistaRef.current, movido: false };
    if (pts.length === 2) {
      gesto.current = { x: 0, y: 0, vista: vistaRef.current, movido: true, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), k: vistaRef.current.k };
    }
  };

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!punteros.current.has(e.pointerId) || !gesto.current) return;
    punteros.current.set(e.pointerId, local(e));
    const pts = [...punteros.current.values()];
    const g = gesto.current;
    if (pts.length >= 2 && g.dist && g.k) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomEn((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, (g.k * d) / g.dist);
      return;
    }
    const dx = pts[0].x - g.x;
    const dy = pts[0].y - g.y;
    if (!g.movido && Math.hypot(dx, dy) > 5) {
      g.movido = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (g.movido) setVista(limitar({ k: g.vista.k, x: g.vista.x + dx, y: g.vista.y + dy }));
  };

  const alSoltar = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!punteros.current.has(e.pointerId)) return;
    const g = gesto.current;
    const p = local(e);
    punteros.current.delete(e.pointerId);
    if (punteros.current.size === 0) gesto.current = null;
    if (!g || g.movido || !modoPin) return;
    const v = vistaRef.current;
    const coords = proy.invert?.([(p.x - v.x) / v.k, (p.y - v.y) / v.k]);
    if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return;
    const [lng, lat] = coords;
    const vuelta = proy([lng, lat]);
    if (!vuelta || Math.hypot(vuelta[0] - (p.x - v.x) / v.k, vuelta[1] - (p.y - v.y) / v.k) > 1) return; // fuera del globo
    onElegir(lat, lng);
  };

  const color = (pl: Plan) => {
    const p = partidosPorId.get(pl.partidoId);
    if (p?.estado === "vivo") return "#ff3b6b";
    if (p?.estado === "final") return "#7d86c7";
    if (yo && (pl.anfitrion === yo || pl.confirmados.includes(yo))) return "#f2c94c";
    return "#00f0ff";
  };

  const aPantalla = (lng: number, lat: number) => {
    const p = proy([lng, lat]);
    return p ? { x: p[0] * vista.k + vista.x, y: p[1] * vista.k + vista.y } : null;
  };
  const visible = (s: { x: number; y: number } | null, margen = 40): s is { x: number; y: number } =>
    !!s && s.x > -margen && s.y > -margen && s.x < tam.w + margen && s.y < tam.h + margen;

  const noche = estilo === "noche";
  const pines = [...planes].sort((a, b) => Number(a.id === activo) - Number(b.id === activo));
  const k = vista.k;
  // Zoom "efectivo": en pantallas angostas el mundo se dibuja más chico, así que los nombres aparecen más tarde.
  const ke = k * Math.min(1, Math.max(tam.w, 1) / 820);
  const tinta = noche ? "#00f0ff" : "#0b0e28";
  const fondoTexto = noche ? "#0b0e28" : "#ffffff";
  const tamEscudo = k * Math.min(1, Math.max(tam.w, 1) / 820) >= 7 ? 28 : k * Math.min(1, Math.max(tam.w, 1) / 820) >= 4.5 ? 22 : 16;

  const etiqueta = (txt: string, s: { x: number; y: number }, tipo: "pais" | "region") => (
    <text
      key={`${tipo}-${txt}`}
      x={s.x}
      y={s.y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily="var(--font-titulo), sans-serif"
      fontWeight={tipo === "region" ? 800 : 700}
      fontStyle={tipo === "region" ? "italic" : "normal"}
      fontSize={tipo === "region" ? 13 : k >= 3 ? 13 : 11.5}
      letterSpacing={tipo === "pais" ? 1.2 : 0.4}
      fill={tipo === "region" ? (noche ? "#f2c94c" : "#0b0e28") : noche ? "#c9cdf2" : "#1d2560"}
      stroke={fondoTexto}
      strokeWidth={3.5}
      paintOrder="stroke"
      strokeLinejoin="round"
      style={{ textTransform: "uppercase" }}
      pointerEvents="none"
    >
      {txt}
    </text>
  );

  const francia = aPantalla(2.4, 46.9);

  return (
    <div ref={caja} className={`absolute inset-0 overflow-hidden ${noche ? "bg-noche-950" : "bg-[#1b2a6b]"}`}>
      {tam.w > 0 && (
        <svg
          width={tam.w}
          height={tam.h}
          className={`block touch-none select-none ${modoPin ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          role="application"
          aria-label="Mapa del mundo para poner pines"
        >
          <defs>
            <pattern id="trama" width={6 / k} height={6 / k} patternUnits="userSpaceOnUse">
              <circle cx={3 / k} cy={3 / k} r={0.9 / k} fill={noche ? "rgba(0,240,255,.12)" : "rgba(11,14,40,.13)"} />
            </pattern>
            <clipPath id="recorte-mexico">
              <path d={mexico} />
            </clipPath>
            {espana && (
              <clipPath id="recorte-espana">
                <path d={espana.d} />
              </clipPath>
            )}
            <linearGradient id="oro-francia" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f8df8e" />
              <stop offset="0.55" stopColor="#f2c94c" />
              <stop offset="1" stopColor="#c99a1e" />
            </linearGradient>
          </defs>
          <g transform={`translate(${vista.x} ${vista.y}) scale(${k})`}>
            <path d={esfera} fill={noche ? "#0b0e28" : "#7fd3ea"} stroke="#0b0e28" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <path d={reticula} fill="none" stroke={noche ? "rgba(0,240,255,.12)" : "rgba(255,255,255,.55)"} strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            {formas.map((f) => (
              <path
                key={f.id}
                d={f.d}
                fill={f.id === ID_FRANCIA ? "url(#oro-francia)" : f.id === ID_ESPANA ? (noche ? "#5a1020" : "#e4504f") : noche ? "#1d2560" : COLOR_PAIS[f.id] ?? PASTEL[0]}
                stroke={f.id === ID_FRANCIA ? "#0b0e28" : tinta}
                strokeWidth={f.id === ID_FRANCIA ? 2.2 : noche ? 0.8 : 1.4}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              >
                <title>{NOMBRES_PAISES.find((n) => n[0] === f.id)?.[1] ?? f.nombre}</title>
              </path>
            ))}

            {/* Estados Unidos por regiones */}
            {regionesEeuu.map((r) => (
              <path key={r.nombre} d={r.d} fill={noche ? "#232c6e" : r.color} stroke={tinta} strokeWidth={noche ? 0.9 : 1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                <title>{r.nombre}</title>
              </path>
            ))}

            {/* México por regiones */}
            <g clipPath="url(#recorte-mexico)">
              {regionesMexico.map((r) => (
                <path key={r.nombre} d={r.d} fill={noche ? "#232c6e" : r.color} stroke={tinta} strokeWidth={noche ? 0.9 : 1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                  <title>{r.nombre}</title>
                </path>
              ))}
            </g>
            <path d={mexico} fill="none" stroke={tinta} strokeWidth={noche ? 1 : 1.8} vectorEffect="non-scaling-stroke" />

            {/* España con la Copa de fondo */}
            {espana && (
              <g clipPath="url(#recorte-espana)" opacity={0.9}>
                <g transform={espana.transform}>
                  <CopaDibujo />
                </g>
              </g>
            )}
            {espana && <path d={espana.d} fill="none" stroke={tinta} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />}

            <path d={esfera} fill="url(#trama)" pointerEvents="none" />
          </g>

          {/* Nombres de países y regiones */}
          {NOMBRES_PAISES.map(([id, nombre, lon, lat, minK]) => {
            if (ke < minK) return null;
            if ((id === ID_MEXICO || id === ID_EEUU) && ke >= 1.8) return null;
            if (id === ID_FRANCIA) return null;
            const s = aPantalla(lon, lat);
            return visible(s) ? etiqueta(nombre, s, "pais") : null;
          })}
          {ke >= 1.8 &&
            REGIONES_EEUU.map((r) => {
              const s = aPantalla(r.lon, r.lat);
              return visible(s) ? etiqueta(r.nombre, s, "region") : null;
            })}
          {REGIONES_MEXICO.map((r) => {
            if (ke < r.minK) return null;
            const s = aPantalla(r.lon, r.lat);
            return visible(s) ? etiqueta(r.nombre, s, "region") : null;
          })}

          {/* Francia: dos estrellas y la leyenda */}
          {visible(francia, 120) && (
            <g transform={`translate(${francia.x} ${francia.y})`} pointerEvents="none">
              <Estrella x={-9} y={ke >= 2 ? -14 : -4} r={ke >= 2 ? 8 : 6} />
              <Estrella x={9} y={ke >= 2 ? -14 : -4} r={ke >= 2 ? 8 : 6} />
              {ke >= 2 && etiqueta("Francia", { x: 0, y: 4 }, "pais")}
            </g>
          )}

          {(() => {
              const s = aPantalla(-5.5, 48.2);
              return visible(s, 200) ? (
                <g transform={`translate(${s.x} ${s.y})`} pointerEvents="none">
                  <rect x={-176} y={-11} width={172} height={22} rx={11} fill="#0b0e28" stroke="#f2c94c" strokeWidth={2} />
                  <text x={-90} y={4.5} textAnchor="middle" fontSize={12} fontWeight={800} fill="#f2c94c" fontFamily="var(--font-cuerpo), sans-serif">
                    Fuerza a la tierra del bi
                  </text>
                  <path d="M-4 0h10" stroke="#f2c94c" strokeWidth={2} />
                </g>
              ) : null;
            })()}

          {/* Escudos de los clubes en su estadio al acercar */}
          {ke >= 3.5 &&
            Object.entries(ESTADIOS).map(([id, [lat, lon]]) => {
              const eq = EQUIPOS[id];
              const s = aPantalla(lon, lat);
              if (!eq || !visible(s)) return null;
              return (
                <foreignObject key={id} x={s.x - tamEscudo / 2} y={s.y - tamEscudo / 2} width={tamEscudo} height={tamEscudo} pointerEvents="none">
                  <div title={`${eq.nombre} · ${eq.estadio}`} style={{ width: tamEscudo, height: tamEscudo }}>
                    <Escudo equipo={eq} tam={tamEscudo} />
                  </div>
                </foreignObject>
              );
            })}

          {pines.map((pl) => {
            const s = aPantalla(pl.lng, pl.lat);
            if (!s) return null;
            const esActivo = activo === pl.id;
            return (
              <g key={pl.id} data-pin transform={`translate(${s.x} ${s.y})`} className="cursor-pointer" onClick={() => onAbrir(pl)} role="button" aria-label={`${pl.hashtag} en ${pl.lugar}`}>
                <PinSvg tipo={pl.tipo} color={color(pl)} activo={esActivo} etiqueta={esActivo ? pl.hashtag : undefined} />
              </g>
            );
          })}
          {borrador &&
            (() => {
              const s = aPantalla(borrador.lng, borrador.lat);
              return s ? (
                <g transform={`translate(${s.x} ${s.y})`} pointerEvents="none">
                  <PinSvg tipo="nuevo" color="#f2c94c" activo nuevo />
                </g>
              ) : null;
            })()}
        </svg>
      )}
    </div>
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
            {!texto && populares.length === 0 && <p className="p-4 text-sm text-white/60">Todavía no hay pines. Pon el primero con el botón “Poner mi pin”.</p>}
            {!texto && populares.length > 0 && (
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
            <input value={pais} onChange={(e) => setPais(e.target.value)} className={claseInput} placeholder="México" />
          </Campo>
          <Campo etiqueta="Estado">
            <input value={estado} onChange={(e) => setEstado(e.target.value)} className={claseInput} placeholder="Jalisco" />
          </Campo>
        </div>
        <Campo etiqueta="Ciudad">
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={claseInput} placeholder="Guadalajara" />
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
  onVoy,
  onMensaje,
  onRecordatorios,
  onCompartir,
  onPedirPermiso,
  onBorrar,
  onCerrar,
}: {
  plan: Plan;
  partido?: Partido;
  ahora: number;
  yo: string;
  permisoAvisos: NotificationPermission | "no-soportado";
  onPedirNombre: (luego: (nombre: string) => void) => void;
  onVoy: (pl: Plan, nombre: string) => void;
  onMensaje: (pl: Plan, nombre: string, texto: string) => void;
  onRecordatorios: (pl: Plan, r: Plan["recordatorios"]) => void;
  onCompartir: (pl: Plan) => void;
  onPedirPermiso: () => void;
  onBorrar: (pl: Plan) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const voy = !!yo && plan.confirmados.includes(yo);
  const inicio = partido?.inicio ?? plan.snap.inicio;
  const titulo = `${partido?.local.nombre ?? plan.snap.local} vs ${partido?.visita.nombre ?? plan.snap.visita}`;
  const direccion = `${plan.lugar}, ${plan.ciudad}, ${plan.estado}, ${plan.pais}`;
  const detalles = `Plan ${plan.hashtag} con ${plan.confirmados.join(", ")}. Organiza: ${plan.anfitrion}.`;

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [plan.chat.length]);

  const alternarVoy = () => onPedirNombre((nombre) => onVoy(plan, nombre));

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    onPedirNombre((nombre) => {
      onMensaje(plan, nombre, t);
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
                onClick={() => onRecordatorios(plan, { ...plan.recordatorios, [k]: !on })}
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
        {/* Borrar */}
        <div className="rounded-2xl border border-vivo/30 bg-vivo/[.06] p-3">
          {confirmarBorrar ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold">¿Borrar {plan.hashtag} del mapa?</p>
              <Boton onClick={() => setConfirmarBorrar(false)}>Cancelar</Boton>
              <Boton tono="vivo" onClick={() => onBorrar(plan)}>
                <Trash2 className="h-4 w-4" /> Sí, borrar
              </Boton>
            </div>
          ) : (
            <button onClick={() => setConfirmarBorrar(true)} className="flex w-full items-center justify-center gap-2 py-1 text-sm font-bold text-vivo">
              <Trash2 className="h-4 w-4" /> Borrar plan
            </button>
          )}
        </div>
        <p className="text-center text-[11px] text-white/35">
          {NUBE ? "Los pines, confirmados y el chat se ven en tiempo real en todos los dispositivos." : "Los pines, confirmados y el chat se guardan en este dispositivo."}
        </p>
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

/* ─────────────────────────── Nube (Supabase) ─────────────────────────── */

// Con estas dos variables en Vercel, pines, confirmados y chats se comparten en tiempo real entre todos los dispositivos.
// Sin ellas la app funciona igual, pero todo se guarda solo en el navegador.
const URL_NUBE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const LLAVE_NUBE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const NUBE: SupabaseClient | null = URL_NUBE && LLAVE_NUBE ? createClient(URL_NUBE, LLAVE_NUBE) : null;
const SALA_GENERAL = "general";

interface FilaPlan {
  id: string;
  partido_id: string;
  snap: Plan["snap"];
  lat: number;
  lng: number;
  pais: string;
  estado: string;
  ciudad: string;
  lugar: string;
  tipo: TipoLugar;
  hashtag: string;
  anfitrion: string;
  creado: string;
}
interface FilaMensaje {
  id: string;
  sala: string;
  autor: string;
  texto: string;
  hora: string;
}

type Recordatorios = Record<string, Plan["recordatorios"]>;

/** Lee todo lo compartido y lo arma como planes con sus confirmados y su chat. */
async function leerNube(recordatorios: Recordatorios): Promise<{ planes: Plan[]; general: Mensaje[] } | null> {
  if (!NUBE) return null;
  const [pl, co, me] = await Promise.all([
    NUBE.from("planes").select("*").order("creado"),
    NUBE.from("confirmados").select("plan_id, nombre, creado").order("creado"),
    NUBE.from("mensajes").select("*").order("hora", { ascending: false }).limit(1500),
  ]);
  if (pl.error || co.error || me.error) throw pl.error ?? co.error ?? me.error;
  const mensajes = ((me.data ?? []) as FilaMensaje[]).reverse();
  const aMensaje = (m: FilaMensaje): Mensaje => ({ id: m.id, autor: m.autor, texto: m.texto, hora: m.hora });
  const planes = ((pl.data ?? []) as FilaPlan[]).map((f) => ({
    id: f.id,
    partidoId: f.partido_id,
    snap: f.snap,
    lat: f.lat,
    lng: f.lng,
    pais: f.pais,
    estado: f.estado,
    ciudad: f.ciudad,
    lugar: f.lugar,
    tipo: f.tipo,
    hashtag: f.hashtag,
    anfitrion: f.anfitrion,
    confirmados: ((co.data ?? []) as { plan_id: string; nombre: string }[]).filter((c) => c.plan_id === f.id).map((c) => c.nombre),
    chat: mensajes.filter((m) => m.sala === f.id).map(aMensaje),
    recordatorios: recordatorios[f.id] ?? { dia: true, hora: true },
    creado: f.creado,
  }));
  return { planes, general: mensajes.filter((m) => m.sala === SALA_GENERAL).map(aMensaje) };
}

/* ─────────────────────────── Chat en vivo ─────────────────────────── */

function ChatEnVivo({
  mensajes,
  yo,
  enLinea,
  onEnviar,
}: {
  mensajes: Mensaje[];
  yo: string;
  enLinea: string[];
  onEnviar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes.length]);
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    onEnviar(t);
    setTexto("");
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/10 px-4 pb-3 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Chat en vivo</h2>
            <p className="text-xs text-white/50">{NUBE ? "Todos los que tienen la app abierta lo ven al momento." : "Modo local: los mensajes se quedan en este dispositivo."}</p>
          </div>
          {NUBE && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neon/10 px-2.5 py-1 text-xs font-bold text-neon">
              <span className="h-2 w-2 animate-pulse rounded-full bg-neon" /> {enLinea.length} en línea
            </span>
          )}
        </div>
        {NUBE && enLinea.length > 0 && <p className="mt-2 truncate text-xs text-white/45">Conectados: {enLinea.join(", ")}</p>}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {mensajes.length === 0 && <p className="py-10 text-center text-sm text-white/45">Nadie ha escrito todavía. Di dónde vas a ver el partido.</p>}
        {mensajes.map((m) => {
          const mio = m.autor === yo;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mio ? "rounded-br-md bg-neon text-noche" : "rounded-bl-md bg-white/[.08]"}`}>
                {!mio && <p className="text-[11px] font-extrabold text-oro">{m.autor}</p>}
                <p className="whitespace-pre-wrap break-words font-medium">{m.texto}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mio ? "text-noche/60" : "text-white/40"}`}>{fmtHora(m.hora)}</p>
              </div>
            </motion.div>
          );
        })}
        <div ref={fin} />
      </div>
      <form onSubmit={enviar} className="flex gap-2 border-t border-white/10 p-3 pb-24 lg:pb-3">
        <input id="chat-general" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} placeholder="Escribe a todos…" className={`${claseInput} py-2`} aria-label="Mensaje al chat en vivo" />
        <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon text-noche transition active:scale-90 disabled:opacity-40" disabled={!texto.trim()} aria-label="Enviar al chat en vivo">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────── App principal ─────────────────────────── */

export default function LaPrevia() {
  const [desfase, setDesfase] = useState(0);
  const [demo, setDemo] = useState(false);
  const ahora = useAhora(desfase);
  const { partidos, fuente } = usePartidos(ahora, demo);
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
  const [ordenMapa, setOrdenMapa] = useState<{ tipo: "mas" | "menos" | "todo"; n: number } | null>(null);
  const [compartir, setCompartir] = useState<{ mensaje: string; url: string } | null>(null);
  const [pedirNombre, setPedirNombre] = useState<((n: string) => void) | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">("default");
  const [general, setGeneral] = useState<Mensaje[]>([]);
  const [enLinea, setEnLinea] = useState<string[]>([]);
  const listo = useRef(false);
  // En modo nube: recordatorios y llaves para borrar viven solo en este dispositivo.
  const recordatoriosRef = useRef<Recordatorios>({});
  const canal = useRef<RealtimeChannel | null>(null);
  const sinNube = useRef(false);

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
      const sig = CALENDARIO.find((p) => Date.parse(p.inicio) > Date.now() && p.local.id !== "tbd");
      if (sig) des = Date.parse(sig.inicio) + 38 * 60000 - Date.now();
      setDesfase(des);
      setDemo(true);
    }
    // Solo los planes que alguien agregó de verdad (se descartan los de muestra de versiones anteriores).
    let iniciales = NUBE ? [] : leer<Plan[]>("previa:planes", []).filter((p) => !p.id.startsWith("demo-"));
    recordatoriosRef.current = leer<Recordatorios>("previa:recordatorios", {});
    if (!NUBE) setGeneral(leer<Mensaje[]>("previa:general", []));
    setYo(leer<string>("previa:yo", ""));
    setPermiso(typeof Notification === "undefined" ? "no-soportado" : Notification.permission);

    const compartido = params.get("plan");
    if (compartido) {
      try {
        const pl = JSON.parse(deBase64(compartido)) as Plan;
        if (pl?.id && typeof pl.lat === "number") {
          // Con la nube el plan ya está compartido; sin ella se agrega desde el enlace.
          const ya = iniciales.find((x) => x.id === pl.id);
          if (!ya && !NUBE) iniciales = [...iniciales, { ...pl, chat: pl.chat ?? [] }];
          setAbierto(pl.id);
          setFoco({ lat: pl.lat, lng: pl.lng, zoom: 5, n: Date.now() });
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
    if (listo.current && !NUBE) guardar("previa:planes", planes);
  }, [planes]);
  useEffect(() => {
    if (listo.current && !NUBE) guardar("previa:general", general.slice(-300));
  }, [general]);

  // Nube: carga todo y se suscribe a cambios para ver al momento lo que agregan otros dispositivos.
  const recargar = useCallback(async () => {
    try {
      const r = await leerNube(recordatoriosRef.current);
      if (r) {
        setPlanes(r.planes);
        setGeneral(r.general);
      }
      sinNube.current = false;
    } catch (e) {
      if (sinNube.current) return;
      sinNube.current = true;
      const msg = (e as { message?: string })?.message ?? "";
      avisar({
        titulo: "Sin conexión con la nube",
        texto: /relation|schema cache|does not exist/i.test(msg) ? "Falta correr supabase/schema.sql en Supabase." : msg || "Reintentando…",
        tono: "vivo",
      });
    }
  }, [avisar]);

  useEffect(() => {
    if (!NUBE) return;
    const nube = NUBE;
    recargar();
    let espera: ReturnType<typeof setTimeout> | undefined;
    const pronto = () => {
      clearTimeout(espera);
      espera = setTimeout(recargar, 250);
    };
    const c = nube
      .channel("la-previa", { config: { presence: { key: uid() } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "planes" }, pronto)
      .on("postgres_changes", { event: "*", schema: "public", table: "confirmados" }, pronto)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, pronto)
      .on("presence", { event: "sync" }, () => {
        const estado = c.presenceState<{ nombre: string }>();
        const nombres = Object.values(estado).flatMap((xs) => xs.map((x) => x.nombre || "Anónimo"));
        setEnLinea([...new Set(nombres)].sort());
      })
      .subscribe((st) => {
        if (st === "SUBSCRIBED") {
          c.track({ nombre: leer<string>("previa:yo", "") });
          pronto();
        }
      });
    canal.current = c;
    // Respaldo por si el tiempo real tarda o se corta: se pone al día cada 8 s.
    const respaldo = setInterval(() => document.visibilityState === "visible" && recargar(), 8000);
    // Al volver a la app desde segundo plano (móviles) se pone al día.
    const visible = () => document.visibilityState === "visible" && pronto();
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(espera);
      clearInterval(respaldo);
      document.removeEventListener("visibilitychange", visible);
      canal.current = null;
      nube.removeChannel(c);
    };
  }, [recargar]);

  useEffect(() => {
    canal.current?.track({ nombre: yo }).catch(() => {});
  }, [yo]);

  // Sincroniza entre pestañas abiertas del mismo dispositivo.
  useEffect(() => {
    if (NUBE) return;
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
    setFoco({ lat: pl.lat, lng: pl.lng, zoom: 5, n: Date.now() });
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


  const cambiarPlan = (id: string, f: (pl: Plan) => Plan) => setPlanes((xs) => xs.map((x) => (x.id === id ? f(x) : x)));
  const fallo = (texto = "No se guardó, revisa tu conexión.") => {
    avisar({ titulo: "Algo salió mal", texto, tono: "vivo" });
    recargar();
  };

  const guardarPin = async (pl: Plan) => {
    if (NUBE) {
      const clave = uid() + uid();
      const { confirmados: _c, chat: _m, recordatorios: _r, partidoId, ...resto } = pl;
      const { error } = await NUBE.rpc("crear_plan", { p: { ...resto, partido_id: partidoId }, p_clave: clave });
      if (error) {
        avisar(
          error.code === "23505"
            ? { titulo: `${pl.hashtag} ya lo usa alguien más`, texto: "Elige otro hashtag.", tono: "vivo" }
            : { titulo: "No se pudo guardar el pin", texto: "Revisa tu conexión e inténtalo otra vez.", tono: "vivo" },
        );
        return;
      }
      guardar("previa:claves", { ...leer<Record<string, string>>("previa:claves", {}), [pl.id]: clave });
    }
    setPlanes((xs) => [...xs, pl]);
    setBorrador(null);
    setAbierto(pl.id);
    if (!yo) {
      setYo(pl.anfitrion);
      guardar("previa:yo", pl.anfitrion);
    }
    avisar({ titulo: `¡Pin clavado! ${pl.hashtag}`, texto: "Compártelo para que tus amigos se apunten.", tono: "oro" });
  };

  const borrarPlan = async (pl: Plan) => {
    if (NUBE) {
      const claves = leer<Record<string, string>>("previa:claves", {});
      const { data, error } = await NUBE.rpc("borrar_plan", { p_id: pl.id, p_clave: claves[pl.id] ?? "" });
      if (error) return fallo();
      if (!data) {
        avisar({ titulo: "Solo quien creó el pin puede borrarlo", texto: "Bórralo desde el dispositivo donde lo clavaste.", tono: "vivo" });
        return;
      }
      delete claves[pl.id];
      guardar("previa:claves", claves);
    }
    setPlanes((xs) => xs.filter((x) => x.id !== pl.id));
    setAbierto(null);
    avisar({ titulo: `Plan ${pl.hashtag} borrado` });
  };

  const alternarVoy = async (pl: Plan, nombre: string) => {
    const voy = pl.confirmados.includes(nombre);
    cambiarPlan(pl.id, (x) => ({ ...x, confirmados: voy ? x.confirmados.filter((n) => n !== nombre) : [...x.confirmados, nombre] }));
    if (!NUBE) return;
    const { error } = voy
      ? await NUBE.from("confirmados").delete().eq("plan_id", pl.id).eq("nombre", nombre)
      : await NUBE.from("confirmados").insert({ plan_id: pl.id, nombre });
    if (error && error.code !== "23505") fallo();
  };

  const mandarMensaje = async (sala: string, autor: string, texto: string) => {
    const m: Mensaje = { id: uid(), autor, texto, hora: new Date().toISOString() };
    if (sala === SALA_GENERAL) setGeneral((xs) => [...xs, m]);
    else cambiarPlan(sala, (x) => ({ ...x, chat: [...x.chat, m] }));
    if (!NUBE) return;
    const { error } = await NUBE.from("mensajes").insert({ sala, autor, texto });
    if (error) fallo(`Tu mensaje no se envió: ${error.message}`);
  };

  const cambiarRecordatorios = (pl: Plan, r: Plan["recordatorios"]) => {
    cambiarPlan(pl.id, (x) => ({ ...x, recordatorios: r }));
    recordatoriosRef.current = { ...recordatoriosRef.current, [pl.id]: r };
    guardar("previa:recordatorios", recordatoriosRef.current);
  };

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
    vista === "chat" ? (
      <ChatEnVivo mensajes={general} yo={yo} enLinea={enLinea} onEnviar={(t) => conNombre((n) => mandarMensaje(SALA_GENERAL, n, t))} />
    ) : vista === "planes" ? (
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
            title={
              fuente === "demo"
                ? "Partidos y fechas oficiales de uefa.com; el marcador en vivo está simulado para la demostración"
                : "Partidos, fechas y resultados oficiales publicados en uefa.com"
            }
            className={`hidden rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider sm:inline ${
              fuente === "demo" ? "bg-oro/15 text-oro" : "bg-neon/15 text-neon"
            }`}
          >
            {fuente === "demo" ? "Calendario oficial · marcador demo" : "Calendario oficial UEFA"}
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
          <MapaSvg
            planes={filtrados}
            partidosPorId={partidosPorId}
            yo={yo}
            activo={abierto}
            modoPin={modoPin}
            borrador={borrador}
            foco={foco}
            estilo={estiloMapa}
            orden={ordenMapa}
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
            {(
              [
                ["mas", "Acercar", Plus],
                ["menos", "Alejar", Minus],
                ["todo", "Ver el mundo completo", Globe2],
              ] as const
            ).map(([tipo, txt, Icono]) => (
              <button key={tipo} onClick={() => setOrdenMapa({ tipo, n: Date.now() })} className="grid h-10 w-10 place-items-center rounded-xl border-2 border-noche bg-white text-noche shadow-comic transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none" aria-label={txt} title={txt}>
                <Icono className="h-5 w-5" />
              </button>
            ))}
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
                <p className="flex-1 text-sm font-extrabold leading-tight">Toca el dibujo donde se van a juntar. Acerca el mapa para mayor precisión.</p>
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
                ["chat", "Chat en vivo", MessageCircle],
              ] as const
            ).map(([v, t, Icono]) => {
              const activo = v === "partidos" ? vista === "partidos" || vista === "mapa" : vista === v;
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
            ["chat", "Chat", MessageCircle],
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
            onVoy={alternarVoy}
            onMensaje={(pl, n, t) => mandarMensaje(pl.id, n, t)}
            onRecordatorios={cambiarRecordatorios}
            onCompartir={compartirPlan}
            onBorrar={borrarPlan}
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
