"use client";

import dynamic from "next/dynamic";
import Cargando from "@/components/Cargando";

// La app usa `window` (mapa, LocalStorage, notificaciones): se carga solo en el navegador y mientras tanto sale el balón.
const LaPrevia = dynamic(() => import("@/components/LaPrevia"), {
  ssr: false,
  loading: () => <Cargando />,
});

export default function Page() {
  return <LaPrevia />;
}
