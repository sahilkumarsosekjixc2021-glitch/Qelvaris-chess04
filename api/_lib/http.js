// One response format for every endpoint:  { error: { code, message } }  or  { ok: true, ... }
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function fail(res, status, code, message) {
  send(res, status, { error: { code, message } });
}

export function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+([\w.-]+)$/.exec(h);
  return m ? m[1] : null;
}

// Raw body as a string (needed to verify PayPal's signature byte for byte).
export async function rawBody(req, max = 1024 * 1024) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw Object.assign(new Error("too-large"), { code: "too-large" });
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Never log secrets or e-mail addresses.
export function log(level, msg, fields = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(fields)) {
    safe[k] = /pass|token|secret|authorization|email|key/i.test(k) ? "[redacted]" : typeof v === "string" ? v.slice(0, 200) : v;
  }
  console[level === "error" ? "error" : "log"](JSON.stringify({ level, msg, ...safe, t: new Date().toISOString() }));
}
