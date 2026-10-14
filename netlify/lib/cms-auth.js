const crypto = require("node:crypto");

const ROLES = ["admin", "reporter", "reviewer"];
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");

function credentialsFor(role, env = process.env) {
  const prefix = `CMS_${String(role || "").toUpperCase()}`;
  return { email: env[`${prefix}_EMAIL`], password: env[`${prefix}_PASSWORD`] };
}

function authenticateCredentials(email, password, role, env = process.env) {
  if (!ROLES.includes(role)) return null;
  const expected = credentialsFor(role, env);
  if (!expected.email || !expected.password) return null;
  if (!safeEqual(String(email).toLowerCase(), String(expected.email).toLowerCase()) || !safeEqual(password, expected.password)) return null;
  return { id: String(expected.email).toLowerCase(), email: String(expected.email).toLowerCase(), role };
}

function signSession(user, secret, now = Date.now()) {
  if (!secret || String(secret).length < 32) throw new Error("CMS_SESSION_SECRET must contain at least 32 characters");
  const payload = encode({ ...user, iat: now, exp: now + 8 * 60 * 60 * 1000 });
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token, secret, now = Date.now()) {
  if (!token || !secret || String(secret).length < 32 || String(token).length > 4096) return null;
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return user.exp > now && ROLES.includes(user.role) ? user : null;
  } catch { return null; }
}

function transitionAllowed(role, from, to) {
  const rules = {
    reporter: { draft: ["submitted"], changes_requested: ["submitted"] },
    reviewer: { submitted: ["under_review", "changes_requested", "reviewer_approved", "reviewer_rejected"], under_review: ["changes_requested", "reviewer_approved", "reviewer_rejected"] },
    admin: { reviewer_approved: ["published", "scheduled", "rejected"], scheduled: ["published", "archived"], published: ["unpublished", "archived"], unpublished: ["published", "archived"] }
  };
  return Boolean(rules[role]?.[from]?.includes(to));
}

module.exports = { authenticateCredentials, signSession, verifySession, transitionAllowed };