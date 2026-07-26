// User-supplied search text goes straight into `new RegExp(...)` in a few
// places (user search, admin user search) — without escaping, a query like
// "a.*a.*a.*a.*b" is a classic ReDoS payload, and even benign input with
// regex metacharacters (e.g. "c++", "a(b)") throws or matches nonsense.
export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
