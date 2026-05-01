import { v4 as uuidv4 } from 'uuid';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface CreateMatchInput {
    gameId: string;
    player1: string;
    player2?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateMatchOutput {
    ok: boolean;
    matchId?: string;
    error?: Error | null;
}

/**
 * Crea un match inicial en la tabla matches y retorna el matchId generado.
 */
export async function createMatch(input: CreateMatchInput): Promise<CreateMatchOutput> {
    try {
        const matchId = uuidv4();
        const now = new Date().toISOString();
        const { error } = await supabase.from('matches').insert({
            id: matchId,
            game_id: input.gameId,
            player_1: input.player1,
            player_2: input.player2,
            status: input.status ?? 'pending',
            created_at: now
            // Eliminado updated_at para evitar errores si no existe
        });
        if (error) return { ok: false, error };
        return { ok: true, matchId };
    } catch (err) {
        return { ok: false, error: err as Error };
    }
}

export interface LaunchContext {
    gameId: string | null;
    matchId: string | null;
    playerId: string | null;
    player2Id: string | null;
    rawParams: Record<string, string>;
}

export type GameMode = 'pvp' | 'sp';

export interface SubmitGameResultInput {
    matchId: string;
    playerId: string;
    opponentId?: string;
    score: number;
    pointsDelta?: number;
    fallbackTable?: string;
    gameMode?: GameMode;
}

export interface SubmitGameResultOutput {
    ok: boolean;
    conflict: boolean;
    source: 'table' | 'cache' | 'none';
    error?: PostgrestError | Error | null;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SubmitMatchMovementInput {
    matchId: string;
    playerId: string;
    moveData: JsonValue;
    gameId?: string | null;
    matchInfo?: Record<string, JsonValue> | null;
    serverTimestamp?: string;
    movementId?: string;
    tableName?: string;
}

export interface SubmitMatchMovementOutput {
    ok: boolean;
    table: string;
    error?: PostgrestError | Error | null;
}

const SUBMITTED_RESULTS_KEY = 'pilot_game_submitted_results_v1';
const submittedResultsMemory = new Set<string>();
const inFlightRequests = new Set<string>();

function getResultKey(matchId: string, playerId: string): string {
    return `${matchId}:${playerId}`;
}

function getSubmittedResults(): Set<string> {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return new Set(submittedResultsMemory);
        }

        const raw = window.sessionStorage.getItem(SUBMITTED_RESULTS_KEY);
        if (!raw) {
            return new Set(submittedResultsMemory);
        }

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return new Set(parsed.filter((item) => typeof item === 'string'));
        }

        return new Set(submittedResultsMemory);
    } catch {
        return new Set(submittedResultsMemory);
    }
}

function markResultSubmitted(key: string): void {
    submittedResultsMemory.add(key);

    try {
        if (typeof window === 'undefined' || !window.sessionStorage) {
            return;
        }

        const current = getSubmittedResults();
        current.add(key);
        window.sessionStorage.setItem(SUBMITTED_RESULTS_KEY, JSON.stringify(Array.from(current)));
    } catch {
        // noop
    }
}

function getFirstParam(params: URLSearchParams, keys: string[]): string | null {
    for (const key of keys) {
        const value = params.get(key);
        if (value && value.trim().length > 0) {
            return value.trim();
        }
    }

    return null;
}

function isConflictError(error: PostgrestError): boolean {
    return (
        error.code === '23505' ||
        error.code === '409' ||
        /conflict|duplicate|already/i.test(error.message ?? '')
    );
}

function buildMoveDataWithContext(input: SubmitMatchMovementInput): JsonValue {
    const hasContext = Boolean(input.gameId || input.matchInfo);
    if (!hasContext) {
        return input.moveData;
    }

    const contextPayload: Record<string, JsonValue> = {};
    if (input.gameId) {
        contextPayload.game_id = input.gameId;
    }

    if (input.matchInfo) {
        contextPayload.match_info = input.matchInfo;
    }

    if (
        input.moveData !== null &&
        typeof input.moveData === 'object' &&
        !Array.isArray(input.moveData)
    ) {
        return {
            ...(input.moveData as Record<string, JsonValue>),
            ...contextPayload
        };
    }

    return {
        move: input.moveData,
        ...contextPayload
    };
}

export function getLaunchContextFromUrl(search: string = window.location.search): LaunchContext {
    const params = new URLSearchParams(search);

    const context: LaunchContext = {
        gameId: getFirstParam(params, ['gameId', 'game_id', 'game']),
        matchId: getFirstParam(params, ['matchId', 'match_id', 'match']),
        playerId: getFirstParam(params, ['player', 'userId', 'playerId', 'player1', 'player_1']),
        player2Id: getFirstParam(params, ['player2', 'player2Id', 'player_2']),
        rawParams: Object.fromEntries(params.entries())
    };

    console.log('Launch context recibido:', context);
    return context;
}

async function submitByTable(input: SubmitGameResultInput): Promise<SubmitGameResultOutput> {
    const fallbackTable = input.fallbackTable ?? 'match_results';
    const isPvP = input.gameMode === 'pvp';
    const iWon = input.score > 0;

    // --- CAMBIO CLAVE: Comprobación previa con nombres de tus columnas ---
    // Esto evita el error 400 del GET automático que veías en consola
    const { data: existing } = await supabase
        .from(fallbackTable)
        .select('final_score_player_1')
        .eq('match_id', input.matchId)
        .eq('winner_id', input.playerId)
        .maybeSingle();

    if (existing) {
        return { ok: true, conflict: true, source: 'cache' };
    }

    const dbPayload: any = {
        match_id: input.matchId,
        winner_id: isPvP ? (iWon ? input.playerId : input.opponentId) : input.playerId,
        loser_id: isPvP ? (iWon ? input.opponentId : input.playerId) : null,
        final_score_player_1: input.score,
        points_awarded: isPvP ? Math.abs(input.score) : 0,
        created_at: new Date().toISOString()
    };

    const { error } = await supabase.from(fallbackTable).insert(dbPayload);

    if (!error) return { ok: true, conflict: false, source: 'table' };
    return { ok: false, conflict: false, source: 'none', error };
}

export async function submitGameResult(input: SubmitGameResultInput): Promise<SubmitGameResultOutput> {
    if (!input.matchId || !input.playerId) {
        return { ok: false, conflict: false, source: 'none', error: new Error('Faltan IDs') };
    }

    // Intentamos guardar directamente por tabla con los nombres correctos
    return await submitByTable(input);
}

export async function submitMatchMovement(
    input: SubmitMatchMovementInput
): Promise<SubmitMatchMovementOutput> {
    if (!input.matchId || !input.playerId) {
        return {
            ok: false,
            table: input.tableName ?? 'match_movements',
            error: new Error('matchId y playerId son obligatorios')
        };
    }

    const tableName = input.tableName ?? 'match_movements';
    const payload: Record<string, unknown> = {
        match_id: input.matchId,
        player_id: input.playerId,
        move_data: buildMoveDataWithContext(input)
    };

    if (input.serverTimestamp) {
        payload.server_timestamp = input.serverTimestamp;
    }

    if (input.movementId) {
        payload.id = input.movementId;
    }

    const { error } = await supabase.from(tableName).insert(payload);

    if (error) {
        return {
            ok: false,
            table: tableName,
            error
        };
    }

    return {
        ok: true,
        table: tableName
    };
}

const S_BY_POSITION: Record<number, number> = { 1: 1.0, 2: 0.7, 3: 0.3, 4: 0.0 };

function expectedScore(rA: number, rB: number): number {
    return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

export async function submitEloResult(
    players: Array<{ userId: string; gameId: string; position: number }>
): Promise<{
    ok: boolean;
    results?: Array<{ userId: string; oldElo: number; newElo: number; delta: number }>;
    error?: any;
}> {
    const gameId = players[0].gameId;
    const userIds = players.map((p) => p.userId);

    const { data, error } = await supabase
        .from('scores')
        .select('user_id, score, games_played')
        .in('user_id', userIds);

    if (error) return { ok: false, error };

    const eloMap: Record<string, number> = {};
    const gamesMap: Record<string, number> = {};
    for (const row of data ?? []) {
        eloMap[row.user_id] = row.score ?? 1000;
        gamesMap[row.user_id] = row.games_played ?? 0;
    }

    for (const p of players) {
        if (!(p.userId in eloMap)) {
            eloMap[p.userId] = 1000;
            gamesMap[p.userId] = 0;
        }
    }

    const results = players.map((player) => {
        const rA = eloMap[player.userId];
        const gamesA = gamesMap[player.userId];
        const sA = S_BY_POSITION[player.position] ?? 0;
        const opponents = players.filter((p) => p.userId !== player.userId);
        const avgOppElo =
            opponents.reduce((sum, opp) => sum + eloMap[opp.userId], 0) / opponents.length;

        const k = avgOppElo - rA > 200 ? 50 : gamesA < 20 ? 40 : 20;

        const delta = Math.round(
            opponents.reduce(
                (sum, opp) => sum + k * (sA - expectedScore(rA, eloMap[opp.userId])),
                0
            )
        );

        return {
            userId: player.userId,
            gameId,
            oldElo: rA,
            newElo: rA + delta,
            delta,
            gamesPlayed: gamesA + 1
        };
    });

    await Promise.all(
        results.map((r) =>
            supabase
                .from('scores')
                .upsert(
                    { user_id: r.userId, game_id: r.gameId, score: r.newElo, games_played: r.gamesPlayed },
                    { onConflict: 'user_id,game_id' }
                )
        )
    );

    return { ok: true, results };
}

export interface EndMatchInput {
    matchId: string;
    winnerId: string;
    loserId: string;
    status?: string; // e.g. 'finished'
}

export interface EndMatchOutput {
    ok: boolean;
    error?: Error | null;
}

/**
 * Finaliza una partida y registra el ganador y el perdedor.
 */
export async function endMatch(input: EndMatchInput): Promise<EndMatchOutput> {
    try {
        const { error } = await supabase
            .from('matches')
            .update({
                winner_id: input.winnerId,
                loser_id: input.loserId,
                status: input.status ?? 'finished',
                updated_at: new Date().toISOString()
            })
            .eq('id', input.matchId);
        if (error) return { ok: false, error };
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err as Error };
    }
}
