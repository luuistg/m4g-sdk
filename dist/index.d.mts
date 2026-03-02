import * as _supabase_supabase_js from '@supabase/supabase-js';
import { PostgrestError } from '@supabase/supabase-js';

interface LaunchContext {
    gameId: string | null;
    matchId: string | null;
    playerId: string | null;
    player2Id: string | null;
    rawParams: Record<string, string>;
}
interface SubmitGameResultInput {
    matchId: string;
    playerId: string;
    score: number;
    pointsDelta?: number;
    rpcName?: string;
    fallbackTable?: string;
}
interface SubmitGameResultOutput {
    ok: boolean;
    conflict: boolean;
    source: 'rpc' | 'table' | 'cache' | 'none';
    error?: PostgrestError | Error | null;
}
declare function getLaunchContextFromUrl(search?: string): LaunchContext;
declare function submitGameResult(input: SubmitGameResultInput): Promise<SubmitGameResultOutput>;

declare const supabase: _supabase_supabase_js.SupabaseClient<any, "public", "public", any, any>;

export { type LaunchContext, type SubmitGameResultInput, type SubmitGameResultOutput, getLaunchContextFromUrl, submitGameResult, supabase };
