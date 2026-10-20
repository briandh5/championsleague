"use client";

import dynamic from "next/dynamic";

// Leaflet necesita `window`, así que la app se carga solo en el navegador.
const LaPrevia = dynamic(() => import("@/components/LaPrevia"), {
  ssr: false,
  loading: () => (
    <div className="cielo grid h-dvh place-items-center">
      <p className="font-display text-2xl font-bold tracking-wide text-neon">Calentando motores…</p>
    </div>
  ),
});

export default function Page() {
  return <LaPrevia />;
}
