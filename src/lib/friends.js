
import { supabase } from "./supabase";

export async function searchPlayers(username, currentUserId) {
  const term = username.trim();

  if (!term) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .neq("id", currentUserId)
    .or(
      `username.ilike.%${term}%,display_name.ilike.%${term}%`
    )
    .limit(20);

  if (error) throw error;

  return data || [];
}

export async function sendFriendRequest(username) {
  const { data, error } = await supabase.rpc(
    "send_friend_request",
    { p_username: username }
  );

  if (error) throw error;

  return data;
}

export async function getFriends(userId) {
  const { data: friendships, error } = await supabase
    .from("friendships")
    .select("id, user_one_id, user_two_id, created_at")
    .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`);

  if (error) throw error;

  if (!friendships?.length) return [];

  const friendIds = friendships.map((friendship) =>
    friendship.user_one_id === userId
      ? friendship.user_two_id
      : friendship.user_one_id
  );

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", friendIds);

  if (profileError) throw profileError;

  return (profiles || []).map((profile) => ({
    ...profile,
    friendship_id: friendships.find(
      (friendship) =>
        friendship.user_one_id === profile.id ||
        friendship.user_two_id === profile.id
    )?.id,
  }));
}

export async function getFriendRequests(userId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, status, created_at")
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data?.length) return [];

  const senderIds = data.map((request) => request.sender_id);

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", senderIds);

  if (profileError) throw profileError;

  return data.map((request) => ({
    ...request,
    sender: profiles?.find(
      (profile) => profile.id === request.sender_id
    ),
  }));
}

export async function getSentRequests(userId) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, status, created_at")
    .eq("sender_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  if (!data?.length) return [];

  const receiverIds = data.map((request) => request.receiver_id);

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", receiverIds);

  if (profileError) throw profileError;

  return data.map((request) => ({
    ...request,
    receiver: profiles?.find(
      (profile) => profile.id === request.receiver_id
    ),
  }));
}

export async function respondToFriendRequest(requestId, accept) {
  const { data, error } = await supabase.rpc(
    "respond_friend_request",
    {
      p_request_id: requestId,
      p_accept: accept,
    }
  );

  if (error) throw error;

  return data;
}

export async function removeFriend(friendId) {
  const { data, error } = await supabase.rpc(
    "remove_friend",
    { p_friend_id: friendId }
  );

  if (error) throw error;

  return data;
}
