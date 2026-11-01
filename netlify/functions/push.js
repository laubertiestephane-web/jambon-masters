// Fonction serverless (Netlify) : envoie une notification push "birdie" à tous les abonnés.
// Appelée par l'app après la saisie d'un birdie ; vérifie le score dans Firestore avant d'envoyer.
const webpush = require("web-push");
const PROJECT = "jambon-masters";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const PARS = {"simola": [5, 4, 4, 4, 4, 3, 5, 4, 3, 4, 3, 5, 4, 3, 5, 4, 3, 5], "pezula": [5, 4, 3, 4, 3, 4, 4, 4, 5, 4, 3, 4, 5, 4, 3, 4, 4, 5], "plettenberg": [4, 4, 4, 5, 4, 3, 5, 3, 4, 4, 3, 4, 3, 4, 5, 4, 4, 5], "goose": [4, 3, 4, 4, 3, 4, 5, 5, 4, 4, 3, 4, 3, 5, 4, 5, 4, 4], "knysna": [4, 3, 5, 4, 4, 4, 4, 3, 5, 4, 4, 3, 5, 3, 4, 5, 4, 4]};
const NAMES = {"simola": "Simola", "pezula": "Pezula", "plettenberg": "Plettenberg", "goose": "Goose Valley", "knysna": "Knysna GC"};
const APP_URL = "https://laubertiestephane-web.github.io/jambon-masters/";
const fv = v => v == null ? null : "integerValue" in v ? +v.integerValue : "doubleValue" in v ? +v.doubleValue : "stringValue" in v ? v.stringValue : "booleanValue" in v ? v.booleanValue : "nullValue" in v ? null : "mapValue" in v ? Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,fv(x)])) : "arrayValue" in v ? (v.arrayValue.values||[]).map(fv) : null;
const doc = async path => { const r = await fetch(`${BASE}/${path}`); if (!r.ok) return null; const j = await r.json(); return Object.fromEntries(Object.entries(j.fields||{}).map(([k,x])=>[k,fv(x)])); };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "POST only" };
  try {
    const { day, pid, hole, by } = JSON.parse(event.body || "{}");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day||"") || !/^[a-z0-9_-]{1,30}$/i.test(pid||"") || !(hole >= 1 && hole <= 18)) return { statusCode: 400, headers: cors, body: "bad request" };
    const d = await doc("days/" + day); const par = d && PARS[d.course]; if (!par) return { statusCode: 404, headers: cors, body: "no course" };
    const sc = await doc(`live/score_${day}_${pid}`); const g = sc && sc.holes && sc.holes[hole - 1]; if (g == null) return { statusCode: 409, headers: cors, body: "no score" };
    const diff = g - par[hole - 1]; if (diff > -1) return { statusCode: 409, headers: cors, body: "not a birdie" };
    const pl = await doc("players/" + pid); const nick = (pl && pl.nick) || pid;
    const label = diff <= -3 ? "ALBATROS" : diff === -2 ? "EAGLE" : "Birdie"; const emoji = diff <= -2 ? "🦅" : "🐦";
    const title = `${emoji} ${label} pour ${nick} !`; const body = `Trou ${hole} · ${NAMES[d.course] || d.course}`;
    webpush.setVapidDetails("mailto:laubertiestephane@gmail.com", process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
    const q = await fetch(`${BASE}:runQuery`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "live" }], where: { fieldFilter: { field: { fieldPath: "kind" }, op: "EQUAL", value: { stringValue: "push" } } } } }) });
    const rows = (await q.json()).filter(x => x.document).map(x => ({ name: x.document.name, ...Object.fromEntries(Object.entries(x.document.fields||{}).map(([k,v])=>[k,fv(v)])) }));
    const payload = JSON.stringify({ title, body, tag: `birdie-${day}-${pid}-${hole}`, url: APP_URL, kind: diff <= -2 ? "eagle" : "birdie" });
    let sent = 0, failed = 0;
    await Promise.all(rows.map(async r => { if (!r.sub || !r.sub.endpoint) return; if (by && r.uid === by) return; try { await webpush.sendNotification(r.sub, payload, { TTL: 600, urgency: "high" }); sent++; } catch (e) { failed++; console.warn("push fail", e.statusCode, r.player); } }));
    return { statusCode: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ ok: true, title, sent, failed, subscribers: rows.length }) };
  } catch (e) { console.error(e); return { statusCode: 500, headers: cors, body: "error: " + e.message }; }
};
