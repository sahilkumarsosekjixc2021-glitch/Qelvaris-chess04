# Checks only a human can do (10 minutes, two accounts A and B, two browsers)

1. Sign in as A, back up. Sign in as B in the other browser. In B's DevTools console run:
   `await (await fetch(SUPABASE_URL + "/rest/v1/user_backups?select=*", {headers:{apikey:ANON_KEY, Authorization:"Bearer "+B_TOKEN}})).json()` -> must list only B's row (or `[]`).
2. Same for `subscriptions`: only your own row.
3. B tries to write a subscription: `POST /rest/v1/subscriptions` with B's token -> must be refused (no insert policy).
4. Paste `<script>alert(1)</script>` into username, display name, feedback, search boxes: nothing pops up.
5. Wrong password and unknown email show the same message.
6. Turn off Wi-Fi in each main page: a friendly message, not a blank screen.
7. Use the site with only the keyboard; open it on your own phone.
8. In DevTools console look for "Content Security Policy" report-only messages after clicking every page. Fix or add the host, then rename the header in `vercel.json` from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
9. Search the deployed JS (DevTools -> Sources) for `service_role` and `PAYPAL_CLIENT_SECRET`: zero results.
