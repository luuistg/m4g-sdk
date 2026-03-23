# m4g-sdk

SDK para integrar contexto de lanzamiento y envío de resultados de partidas con Supabase.

## Instalación

```bash
npm install m4g-sdk @supabase/supabase-js
```

> `@supabase/supabase-js` se declara como `peerDependency`, por lo que debe estar instalado en el proyecto consumidor.

## Uso básico

```ts
import { getLaunchContextFromUrl, submitGameResult, submitMatchMovement } from 'm4g-sdk';

const context = getLaunchContextFromUrl();

await submitGameResult({
  matchId: context.matchId ?? '',
  playerId: context.playerId ?? '',
  score: 100
});

await submitMatchMovement({
  matchId: context.matchId ?? '',
  playerId: context.playerId ?? '',
  moveData: {
    type: 'move',
    from: 'A2',
    to: 'A3'
  },
  gameId: context.gameId,
  matchInfo: {
    turn: 5,
    boardSize: '8x8'
  }
});
```

## Registro de movimientos

`submitMatchMovement` inserta cada jugada en la tabla `match_movements` con esta estructura:

- `match_id`
- `player_id`
- `move_data` (`jsonb`, incluye el movimiento y opcionalmente `game_id`/`match_info`)
- `server_timestamp` (opcional, si lo envías)

## Scripts

- `npm run build`: genera `dist` (ESM + CJS + tipos).
- `npm run dev`: build en modo watch.
- `npm run prepublishOnly`: ejecuta build antes de publicar.

## Publicación

```bash
npm publish
```
