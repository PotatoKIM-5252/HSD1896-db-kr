// ===========================================================================
// 스팀 OpenID 로그인 검증 프록시 (Cloudflare Workers)
//
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
// 배포: Cloudflare 대시보드 > Workers & Pages > Create Worker > 이 파일 내용을
// 그대로 붙여넣고 배포. 아래 시크릿 2개를 Settings > Variables and Secrets에 등록:
//   - FIREBASE_CLIENT_EMAIL : Firebase 서비스 계정 JSON의 client_email 값
//   - FIREBASE_PRIVATE_KEY  : Firebase 서비스 계정 JSON의 private_key 값 (그대로, 줄바꿈 포함)
// ===========================================================================

const ALLOWED_ORIGIN = "https://potatokim-5252.github.io";
const STEAM_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
    if (request.method !== "POST") return jsonResponse({ valid: false, error: "method_not_allowed" }, 405);

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
  },
};
