// Lógica pura del dominio, sin React ni navegador: se prueba con Vitest.
import type { Respuesta } from "./tipos";

// Si la base no tiene la columna `responde`, la cita viaja dentro del texto en una primera línea marcada (invisible).
export const MARCA_CITA = "\u2063";
export const citaEnTexto = (r: Respuesta, texto: string) => `${MARCA_CITA}${r.autor}${MARCA_CITA}${r.texto.replace(/\s+/g, " ").slice(0, 100)}\n${texto}`;
export function leerCitaEnTexto(texto: string): Respuesta | null {
  if (!texto.startsWith(MARCA_CITA)) return null;
  const fin = texto.indexOf("\n");
  const [, autor, cita] = texto.slice(0, fin < 0 ? undefined : fin).split(MARCA_CITA);
  return autor ? { autor, texto: cita ?? "" } : null;
}
export const quitarCitaDeTexto = (texto: string) => texto.slice(texto.indexOf("\n") + 1);
