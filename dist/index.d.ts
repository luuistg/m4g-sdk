import * as _supabase_supabase_js from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/supabase-js';

interface CreateMatchInput {
    gameId: string;
    player1: string;
    player2?: string | null;
    player3?: string | null;
    player4?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface CreateMatchOutput {
    ok: boolean;
    matchId?: string;
    error?: Error | null;
}
/**
 * Crea un match inicial en la tabla matches y retorna el matchId generado.
 */
declare function createMatch(input: CreateMatchInput): Promise<CreateMatchOutput>;
interface LaunchContext {
    gameId: string | null;
    matchId: string | null;
    playerId: string | null;
    player2Id: string | null;
    rawParams: Record<string, string>;
}
type GameMode = 'pvp' | 'sp';
interface SubmitGameResultInput {
    matchId: string;
    playerId: string;
    opponentId?: string;
    score: number;
    pointsDelta?: number;
    fallbackTable?: string;
    gameMode?: GameMode;
}
interface SubmitGameResultOutput {
    ok: boolean;
    conflict: boolean;
    source: 'table' | 'cache' | 'none';
    error?: PostgrestError | Error | null;
}
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
interface SubmitMatchMovementInput {
    matchId: string;
    playerId: string;
    moveData: JsonValue;
    gameId?: string | null;
    matchInfo?: Record<string, JsonValue> | null;
    serverTimestamp?: string;
    movementId?: string;
    tableName?: string;
}
interface SubmitMatchMovementOutput {
    ok: boolean;
    table: string;
    error?: PostgrestError | Error | null;
}
declare function getLaunchContextFromUrl(search?: string): LaunchContext;
declare function submitGameResult(input: SubmitGameResultInput): Promise<SubmitGameResultOutput>;
declare function submitMatchMovement(input: SubmitMatchMovementInput): Promise<SubmitMatchMovementOutput>;
declare function submitEloResult(players: Array<{
    userId: string;
    gameId: string;
    position: number;
}>): Promise<{
    ok: boolean;
    results?: Array<{
        userId: string;
        oldElo: number;
        newElo: number;
        delta: number;
    }>;
    error?: any;
}>;
interface UpdateMatchInput {
    matchId: string;
    status?: string;
    player1?: string | null;
    player2?: string | null;
    player3?: string | null;
    player4?: string | null;
}
interface UpdateMatchOutput {
    ok: boolean;
    error?: Error | null;
}
declare function updateMatch(input: UpdateMatchInput): Promise<UpdateMatchOutput>;
interface EndMatchInput {
    matchId: string;
    winnerId: string;
    loserId: string | null;
    status?: string;
}
interface EndMatchOutput {
    ok: boolean;
    error?: Error | null;
}
/**
 * Finaliza una partida y registra el ganador y el perdedor.
 */
declare function endMatch(input: EndMatchInput): Promise<EndMatchOutput>;

declare const supabase: _supabase_supabase_js.SupabaseClient<any, "public", "public", any, any>;

export { type CreateMatchInput, type CreateMatchOutput, type EndMatchInput, type EndMatchOutput, type GameMode, type LaunchContext, type SubmitGameResultInput, type SubmitGameResultOutput, type SubmitMatchMovementInput, type SubmitMatchMovementOutput, type UpdateMatchInput, type UpdateMatchOutput, createMatch, endMatch, getLaunchContextFromUrl, submitEloResult, submitGameResult, submitMatchMovement, supabase, updateMatch };
