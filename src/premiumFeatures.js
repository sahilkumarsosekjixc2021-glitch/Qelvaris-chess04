
export const PREMIUM_FEATURES = {
  deepAnalysis: {
    id: "deepAnalysis",
    name: "Deep Analysis Reports",
    description: "Detailed engine-based game reports and critical positions.",
  },
  personalTraining: {
    id: "personalTraining",
    name: "Personal Training Plans",
    description: "Training recommendations based on reviewed games.",
  },
  progressTrends: {
    id: "progressTrends",
    name: "Long-term Progress Trends",
    description: "Track recurring mistakes and performance over time.",
  },
};

export function hasPremiumAccess(user) {
  // Connect this to a verified backend subscription later.
  // Never trust a client-side flag for real payment protection.
  return user?.plan === "premium" && user?.subscriptionVerified === true;
}
