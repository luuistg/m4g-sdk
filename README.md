# m4g-sdk

SDK para integrar contexto de lanzamiento y envío de resultados de partidas con Supabase.

## Instalación

```bash
npm install m4g-sdk @supabase/supabase-js
```

> `@supabase/supabase-js` se declara como `peerDependency`, por lo que debe estar instalado en el proyecto consumidor.

## Uso básico

```ts
import { getLaunchContextFromUrl, submitGameResult } from 'm4g-sdk';

const context = getLaunchContextFromUrl();

await submitGameResult({
  matchId: context.matchId ?? '',
  playerId: context.playerId ?? '',
  score: 100
});
```

## Scripts

- `npm run build`: genera `dist` (ESM + CJS + tipos).
- `npm run dev`: build en modo watch.
- `npm run prepublishOnly`: ejecuta build antes de publicar.

## Publicación

```bash
npm publish
```
