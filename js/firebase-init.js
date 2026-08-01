// ===========================================================================
// 커뮤니티 로드아웃 저장/불러오기 — Firebase(Firestore + 익명 인증) 연동
//
// 이 파일은 ES 모듈(index.html에서 type="module"로 로드)이라 app.js(일반 스크립트)와
// 직접 함수를 주고받을 수 없어서, window.LoadoutCloud에 필요한 함수만 얹어둔다.
// 모듈 스크립트는 자동으로 defer 처리되어 DOMContentLoaded 이전, app.js 실행 이후에
// 돌아가므로 app.js의 init()이 호출될 때는 window.LoadoutCloud가 이미 준비돼 있다.
//
// 로그인 계정 없이도 "본인 글만 삭제/좋아요 취소" 같은 소유권 판단이 필요해서
// Firebase 익명 인증(signInAnonymously)을 사용한다 — 사람이 뭘 입력하지 않아도
// 브라우저마다 안정적인 uid가 하나 생기고, 이 uid는 서버(Firestore 보안 규칙)가
// 검증하는 값이라 클라이언트가 마음대로 위조할 수 없다.
//
// ⚠ 보안은 여기(클라이언트) 값 검증이 아니라 Firestore 보안 규칙이 담당한다.
//   apiKey 등은 원래 클라이언트에 노출되는 값이라 공개돼도 안전함.
// ===========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged,
  setPersistence, browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, collectionGroup, addDoc, getDocs, getDoc, query, orderBy, where, limit, serverTimestamp,
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc, onSnapshot, increment, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3SbLMnzxnDypLXa4kLizKJQkn30bl3CU",
  authDomain: "hsd-db-1a8d7.firebaseapp.com",
  projectId: "hsd-db-1a8d7",
  storageBucket: "hsd-db-1a8d7.firebasestorage.app",
  messagingSenderId: "1043279827478",
  appId: "1:1043279827478:web:e8e6b5521ddcfc5153db37",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

let resolveAuthReady;
const authReady = new Promise((resolve) => { resolveAuthReady = resolve; });

// 방문할 때마다 uid가 유지되는지 콘솔에서 눈으로 확인할 수 있게 이전 방문의 uid와 비교해서 남김
// (같은 브라우저인데도 "본인 글" 인식이 며칠 지나면 사라진다는 제보가 있어 원인 추적용으로 추가)
//
// ⚠ user가 null일 때만 signInAnonymously를 호출해야 한다 — 예전엔 setPersistence 뒤에
//   무조건 signInAnonymously를 불렀는데, 이러면 스팀 로그인(Custom Token)으로 이미 복원된
//   세션이 있어도 그걸 무시하고 새 익명 계정으로 덮어써버려서, 스팀 인증이 조용히 풀리는
//   버그가 있었다(재로그인 없이 새로고침만 해도 사무소 글쓰기가 전부 permission-denied로
//   실패하던 원인).
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((err) => console.error("[LoadoutCloud] 익명 로그인 실패:", err));
    return;
  }
  resolveAuthReady(user.uid);
  try {
    const prevUid = localStorage.getItem("hsddb_debug_last_uid");
    if (prevUid && prevUid !== user.uid) {
      console.warn(`[LoadoutCloud] uid가 이전 방문과 달라졌습니다. 이전: ${prevUid} / 지금: ${user.uid}`);
    } else {
      console.info(`[LoadoutCloud] uid: ${user.uid}`);
    }
    localStorage.setItem("hsddb_debug_last_uid", user.uid);
  } catch (err) {
    console.error("[LoadoutCloud] uid 디버그 기록 실패:", err);
  }
});

// 로그인 상태를 브라우저에 최대한 오래 유지(기본값이지만 명시적으로 지정)
setPersistence(auth, browserLocalPersistence)
  .catch((err) => console.error("[LoadoutCloud] persistence 설정 실패:", err));

async function getUid() {
  if (auth.currentUser) return auth.currentUser.uid;
  return authReady;
}

const LOADOUTS_COLLECTION = "sharedLoadouts";
const MAX_NAME_LEN = 30;
const MAX_DATA_LEN = 4000;
const LIST_LIMIT = 200; // 클라이언트에서 20개씩 페이지 나눠 보여주므로 넉넉하게 가져옴

const REPORTS_COLLECTION = "reports";
const MAX_REPORT_LEN = 1000;
const REPORT_COOLDOWN_MS = 60 * 1000;
const REPORT_COOLDOWN_KEY = "hsddb_report_last_submit";
const REPORT_COUNT_KEY = "hsddb_report_count";
const REPORT_CAPTCHA_THRESHOLD = 10;

// 이름/데이터 길이 등은 UX용 1차 검증일 뿐, 실제 강제는 Firestore 보안 규칙에서 함
async function saveLoadout(name, dataStr) {
  const trimmedName = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!trimmedName) throw new Error("이름을 입력해주세요.");
  if (!dataStr || dataStr.length > MAX_DATA_LEN) throw new Error("로드아웃 데이터가 비어있거나 너무 큽니다.");
  const uid = await getUid();
  await addDoc(collection(db, LOADOUTS_COLLECTION), {
    name: trimmedName,
    data: dataStr,
    createdAt: serverTimestamp(),
    likedBy: [],
    ownerId: uid,
  });
}

async function listLoadouts() {
  const uid = await getUid();
  const q = query(collection(db, LOADOUTS_COLLECTION), orderBy("createdAt", "desc"), limit(LIST_LIMIT));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
    return {
      id: d.id,
      ...data,
      likedBy,
      likeCount: likedBy.length,
      isLiked: likedBy.includes(uid),
      isMine: data.ownerId === uid,
    };
  });
}

// 좋아요 토글 — 이미 눌렀으면 취소(내 uid 제거), 아니면 좋아요(내 uid 추가)
async function toggleLike(id, currentlyLiked) {
  const uid = await getUid();
  await updateDoc(doc(db, LOADOUTS_COLLECTION, id), {
    likedBy: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

async function deleteLoadout(id) {
  await deleteDoc(doc(db, LOADOUTS_COLLECTION, id));
}

// 오류 제보: 익명으로 자유 텍스트를 저장. 어떤 화면(탭)에서 눌렀는지도 같이 남겨서
// 나중에 확인할 때 재현에 참고할 수 있게 함.
// 매크로/연타 스팸 완화용 최소한의 클라이언트 쿨다운(브라우저당 1분에 1회) —
// 작정하고 Firestore에 직접 요청을 보내는 사람은 못 막지만, 실수로 여러 번
// 누르거나 가벼운 반복 제출은 걸러줌.
async function submitReport(message, context) {
  const trimmed = (message || "").trim().slice(0, MAX_REPORT_LEN);
  if (!trimmed) throw new Error("내용을 입력해주세요.");
  const last = Number(localStorage.getItem(REPORT_COOLDOWN_KEY) || 0);
  const now = Date.now();
  if (now - last < REPORT_COOLDOWN_MS) {
    const waitSec = Math.ceil((REPORT_COOLDOWN_MS - (now - last)) / 1000);
    throw new Error(`너무 빠르게 제출하셨습니다. ${waitSec}초 후 다시 시도해주세요.`);
  }
  const uid = await getUid();
  await addDoc(collection(db, REPORTS_COLLECTION), {
    message: trimmed,
    context: (context || "").slice(0, 50),
    userAgent: (navigator.userAgent || "").slice(0, 200),
    createdAt: serverTimestamp(),
    ownerId: uid,
  });
  localStorage.setItem(REPORT_COOLDOWN_KEY, String(now));
  localStorage.setItem(REPORT_COUNT_KEY, String(reportSubmitCount() + 1));
}

// 이 브라우저에서 지금까지 제출한 횟수 — 일정 횟수 넘으면 UI에서 간단한 확인(캡챠)을 추가로 요구함
function reportSubmitCount() {
  return Number(localStorage.getItem(REPORT_COUNT_KEY) || 0);
}

function reportNeedsCaptcha() {
  return reportSubmitCount() >= REPORT_CAPTCHA_THRESHOLD;
}

const REPORT_LIST_LIMIT = 100;

async function listReports() {
  const q = query(collection(db, REPORTS_COLLECTION), orderBy("createdAt", "desc"), limit(REPORT_LIST_LIMIT));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 제보 댓글 — 규칙상 해당 제보를 올린 본인과 운영자만 작성 가능(자세한 조건은 firestore.rules 참고).
// 운영자 uid는 비밀값이 아님(규칙 파일에도 그대로 노출) — 댓글 작성자가 운영자인지 표시하는 용도로만 씀.
const OPERATOR_UID = "2S8L0VeihHaUFRkOWOeypEe2Guk1";
const MAX_COMMENT_LEN = 500;

async function listComments(reportId) {
  const q = query(collection(db, REPORTS_COLLECTION, reportId, "comments"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function addComment(reportId, text) {
  const trimmed = (text || "").trim().slice(0, MAX_COMMENT_LEN);
  if (!trimmed) throw new Error("댓글 내용을 입력해주세요.");
  const uid = await getUid();
  await addDoc(collection(db, REPORTS_COLLECTION, reportId, "comments"), {
    text: trimmed,
    createdAt: serverTimestamp(),
    ownerId: uid,
  });
}

async function getCurrentUid() {
  return getUid();
}

// 무기 평가 — 문서 id가 곧 작성자 uid라서 무기당(파생형 포함) 1개만 존재.
// liked(하트)와 text(한줄평)는 완전히 독립적으로 켜고 끔(하트 눌러도 한줄평 안 지워지고,
// 한줄평 남겨도 하트가 자동으로 켜지지 않음 — 사용자 확인). 반대(싫어요) 개념은 없이
// liked만 집계 — 뉴비가 부정적 숫자만 보고 반사적으로 거르는 걸 막기 위함.
// agreedBy는 "이 한줄평에 공감(👍)"한 사람 목록 — 무기 하트와는 별개의 반응.
const WEAPON_REVIEWS_COLLECTION = "weaponReviews";
const MAX_WEAPON_REVIEW_LEN = 300;

async function getWeaponReviews(weaponId) {
  const uid = await getUid();
  const q = query(collection(db, WEAPON_REVIEWS_COLLECTION, weaponId, "reviews"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => {
    const data = d.data();
    const agreedBy = Array.isArray(data.agreedBy) ? data.agreedBy : [];
    return { id: d.id, ...data, agreedBy, agreeCount: agreedBy.length, iAgreed: agreedBy.includes(uid) };
  });
  return {
    reviews,
    likeCount: reviews.filter((r) => r.liked).length,
    myReview: reviews.find((r) => r.id === uid) || null,
  };
}

async function setWeaponHeart(weaponId, liked) {
  const uid = await getUid();
  const ref = doc(db, WEAPON_REVIEWS_COLLECTION, weaponId, "reviews", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { liked: !!liked, createdAt: serverTimestamp() });
  } else {
    await setDoc(ref, { liked: !!liked, text: "", agreedBy: [], createdAt: serverTimestamp(), ownerId: uid });
  }
}

async function saveWeaponComment(weaponId, text) {
  const trimmed = (text || "").trim().slice(0, MAX_WEAPON_REVIEW_LEN);
  const uid = await getUid();
  const ref = doc(db, WEAPON_REVIEWS_COLLECTION, weaponId, "reviews", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { text: trimmed, createdAt: serverTimestamp() });
  } else {
    await setDoc(ref, { liked: false, text: trimmed, agreedBy: [], createdAt: serverTimestamp(), ownerId: uid });
  }
}

// 한줄평 공감(👍) 토글 — 무기 하트와 별개로, 댓글 작성자 본인이 아니어도 아무나 자기 uid만 추가/제거
async function toggleWeaponCommentAgree(weaponId, reviewOwnerUid, currentlyAgreed) {
  const uid = await getUid();
  await updateDoc(doc(db, WEAPON_REVIEWS_COLLECTION, weaponId, "reviews", reviewOwnerUid), {
    agreedBy: currentlyAgreed ? arrayRemove(uid) : arrayUnion(uid),
  });
}

// 사무소(매칭 게시판) 이용 등록 — 진짜 스팀 로그인(OpenID)으로 검증된 SteamID64를 그대로
// Firebase Auth의 uid로 쓴다. 검증은 Cloudflare Worker가 스팀에 직접 물어봐서
// (check_authentication) 확인한 뒤에만 로그인 토큰(Custom Token)을 발급해주므로, 이 uid를
// 가지려면 반드시 그 스팀 계정으로 실제 로그인을 통과해야 한다 — 클라이언트가 Firestore에
// 직접 요청을 보내도 검증 없이는 원하는 SteamID를 위조할 수 없다(자세한 이유는
// firestore.rules의 officeMembers 규칙 주석 참고).
// 문서 ID도 SteamID64라서 같은 스팀ID로 중복 등록도 구조적으로 막힌다.
const OFFICE_MEMBERS_COLLECTION = "officeMembers";
const STEAM_ID64_FORMAT_RE = /^\d{17}$/;
const STEAM_VERIFY_WORKER_URL = "https://potatokim.cisd456.workers.dev";

function buildSteamLoginUrl() {
  const returnTo = `${location.origin}${location.pathname}?steamAuth=1`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": `${location.origin}/`,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `https://steamcommunity.com/openid/login?${params.toString()}`;
}

// 스팀에서 돌아온 직후(콜백)인지 URL 쿼리로 판단 — 맞으면 openid.* 파라미터를 그대로 반환
function getSteamOpenIdParamsFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.get("steamAuth") !== "1" || params.get("openid.mode") !== "id_res") return null;
  const out = {};
  params.forEach((value, key) => { out[key] = value; });
  return out;
}

// Cloudflare Worker에 검증을 맡기고, 통과하면 받은 토큰으로 실제 로그인까지 마친다.
// 로그인에 성공하면 이후 getUid()가 돌려주는 uid가 이 SteamID64로 바뀐다.
async function verifySteamLoginAndSignIn(openidParams) {
  const res = await fetch(STEAM_VERIFY_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(openidParams),
  }).catch(() => null);
  if (!res || !res.ok) throw new Error("스팀 인증 확인에 실패했습니다. 잠시 후 다시 시도해주세요.");
  const data = await res.json();
  if (!data.valid || !data.steamId || !data.token) throw new Error("스팀 로그인 검증에 실패했습니다.");
  await signInWithCustomToken(auth, data.token);
  return data.steamId;
}

// 지금 로그인된 uid가 스팀 인증을 마친 상태인지, 등록된 사무소 회원인지 조회 (아니면 null)
async function getMyOfficeMembership() {
  const uid = await getUid();
  if (!STEAM_ID64_FORMAT_RE.test(uid)) return null; // 아직 스팀 로그인 전(익명 uid)
  const snap = await getDoc(doc(db, OFFICE_MEMBERS_COLLECTION, uid));
  return snap.exists() ? { steamId: uid, ...snap.data() } : null;
}

// 스팀 로그인까지 마친 uid(=steamId64) 기준으로 사무소 등록 문서를 만든다.
// 이미 등록돼 있으면(재로그인 등) 새로 쓰지 않고 기존 상태 그대로 반환.
async function ensureOfficeMembership(steamId) {
  const ref = doc(db, OFFICE_MEMBERS_COLLECTION, steamId);
  const snap = await getDoc(ref);
  if (snap.exists()) return { steamId, ...snap.data() };
  await setDoc(ref, {
    ownerId: steamId,
    pledgeAgreedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    banned: false,
  });
  return { steamId, ownerId: steamId, banned: false };
}

// 파티 모집 — 문서 ID = 파티장 uid(=steamId64)라서 "한 사람당 활성 파티 1개"가 구조적으로
// 강제됨. 모집 정보(활동서버/파티MMR/최소KDA/전투성향/음성여부)는 사무소 회원이면 누구나
// 보지만, 합류 코드(private/code)와 지원자 목록(applications)은 각각 별도 하위 경로라
// Firestore 규칙이 따로 접근을 제한한다(코드는 파티장 본인과 "수락된" 지원자만, 지원자
// 목록은 파티장만).
const OFFICE_PARTIES_COLLECTION = "officeParties";
const PARTY_FIELD_KEYS = ["partyMmr", "minKda", "combatStyle", "voice", "partyType", "gameMode"];
const OFFICE_SERVERS = ["유럽", "러시아", "미국서부", "미국동부", "남미", "아시아", "오세아니아"];
const OFFICE_SERVERS_WITH_ANY = [...OFFICE_SERVERS, "상관없음"];
const PARTY_TYPES = ["듀오", "트리오"];
const GAME_MODES = ["결전", "사냥", "상관없음"];
const MAX_PARTY_FIELD_LEN = 100;
const MAX_APPLICATION_MSG_LEN = 200;
const PARTY_CODE_RE = /^\d{6}$/;

function sanitizePartyFields(fields) {
  const out = {};
  for (const key of PARTY_FIELD_KEYS) {
    if (key === "voice") { out.voice = !!fields.voice; continue; }
    out[key] = (fields[key] || "").trim().slice(0, MAX_PARTY_FIELD_LEN);
  }
  const servers = Array.isArray(fields.activeServers) ? [...new Set(fields.activeServers)] : [];
  out.activeServers = servers.filter((s) => OFFICE_SERVERS_WITH_ANY.includes(s));
  if (out.activeServers.length === 0) throw new Error("활동서버를 하나 이상 선택해주세요.");
  if (!out.partyMmr) throw new Error("파티 MMR을 입력해주세요.");
  if (!PARTY_TYPES.includes(out.partyType)) throw new Error("파티 유형(듀오/트리오)을 선택해주세요.");
  if (!GAME_MODES.includes(out.gameMode)) throw new Error("게임 모드를 선택해주세요.");
  return out;
}

// where("status","==","open") + orderBy("createdAt")를 같이 쓰면 Firestore가 별도
// 복합 색인을 요구해서(콘솔에서 색인을 직접 만들어야 함), 색인 없이도 되게 status
// 필터 없이 전체를 가져온 다음 open만 걸러내고 클라이언트에서 정렬한다. 파티 수가
// 많지 않은 서비스라 이 정도는 부담 없음.
async function listOpenParties() {
  const q = query(collection(db, OFFICE_PARTIES_COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ leaderId: d.id, ...d.data() }))
    .filter((p) => p.status === "open");
}

async function getMyParty() {
  const uid = await getUid();
  const snap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid));
  return snap.exists() ? { leaderId: uid, ...snap.data() } : null;
}

// 파티 등록/수정 — 처음 만들 때는 생성, 이미 있으면 모집 정보만 수정.
// ⚠ 규칙은 update 시에도 결과 문서 전체(codePublic 포함)가 유효해야 한다고 검증하므로,
//   과거(이 필드가 생기기 전)에 만들어진 문서처럼 codePublic이 아예 없는 경우를 대비해
//   항상 기존 값을 읽어서 같이 채워 보낸다(없으면 false로 기본값 처리).
async function saveMyParty(fields) {
  const sanitized = sanitizePartyFields(fields);
  const uid = await getUid();
  const ref = doc(db, OFFICE_PARTIES_COLLECTION, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data();
    await updateDoc(ref, { ...sanitized, codePublic: typeof existing.codePublic === "boolean" ? existing.codePublic : false });
  } else {
    await setDoc(ref, { leaderId: uid, ...sanitized, codePublic: false, status: "open", acceptedCount: 0, createdAt: serverTimestamp() });
  }
}

async function setMyPartyStatus(status) {
  const uid = await getUid();
  await updateDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid), { status });
}

async function setMyPartyCode(code, isPublic) {
  const trimmed = (code || "").trim();
  if (!PARTY_CODE_RE.test(trimmed)) throw new Error("로비 코드는 숫자 6자리로 입력해주세요.");
  const uid = await getUid();
  await setDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid, "private", "code"), { code: trimmed });
  await updateDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid), { codePublic: !!isPublic });
}

// 파티 취소 — 받은 신청들과 로비 코드까지 다 지우고 파티 문서 자체를 삭제
async function deleteMyParty() {
  const uid = await getUid();
  const appsSnap = await getDocs(collection(db, OFFICE_PARTIES_COLLECTION, uid, "applications"));
  await Promise.all(appsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid, "private", "code"));
  await deleteDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid));
}

// 내가 만든 파티에 들어온 신청 목록 (신청자 식별값(uid)은 화면에 노출하지 않고 메시지만 보여줄 것)
async function listApplicationsForMyParty() {
  const uid = await getUid();
  const q = query(collection(db, OFFICE_PARTIES_COLLECTION, uid, "applications"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ applicantId: d.id, ...d.data() }));
}

async function applyToParty(leaderId, message) {
  const trimmed = (message || "").trim().slice(0, MAX_APPLICATION_MSG_LEN);
  const uid = await getUid();
  try {
    await setDoc(doc(db, OFFICE_PARTIES_COLLECTION, leaderId, "applications", uid), {
      applicantId: uid,
      message: trimmed,
      status: "pending",
      createdAt: serverTimestamp(),
      respondedAt: null,
    });
  } catch {
    throw new Error("신청에 실패했습니다. 이미 신청했거나 마감된 파티일 수 있습니다.");
  }
}

// 수락 시엔 신청 문서 상태 변경과 함께 파티 문서의 acceptedCount도 같이 올려야
// (구인 게시판에서 "N/최대인원명" 표시가 가능해짐) 배치로 묶어서 처리한다.
async function respondToApplication(applicantId, accepted) {
  const uid = await getUid();
  const appRef = doc(db, OFFICE_PARTIES_COLLECTION, uid, "applications", applicantId);
  if (!accepted) {
    await updateDoc(appRef, { status: "declined", respondedAt: serverTimestamp() });
    return;
  }
  const batch = writeBatch(db);
  batch.update(appRef, { status: "accepted", respondedAt: serverTimestamp() });
  batch.update(doc(db, OFFICE_PARTIES_COLLECTION, uid), { acceptedCount: increment(1) });
  await batch.commit();
}

// 내 파티에 들어오는 신청을 실시간으로 감시 — 새 신청이 오면 화면을 안 보고 있어도
// 바로 알 수 있게 하기 위함. 구독 해제 함수를 돌려준다.
function watchMyPartyApplications(callback) {
  let unsub = null;
  let cancelled = false;
  getUid().then((uid) => {
    if (cancelled) return;
    const q = query(collection(db, OFFICE_PARTIES_COLLECTION, uid, "applications"), orderBy("createdAt", "desc"));
    unsub = onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ applicantId: d.id, ...d.data() })));
    });
  });
  return () => { cancelled = true; if (unsub) unsub(); };
}

// 내가 신청한 파티 목록 — 여러 파티에 걸쳐 있는 applications 하위 컬렉션을 한 번에 조회
async function listMyApplications() {
  const uid = await getUid();
  const q = query(collectionGroup(db, "applications"), where("applicantId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ leaderId: d.ref.parent.parent.id, ...d.data() }));
}

// 수락된 신청자만 읽을 수 있는 합류 코드 — 아직 수락 전이면 규칙이 거부하므로 null로 처리
async function getPartyCode(leaderId) {
  try {
    const snap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, leaderId, "private", "code"));
    return snap.exists() ? snap.data().code : null;
  } catch {
    return null;
  }
}

// 이력서("인력 목록") — 사무소 회원이면 누구나 전체 목록을 볼 수 있다. 문서 ID가
// steamId지만 화면에는 절대 노출하지 않기 위해, 목록 조회 함수는 항목 데이터만 돌려주고
// 문서 ID(d.id)는 반환값에 아예 포함하지 않는다.
const OFFICE_RESUMES_COLLECTION = "officeResumes";
const RESUME_FIELD_KEYS = ["mmr", "kda", "preferredStyle", "voice", "preferredPartyType", "preferredGameMode"];
const MAX_RESUME_FIELD_LEN = 100;

function sanitizeResumeFields(fields) {
  const out = {};
  for (const key of RESUME_FIELD_KEYS) {
    if (key === "voice") { out.voice = !!fields.voice; continue; }
    out[key] = (fields[key] || "").trim().slice(0, MAX_RESUME_FIELD_LEN);
  }
  const servers = Array.isArray(fields.preferredServers) ? [...new Set(fields.preferredServers)] : [];
  out.preferredServers = servers.filter((s) => OFFICE_SERVERS_WITH_ANY.includes(s));
  if (out.preferredServers.length === 0) throw new Error("선호 서버를 하나 이상 선택해주세요.");
  if (!PARTY_TYPES.includes(out.preferredPartyType)) throw new Error("선호 인원(듀오/트리오)을 선택해주세요.");
  if (!GAME_MODES.includes(out.preferredGameMode)) throw new Error("선호 게임 모드를 선택해주세요.");
  return out;
}

async function getMyResume() {
  const uid = await getUid();
  const snap = await getDoc(doc(db, OFFICE_RESUMES_COLLECTION, uid));
  return snap.exists() ? snap.data() : null;
}

// 파티장은 이력서를 쓸 수 없다(파티 등록 중이면 규칙도 같이 막음 — firestore.rules 참고)
async function saveMyResume(fields) {
  const sanitized = sanitizeResumeFields(fields);
  const uid = await getUid();
  const partySnap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid));
  if (partySnap.exists()) throw new Error("파티를 등록한 상태에서는 프로필을 작성할 수 없습니다. 먼저 파티를 취소해주세요.");
  await setDoc(doc(db, OFFICE_RESUMES_COLLECTION, uid), { ...sanitized, updatedAt: serverTimestamp() });
}

async function deleteMyResume() {
  const uid = await getUid();
  await deleteDoc(doc(db, OFFICE_RESUMES_COLLECTION, uid));
}

// 내 파티에 신청한 사람의 이력서 — 신청이 없거나 남의 파티면 규칙이 거부하므로 null 처리
async function getApplicantResume(applicantId) {
  try {
    const snap = await getDoc(doc(db, OFFICE_RESUMES_COLLECTION, applicantId));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// 인력 목록 — 등록된 이력서 전체를 사무소 회원 누구나 조회. 문서 ID(steamId)는 절대
// 반환하지 않는다(d.data()만 사용, d.id는 쓰지 않음).
async function listAllResumes() {
  const snap = await getDocs(collection(db, OFFICE_RESUMES_COLLECTION));
  return snap.docs.map((d) => d.data());
}

window.LoadoutCloud = {
  saveLoadout, listLoadouts, toggleLike, deleteLoadout,
  submitReport, reportNeedsCaptcha, listReports,
  listComments, addComment, getCurrentUid, OPERATOR_UID,
  getWeaponReviews, setWeaponHeart, saveWeaponComment, toggleWeaponCommentAgree,
  buildSteamLoginUrl, getSteamOpenIdParamsFromUrl, verifySteamLoginAndSignIn,
  getMyOfficeMembership, ensureOfficeMembership,
  listOpenParties, getMyParty, saveMyParty, setMyPartyStatus, setMyPartyCode, deleteMyParty,
  listApplicationsForMyParty, applyToParty, respondToApplication, listMyApplications, getPartyCode,
  watchMyPartyApplications,
  getMyResume, saveMyResume, deleteMyResume, getApplicantResume, listAllResumes,
};
