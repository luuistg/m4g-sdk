"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  getLaunchContextFromUrl: () => getLaunchContextFromUrl,
  submitGameResult: () => submitGameResult,
  submitMatchMovement: () => submitMatchMovement,
  supabase: () => supabase
});
module.exports = __toCommonJS(index_exports);

// src/supabase.ts
var import_supabase_js = require("@supabase/supabase-js");
var supabaseUrl = "https://gfuldfbbwdjfetjfvkti.supabase.co";
var supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmdWxkZmJid2RqZmV0amZ2a3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDQ1MzMsImV4cCI6MjA4NzcyMDUzM30.E_5di-Fh0oKZf8ODC1Y-V21bWuoG1eDKtFuKXevjtp0";
var supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);

// src/gamePlatform.ts
var SUBMITTED_RESULTS_KEY = "pilot_game_submitted_results_v1";
var submittedResultsMemory = /* @__PURE__ */ new Set();
var inFlightRequests = /* @__PURE__ */ new Set();
function getResultKey(matchId, playerId) {
  return `${matchId}:${playerId}`;
}
function getSubmittedResults() {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return new Set(submittedResultsMemory);
    }
    const raw = window.sessionStorage.getItem(SUBMITTED_RESULTS_KEY);
    if (!raw) {
      return new Set(submittedResultsMemory);
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item) => typeof item === "string"));
    }
    return new Set(submittedResultsMemory);
  } catch {
    return new Set(submittedResultsMemory);
  }
}
function markResultSubmitted(key) {
  submittedResultsMemory.add(key);
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }
    const current = getSubmittedResults();
    current.add(key);
    window.sessionStorage.setItem(SUBMITTED_RESULTS_KEY, JSON.stringify(Array.from(current)));
  } catch {
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
function isConflictError(error) {
  return error.code === "23505" || error.code === "409" || /conflict|duplicate|already/i.test(error.message ?? "");
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
async function submitByRpc(input) {
  const rpcName = input.rpcName ?? "register_final_result";
  const pointsDelta = input.pointsDelta ?? 10;
  const payloadVariants = [
    {
      p_match_id: input.matchId,
      p_winner_id: input.playerId,
      p_score_p1: input.score,
      p_points_delta: pointsDelta
    },
    {
      p_match_id: input.matchId,
      p_player_id: input.playerId,
      p_score: input.score,
      p_points_delta: pointsDelta
    },
    {
      match_id: input.matchId,
      player_id: input.playerId,
      score: input.score,
      points_delta: pointsDelta
    }
  ];
  let lastError = null;
  for (const payload of payloadVariants) {
    const { error } = await supabase.rpc(rpcName, payload);
    if (!error) {
      return {
        ok: true,
        conflict: false,
        source: "rpc"
      };
    }
    if (isConflictError(error)) {
      return {
        ok: true,
        conflict: true,
        source: "rpc",
        error
      };
    }
    lastError = error;
    console.warn("RPC fall\xF3 con firma de payload", {
      rpcName,
      payload,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
  }
  return {
    ok: false,
    conflict: false,
    source: "none",
    error: lastError
  };
}
async function submitByTable(input) {
  const fallbackTable = input.fallbackTable ?? "match_results";
  const pointsDelta = input.pointsDelta ?? 10;
  const { error } = await supabase.from(fallbackTable).insert({
    match_id: input.matchId,
    player_id: input.playerId,
    score: input.score,
    points_delta: pointsDelta
  });
  if (!error) {
    return {
      ok: true,
      conflict: false,
      source: "table"
    };
  }
  if (isConflictError(error)) {
    return {
      ok: true,
      conflict: true,
      source: "table",
      error
    };
  }
  return {
    ok: false,
    conflict: false,
    source: "none",
    error
  };
}
async function submitGameResult(input) {
  if (!input.matchId || !input.playerId) {
    return {
      ok: false,
      conflict: false,
      source: "none",
      error: new Error("matchId y playerId son obligatorios")
    };
  }
  const resultKey = getResultKey(input.matchId, input.playerId);
  const submittedResults = getSubmittedResults();
  if (submittedResults.has(resultKey)) {
    return {
      ok: true,
      conflict: false,
      source: "cache"
    };
  }
  if (inFlightRequests.has(resultKey)) {
    return {
      ok: true,
      conflict: false,
      source: "cache"
    };
  }
  inFlightRequests.add(resultKey);
  try {
    const rpcResult = await submitByRpc(input);
    if (rpcResult.ok) {
      markResultSubmitted(resultKey);
      return rpcResult;
    }
    const tableResult = await submitByTable(input);
    if (tableResult.ok) {
      markResultSubmitted(resultKey);
      return tableResult;
    }
    return tableResult;
  } finally {
    inFlightRequests.delete(resultKey);
  }
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getLaunchContextFromUrl,
  submitGameResult,
  submitMatchMovement,
  supabase
});
