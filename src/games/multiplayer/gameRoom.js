import { Chess } from "chess.js";
import { supabase } from "../../lib/supabase";

const INITIAL_FEN = new Chess().fen();

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Please log in first");
  return data.user;
}

export async function getGameRoom(roomId) {
  const { data, error } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error) throw error;
  return data;
}

export async function getGameRoomByCode(roomCode) {
  const { data, error } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("room_code", roomCode.trim().toUpperCase())
    .single();

  if (error) throw error;
  return data;
}

export async function getGameMoves(roomId) {
  const { data, error } = await supabase
    .from("game_moves")
    .select("*")
    .eq("room_id", roomId)
    .order("move_number", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCurrentGamePosition(roomId) {
  const { data, error } = await supabase
    .from("game_moves")
    .select("*")
    .eq("room_id", roomId)
    .order("move_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    fen: data?.fen || INITIAL_FEN,
    moveNumber: data?.move_number || 0,
    lastMove: data || null,
  };
}

export async function submitGameMove(roomId, moveInput) {
  const user = await getCurrentUser();
  const room = await getGameRoom(roomId);

  if (room.status !== "active") {
    throw new Error("This game is not active");
  }

  const playerColor =
    room.white_player === user.id
      ? "w"
      : room.black_player === user.id
        ? "b"
        : null;

  if (!playerColor) throw new Error("You are not a player in this room");

  const position = await getCurrentGamePosition(roomId);
  const chess = new Chess(position.fen);

  if (chess.turn() !== playerColor) {
    throw new Error("It is not your turn");
  }

  let move;

  try {
    move = chess.move({
      from: moveInput.from,
      to: moveInput.to,
      promotion: moveInput.promotion || "q",
    });
  } catch {
    throw new Error("Invalid chess move");
  }

  if (!move) throw new Error("Illegal chess move");

  const nextMoveNumber = position.moveNumber + 1;

  const { data, error } = await supabase
    .from("game_moves")
    .insert({
      room_id: roomId,
      player_id: user.id,
      move_number: nextMoveNumber,
      from_square: move.from,
      to_square: move.to,
      promotion: move.promotion || null,
      san: move.san,
      fen: chess.fen(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("The position has already changed. Please wait for sync.");
    }
    throw error;
  }

  return {
    move: data,
    fen: chess.fen(),
    isGameOver: chess.isGameOver(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
    isStalemate: chess.isStalemate(),
  };
}

export async function performGameAction(roomId, action) {
  const allowed = [
    "offer_draw",
    "accept_draw",
    "decline_draw",
    "resign",
  ];

  if (!allowed.includes(action)) {
    throw new Error("Invalid game action");
  }

  const { data, error } = await supabase.rpc("handle_game_action", {
    p_room_id: roomId,
    p_action: action,
  });

  if (error) throw error;
  return data;
}

export function subscribeToGameMoves(roomId, callback) {
  const channel = supabase
    .channel(`game-moves-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "game_moves",
        filter: `room_id=eq.${roomId}`,
      },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToGameRoom(roomId, callback) {
  const channel = supabase
    .channel(`game-room-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_rooms",
        filter: `id=eq.${roomId}`,
      },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function getMyGameRooms() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("game_rooms")
    .select("*")
    .or(`white_player.eq.${user.id},black_player.eq.${user.id}`)
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export function subscribeToMyGameRooms(callback) {
  const channel = supabase
    .channel("my-game-rooms")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_rooms",
      },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}