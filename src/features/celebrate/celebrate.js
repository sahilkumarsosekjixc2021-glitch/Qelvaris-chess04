// QV-CELEBRATE: kahin se bhi celebration trigger karo:
//   celebrate({ kind: "step" | "perfect" | "milestone" | "start" | "purchase" | "claim", title, sub, qc })
// Kaun sa kind kitna bada hai (confetti / sound) CelebrationHost.jsx mein tay hota hai.
export function celebrate(detail) {
  try {
    window.dispatchEvent(new CustomEvent("qelvaris-celebrate", { detail }));
  } catch {
    /* ignore */
  }
}
