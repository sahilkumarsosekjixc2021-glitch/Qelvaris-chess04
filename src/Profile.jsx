import { friendlyMessage } from "./lib/friendlyMessage";
import { askConfirm } from "./lib/confirm";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { supabase } from "./lib/supabase";
import { dbAll } from "./storage"; // QV-STREAK
import { loadStreak } from "./todayData"; // QV-STREAK
import { SOURCE_LABELS, sourceKey } from "./gamesData"; // QV-STREAK


import {
  searchPlayers,
  sendFriendRequest,
  getFriends,
  getFriendRequests,
  getSentRequests,
  respondToFriendRequest,
  removeFriend,
} from "./lib/friends";

import {
  sendGameInvitation,
  getIncomingGameInvitations,
  getSentGameInvitations,
  respondToGameInvitation,
  subscribeToGameInvitations,
} from "./games/multiplayer/invitations";

import { getGameRoom } from "./games/multiplayer/gameRoom";
import MultiplayerGame from "./games/multiplayer/MultiplayerGame";

import glassPawn from "./assets/glass-pawn.webp";
import { tx } from "./i18n/pages/profile"; // QV-I18N
import { getLang } from "./i18n/i18n"; // QV-I18N
import "./Profile.css";
import "./Profile-glass.css";

const GAME_MODES = [
  { value: "classic", label: "Classic Chess" },
  { value: "fog", label: "Fog of War" },
  { value: "bullet", label: "Bullet Survival" },
  { value: "king-hunt", label: "King Hunt" },
  { value: "chaos", label: "Chaos Chess" },
  { value: "one-life", label: "One Life Chess" },
  { value: "invisible-threats", label: "Invisible Threats" },
  { value: "chess-dungeon", label: "Chess Dungeon" },
  { value: "last-piece-standing", label: "Last Piece Standing" },
];

const TIME_CONTROLS = [
  { value: "1+0", label: "1 min • Bullet" },
  { value: "3+0", label: "3 min • Blitz" },
  { value: "3+2", label: "3 min + 2 sec" },
  { value: "5+0", label: "5 min • Blitz" },
  { value: "10+0", label: "10 min • Rapid" },
  { value: "15+10", label: "15 min + 10 sec" },
];


/* Chhote inline icons (emoji ki jagah, taaki har device pe ek jaise dikhein) */
function Icon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "crown":
      return (
        <svg {...common}>
          <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
        </svg>
      );
    case "pawn":
      return (
        <svg {...common}>
          <circle cx="12" cy="6.5" r="3" />
          <path d="M9.5 11h5M10 11c0 3-1.5 4-2.5 6h9c-1-2-2.5-3-2.5-6M6.5 20h11" />
        </svg>
      );
    case "won":
      return (
        <svg {...common}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "at":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <path d="M4 7l8 6 8-6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 6.5a3 3 0 0 1 0 5.5M18 14.3c1.6.7 2.5 2.2 2.5 4.2" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case "spark":
    default:
      return (
        <svg {...common}>
          <path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7L12 3z" />
        </svg>
      );
  }
}

/* QV-STREAK: stats aur recent games ab asli data se aate hain (is browser ki saved games).
   Note: ye data abhi account-wise alag nahi hai, browser ka hai. */
function resultOf(game) {
  const r = game.result;
  const color = game.userColor || "w";
  if (r === "1/2-1/2") return "Draw";
  if (r === "1-0") return color === "w" ? "Win" : "Loss";
  if (r === "0-1") return color === "b" ? "Win" : "Loss";
  return null; // "*" ya pata nahi
}

function gameTime(game) {
  const t = new Date(game.playedAt || game.date || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

export default function Profile() {
  const { user, signOut } = useAuth();

  const metadata = user?.user_metadata || {};

  const displayName =
    metadata.display_name ||
    metadata.full_name ||
    user?.email?.split("@")[0] ||
    tx("Player");

  const username =
    metadata.username ||
    user?.email?.split("@")[0] ||
    "player";

  const email = user?.email ? maskEmail(user.email) : tx("No email available");
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const joinedLabel = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(getLang(), {
        month: "long",
        year: "numeric",
      })
    : "—";

  const [avatarBroken, setAvatarBroken] = useState(false);
  const [screen, setScreen] = useState("profile");
  const [tab, setTab] = useState("friends");

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);

  const [gameInvitations, setGameInvitations] = useState([]);
  const [sentGameInvitations, setSentGameInvitations] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [challengeFriend, setChallengeFriend] = useState(null);
  const [selectedMode, setSelectedMode] = useState("classic");
  const [selectedTime, setSelectedTime] = useState("10+0");
  const [sendingChallenge, setSendingChallenge] = useState(false);

  const [activeRoomId, setActiveRoomId] = useState(null);

  /* QV-STREAK: asli stats */
  const [myStats, setMyStats] = useState(null);
  const [recentGames, setRecentGames] = useState([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [games, streak] = await Promise.all([dbAll("games"), loadStreak()]);
        if (!alive) return;

        const real = games.filter((g) => g && g.pgn);
        const sorted = [...real].sort((a, b) => gameTime(b) - gameTime(a));
        const wins = real.filter((g) => resultOf(g) === "Win").length;

        setMyStats({
          streak: streak.count,
          best: streak.best,
          total: real.length,
          wins,
          activeDays: streak.week.filter((d) => d.state === "done").length,
        });

        setRecentGames(
          sorted.slice(0, 5).map((g) => {
            const opponent = (g.userColor === "b" ? g.white : g.black) || g.opponent || "Opponent";
            const label = SOURCE_LABELS[sourceKey(g)];
            const time = gameTime(g);
            return {
              id: g.id,
              opponent,
              mode: label && label !== "Saved" ? label : "",
              result: resultOf(g),
              accuracy: typeof g.accuracy === "number" ? Math.round(g.accuracy) : null,
              date: time ? new Date(time).toLocaleDateString(getLang(), { day: "numeric", month: "short", year: "numeric" }) : "",
            };
          })
        );
      } catch (err) {
        console.error("Profile stats failed:", err);
        if (alive) setMyStats({ streak: 0, best: 0, total: 0, wins: 0, activeDays: 0 });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function handleLogout() {
    const confirmed = await askConfirm(
      tx("Are you sure you want to log out of Qelvaris?")
    );

    if (!confirmed) return;

    const { error } = await signOut();

    if (error) window.alert(tx(friendlyMessage(error, "Could not log out. Please try again.")));
  }

  const loadFriendsData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError("");

    try {
      const [friendList, incoming, outgoing] = await Promise.all([
        getFriends(user.id),
        getFriendRequests(user.id),
        getSentRequests(user.id),
      ]);

      setFriends(friendList);
      setRequests(incoming);
      setSentRequests(outgoing);
    } catch (err) {
      console.error("Friends loading error:", err);
      setError(tx(friendlyMessage(err, "Could not load friends.")));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadGameInvitations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [incoming, outgoing] = await Promise.all([
        getIncomingGameInvitations(),
        getSentGameInvitations(),
      ]);

      setGameInvitations(incoming);
      setSentGameInvitations(outgoing);

      // If the other player accepts your challenge,
      // automatically open the active room.
      const acceptedInvitation = outgoing.find(
        (invitation) => invitation.status === "accepted"
      );

      if (acceptedInvitation?.room_id) {
        const room = await getGameRoom(acceptedInvitation.room_id);

        if (room?.status === "active") {
          setActiveRoomId(room.id);
          setScreen("game");
        }
      }
    } catch (err) {
      console.error("Game invitation loading error:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (screen !== "friends" || !user?.id) return;

    loadFriendsData();
    loadGameInvitations();

    const channel = supabase
      .channel(`friends-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
        },
        () => loadFriendsData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => loadFriendsData()
      )
      .subscribe();

    const invitationChannel = subscribeToGameInvitations(
      user.id,
      () => loadGameInvitations()
    );

    // Check sent invitations too, so the challenger can
    // automatically enter after the opponent accepts.
    const refreshId = window.setInterval(() => {
      loadGameInvitations();
    }, 4000);

    return () => {
  supabase.removeChannel(channel);

  if (typeof invitationChannel === "function") {
    invitationChannel();
  }

  window.clearInterval(refreshId);
};
  }, [
    screen,
    user?.id,
    loadFriendsData,
    loadGameInvitations,
  ]);

  async function handleSearch(event) {
    event.preventDefault();

    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError("");
    setMessage("");

    try {
      const results = await searchPlayers(searchTerm, user.id);
      setSearchResults(results);

      if (!results.length) {
        setMessage(tx("No players found. Try another username."));
      }
    } catch (err) {
  console.error("Game invitation loading error:", err);
  setError(
    tx(err.message || "Could not load game invitations.")
  );
}finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(player) {
    setActionId(player.id);
    setError("");
    setMessage("");

    try {
      await sendFriendRequest(player.username);

      setMessage(tx("Friend request sent to @{u}.", { u: player.username }));

      setSearchResults((previous) =>
        previous.filter((item) => item.id !== player.id)
      );

      await loadFriendsData();
    } catch (err) {
      setError(tx(friendlyMessage(err, "Could not send friend request.")));
    } finally {
      setActionId(null);
    }
  }

  async function handleRequestResponse(request, accept) {
    setActionId(request.id);
    setError("");
    setMessage("");

    try {
      await respondToFriendRequest(request.id, accept);

      setMessage(
        accept
          ? tx("Friend request accepted!")
          : tx("Friend request rejected.")
      );

      await loadFriendsData();
    } catch (err) {
      setError(tx(friendlyMessage(err, "Could not process request.")));
    } finally {
      setActionId(null);
    }
  }

  async function handleRemoveFriend(friend) {
    const confirmed = await askConfirm(
      tx("Remove @{u} from your friends?", { u: friend.username }),
      { danger: true }
    );

    if (!confirmed) return;

    setActionId(friend.id);
    setError("");

    try {
      await removeFriend(friend.id);
      setMessage(tx("@{u} removed from friends.", { u: friend.username }));
      await loadFriendsData();
    } catch (err) {
      setError(tx(friendlyMessage(err, "Could not remove friend.")));
    } finally {
      setActionId(null);
    }
  }

  function openChallenge(friend) {
    setChallengeFriend(friend);
    setSelectedMode("classic");
    setSelectedTime("10+0");
    setError("");
    setMessage("");
  }

  async function handleSendChallenge() {
    if (!challengeFriend?.id) return;

    setSendingChallenge(true);
    setError("");
    setMessage("");

    try {
      await sendGameInvitation(
        challengeFriend.id,
        selectedMode,
        selectedTime
      );

      setMessage(
        tx("Challenge sent to @{u}! Waiting for acceptance.", { u: challengeFriend.username })
      );

      setChallengeFriend(null);
      await loadGameInvitations();
    } catch (err) {
      console.error("Challenge sending error:", err);
      setError(
        tx(err.message ||
          "Could not send challenge. Please try again.")
      );
    } finally {
      setSendingChallenge(false);
    }
  }

  async function handleGameInvitationResponse(invitation, accept) {
    setActionId(invitation.id);
    setError("");
    setMessage("");

    try {
      const roomId = await respondToGameInvitation(
        invitation.id,
        accept
      );

      if (accept && roomId) {
        setActiveRoomId(roomId);
        setScreen("game");
        setMessage(tx("Challenge accepted. Entering game..."));
      } else {
        setMessage(tx("Game challenge rejected."));
        await loadGameInvitations();
      }
    } catch (err) {
      console.error("Game invitation response error:", err);
      setError(
        tx(err.message ||
          "Could not process the game invitation.")
      );
    } finally {
      setActionId(null);
    }
  }

  function openFriends() {
    setScreen("friends");
    setTab("friends");
    setMessage("");
    setError("");
  }

  function getModeLabel(mode) {
    return (
      tx(GAME_MODES.find((item) => item.value === mode)?.label ||
      mode ||
      "Chess")
    );
  }

  function renderPlayer(player, type) {
    const name =
      player.display_name || player.username || tx("Player");

    return (
      <div className="friends-player-card" key={player.id}>
        <div className="friends-player-avatar">
          {player.avatar_url ? (
            <img src={player.avatar_url} alt={name} />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="friends-player-info">
          <strong>{name}</strong>
          <span>@{player.username}</span>
        </div>

        <div className="friends-player-actions">
          {type === "friend" && (
            <>
              <button
                className="friends-challenge-btn"
                onClick={() => openChallenge(player)}
              >
                {tx("⚔ Challenge")}</button>

              <button
                className="friends-remove-btn"
                disabled={actionId === player.id}
                onClick={() => handleRemoveFriend(player)}
                title={tx("Remove friend")}
              >
                ×
              </button>
            </>
          )}

          {type === "search" && (
            <button
              className="friends-add-btn"
              disabled={actionId === player.id}
              onClick={() => handleSendRequest(player)}
            >
              {actionId === player.id ? "Sending..." : "+ Add"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "game" && activeRoomId) {
    return (
      <div className="profile-page">
        <MultiplayerGame
          roomId={activeRoomId}
          onBack={() => {
            setActiveRoomId(null);
            setScreen("friends");
            loadGameInvitations();
          }}
        />
      </div>
    );
  }

  if (screen === "friends") {
    return (
      <div className="profile-page friends-page">
        <div className="friends-page-header">
          <div>
            <span className="profile-eyebrow">{tx("QELVARIS COMMUNITY")}</span>
            <h1>{tx("Friends")}</h1>
            <p>{tx("Connect with players and build your chess circle.")}</p>
          </div>

          <button
            className="friends-back-btn"
            onClick={() => {
              setScreen("profile");
              setMessage("");
              setError("");
            }}
          >
            {tx("← Back to Profile")}</button>
        </div>

        <div className="friends-summary">
          <div className="friends-summary-icon">♟</div>
          <div>
            <strong>{tx("{n} Friends", { n: friends.length })}</strong>
            <span>{tx("Your chess community")}</span>
          </div>
        </div>

        <div className="friends-tabs">
          <button
            className={tab === "friends" ? "active" : ""}
            onClick={() => setTab("friends")}
          >
            <span>♟</span> {" "}{tx("My Friends")}<b>{friends.length}</b>
          </button>

          <button
            className={tab === "add" ? "active" : ""}
            onClick={() => setTab("add")}
          >
            <span>＋</span> {" "}{tx("Add Friends")}</button>

          <button
            className={tab === "requests" ? "active" : ""}
            onClick={() => setTab("requests")}
          >
            <span>✉</span> {" "}{tx("Requests")}<b>{requests.length}</b>
          </button>

          <button
            className={tab === "challenges" ? "active" : ""}
            onClick={() => {
              setTab("challenges");
              loadGameInvitations();
            }}
          >
            <span>⚔</span> {" "}{tx("Challenges")}<b>{gameInvitations.length}</b>
          </button>
        </div>

        {message && (
          <div className="friends-message success">{message}</div>
        )}

        {error && (
          <div className="friends-message error">{error}</div>
        )}

        {loading && (
          <div className="friends-empty">
            <div className="friends-loader"></div>
            <p>{tx("Loading your chess community...")}</p>
          </div>
        )}

        {!loading && tab === "friends" && (
          <section className="friends-panel">
            <div className="friends-panel-heading">
              <div>
                <span className="profile-section-label">
                  {tx("YOUR COMMUNITY")}</span>
                <h2>{tx("My Friends")}</h2>
              </div>

              <button
                className="friends-add-top-btn"
                onClick={() => setTab("add")}
              >
                {tx("+ Find Players")}</button>
            </div>

            {friends.length ? (
              <div className="friends-list">
                {friends.map((friend) =>
                  renderPlayer(friend, "friend")
                )}
              </div>
            ) : (
              <div className="friends-empty">
                <div className="friends-empty-icon">♟</div>
                <h3>{tx("Your chess circle starts here")}</h3>
                <p>
                  {tx("Search for players and add your first chess friend.")}</p>
                <button
                  className="friends-add-top-btn"
                  onClick={() => setTab("add")}
                >
                  {tx("Find Players")}</button>
              </div>
            )}
          </section>
        )}

        {!loading && tab === "add" && (
          <section className="friends-panel">
            <div className="friends-panel-heading">
              <div>
                <span className="profile-section-label">
                  {tx("DISCOVER PLAYERS")}</span>
                <h2>{tx("Add Friends")}</h2>
              </div>
              <span className="friends-panel-symbol">⌕</span>
            </div>

            <form
              className="friends-search-form"
              onSubmit={handleSearch}
            >
              <span>⌕</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder={tx("Search by username or display name...")}
              />
              <button type="submit" disabled={searching}>
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            <p className="friends-search-hint">
              {tx("Search for registered Qelvaris players by their username.")}</p>

            {searchResults.length > 0 && (
              <div className="friends-list">
                {searchResults.map((player) =>
                  renderPlayer(player, "search")
                )}
              </div>
            )}

            {!searchResults.length && !searching && (
              <div className="friends-empty">
                <div className="friends-empty-icon">⌕</div>
                <h3>{tx("Find your next chess rival")}</h3>
                <p>
                  {tx("Enter a player's username or display name above.")}</p>
              </div>
            )}
          </section>
        )}

        {!loading && tab === "requests" && (
          <section className="friends-panel">
            <div className="friends-panel-heading">
              <div>
                <span className="profile-section-label">
                  {tx("CONNECTIONS")}</span>
                <h2>{tx("Friend Requests")}</h2>
              </div>
              <span className="friends-panel-symbol">✉</span>
            </div>

            <h3 className="friends-subheading">
              {tx("Incoming Requests ({n})", { n: requests.length })}
            </h3>

            {requests.length ? (
              <div className="friends-list">
                {requests.map((request) => {
                  const player = request.sender;

                  if (!player) return null;

                  return (
                    <div
                      className="friends-player-card"
                      key={request.id}
                    >
                      <div className="friends-player-avatar">
                        {(player.display_name || player.username)
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="friends-player-info">
                        <strong>
                          {player.display_name || player.username}
                        </strong>
                        <span>@{player.username}</span>
                      </div>

                      <div className="friends-player-actions">
                        <button
                          className="friends-accept-btn"
                          disabled={actionId === request.id}
                          onClick={() =>
                            handleRequestResponse(request, true)
                          }
                        >
                          {tx("Accept")}</button>

                        <button
                          className="friends-reject-btn"
                          disabled={actionId === request.id}
                          onClick={() =>
                            handleRequestResponse(request, false)
                          }
                        >
                          {tx("Reject")}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="friends-empty compact">
                <h3>{tx("No incoming requests")}</h3>
                <p>{tx("New friend requests will appear here.")}</p>
              </div>
            )}

            <div className="friends-request-divider"></div>

            <h3 className="friends-subheading">
              {tx("Sent Requests ({n})", { n: sentRequests.length })}
            </h3>

            {sentRequests.length ? (
              <div className="friends-list">
                {sentRequests.map((request) => (
                  <div
                    className="friends-player-card"
                    key={request.id}
                  >
                    <div className="friends-player-avatar">
                      {(request.receiver?.display_name ||
                        request.receiver?.username ||
                        "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="friends-player-info">
                      <strong>
                        {request.receiver?.display_name ||
                          request.receiver?.username ||
                          tx("Player")}
                      </strong>
                      <span>
                        @{request.receiver?.username || "player"}
                      </span>
                    </div>

                    <span className="friends-pending-label">
                      {tx("Pending")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="friends-search-hint">
                {tx("You have no pending sent requests.")}</p>
            )}
          </section>
        )}

        {!loading && tab === "challenges" && (
          <section className="friends-panel">
            <div className="friends-panel-heading">
              <div>
                <span className="profile-section-label">
                  {tx("MULTIPLAYER")}</span>
                <h2>{tx("Game Challenges")}</h2>
              </div>
              <span className="friends-panel-symbol">⚔</span>
            </div>

            <h3 className="friends-subheading">
              {tx("Incoming Challenges ({n})", { n: gameInvitations.length })}
            </h3>

            {gameInvitations.length ? (
              <div className="friends-list">
                {gameInvitations.map((invitation) => (
                  <div
                    className="friends-player-card challenge-card"
                    key={invitation.id}
                  >
                    <div className="friends-player-avatar">
                      ⚔
                    </div>

                    <div className="friends-player-info">
                      <strong>
                        {getModeLabel(invitation.game_mode)}
                      </strong>
                      <span>
                        {invitation.time_control} • {tx("Game invitation")}
                      </span>
                    </div>

                    <div className="friends-player-actions">
                      <button
                        className="friends-accept-btn"
                        disabled={actionId === invitation.id}
                        onClick={() =>
                          handleGameInvitationResponse(
                            invitation,
                            true
                          )
                        }
                      >
                        {tx("Accept")}</button>

                      <button
                        className="friends-reject-btn"
                        disabled={actionId === invitation.id}
                        onClick={() =>
                          handleGameInvitationResponse(
                            invitation,
                            false
                          )
                        }
                      >
                        {tx("Reject")}</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="friends-empty compact">
                <h3>{tx("No incoming challenges")}</h3>
                <p>{tx("When a friend challenges you, it will appear here.")}</p>
              </div>
            )}

            <div className="friends-request-divider"></div>

            <h3 className="friends-subheading">
              {tx("Your Sent Challenges")}</h3>

            {sentGameInvitations.length ? (
              <div className="friends-list">
                {sentGameInvitations.map((invitation) => (
                  <div
                    className="friends-player-card"
                    key={invitation.id}
                  >
                    <div className="friends-player-avatar">⚔</div>

                    <div className="friends-player-info">
                      <strong>
                        {getModeLabel(invitation.game_mode)}
                      </strong>
                      <span>
                        {invitation.time_control} •{" "}
                        {invitation.status}
                      </span>
                    </div>

                    <span
                      className={`friends-pending-label ${
                        invitation.status === "accepted"
                          ? "challenge-accepted"
                          : ""
                      }`}
                    >
                      {invitation.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="friends-search-hint">
                {tx("You have not sent any game challenges yet.")}</p>
            )}
          </section>
        )}

        {challengeFriend && (
          <div
            className="challenge-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setChallengeFriend(null);
              }
            }}
          >
            <div className="challenge-modal">
              <div className="challenge-modal-heading">
                <div>
                  <span className="profile-section-label">
                    {tx("MULTIPLAYER MATCH")}</span>
                  <h2>{tx("Challenge Player")}</h2>
                  <p>
                    {tx("Send a chess challenge to")}{" "}
                    <strong>@{challengeFriend.username}</strong>
                  </p>
                </div>

                <button
                  className="challenge-modal-close"
                  onClick={() => setChallengeFriend(null)}
                  aria-label={tx("Close")}
                >
                  ×
                </button>
              </div>

              <label className="challenge-field">
                <span>{tx("Game Mode")}</span>
                <select
                  value={selectedMode}
                  onChange={(event) =>
                    setSelectedMode(event.target.value)
                  }
                >
                  {GAME_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {tx(mode.label)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="challenge-field">
                <span>{tx("Time Control")}</span>
                <select
                  value={selectedTime}
                  onChange={(event) =>
                    setSelectedTime(event.target.value)
                  }
                >
                  {TIME_CONTROLS.map((time) => (
                    <option key={time.value} value={time.value}>
                      {tx(time.label)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="challenge-modal-actions">
                <button
                  className="challenge-cancel-btn"
                  onClick={() => setChallengeFriend(null)}
                  disabled={sendingChallenge}
                >
                  {tx("Cancel")}</button>

                <button
                  className="friends-challenge-btn challenge-send-btn"
                  onClick={handleSendChallenge}
                  disabled={sendingChallenge}
                >
                  {sendingChallenge
                    ? "Sending..."
                    : "⚔ Send Challenge"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="profile-page pf-page">
      <section className="pf-hero">
        {/* Left: glass bubble avatar */}
        <div className="pf-avatar" aria-hidden="true">
          {!avatarBroken ? (
            <img
              src={glassPawn}
              alt=""
              draggable="false"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <span className="pf-avatar-letter">{avatarLetter}</span>
          )}
        </div>

        <div className="pf-hero-main">
          <div className="pf-hero-top">
            <div className="pf-identity">
              <div className="pf-name-row">
                <h1>{displayName}</h1>
                <span className="pf-player-pill">
                  <b>Q</b> {" "}{tx("Qelvaris Player")}</span>
                <span className="pf-hex" title={tx("Member")}>
                  <Icon name="spark" />
                </span>
              </div>
              <p className="pf-handle">@{username}</p>
            </div>

            <button
              type="button"
              className="pf-connect"
              onClick={openFriends}
            >
              <span className="pf-connect-head">
                <span className="pf-connect-icon">
                  <Icon name="pawn" />
                </span>
                <strong>{tx("Connect with players")}</strong>
              </span>
              <span className="pf-connect-bar">
                <span>{tx("Open Friends")}</span>
                <span aria-hidden="true">→</span>
              </span>
            </button>
          </div>

          <div className="pf-stats">
            <div className="pf-stat">
              <span className="pf-stat-icon"><Icon name="flame" /></span>
              <div>
                <strong>{myStats ? myStats.streak : "—"}</strong>
                <small>{myStats && myStats.best > myStats.streak ? tx("Day streak · best {n}", { n: myStats.best }) : tx("Day streak")}</small>
              </div>
            </div>
            <div className="pf-stat">
              <span className="pf-stat-icon"><Icon name="pawn" /></span>
              <div>
                <strong>{myStats ? myStats.total : "—"}</strong>
                <small>{tx("Total games")}</small>
              </div>
            </div>
            <div className="pf-stat">
              <span className="pf-stat-icon"><Icon name="won" /></span>
              <div>
                <strong>{myStats ? myStats.wins : "—"}</strong>
                <small>{tx("Games won")}</small>
              </div>
            </div>
            <div className="pf-stat">
              <span className="pf-stat-icon"><Icon name="clock" /></span>
              <div>
                <strong>{myStats ? `${myStats.activeDays}/7` : "—"}</strong>
                <small>{tx("Active days this week")}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pf-grid">
        <div className="pf-panel">
          <h2>{tx("Personal Details")}</h2>

          <div className="pf-details">
            <div className="pf-detail">
              <span className="pf-detail-icon"><Icon name="pawn" /></span>
              <div>
                <small>{tx("Display Name")}</small>
                <strong>{displayName}</strong>
              </div>
            </div>

            <div className="pf-detail">
              <span className="pf-detail-icon"><Icon name="at" /></span>
              <div>
                <small>{tx("Username")}</small>
                <strong>@{username}</strong>
              </div>
            </div>

            <div className="pf-detail">
              <span className="pf-detail-icon"><Icon name="mail" /></span>
              <div>
                <small>{tx("Email Address")}</small>
                <strong>{email}</strong>
              </div>
            </div>

            <div className="pf-detail">
              <span className="pf-detail-icon"><Icon name="users" /></span>
              <div>
                <small>{tx("Joined")}</small>
                <strong>{joinedLabel}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="pf-logout"
            onClick={handleLogout}
          >
            <span aria-hidden="true">↪</span> {" "}{tx("Logout")}</button>
        </div>

        <div className="pf-panel">
          <h2>{tx("Recent Game History")}</h2>

          {recentGames.length ? (
            <div className="pf-history">
              {recentGames.map((game) => (
                <div className="pf-game" key={game.id}>
                  <span className="pf-game-text">
                    {tx("vs.")} <b>{game.opponent}</b>
                    {game.mode ? <em> ({game.mode})</em> : null}
                    {game.result ? (
                      <>
                        {" "}
                        •{" "}
                        <span
                          className={`pf-result pf-result--${String(
                            game.result
                          ).toLowerCase()}`}
                        >
                          {tx(game.result)}
                        </span>
                      </>
                    ) : null}
                    {game.accuracy != null ? (
                      <>
                        {" "}
                        • {tx("Accuracy")} <b>{game.accuracy}%</b>
                      </>
                    ) : null}
                  </span>
                  {game.date ? (
                    <span className="pf-game-date">{game.date}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="pf-history-empty">
              <span className="pf-detail-icon"><Icon name="pawn" /></span>
              <strong>{tx("No games yet")}</strong>
              <p>
                {tx("Your latest games will show up here once you start playing.")}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}