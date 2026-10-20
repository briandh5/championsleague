/** Balón de la Champions (blanco con estrellas) que rebota, gira y cambia de tamaño mientras carga la app. */
export default function Cargando() {
  const estrella = (cx: number, cy: number, r: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.42 : r;
      return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  // Una estrella al centro y cinco alrededor, como en el balón oficial.
  const satelites = Array.from({ length: 5 }, (_, i) => {
    const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
    return [60 + 50 * Math.cos(a), 60 + 50 * Math.sin(a)] as const;
  });
  return (
    <div className="cielo grid h-dvh place-items-center" role="status" aria-label="Cargando La Previa">
      <div className="flex flex-col items-center">
        <div className="relative h-[190px] w-[120px]">
          <div className="balon-bote absolute left-0 top-[60px] h-[120px] w-[120px]">
            <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_0_14px_rgba(0,240,255,.45)]">
              <defs>
                <clipPath id="balon-recorte">
                  <circle cx="60" cy="60" r="56" />
                </clipPath>
                <radialGradient id="balon-luz" cx="35%" cy="30%" r="75%">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.6" stopColor="#0b0e28" stopOpacity="0.08" />
                  <stop offset="1" stopColor="#0b0e28" stopOpacity="0.45" />
                </radialGradient>
              </defs>
              <circle cx="60" cy="60" r="56" fill="#fff" />
              <g clipPath="url(#balon-recorte)">
                <g className="balon-giro">
                  <polygon points={estrella(60, 60, 26)} fill="#0b0e28" stroke="#00f0ff" strokeWidth="2" strokeLinejoin="round" />
                  {satelites.map(([x, y], i) => (
                    <polygon key={i} points={estrella(x, y, 24)} fill="#0b0e28" stroke="#00f0ff" strokeWidth="2" strokeLinejoin="round" />
                  ))}
                </g>
              </g>
              <circle cx="60" cy="60" r="56" fill="url(#balon-luz)" />
              <circle cx="60" cy="60" r="56" fill="none" stroke="#0b0e28" strokeWidth="3" />
            </svg>
          </div>
          <div className="balon-sombra absolute bottom-0 left-[10px] h-[14px] w-[100px] rounded-[50%] bg-black/60 blur-[2px]" />
        </div>
        <p className="mt-3 font-display text-sm font-bold uppercase tracking-[.3em] text-white/50">La Previa</p>
      </div>
    </div>
  );
}
