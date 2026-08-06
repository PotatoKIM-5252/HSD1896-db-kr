// ===========================================================================
// 스팀 OpenID 로그인 검증 프록시 + 사무소 신고 영상 업로드/조회/삭제 (Cloudflare Workers)
//
// [스팀 로그인 검증]
// 스팀의 OpenID check_authentication 엔드포인트는 CORS를 지원하지 않아서 브라우저가
// 직접 호출할 수 없다(서버 대 서버 통신만 가능). 그래서 이 Worker가 대신 스팀에
// 물어봐서 로그인 응답이 진짜인지 확인하고, 통과하면 그 결과로 Firebase 로그인
// 토큰(Custom Token)까지 직접 발급해서 돌려준다.
//
// ⚠ 토큰을 여기서 직접 발급하는 이유: 만약 이 Worker가 "검증됨(true/false)"만
//   알려주고 실제 Firestore 쓰기는 브라우저가 한다면, 이 Worker를 거치지 않고
//   Firestore에 직접 요청을 보내 아무 SteamID나 자기 것이라고 위조할 수 있다.
//   Firebase Auth의 uid 자체를 여기서 발급하면, Firestore 보안 규칙이
//   "ownerId == request.auth.uid"만 확인해도 안전해진다(그 uid를 가지려면
//   반드시 이 Worker를 통과해야 하므로).
//
// [사무소 신고 영상]
// Firebase Storage는 유료(Blaze) 요금제가 필요해서 안 쓰고, 이 Worker가 대신
// Cloudflare R2(영상 저장)와 KV(하루 신고 횟수 카운터)를 이용해 업로드/조회/삭제를
// 중계한다. 웹훅/버킷 주소를 클라이언트에 직접 노출하지 않고, 매 요청마다 여기서
// Firebase ID 토큰을 검증해서 실제 로그인한 스팀 사용자인지 확인한 뒤에만 처리한다.
// 악용 방지로 영상 1개당 300MB 제한, 버킷 전체 5GB 넘으면 업로드 거부, 사람당
// 하루 5건 제한을 둔다(완벽한 동시성 차단은 아니지만 한도를 넉넉히 낮게 잡아 안전).
//
// 배포: Cloudflare 대시보드 > Workers & Pages > 해당 Worker > 이 파일 내용을
// 그대로 붙여넣고 배포. 아래를 Settings에 등록해야 한다:
//   시크릿(Variables and Secrets):
//     - FIREBASE_CLIENT_EMAIL : Firebase 서비스 계정 JSON의 client_email 값
//     - FIREBASE_PRIVATE_KEY  : Firebase 서비스 계정 JSON의 private_key 값 (그대로, 줄바꿈 포함)
//   바인딩(Bindings):
//     - R2 Bucket, 변수명 REPORT_VIDEOS → report-video 버킷
//     - KV Namespace, 변수명 REPORT_LIMITS → report-limits 네임스페이스
// ===========================================================================

const ALLOWED_ORIGIN = "https://potatokim-5252.github.io";
const STEAM_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const STEAM_UID_RE = /^7656119\d{10}$/;
const FIREBASE_WEB_API_KEY = "AIzaSyD3SbLMnzxnDypLXa4kLizKJQkn30bl3CU"; // 공개 클라이언트 키(비밀 아님)
const OPERATOR_UID = "2S8L0VeihHaUFRkOWOeypEe2Guk1";

const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 영상 1개당 상한
const MAX_TOTAL_BYTES = 5 * 1024 * 1024 * 1024; // 버킷 전체 상한(무료 한도 10GB보다 여유 크게)
const DAILY_REPORT_LIMIT = 5; // 사람당 하루 신고(영상 업로드) 횟수 제한

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(obj) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function pemToArrayBuffer(pem) {
  // Firebase 서비스계정 JSON을 그대로 복사하면 줄바꿈이 실제 개행이 아니라 "\n" 두 글자
  // 그대로 붙여넣어질 수 있어서, 둘 다 처리되게 먼저 실제 개행으로 바꿔준다.
  const b64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importSigningKey(pem) {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// Firebase Custom Token 스펙(https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library)에
// 맞춰 RS256로 서명한 JWT를 직접 만든다 — firebase-admin 패키지는 Workers 런타임과
// 호환되지 않아서 못 쓰고, 표준 JWT 서명이라 Web Crypto API로 직접 구현 가능하다.
async function createFirebaseCustomToken(steamId, clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid: steamId,
  };
  const unsigned = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const key = await importSigningKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function handleSteamVerify(request, env) {
  let params;
  try {
    params = await request.json();
  } catch {
    return jsonResponse({ valid: false, error: "bad_request" }, 400);
  }

  if (params["openid.mode"] !== "id_res") {
    return jsonResponse({ valid: false, error: "bad_mode" }, 400);
  }

  const claimedId = params["openid.claimed_id"] || "";
  const match = claimedId.match(STEAM_ID_RE);
  if (!match) return jsonResponse({ valid: false, error: "no_steamid" }, 400);
  const steamId = match[1];

  // 스팀에게 이 로그인 응답이 진짜인지 서버 대 서버로 재확인 — 브라우저가 보낸 openid.*
  // 파라미터를 그대로 다시 스팀에 보내되 mode만 check_authentication으로 바꿔서 검증받는다.
  const verifyBody = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith("openid.")) verifyBody.set(key, String(value));
  }
  verifyBody.set("openid.mode", "check_authentication");

  let steamText;
  try {
    const steamRes = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody.toString(),
    });
    steamText = await steamRes.text();
  } catch {
    return jsonResponse({ valid: false, error: "steam_unreachable" }, 502);
  }

  if (!/is_valid\s*:\s*true/.test(steamText)) {
    return jsonResponse({ valid: false, error: "steam_rejected" }, 401);
  }

  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return jsonResponse({ valid: false, error: "server_misconfigured" }, 500);
  }

  const token = await createFirebaseCustomToken(steamId, env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
  return jsonResponse({ valid: true, steamId, token });
}

// ---------------------------------------------------------------------------
// 사무소 신고 영상 — 업로드/조회/삭제
// ---------------------------------------------------------------------------

// Authorization: Bearer <Firebase ID 토큰>이 진짜 유효한 로그인인지 Firebase Identity
// Toolkit에 물어봐서 확인하고, 통과하면 그 안의 uid(=스팀 로그인이면 SteamID64)를 돌려준다.
async function verifyIdTokenAndGetUid(idToken) {
  if (!idToken) return null;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.users?.[0]?.localId || null;
  } catch {
    return null;
  }
}

function getBearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  return m ? m[1] : null;
}

// 버킷에 지금까지 쌓인 전체 용량(바이트) — 신고 영상은 소수만 쌓이는 구조라
// list() 한 번(필요하면 페이지네이션)으로 충분히 가볍다.
async function getBucketTotalBytes(bucket) {
  let total = 0;
  let cursor;
  do {
    const listed = await bucket.list({ cursor });
    for (const obj of listed.objects) total += obj.size;
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return total;
}

// 오늘 하루 이 사람이 몇 건 올렸는지 KV에서 세고, 한도 안이면 1 늘려서 저장한다.
// (완벽한 원자적 카운터는 아니지만 하루 5건이라는 느슨한 제한엔 충분하다.)
async function checkAndBumpDailyLimit(kv, uid) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const key = `count:${uid}:${today}`;
  const current = Number((await kv.get(key)) || "0");
  if (current >= DAILY_REPORT_LIMIT) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 172800 }); // 2일 뒤 자동 만료
  return true;
}

function randomId(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function handleUploadReportVideo(request, env) {
  if (!env.REPORT_VIDEOS || !env.REPORT_LIMITS) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const uid = await verifyIdTokenAndGetUid(getBearerToken(request));
  if (!uid || !STEAM_UID_RE.test(uid)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.startsWith("video/")) {
    return jsonResponse({ error: "not_video" }, 400);
  }

  // 대략적인 사전 체크(Content-Length는 클라이언트가 보내는 값이라 완전히 신뢰하진
  // 않고, 업로드 뒤 실제 저장된 크기로 다시 한번 확인한다).
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_VIDEO_BYTES) {
    return jsonResponse({ error: "video_too_large" }, 413);
  }

  const currentTotal = await getBucketTotalBytes(env.REPORT_VIDEOS);
  if (currentTotal + declaredLength > MAX_TOTAL_BYTES) {
    return jsonResponse({ error: "storage_full" }, 507);
  }

  const allowed = await checkAndBumpDailyLimit(env.REPORT_LIMITS, uid);
  if (!allowed) {
    return jsonResponse({ error: "daily_limit_exceeded" }, 429);
  }

  const ext = (contentType.split("/")[1] || "mp4").split(";")[0];
  const key = `reportVideos/${uid}/${Date.now()}_${randomId()}.${ext}`;

  const putResult = await env.REPORT_VIDEOS.put(key, request.body, {
    httpMetadata: { contentType },
  });

  // 실제 저장된 크기 기준으로 최종 확인 — 넘으면 바로 지우고 거부
  if (putResult.size > MAX_VIDEO_BYTES) {
    await env.REPORT_VIDEOS.delete(key);
    return jsonResponse({ error: "video_too_large" }, 413);
  }

  return jsonResponse({ key });
}

async function handleGetReportVideo(request, env, key) {
  if (!env.REPORT_VIDEOS) return jsonResponse({ error: "server_misconfigured" }, 500);

  const uid = await verifyIdTokenAndGetUid(getBearerToken(request));
  if (!uid) return jsonResponse({ error: "unauthorized" }, 401);

  // 경로 자체에 신고자 uid가 들어있어서(reportVideos/{uid}/...), 그 본인이거나
  // 운영자만 볼 수 있게 여기서 직접 검사한다.
  const ownerUid = key.split("/")[1];
  if (uid !== ownerUid && uid !== OPERATOR_UID) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const obj = await env.REPORT_VIDEOS.get(key);
  if (!obj) return jsonResponse({ error: "not_found" }, 404);

  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "video/mp4",
      "Content-Length": String(obj.size),
      ...corsHeaders(),
    },
  });
}

async function handleDeleteReportVideo(request, env, key) {
  if (!env.REPORT_VIDEOS) return jsonResponse({ error: "server_misconfigured" }, 500);

  const uid = await verifyIdTokenAndGetUid(getBearerToken(request));
  const ownerUid = key.split("/")[1];
  if (!uid || (uid !== ownerUid && uid !== OPERATOR_UID)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  await env.REPORT_VIDEOS.delete(key);
  return jsonResponse({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

    const url = new URL(request.url);

    if (url.pathname.startsWith("/report-video/")) {
      const key = decodeURIComponent(url.pathname.slice("/report-video/".length));
      if (!key) return jsonResponse({ error: "bad_request" }, 400);
      if (request.method === "GET") return handleGetReportVideo(request, env, key);
      if (request.method === "DELETE") return handleDeleteReportVideo(request, env, key);
      return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    if (url.pathname === "/report-video" && request.method === "POST") {
      return handleUploadReportVideo(request, env);
    }

    // 기본 경로 — 기존 스팀 로그인 검증(하위 호환: 경로 없이 그냥 POST로 오는 것도 허용)
    if (request.method === "POST") return handleSteamVerify(request, env);

    return jsonResponse({ valid: false, error: "method_not_allowed" }, 405);
  },
};
