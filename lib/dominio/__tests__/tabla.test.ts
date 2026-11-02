import { describe, expect, it } from "vitest";
import { calcularTabla, zonaTabla } from "../tabla";
import { equipo, partido, resultado } from "./fabrica";

const rma = equipo("rma", "Real Madrid");
const bar = equipo("bar", "Barcelona");
const liv = equipo("liv", "Liverpool");
const ars = equipo("ars", "Arsenal");

describe("calcularTabla", () => {
  it("suma 3 por victoria, 1 por empate y lleva goles", () => {
    const tabla = calcularTabla([resultado(rma, bar, 2, 1), resultado(liv, ars, 1, 1)]);
    const de = (id: string) => tabla.find((f) => f.equipo.id === id)!;
    expect(de("rma")).toMatchObject({ pj: 1, g: 1, e: 0, p: 0, gf: 2, gc: 1, pts: 3 });
    expect(de("bar")).toMatchObject({ pj: 1, g: 0, p: 1, pts: 0 });
    expect(de("liv")).toMatchObject({ e: 1, pts: 1 });
    expect(de("ars")).toMatchObject({ e: 1, pts: 1 });
  });

  it("con los mismos puntos ordena por diferencia de goles", () => {
    const tabla = calcularTabla([
      resultado(rma, bar, 3, 0),
      resultado(liv, ars, 4, 2),
      resultado(ars, bar, 2, 0),
      resultado(bar, liv, 1, 0),
    ]);
    // Los cuatro tienen 3 puntos: RMA +3, LIV +1, ARS 0, BAR -4.
    expect(tabla.map((f) => [f.equipo.id, f.pts, f.gf - f.gc, f.pos])).toEqual([
      ["rma", 3, 3, 1],
      ["liv", 3, 1, 2],
      ["ars", 3, 0, 3],
      ["bar", 3, -4, 4],
    ]);
  });

  it("con misma DG gana quien anotó más, y luego el orden alfabético", () => {
    // RMA y LIV ganan por uno, BAR y ARS pierden por uno: decide quién anotó más.
    expect(calcularTabla([resultado(rma, bar, 3, 2), resultado(liv, ars, 1, 0)]).map((f) => f.equipo.id)).toEqual(["rma", "liv", "bar", "ars"]);
    // Empate total en puntos y goles: orden alfabético (Arsenal antes que Liverpool).
    expect(calcularTabla([resultado(liv, ars, 1, 1)]).map((f) => f.equipo.id)).toEqual(["ars", "liv"]);
  });

  it("cuenta el marcador en vivo pero no los partidos programados", () => {
    const tabla = calcularTabla([
      resultado(rma, bar, 1, 0, { estado: "vivo" }),
      partido(liv, ars, { estado: "programado" }),
    ]);
    expect(tabla.find((f) => f.equipo.id === "rma")?.pts).toBe(3);
    expect(tabla.find((f) => f.equipo.id === "liv")).toMatchObject({ pj: 0, pts: 0 });
  });

  it("ignora eliminatorias y cruces por definir", () => {
    const tbd = equipo("tbd", "Por definir");
    const tabla = calcularTabla([resultado(rma, bar, 5, 0, { fase: "Octavos" }), resultado(tbd, liv, 1, 0)]);
    expect(tabla).toEqual([]);
  });
});

describe("zonaTabla", () => {
  it.each([
    [1, "octavos"],
    [8, "octavos"],
    [9, "playoff"],
    [24, "playoff"],
    [25, "fuera"],
    [36, "fuera"],
  ])("el lugar %i va a %s", (pos, zona) => {
    expect(zonaTabla(pos)).toBe(zona);
  });
});
