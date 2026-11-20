# 0002 Backup is a versioned snapshot with a revision check
Context: two devices can back up to the same row; a blind upsert lets an old device erase a newer backup.
Decision: `user_backups.rev` is a counter. Push updates `where rev = <rev this device last saw>`; zero rows updated = conflict, the user must choose. Restore shows a preview and offers "add missing only" (default for used devices) or "replace" (default for empty devices).
Alternatives: last-write-wins (rejected: silent loss); field-level merge of streak/QC (rejected: wallet is a ledger, wrong merges could create or destroy credits).
Consequences: this is restore-on-demand, not live sync. Documented in the UI.
