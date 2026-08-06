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
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc, onSnapshot, increment, writeBatch, runTransaction,
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

// 지금 로그인된 사용자 본인의 Firebase ID 토큰 — 신고 영상 업로드/조회/삭제 때
// Cloudflare Worker에 "나 맞다"는 걸 증명하는 용도로만 쓴다.
async function getMyIdToken() {
  if (!auth.currentUser) await authReady;
  if (!auth.currentUser) throw new Error("로그인 상태를 확인할 수 없습니다.");
  return auth.currentUser.getIdToken();
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

// 사무소 탈퇴 — 등록해둔 스팀 ID(officeMembers)를 본인이 직접 지울 수 있게 한다.
// 파티/이력서(있으면 최대 하나)와, 다른 사람 파티에 걸려 있는 신청·초대까지 먼저
// 정리해야 고아 문서가 안 남는다 — 수락된 파티원 자리는 leaveParty로 인원수까지
// 맞추고, 그 외(대기중/받은 초대 등)는 그냥 지운다.
async function deleteMyOfficeMembership() {
  const uid = await getUid();

  const partySnap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid));
  if (partySnap.exists()) await deleteMyParty();

  const resumeSnap = await getDoc(doc(db, OFFICE_RESUMES_COLLECTION, uid));
  if (resumeSnap.exists()) await deleteMyResume();

  const appsQ = query(collectionGroup(db, "applications"), where("applicantId", "==", uid));
  const appsSnap = await getDocs(appsQ);
  for (const d of appsSnap.docs) {
    const leaderId = d.ref.parent.parent.id;
    if (d.data().status === "accepted") {
      await leaveParty(leaderId).catch(() => {});
    } else {
      await deleteDoc(d.ref).catch(() => {});
    }
  }

  await deleteDoc(doc(db, OFFICE_MEMBERS_COLLECTION, uid));
}

// 파티 모집 — 문서 ID = 파티장 uid(=steamId64)라서 "한 사람당 활성 파티 1개"가 구조적으로
// 강제됨. 모집 정보(활동서버/파티MMR/최소KDA/전투성향/음성여부)는 사무소 회원이면 누구나
// 보지만, 합류 코드(private/code)와 지원자 목록(applications)은 각각 별도 하위 경로라
// Firestore 규칙이 따로 접근을 제한한다(코드는 파티장 본인과 "수락된" 지원자만, 지원자
// 목록은 파티장만).
const OFFICE_PARTIES_COLLECTION = "officeParties";
const OFFICE_PARTY_DAY_COUNTERS_COLLECTION = "officePartyDayCounters";
const OFFICE_PARTY_HISTORY_COLLECTION = "officePartyHistory";
const OFFICE_PARTY_ROSTER_COLLECTION = "officePartyRoster";
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

// 모집 마감(status: "closed")이어도 목록에서는 계속 보여준다 — 마감은 새 신청만
// 막을 뿐(신청 생성은 규칙에서 status=='open'을 요구), 목록 노출과는 무관하다.
async function listAllParties() {
  const q = query(collection(db, OFFICE_PARTIES_COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ leaderId: d.id, ...d.data() }));
}

async function getMyParty() {
  const uid = await getUid();
  const snap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid));
  return snap.exists() ? { leaderId: uid, ...snap.data() } : null;
}

// 받은 초대 카드에 어떤 파티인지(서버/모드/MMR 등) 같이 보여주기 위해 조회
async function getPartyByLeaderId(leaderId) {
  const snap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, leaderId));
  return snap.exists() ? { leaderId, ...snap.data() } : null;
}

// 파티 번호(=사건번호) 형식: YYMMDD(만든 날짜, 6자리) + 그날의 순번(2자리) = 총 8자리
// 문자열. 예) 2026년 8월 6일에 만들어진 그날 첫 파티 → "26080601". 날짜가 그대로 번호에
// 드러나서 신고할 때 "사건이 언제였는지"와 "어느 파티였는지"를 번호 하나로 같이 전달할
// 수 있다. 순번은 officePartyDayCounters/{YYMMDD} 문서를 트랜잭션으로 읽고 +1해서
// 매기므로, 같은 날 여러 명이 동시에 파티를 만들어도 번호가 겹치지 않는다.
function officePartyDayKey(date = new Date()) {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

// 파티 참여 이력(officePartyHistory) 문서 ID — "{파티번호}_{스팀ID}" 고정 형식이라
// firestore.rules가 "신고자가 이 파티에 정말 있었는지"를 exists()로 바로 확인할 수 있다.
function officePartyHistoryDocId(partyNumber, steamId) {
  return `${partyNumber}_${steamId}`;
}

const OFFICE_MEMBER_NUMBER_HISTORY_COLLECTION = "officeMemberNumberHistory";

// 프로필/파티 목록 노출 만료 기준(3시간) — app.js의 OFFICE_EXPIRY_MS와 같은 값. 여기서도
// 필요한 이유: "임시 번호"는 목록에서 이미 사라졌다가(3시간 경과) 다시 올릴 때 새로
// 발급해야 하므로, 저장 시점에 firebase-init.js 쪽에서 직접 만료 여부를 판단해야 한다.
const OFFICE_NUMBER_EXPIRY_MS = 3 * 60 * 60 * 1000;
function isTimestampExpired(ts) {
  if (!ts) return true;
  const ms = typeof ts.toMillis === "function" ? ts.toMillis() : (typeof ts.seconds === "number" ? ts.seconds * 1000 : null);
  if (ms == null) return true;
  return Date.now() - ms > OFFICE_NUMBER_EXPIRY_MS;
}

// 등록번호(memberNumber) 형식: YYMMDD(등록한 날짜, 6자리) + 무작위 3자리 = 총 9자리.
// 날짜가 매일 바뀌니 자연히 "며칠 지나면 새 번호 대역으로 넘어가는" 효과가 있고, 같은
// 날짜대에서도 무작위라 순서(가입 순서 등)가 번호로 드러나지 않는다. officeMemberNumberHistory
// 문서는 한 번 만들어지면 절대 수정 불가(규칙 참고)라서, 이미 그 번호로 문서가 있으면
// create 자체가 거부된다 — 그걸 이용해 충돌 시 다른 무작위 번호로 재시도한다.
async function generateMemberNumber(uid) {
  const dayKey = officePartyDayKey();
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const candidate = `${dayKey}${suffix}`;
    try {
      await setDoc(doc(db, OFFICE_MEMBER_NUMBER_HISTORY_COLLECTION, candidate), { steamId: uid, assignedAt: serverTimestamp() });
      return candidate;
    } catch {
      // 이미 그 번호를 누가 먼저 가져갔음 — 다른 무작위 번호로 재시도
    }
  }
  throw new Error("등록번호 발급에 실패했습니다. 다시 시도해주세요.");
}

// 파티 등록/수정 — 처음 만들 때는 생성, 이미 있으면 모집 정보만 수정.
// ⚠ 규칙은 update 시에도 결과 문서 전체(codePublic 포함)가 유효해야 한다고 검증하므로,
//   과거(이 필드가 생기기 전)에 만들어진 문서처럼 codePublic이 아예 없는 경우를 대비해
//   항상 기존 값을 읽어서 같이 채워 보낸다(없으면 false로 기본값 처리).
// 등록/수정할 때마다 renewedAt을 지금 시각으로 갱신 — 3시간 만료 타이머가 여기서 리셋된다.
async function saveMyParty(fields) {
  const sanitized = sanitizePartyFields(fields);
  const uid = await getUid();
  const ref = doc(db, OFFICE_PARTIES_COLLECTION, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data();
    await updateDoc(ref, { ...sanitized, codePublic: typeof existing.codePublic === "boolean" ? existing.codePublic : false, renewedAt: serverTimestamp() });
  } else {
    // 파티원이 파티장을 등록번호로 식별할 수 있으려면 파티장도 이력서(등록번호)가
    // 먼저 있어야 한다 — 규칙도 이걸 요구하므로 여기서 미리 확인해 친절한 메시지로 안내.
    // 이력서가 이미 3시간 지나 만료된 상태였다면(오래 방치) 번호도 새로 받는다.
    const resumeRef = doc(db, OFFICE_RESUMES_COLLECTION, uid);
    const resumeSnap = await getDoc(resumeRef);
    if (!resumeSnap.exists()) throw new Error("파티를 만들려면 먼저 프로필(이력서)을 등록해주세요.");
    let memberNumber = resumeSnap.data().resumeNumber;
    if (isTimestampExpired(resumeSnap.data().updatedAt)) {
      memberNumber = await generateMemberNumber(uid);
      await updateDoc(resumeRef, { resumeNumber: memberNumber, updatedAt: serverTimestamp() });
    }
    // 파티 번호 발급(일자별 카운터 +1)과 파티 문서 생성, 리더 본인의 참여 이력·로스터
    // 기록을 한 트랜잭션으로 묶어서 전부 같이 성공/실패하게 한다.
    const dayKey = officePartyDayKey();
    const counterRef = doc(db, OFFICE_PARTY_DAY_COUNTERS_COLLECTION, dayKey);
    await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const nextSeq = (counterSnap.exists() ? counterSnap.data().count : 0) + 1;
      const partyNumber = `${dayKey}${String(nextSeq).padStart(2, "0")}`;
      tx.set(counterRef, { count: nextSeq });
      tx.set(ref, { leaderId: uid, ...sanitized, codePublic: false, status: "open", acceptedCount: 0, partyNumber, createdAt: serverTimestamp(), renewedAt: serverTimestamp() });
      tx.set(doc(db, OFFICE_PARTY_HISTORY_COLLECTION, officePartyHistoryDocId(partyNumber, uid)), {
        steamId: uid, partyNumber, leaderId: uid, role: "leader", joinedAt: serverTimestamp(), leftAt: null, memberNumberAtJoin: memberNumber,
      });
      tx.set(doc(db, OFFICE_PARTY_ROSTER_COLLECTION, partyNumber), {
        leaderId: uid, members: [{ role: "leader", memberNumber }],
      });
    });
  }
}

// 폼을 다시 채우지 않고 만료 타이머만 지금 시각으로 리셋
async function renewMyParty() {
  const uid = await getUid();
  const ref = doc(db, OFFICE_PARTIES_COLLECTION, uid);
  const snap = await getDoc(ref);
  // 이미 3시간 지나 목록에서 사라졌던 파티를 다시 살리는 거라면(=재등록), 리더의
  // 등록번호도 새로 받는다. 이미 확정된 과거 참여 기록(officePartyHistory)은 그때
  // 그 번호로 그대로 고정돼 있으니 영향 없음 — 앞으로 새로 합류하는 사람부터 새 번호로 보임.
  if (snap.exists() && isTimestampExpired(snap.data().renewedAt || snap.data().createdAt)) {
    const resumeRef = doc(db, OFFICE_RESUMES_COLLECTION, uid);
    const resumeSnap = await getDoc(resumeRef);
    if (resumeSnap.exists()) {
      const newNumber = await generateMemberNumber(uid);
      await updateDoc(resumeRef, { resumeNumber: newNumber, updatedAt: serverTimestamp() });
    }
  }
  await updateDoc(ref, { renewedAt: serverTimestamp() });
}

async function setMyPartyStatus(status) {
  const uid = await getUid();
  await updateDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid), { status });
}

// 로비 코드는 초대받은 사람/승인된 파티원에게만 보인다(firestore.rules 참고) — 전체
// 공개 옵션은 없앴으므로 여기선 코드 값만 저장한다.
async function setMyPartyCode(code) {
  const trimmed = (code || "").trim();
  if (!PARTY_CODE_RE.test(trimmed)) throw new Error("로비 코드는 숫자 6자리로 입력해주세요.");
  const uid = await getUid();
  await setDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid, "private", "code"), { code: trimmed });
}

// 파티 해산 — 받은 신청들과 로비 코드까지 다 지우고 파티 문서 자체를 삭제. 해산
// 전에 리더 본인과 그때 수락돼 있던 파티원들의 참여 이력(officePartyHistory)에
// leftAt을 남겨서, 나중에 신고가 들어와도 "그 파티에 누가 있었는지"가 계속 조회된다.
// 리더의 등록번호도 해산 시점에 바로 새로 발급한다(그 번호는 이 파티가 살아있는
// 동안만 유효한 임시 번호였으므로) — 이미 확정된 officePartyHistory 기록은 그때
// 그 번호로 고정돼 있어 영향 없다.
async function deleteMyParty() {
  const uid = await getUid();
  const partySnap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid));
  const partyNumber = partySnap.exists() ? partySnap.data().partyNumber : null;
  const appsSnap = await getDocs(collection(db, OFFICE_PARTIES_COLLECTION, uid, "applications"));
  const acceptedIds = appsSnap.docs.filter((d) => d.data().status === "accepted").map((d) => d.id);
  await Promise.all(appsSnap.docs.map((d) => deleteDoc(d.ref)));
  if (partyNumber) {
    await Promise.all([uid, ...acceptedIds].map((sid) =>
      updateDoc(doc(db, OFFICE_PARTY_HISTORY_COLLECTION, officePartyHistoryDocId(partyNumber, sid)), { leftAt: serverTimestamp() }).catch(() => {})
    ));
  }
  const resumeRef = doc(db, OFFICE_RESUMES_COLLECTION, uid);
  const resumeSnap = await getDoc(resumeRef);
  if (resumeSnap.exists()) {
    const newNumber = await generateMemberNumber(uid);
    await updateDoc(resumeRef, { resumeNumber: newNumber, updatedAt: serverTimestamp() }).catch(() => {});
  }
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
    throw new Error("신청에 실패했습니다. 프로필을 먼저 등록했는지, 이미 신청했거나 마감된 파티는 아닌지 확인해주세요.");
  }
}

// 수락 시엔 신청 문서 상태 변경과 함께 파티 문서의 acceptedCount도 같이 올리고,
// 참여 이력(officePartyHistory)·로스터(officePartyRoster)에도 이 사람이 이 파티에
// 들어왔다는 기록을 남긴다(배치로 묶어서 넷 다 같이 성공/실패). partyNumber는 파티
// 문서에서, 등록번호는 신청자의 이력서에서 지금 시점 값을 읽어와 그대로 고정한다.
async function respondToApplication(applicantId, accepted) {
  const uid = await getUid();
  const appRef = doc(db, OFFICE_PARTIES_COLLECTION, uid, "applications", applicantId);
  if (!accepted) {
    await updateDoc(appRef, { status: "declined", respondedAt: serverTimestamp() });
    return;
  }
  const [partySnap, applicantResumeSnap] = await Promise.all([
    getDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid)),
    getDoc(doc(db, OFFICE_RESUMES_COLLECTION, applicantId)),
  ]);
  const partyNumber = partySnap.exists() ? partySnap.data().partyNumber : null;
  const memberNumber = applicantResumeSnap.exists() ? applicantResumeSnap.data().resumeNumber : null;
  const batch = writeBatch(db);
  batch.update(appRef, { status: "accepted", respondedAt: serverTimestamp() });
  batch.update(doc(db, OFFICE_PARTIES_COLLECTION, uid), { acceptedCount: increment(1) });
  if (partyNumber && memberNumber) {
    batch.set(doc(db, OFFICE_PARTY_HISTORY_COLLECTION, officePartyHistoryDocId(partyNumber, applicantId)), {
      steamId: applicantId, partyNumber, leaderId: uid, role: "member", joinedAt: serverTimestamp(), leftAt: null, memberNumberAtJoin: memberNumber,
    });
    batch.update(doc(db, OFFICE_PARTY_ROSTER_COLLECTION, partyNumber), {
      members: arrayUnion({ role: "member", memberNumber }),
    });
  }
  await batch.commit();
}

// 이미 수락된 파티원을 내보냄 — 신청 상태를 kicked로 바꾸고 acceptedCount를 1 줄인다.
// kicked가 되면 로비 코드 읽기 권한도 규칙상 자동으로 사라진다(accepted 상태만 허용).
// 참여 이력에도 나간 시각(leftAt)을 남긴다.
async function kickApplicant(applicantId) {
  const uid = await getUid();
  const partySnap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid));
  const partyNumber = partySnap.exists() ? partySnap.data().partyNumber : null;
  const batch = writeBatch(db);
  batch.update(doc(db, OFFICE_PARTIES_COLLECTION, uid, "applications", applicantId), { status: "kicked", respondedAt: serverTimestamp() });
  batch.update(doc(db, OFFICE_PARTIES_COLLECTION, uid), { acceptedCount: increment(-1) });
  if (partyNumber) {
    batch.update(doc(db, OFFICE_PARTY_HISTORY_COLLECTION, officePartyHistoryDocId(partyNumber, applicantId)), { leftAt: serverTimestamp() });
  }
  await batch.commit();
}

// 파티장이 프로필 게시판을 보고 먼저 초대 — applications 문서를 파티장이 직접
// 만들되 status를 invited로 시작(applyToParty의 pending과 반대 방향)
async function inviteToParty(targetId, message) {
  const trimmed = (message || "").trim().slice(0, MAX_APPLICATION_MSG_LEN);
  const uid = await getUid();
  try {
    await setDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid, "applications", targetId), {
      applicantId: targetId,
      message: trimmed,
      status: "invited",
      createdAt: serverTimestamp(),
      respondedAt: null,
    });
  } catch {
    throw new Error("초대에 실패했습니다. 이미 신청했거나 초대한 상대일 수 있습니다.");
  }
}

// 보낸 초대를 파티장이 취소(상대가 아직 응답하지 않은 상태에서도 삭제 가능)
async function cancelInvite(targetId) {
  const uid = await getUid();
  await deleteDoc(doc(db, OFFICE_PARTIES_COLLECTION, uid, "applications", targetId));
}

// 내가 받은 초대에 응답 — 수락 시엔 respondToApplication과 대칭으로 acceptedCount를
// 배치로 같이 올린다(이번엔 파티장이 아니라 초대받은 본인이 자기 몫만큼 올림). 참여
// 이력도 본인이 직접 남긴다(규칙상 role=='member'는 본인 또는 리더가 쓸 수 있음).
async function respondToInvite(leaderId, accepted) {
  const uid = await getUid();
  const appRef = doc(db, OFFICE_PARTIES_COLLECTION, leaderId, "applications", uid);
  if (!accepted) {
    await updateDoc(appRef, { status: "declined", respondedAt: serverTimestamp() });
    return;
  }
  const [partySnap, myResumeSnap] = await Promise.all([
    getDoc(doc(db, OFFICE_PARTIES_COLLECTION, leaderId)),
    getDoc(doc(db, OFFICE_RESUMES_COLLECTION, uid)),
  ]);
  const partyNumber = partySnap.exists() ? partySnap.data().partyNumber : null;
  const memberNumber = myResumeSnap.exists() ? myResumeSnap.data().resumeNumber : null;
  const batch = writeBatch(db);
  batch.update(appRef, { status: "accepted", respondedAt: serverTimestamp() });
  batch.update(doc(db, OFFICE_PARTIES_COLLECTION, leaderId), { acceptedCount: increment(1) });
  if (partyNumber && memberNumber) {
    batch.set(doc(db, OFFICE_PARTY_HISTORY_COLLECTION, officePartyHistoryDocId(partyNumber, uid)), {
      steamId: uid, partyNumber, leaderId, role: "member", joinedAt: serverTimestamp(), leftAt: null, memberNumberAtJoin: memberNumber,
    });
    batch.update(doc(db, OFFICE_PARTY_ROSTER_COLLECTION, partyNumber), {
      members: arrayUnion({ role: "member", memberNumber }),
    });
  }
  await batch.commit();
}

// 파티원 스스로 파티에서 나감 — kickApplicant와 대칭으로 내 신청 문서를 지우고
// acceptedCount를 1 줄인다(이번엔 파티장이 아니라 나가는 본인이 수행). 참여 이력에도
// 나간 시각을 남긴다.
async function leaveParty(leaderId) {
  const uid = await getUid();
  const partySnap = await getDoc(doc(db, OFFICE_PARTIES_COLLECTION, leaderId));
  const partyNumber = partySnap.exists() ? partySnap.data().partyNumber : null;
  const batch = writeBatch(db);
  batch.delete(doc(db, OFFICE_PARTIES_COLLECTION, leaderId, "applications", uid));
  batch.update(doc(db, OFFICE_PARTIES_COLLECTION, leaderId), { acceptedCount: increment(-1) });
  if (partyNumber) {
    batch.update(doc(db, OFFICE_PARTY_HISTORY_COLLECTION, officePartyHistoryDocId(partyNumber, uid)), { leftAt: serverTimestamp() });
  }
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

// 내가 받은 초대/신청 현황을 실시간으로 감시 — watchMyPartyApplications(파티장용)와
// 대칭으로, 다른 화면을 보고 있어도 새 초대가 오면 바로 알 수 있게 하기 위함.
function watchMyApplications(callback) {
  let unsub = null;
  let cancelled = false;
  getUid().then((uid) => {
    if (cancelled) return;
    const q = query(collectionGroup(db, "applications"), where("applicantId", "==", uid));
    unsub = onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ leaderId: d.ref.parent.parent.id, ...d.data() })));
    });
  });
  return () => { cancelled = true; if (unsub) unsub(); };
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

// 파티장도 등록번호(파티원이 자신을 식별할 수단)가 있어야 해서 이제 파티 등록 중에도
// 이력서를 쓸 수 있다 — 다만 화면에는 파티장으로 활동 중인 동안 "인력 목록"에서
// 걸러서 안 보여준다(app.js renderResumeList 참고). resumeNumber는 임시 번호다 —
// 목록에 계속 살아있는 상태로 수정(갱신)하면 그대로 유지되지만, 이미 3시간이
// 지나 목록에서 사라졌던 걸 다시 올리면(=재등록) 새 번호를 받는다.
async function saveMyResume(fields) {
  const sanitized = sanitizeResumeFields(fields);
  const uid = await getUid();
  const ref = doc(db, OFFICE_RESUMES_COLLECTION, uid);
  const existing = await getDoc(ref);
  const stillActive = existing.exists() && existing.data().resumeNumber && !isTimestampExpired(existing.data().updatedAt);
  const resumeNumber = stillActive ? existing.data().resumeNumber : await generateMemberNumber(uid);
  await setDoc(ref, { ...sanitized, resumeNumber, updatedAt: serverTimestamp() });
}

async function deleteMyResume() {
  const uid = await getUid();
  await deleteDoc(doc(db, OFFICE_RESUMES_COLLECTION, uid));
}

// "타이머 리셋" — 이미 3시간이 지나 목록에서 사라진 뒤였다면 재등록으로 취급해서
// 번호도 새로 받는다(폼 재입력은 saveMyResume과 달리 여기선 안 함).
async function renewMyResume() {
  const uid = await getUid();
  const ref = doc(db, OFFICE_RESUMES_COLLECTION, uid);
  const existing = await getDoc(ref);
  if (existing.exists() && isTimestampExpired(existing.data().updatedAt)) {
    const resumeNumber = await generateMemberNumber(uid);
    await updateDoc(ref, { resumeNumber, updatedAt: serverTimestamp() });
    return;
  }
  await updateDoc(ref, { updatedAt: serverTimestamp() });
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

// 프로필 목록 — 등록된 이력서 전체를 사무소 회원 누구나 조회. steamId는 파티장이
// "초대" 버튼을 눌렀을 때 대상을 지정하는 용도로만 쓰고, 화면에 텍스트로 절대
// 노출하지 않는 게 클라이언트 쪽 원칙이다(블라인드 유지).
async function listAllResumes() {
  const snap = await getDocs(collection(db, OFFICE_RESUMES_COLLECTION));
  return snap.docs.map((d) => ({ ...d.data(), steamId: d.id }));
}

// 사무소 위반 신고 — 기존 오류제보(reports)와 완전히 별개 컬렉션. 영상/설명은 신고자
// 본인과 운영자만 볼 수 있고(전체공개 아님), 목록은 본인 것만 조회 가능(규칙 참고).
// ⚠ Firebase Storage는 유료(Blaze) 요금제가 필요해서 안 쓴다 — 영상은 외부 링크
//   (유튜브/스트리머블 등)만 붙여넣는 방식으로 한다.
const OFFICE_REPORTS_COLLECTION = "officeReports";
const MAX_OFFICE_REPORT_DESC_LEN = 200;

const PARTY_NUMBER_RE = /^\d{8}$/;
const MEMBER_NUMBER_RE = /^\d{9}$/;

// 신고 등록 — videoUrl은 사용자가 직접 붙여넣은 외부 링크(유튜브/스트리머블 등)만 받는다.
// incidentPartyNumber(사건번호=파티번호) + targetMemberNumber(신고 대상의 등록번호)를
// 같이 받는다. Firestore 규칙이 "신고자가 정말 그 파티에 있었는지"와 "지목한 등록번호의
// 주인도 정말 같은 파티에 있었는지"를 제출 시점에 이중으로 검증한다(클라이언트가 우회
// 불가) — 번호를 잘못 입력해도 두 조건이 우연히 동시에 맞아떨어질 확률이 낮아서 안전하다.
async function submitOfficeReport({ description, videoUrl, incidentPartyNumber, targetMemberNumber }) {
  const trimmedUrl = (videoUrl || "").trim();
  if (!trimmedUrl) throw new Error("영상 링크를 입력해주세요.");
  const trimmedPartyNumber = (incidentPartyNumber || "").trim();
  if (!PARTY_NUMBER_RE.test(trimmedPartyNumber)) throw new Error("사건번호(파티 번호, 8자리)를 정확히 입력해주세요.");
  const trimmedMemberNumber = (targetMemberNumber || "").trim();
  if (!MEMBER_NUMBER_RE.test(trimmedMemberNumber)) throw new Error("신고 대상 등록번호(9자리)를 정확히 입력해주세요.");
  const uid = await getUid();
  try {
    await addDoc(collection(db, OFFICE_REPORTS_COLLECTION), {
      reporterId: uid,
      description: (description || "").trim().slice(0, MAX_OFFICE_REPORT_DESC_LEN),
      videoUrl: trimmedUrl,
      incidentPartyNumber: trimmedPartyNumber,
      targetMemberNumber: trimmedMemberNumber,
      createdAt: serverTimestamp(),
      resolved: false,
      keep: false,
    });
  } catch {
    throw new Error("신고 접수에 실패했습니다. 사건번호·등록번호가 정확한지, 둘 다 그 파티에 있었는지 확인해주세요.");
  }
}

// "최근 기록" — 내가 참여했던 파티들과, 그때 같이 있었던 사람들의 등록번호(가명, 실명
// 아님)를 보여준다. 신고할 때 "그때 몇 번이었는지" 기억을 돕는 용도. 진짜 스팀ID는
// 전혀 노출되지 않는다(officePartyRoster엔 등록번호만 담겨 있음 — firestore.rules 참고).
async function listMyPartyHistory() {
  const uid = await getUid();
  const q = query(collection(db, OFFICE_PARTY_HISTORY_COLLECTION), where("steamId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

async function getPartyRoster(partyNumber) {
  const snap = await getDoc(doc(db, OFFICE_PARTY_ROSTER_COLLECTION, partyNumber));
  return snap.exists() ? snap.data() : null;
}

// 내가 제출한 신고 내역 — 규칙상 reporterId==내 uid로 필터가 걸린 쿼리만 조회 허용됨
async function listMyOfficeReports() {
  const uid = await getUid();
  const q = query(collection(db, OFFICE_REPORTS_COLLECTION), where("reporterId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

window.LoadoutCloud = {
  saveLoadout, listLoadouts, toggleLike, deleteLoadout,
  submitReport, reportNeedsCaptcha, listReports,
  listComments, addComment, getCurrentUid, OPERATOR_UID,
  getWeaponReviews, setWeaponHeart, saveWeaponComment, toggleWeaponCommentAgree,
  buildSteamLoginUrl, getSteamOpenIdParamsFromUrl, verifySteamLoginAndSignIn,
  getMyOfficeMembership, ensureOfficeMembership, deleteMyOfficeMembership,
  listAllParties, getMyParty, getPartyByLeaderId, saveMyParty, renewMyParty, setMyPartyStatus, setMyPartyCode, deleteMyParty,
  listApplicationsForMyParty, applyToParty, respondToApplication, listMyApplications, getPartyCode,
  watchMyPartyApplications, watchMyApplications, kickApplicant, inviteToParty, cancelInvite, respondToInvite, leaveParty,
  getMyResume, saveMyResume, renewMyResume, deleteMyResume, getApplicantResume, listAllResumes,
  submitOfficeReport, listMyOfficeReports, getMyIdToken, listMyPartyHistory, getPartyRoster,
};
