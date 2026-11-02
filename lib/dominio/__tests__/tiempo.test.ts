import { describe, expect, it } from "vitest";
import { claveDia, conEstado, faltan, hash, horaMadrid } from "../tiempo";
import { equipo, partido } from "./fabrica";

/** Desfase real de Madrid según la base de zonas horarias del sistema, para no confiar en la tabla escrita a mano. */
const desfaseMadrid = (iso: string) => {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" }).formatToParts(new Date(iso));
  return partes.find((p) => p.type === "timeZoneName")?.value; // "GMT+1" o "GMT+2"
};

describe("horaMadrid", () => {
  it.each([
    ["2026-09-16", "21:00", "2026-09-16T19:00:00.000Z"], // horario de verano (UTC+2)
    ["2026-10-24", "18:45", "2026-10-24T16:45:00.000Z"], // último sábado de verano
    ["2026-10-25", "21:00", "2026-10-25T20:00:00.000Z"], // ya en invierno (UTC+1)
    ["2027-01-27", "21:00", "2027-01-27T20:00:00.000Z"],
    ["2027-03-28", "21:00", "2027-03-28T19:00:00.000Z"], // de vuelta en verano
    ["2027-06-05", "21:00", "2027-06-05T19:00:00.000Z"], // final
  ])("%s %s en Madrid es %s", (fecha, hora, esperado) => {
    expect(horaMadrid(fecha, hora)).toBe(esperado);
  });

  it("coincide con la zona horaria Europe/Madrid toda la temporada", () => {
    for (let t = Date.UTC(2026, 8, 1); t < Date.UTC(2027, 5, 10); t += 86_400_000) {
      const fecha = new Date(t).toISOString().slice(0, 10);
      const iso = horaMadrid(fecha, "21:00");
      const horasUTC = new Date(iso).getUTCHours();
      expect(`GMT+${21 - horasUTC}`).toBe(desfaseMadrid(iso));
    }
  });
});

describe("conEstado", () => {
  const p = partido(equipo("rma", "Real Madrid"), equipo("liv", "Liverpool"), { estado: "programado", inicio: "2026-11-04T20:00:00.000Z" });
  const inicio = Date.parse(p.inicio);
  const min = (m: number) => inicio + m * 60_000;

  it("antes del silbatazo está programado", () => {
    expect(conEstado(p, min(-5), false)).toMatchObject({ estado: "programado", minuto: undefined });
  });

  it("calcula el minuto y el descanso", () => {
    expect(conEstado(p, min(0), false)).toMatchObject({ estado: "vivo", minuto: "1'" });
    expect(conEstado(p, min(46), false).minuto).toBe("45+");
    expect(conEstado(p, min(55), false).minuto).toBe("Descanso");
    expect(conEstado(p, min(62), false).minuto).toBe("46'");
    expect(conEstado(p, min(108), false).minuto).toBe("90+");
  });

  it("termina a los 112 minutos de reloj", () => {
    expect(conEstado(p, min(112), false)).toMatchObject({ estado: "final", minuto: undefined });
  });

  it("nunca inventa marcador fuera del modo demo", () => {
    const vivo = conEstado(p, min(80), false);
    expect(vivo.golesLocal).toBeUndefined();
    expect(vivo.golesVisita).toBeUndefined();
  });

  it("respeta un resultado oficial ya cargado", () => {
    const oficial = { ...p, estado: "final" as const, golesLocal: 2, golesVisita: 1 };
    expect(conEstado(oficial, min(-1000), false)).toBe(oficial);
  });

  it("el modo demo es determinista y los goles solo suben", () => {
    const a = conEstado(p, min(30), true);
    expect(conEstado(p, min(30), true)).toEqual(a);
    const b = conEstado(p, min(100), true);
    expect(b.golesLocal!).toBeGreaterThanOrEqual(a.golesLocal!);
    expect(b.golesVisita!).toBeGreaterThanOrEqual(a.golesVisita!);
  });
});

describe("utilidades de tiempo", () => {
  it("faltan da textos cortos", () => {
    const ahora = Date.parse("2026-11-04T12:00:00Z");
    expect(faltan("2026-11-04T12:30:00Z", ahora)).toBe("en 30 min");
    expect(faltan("2026-11-04T17:00:00Z", ahora)).toBe("en 5 h");
    expect(faltan("2026-11-05T12:00:00Z", ahora)).toBe("mañana");
    expect(faltan("2026-11-08T12:00:00Z", ahora)).toBe("en 4 días");
  });

  it("claveDia usa la fecha local con ceros", () => {
    expect(claveDia(new Date(2027, 0, 5, 10).toISOString())).toBe("2027-01-05");
  });

  it("hash es estable (FNV-1a de 32 bits)", () => {
    expect(hash("")).toBe(2166136261);
    expect(hash("abc")).toBe(hash("abc"));
    expect(hash("abc")).not.toBe(hash("abd"));
  });
});
