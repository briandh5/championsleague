import { describe, expect, it } from "vitest";
import { mismoEquipo } from "../equipos";
import { citaEnTexto, leerCitaEnTexto, quitarCitaDeTexto } from "../citas";

describe("mismoEquipo (empatar nombres de ESPN con el calendario)", () => {
  it.each([
    ["Bayern München", "Bayern Munich"],
    ["FC Barcelona", "Barcelona"],
    ["Slavia Praha", "Slavia Prague"],
    ["Bodø/Glimt", "Bodo/Glimt"],
    ["Paris Saint-Germain", "Paris Saint Germain"],
  ])("%s = %s", (a, b) => {
    expect(mismoEquipo(a, b)).toBe(true);
  });

  it.each([
    ["Manchester City", "Manchester United"],
    ["Real Madrid", "Atlético de Madrid"],
    ["", "Barcelona"],
  ])("%s ≠ %s", (a, b) => {
    expect(mismoEquipo(a, b)).toBe(false);
  });
});

describe("citas dentro del texto del chat", () => {
  it("guarda y recupera la cita sin mostrar la marca", () => {
    const texto = citaEnTexto({ autor: "Ana", texto: "¿Vamos al bar\nde siempre?" }, "Va, a las 8");
    expect(leerCitaEnTexto(texto)).toEqual({ autor: "Ana", texto: "¿Vamos al bar de siempre?" });
    expect(quitarCitaDeTexto(texto)).toBe("Va, a las 8");
  });

  it("recorta citas largas a 100 caracteres", () => {
    const texto = citaEnTexto({ autor: "Leo", texto: "x".repeat(300) }, "ok");
    expect(leerCitaEnTexto(texto)?.texto).toHaveLength(100);
  });

  it("un mensaje normal no tiene cita", () => {
    expect(leerCitaEnTexto("Hola")).toBeNull();
  });
});
