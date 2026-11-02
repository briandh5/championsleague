// Lógica pura del dominio, sin React ni navegador: se prueba con Vitest.
import type { Equipo, Partido } from "./tipos";

export const aBase64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const deBase64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export const fechaGoogle = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");

/* Enlaces cortos: /bayernVsBarcelona4noviembre para un partido y /ChampionsXalapa (su hashtag) para un plan. */
export const APODOS: Record<string, string> = {
  bay: "Bayern", psg: "PSG", atm: "Atletico", mci: "ManCity", mun: "ManUnited", bvb: "Dortmund", rbl: "Leipzig", psv: "PSV",
  sha: "Shakhtar", cbr: "Brujas", sla: "Slavia", aek: "AEK", slo: "Slovan", scp: "Sporting", bod: "Bodo", bet: "Betis", lask: "LASK",
};
export const sinAcentos = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/ı/g, "i").replace(/ş/g, "s");
export const apodo = (e: Equipo) => APODOS[e.id] ?? sinAcentos(e.nombre).split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
// La fecha va en hora de Madrid para que el enlace sea el mismo en cualquier país.
export const fechaEnlace = (iso: string) => {
  const f = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).formatToParts(new Date(iso));
  return (f.find((x) => x.type === "day")?.value ?? "") + sinAcentos(f.find((x) => x.type === "month")?.value ?? "");
};
export function slugPartido(p: Partido) {
  const a = apodo(p.local);
  const inicio = a === a.toUpperCase() ? a.toLowerCase() : a[0].toLowerCase() + a.slice(1);
  return inicio + "Vs" + apodo(p.visita) + fechaEnlace(p.inicio);
}
export const ENLACE_CORTO = /^[A-Za-z0-9_]{3,80}$/;

export function enlaceGoogleCalendar(titulo: string, inicio: string, lugar: string, detalles: string) {
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

export const HASHTAG_OK = /^#[\p{L}\p{N}_]{3,30}$/u;
export const limpiarHashtag = (s: string) => `#${s.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`;
export const sugerirHashtag = (ciudad: string, existentes: string[]) => {
  const base = limpiarHashtag(`Champions${ciudad.replace(/\s+/g, "")}`).slice(0, 28);
  let tag = base;
  let i = 2;
  const usados = new Set(existentes.map((t) => t.toLowerCase()));
  while (usados.has(tag.toLowerCase())) tag = `${base}${i++}`;
  return tag;
};
