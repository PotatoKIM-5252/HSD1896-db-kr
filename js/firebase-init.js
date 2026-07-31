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
  getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc,
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
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  resolveAuthReady(user.uid);
  try {
    const prevUid = localStorage.getItem("hsddb_debug_last_uid");
    if (prevUid && prevUid !== user.uid) {
      console.warn(`[LoadoutCloud] 익명 uid가 이전 방문과 달라졌습니다. 이전: ${prevUid} / 지금: ${user.uid}`);
    } else {
      console.info(`[LoadoutCloud] 익명 uid: ${user.uid}`);
    }
    localStorage.setItem("hsddb_debug_last_uid", user.uid);
  } catch (err) {
    console.error("[LoadoutCloud] uid 디버그 기록 실패:", err);
  }
});

// 로그인 상태를 브라우저에 최대한 오래 유지(기본값이지만 명시적으로 지정) — 그 다음에 익명 로그인 시도
setPersistence(auth, browserLocalPersistence)
  .catch((err) => console.error("[LoadoutCloud] persistence 설정 실패:", err))
  .finally(() => {
    signInAnonymously(auth).catch((err) => console.error("[LoadoutCloud] 익명 로그인 실패:", err));
  });

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

// 무기 평가(하트+댓글) — 문서 id가 곧 작성자 uid라서 무기당 1개만 존재(다시 쓰면 덮어씀).
// 반대(싫어요) 개념 없이 "존재하면 좋아요"로 집계 — 뉴비가 숫자만 보고 반사적으로 거르는 걸
// 막기 위해 부정적 카운트 자체를 안 둠(사용자 확인).
const WEAPON_REVIEWS_COLLECTION = "weaponReviews";
const MAX_WEAPON_REVIEW_LEN = 300;

async function getWeaponReviews(weaponId) {
  const uid = await getUid();
  const q = query(collection(db, WEAPON_REVIEWS_COLLECTION, weaponId, "reviews"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    reviews,
    likeCount: reviews.length,
    myReview: reviews.find((r) => r.id === uid) || null,
  };
}

// text가 비어있으면 "댓글 없는 하트"만 남김. 이미 있으면 덮어씀(무기당 1개 유지).
async function submitWeaponReview(weaponId, text) {
  const trimmed = (text || "").trim().slice(0, MAX_WEAPON_REVIEW_LEN);
  const uid = await getUid();
  await setDoc(doc(db, WEAPON_REVIEWS_COLLECTION, weaponId, "reviews", uid), {
    text: trimmed,
    createdAt: serverTimestamp(),
    ownerId: uid,
  });
}

async function deleteWeaponReview(weaponId) {
  const uid = await getUid();
  await deleteDoc(doc(db, WEAPON_REVIEWS_COLLECTION, weaponId, "reviews", uid));
}

window.LoadoutCloud = {
  saveLoadout, listLoadouts, toggleLike, deleteLoadout,
  submitReport, reportNeedsCaptcha, listReports,
  listComments, addComment, getCurrentUid, OPERATOR_UID,
  getWeaponReviews, submitWeaponReview, deleteWeaponReview,
};
