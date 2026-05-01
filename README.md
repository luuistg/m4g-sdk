# m4g-sdk

Librería TypeScript para la gestión de partidas, movimientos y resultados de juegos multijugador o single player, integrando Supabase como backend.

## Características

- Creación y gestión de partidas (matches) con uno o dos jugadores
- Registro de movimientos y resultados de jugadores
- Soporte para modos PvP y Single Player (SP)
- Prevención de envíos duplicados de resultados
- Integración sencilla con Supabase
- Utilidad para extraer parámetros de usuario y juego desde la URL

## Instalación

```sh
npm install m4g-sdk
```

Asegúrate de tener instaladas las dependencias necesarias:

```sh
npm install @supabase/supabase-js uuid
npm install --save-dev @types/uuid
```

## Uso Básico

### 1. Inicialización

Antes de usar la librería, inicializa Supabase en tu proyecto:

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient('https://your-project.supabase.co', 'public-anon-key');
```

---

### 2. Recibir datos desde la URL

El SDK **no obtiene automáticamente** los parámetros desde la URL.  
Para extraerlos, utiliza la función `getLaunchContextFromUrl`:

```typescript
import { getLaunchContextFromUrl, LaunchContext } from 'm4g-sdk';

const ctx: LaunchContext = getLaunchContextFromUrl();
// ctx.gameId, ctx.playerId, ctx.player2Id, ctx.matchId, etc.
```

---

### 3. Crear una partida (uno o dos jugadores)

```typescript
import { createMatch, CreateMatchInput, CreateMatchOutput, getLaunchContextFromUrl } from 'm4g-sdk';

const ctx = getLaunchContextFromUrl();

const input: CreateMatchInput = {
  gameId: ctx.gameId!,
  player1: ctx.playerId!,
  // player2 es opcional, puede omitirse o ser null
  player2: ctx.player2Id ?? null
};

const result: CreateMatchOutput = await createMatch(input);

if (result.ok) {
  const matchId = result.matchId!;
  // Guarda el matchId para siguientes acciones
} else {
  console.error('Error al crear partida:', result.error);
}
```

---

### 4. Registrar movimientos en la partida

```typescript
import { submitMatchMovement, SubmitMatchMovementInput, SubmitMatchMovementOutput } from 'm4g-sdk';

const movementInput: SubmitMatchMovementInput = {
  matchId: 'match-123', // Usa el matchId generado
  playerId: 'user-1',
  moveData: { action: 'move', x: 1, y: 2 }
};

const movementResult: SubmitMatchMovementOutput = await submitMatchMovement(movementInput);

if (movementResult.ok) {
  console.log('Movimiento registrado');
} else {
  console.error('Error al registrar movimiento:', movementResult.error);
}
```

---

### 5. Registrar resultado de la partida

```typescript
import { submitGameResult, SubmitGameResultInput, SubmitGameResultOutput } from 'm4g-sdk';

const resultInput: SubmitGameResultInput = {
  matchId: 'match-123',
  playerId: 'user-1',
  opponentId: 'user-2', // Solo para PvP
  score: 100,           // Positivo si ganó, negativo si perdió (PvP)
  gameMode: 'pvp'       // o 'sp'
};

const gameResult: SubmitGameResultOutput = await submitGameResult(resultInput);

if (gameResult.ok) {
  console.log('Resultado enviado correctamente');
} else {
  console.error('Error al enviar resultado:', gameResult.error);
}
```

---

### 6. Actualizar el score final del jugador

```typescript
import { updatePlayerScore, UpdatePlayerScoreInput, UpdatePlayerScoreOutput } from 'm4g-sdk';

const scoreInput: UpdatePlayerScoreInput = {
  userId: 'user-1',
  gameId: 'game-123',
  score: 150
};

const scoreResult: UpdatePlayerScoreOutput = await updatePlayerScore(scoreInput);

if (scoreResult.ok) {
  console.log('Score actualizado');
} else {
  console.error('Error al actualizar score:', scoreResult.error);
}
```

---

### 7. Finalizar la partida y registrar ganador/perdedor

```typescript
import { endMatch, EndMatchInput, EndMatchOutput } from 'm4g-sdk';

const endInput: EndMatchInput = {
  matchId: 'match-123',
  winnerId: 'user-1',
  loserId: 'user-2',
  status: 'finished'
};

const endResult: EndMatchOutput = await endMatch(endInput);

if (endResult.ok) {
  console.log('Partida finalizada');
} else {
  console.error('Error al finalizar partida:', endResult.error);
}
```

---

## Tipos principales

- `CreateMatchInput`, `CreateMatchOutput`
- `SubmitMatchMovementInput`, `SubmitMatchMovementOutput`
- `SubmitGameResultInput`, `SubmitGameResultOutput`
- `UpdatePlayerScoreInput`, `UpdatePlayerScoreOutput`
- `EndMatchInput`, `EndMatchOutput`
- `LaunchContext`

---

## Configuración adicional

Si usas TypeScript y tienes problemas con los tipos de `uuid`, instala los tipos:

```sh
npm install --save-dev @types/uuid
```

Si usas un bundler como tsup y tienes problemas con declaraciones, crea un archivo `types/uuid.d.ts` con:

```typescript
declare module 'uuid';
```

---

## Contribuir

¡Las contribuciones son bienvenidas! Abre un issue o pull request para sugerencias o mejoras.

## Licencia

MIT
