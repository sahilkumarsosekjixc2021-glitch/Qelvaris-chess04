import { supabase } from "../../lib/supabase";

// Send a challenge to a friend
export async function sendGameInvitation(
  receiverId,
  gameMode = "classic",
  timeControl = "10+0"
) {
  const { data, error } = await supabase.rpc(
    "create_game_invitation",
    {
      p_receiver_id: receiverId,
      p_game_mode: gameMode,
      p_time_control: timeControl,
    }
  );

  if (error) throw error;

  return data;
}

// Get incoming pending challenges
export async function getIncomingGameInvitations() {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Please log in first");

  const { data, error } = await supabase
    .from("game_invitations")
    .select("*")
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

// Get challenges sent by the current user
export async function getSentGameInvitations() {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Please log in first");

  const { data, error } = await supabase
    .from("game_invitations")
    .select("*")
    .eq("sender_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

// Accept or reject a challenge
export async function respondToGameInvitation(
  invitationId,
  accept
) {
  const { data, error } = await supabase.rpc(
    "respond_game_invitation",
    {
      p_invitation_id: invitationId,
      p_accept: accept,
    }
  );

  if (error) throw error;

  return data;
}

// Listen for incoming challenges in real time
export function subscribeToGameInvitations(userId, callback) {
  const channel = supabase
    .channel(`game-invitations-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "game_invitations",
        filter: `receiver_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}