import { describe, expect, it } from "vitest";
import {
  aBase64,
  apodo,
  deBase64,
  ENLACE_CORTO,
  enlaceGoogleCalendar,
  fechaEnlace,
  HASHTAG_OK,
  limpiarHashtag,
  slugPartido,
  sugerirHashtag,
} from "../enlaces";
import { equipo, partido } from "./fabrica";

describe("enlaces cortos de partido", () => {
  it("arma /bayernVsBarcelona4noviembre", () => {
    const p = partido(equipo("bay", "Bayern München"), equipo("bar", "Barcelona"), { inicio: "2026-11-04T20:00:00.000Z" });
    expect(slugPartido(p)).toBe("bayernVsBarcelona4noviembre");
    expect(ENLACE_CORTO.test(slugPartido(p))).toBe(true);
  });

  it("usa siglas en minúsculas cuando el apodo es todo mayúsculas", () => {
    const p = partido(equipo("psg", "Paris Saint-Germain"), equipo("rma", "Real Madrid"));
    expect(slugPartido(p)).toMatch(/^psgVsRealMadrid/);
  });

  it("quita acentos y letras especiales del nombre", () => {
    expect(apodo(equipo("x", "Bodø/Glimt"))).toBe("BodoGlimt");
    expect(apodo(equipo("y", "Fenerbahçe"))).toBe("Fenerbahce");
  });

  it("la fecha del enlace va en hora de Madrid, no en la del visitante", () => {
    // 23:30 UTC del 4 de noviembre ya es 5 de noviembre en Madrid.
    expect(fechaEnlace("2026-11-04T23:30:00.000Z")).toBe("5noviembre");
  });
});

describe("planes dentro del enlace (sin base de datos)", () => {
  it("base64 de ida y vuelta conserva acentos y emoji, y es seguro para URL", () => {
    const plan = JSON.stringify({ lugar: "La Cantina de Peñón 🍺", hashtag: "#ChampionsXalapa" });
    const codificado = aBase64(plan);
    expect(codificado).not.toMatch(/[+/=]/);
    expect(deBase64(codificado)).toBe(plan);
  });
});

describe("hashtags", () => {
  it("limpia espacios, signos y almohadillas repetidas", () => {
    expect(limpiarHashtag("##Champions Xalapa!")).toBe("#ChampionsXalapa");
    expect(limpiarHashtag("Previa_Peñón")).toBe("#Previa_Peñón");
  });

  it("valida largo y caracteres", () => {
    expect(HASHTAG_OK.test("#ChampionsXalapa")).toBe(true);
    expect(HASHTAG_OK.test("#ab")).toBe(false);
    expect(HASHTAG_OK.test("#con espacio")).toBe(false);
  });

  it("sugiere uno libre sin importar mayúsculas", () => {
    expect(sugerirHashtag("Xalapa", [])).toBe("#ChampionsXalapa");
    expect(sugerirHashtag("Xalapa", ["#championsxalapa"])).toBe("#ChampionsXalapa2");
    expect(sugerirHashtag("Xalapa", ["#ChampionsXalapa", "#ChampionsXalapa2"])).toBe("#ChampionsXalapa3");
  });
});

describe("Google Calendar", () => {
  it("crea un evento de dos horas en UTC", () => {
    const url = new URL(enlaceGoogleCalendar("Real Madrid vs Liverpool", "2026-11-04T20:00:00.000Z", "Xalapa", "Con los amigos"));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("dates")).toBe("20261104T200000Z/20261104T220000Z");
    expect(url.searchParams.get("text")).toBe("Real Madrid vs Liverpool");
    expect(url.searchParams.get("location")).toBe("Xalapa");
  });
});
