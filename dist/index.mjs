// src/gamePlatform.ts
import { v4 as uuidv4 } from "uuid";

// src/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = "https://gfuldfbbwdjfetjfvkti.supabase.co";
var supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWxkZmJid2RqZmV0amZ2a3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDQ1MzMsImV4cCI6MjA4NzcyMDUzM30.E_5di-Fh0oKZf8ODC1Y-V21bWuoG1eDKtFuKXevjtp0";
var supabase = createClient(supabaseUrl, supabaseKey);

// src/gamePlatform.ts
async function createMatch(input) {
  try {
    const matchId = uuidv4();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { error } = await supabase.from("matches").insert({
      id: matchId,
      game_id: input.gameId,
      player_1: input.player1,
      player_2: input.player2 ?? null,
      player_3: input.player3 ?? null,
      player_4: input.player4 ?? null,
      status: input.status ?? "pending",
      created_at: now
    });
    if (error) return { ok: false, error };
    return { ok: true, matchId };
  } catch (err) {
    return { ok: false, error: err };
  }
}
function getFirstParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
function buildMoveDataWithContext(input) {
  const hasContext = Boolean(input.gameId || input.matchInfo);
  if (!hasContext) {
    return input.moveData;
  }
  const contextPayload = {};
  if (input.gameId) {
    contextPayload.game_id = input.gameId;
  }
  if (input.matchInfo) {
    contextPayload.match_info = input.matchInfo;
  }
  if (input.moveData !== null && typeof input.moveData === "object" && !Array.isArray(input.moveData)) {
    return {
      ...input.moveData,
      ...contextPayload
    };
  }
  return {
    move: input.moveData,
    ...contextPayload
  };
}
function getLaunchContextFromUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const context = {
    gameId: getFirstParam(params, ["gameId", "game_id", "game"]),
    matchId: getFirstParam(params, ["matchId", "match_id", "match"]),
    playerId: getFirstParam(params, ["player", "userId", "playerId", "player1", "player_1"]),
    player2Id: getFirstParam(params, ["player2", "player2Id", "player_2"]),
    rawParams: Object.fromEntries(params.entries())
  };
  console.log("Launch context recibido:", context);
  return context;
}
async function submitByTable(input) {
  const fallbackTable = input.fallbackTable ?? "match_results";
  const isPvP = input.gameMode === "pvp";
  const iWon = input.score > 0;
  const { data: existing } = await supabase.from(fallbackTable).select("final_score_player_1").eq("match_id", input.matchId).eq("winner_id", input.playerId).maybeSingle();
  if (existing) {
    return { ok: true, conflict: true, source: "cache" };
  }
  const dbPayload = {
    match_id: input.matchId,
    winner_id: isPvP ? iWon ? input.playerId : input.opponentId : input.playerId,
    loser_id: isPvP ? iWon ? input.opponentId : input.playerId : null,
    final_score_player_1: input.score,
    points_awarded: isPvP ? Math.abs(input.score) : 0,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const { error } = await supabase.from(fallbackTable).insert(dbPayload);
  if (!error) return { ok: true, conflict: false, source: "table" };
  return { ok: false, conflict: false, source: "none", error };
}
async function submitGameResult(input) {
  if (!input.matchId || !input.playerId) {
    return { ok: false, conflict: false, source: "none", error: new Error("Faltan IDs") };
  }
  return await submitByTable(input);
}
async function submitMatchMovement(input) {
  if (!input.matchId || !input.playerId) {
    return {
      ok: false,
      table: input.tableName ?? "match_movements",
      error: new Error("matchId y playerId son obligatorios")
    };
  }
  const tableName = input.tableName ?? "match_movements";
  const payload = {
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
function sForPosition(position, totalPlayers) {
  if (totalPlayers === 1) return 1;
  return (totalPlayers - position) / (totalPlayers - 1);
}
function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}
async function submitEloResult(players) {
  const gameId = players[0].gameId;
  const userIds = players.map((p) => p.userId);
  const { data, error } = await supabase.from("scores").select("user_id, score, games_played").in("user_id", userIds).eq("game_id", gameId);
  if (error) return { ok: false, error };
  const eloMap = {};
  const gamesMap = {};
  for (const row of data ?? []) {
    eloMap[row.user_id] = row.score ?? 1e3;
    gamesMap[row.user_id] = row.games_played ?? 0;
  }
  for (const p of players) {
    if (!(p.userId in eloMap)) {
      eloMap[p.userId] = 1e3;
      gamesMap[p.userId] = 0;
    }
  }
  const results = players.map((player) => {
    const rA = eloMap[player.userId];
    const gamesA = gamesMap[player.userId];
    const sA = sForPosition(player.position, players.length);
    const opponents = players.filter((p) => p.userId !== player.userId);
    const avgOppElo = opponents.reduce((sum, opp) => sum + eloMap[opp.userId], 0) / opponents.length;
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
    results.map(
      (r) => supabase.from("scores").upsert(
        { user_id: r.userId, game_id: r.gameId, score: r.newElo, games_played: r.gamesPlayed },
        { onConflict: "user_id,game_id" }
      )
    )
  );
  return { ok: true, results };
}
async function updateMatch(input) {
  try {
    const { error } = await supabase.from("matches").update({ status: input.status, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", input.matchId);
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}
async function endMatch(input) {
  try {
    const { error } = await supabase.from("matches").update({
      winner_id: input.winnerId,
      loser_id: input.loserId,
      status: input.status ?? "finished",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", input.matchId);
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}
export {
  createMatch,
  endMatch,
  getLaunchContextFromUrl,
  submitEloResult,
  submitGameResult,
  submitMatchMovement,
  supabase,
  updateMatch
};
