# 0001 Learning data stays on the user's device
Context: analysis runs in the browser; storing every user's games centrally costs money and raises privacy duties.
Decision: IndexedDB per account; cloud backup is optional and explicit.
Alternatives: central database of all games (rejected: cost, privacy, size).
Consequences: no automatic multi-device sync; need backup/restore, conflict checks, persistent storage request.
