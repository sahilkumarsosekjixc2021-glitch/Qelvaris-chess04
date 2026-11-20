# 0004 Error reporting through the existing events table
Context: need to hear about crashes without a new paid service.
Decision: `errorReport.js` sends redacted `client_error` events (max 8 per session) into the insert-only `events` table; ErrorBoundary wraps the whole app and every page.
Alternatives: Sentry (better stack traces and alerts; add when traffic justifies it).
Consequences: minified stack lines only; no automatic alerts -> check the events table weekly (see monitoring runbook).
