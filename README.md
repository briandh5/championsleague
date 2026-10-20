# La Previa · Champions con tus amigos

App #4 del reto de 100 apps. Coordina con tus amigos dónde ver cada partido de la
Champions: mapa ilustrado con pines y hashtags, calendario por fases con marcador en vivo,
recordatorios, compartir plan, Google Calendar y chat rápido por evento.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 3 · Leaflet (react-leaflet) ·
Framer Motion · Lucide. Toda la interfaz vive en un solo componente:
[`components/LaPrevia.tsx`](components/LaPrevia.tsx).

## Qué hace

| Parte | Detalle |
| --- | --- |
| Mapa caricatura | Leaflet con CartoDB Voyager saturado y trama de puntos tipo cómic. Botón para cambiar a mapa de noche. |
| Pin personalizado | "Poner mi pin" → tocas el mapa (o "Aquí estoy" con tu ubicación) → formulario con partido, País, Estado, Ciudad (se prellenan con OpenStreetMap), tipo de lugar, nombre del lugar, `#Hashtag` único y anfitrión. |
| Buscador flotante | Filtra los pines por hashtag, nombre de amigo, lugar o ciudad. Muestra los hashtags más populares. |
| Calendario | Fases (Fase de liga, Play-off, Octavos, Cuartos, Semifinal, Final), tira de días y tarjetas con escudos, estado **En vivo** con marcador y minuto o **Próximamente** con hora local. |
| Recordatorios | 1 día y 1 hora antes, configurables por plan. Aviso dentro de la app y notificación del navegador. El botón **.ics** descarga el evento con las dos alarmas para que lleguen aunque la app esté cerrada. |
| Compartir plan | Enlace dinámico con el mensaje "¿Qué plan para Equipo A vs Equipo B?". Quien lo abre ve el pin y puede apuntarse. WhatsApp, Telegram, X o copiar. En celular usa el menú nativo de compartir. |
| Google Calendar | Botón que abre el evento con fecha, hora, lugar y lista de amigos ya llenos. |
| Confirmados y chat | "¡Me apunto!" y chat rápido por plan. |

## Datos

- `app/api/partidos/route.ts` pide los partidos de la Champions a **TheSportsDB** (gratis).
  Si responde con 8 partidos o más, la app los usa y muestra "Datos en vivo".
  Con la llave gratuita llegan pocos partidos, así que normalmente verás el
  **calendario de ejemplo 2026/27** con marcador simulado (etiqueta "Datos de ejemplo").
  Con una llave propia de TheSportsDB pon la variable `THESPORTSDB_KEY` en Vercel.
- Escudos en alta resolución desde el CDN de API-Football; si alguno no carga se dibuja un
  escudo con los colores del club.
- Pines, confirmados, chat y tu nombre se guardan en el navegador (LocalStorage). Para chat
  entre varias personas en tiempo real el siguiente paso es conectar Supabase Realtime.

**Modo demo:** abre `/?demo=vivo` para adelantar el reloj al siguiente partido y ver
el marcador en vivo.

## Correr en local

```bash
npm install
npm run dev
```

## Publicar en Vercel

1. Sube este proyecto a un repo vacío de GitHub.
2. En Vercel: **Add New → Project → Import** ese repo. No necesita variables de entorno.
