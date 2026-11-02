// Lógica pura del dominio, sin React ni navegador: se prueba con Vitest.

export const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|ac|ssc|sl|sk|rc|rb|afc|as|vfb)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
export const mismoEquipo = (a: string, b: string) => {
  const x = normal(a);
  const y = normal(b);
  // Prefijo de 6 letras para "Bayern München"/"Bayern Munich" o "Slavia Praha"/"Slavia Prague", sin confundir a los dos Manchester.
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x) || (x.slice(0, 6) === y.slice(0, 6) && !x.startsWith("manche")));
};
