
export function friendlyMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;

  const message =
    typeof error === "string"
      ? error
      : error.message || error.details || error.hint || "";

  if (!message) return fallback;

  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Please verify your email before logging in.";
  }

  if (normalized.includes("user already registered")) {
    return "An account with this email already exists.";
  }

  if (normalized.includes("network")) {
    return "Network error. Please check your internet connection.";
  }

  if (normalized.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  return message;
}
