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
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
  doc, updateDoc, deleteDoc, arrayUnion, arrayRemove,
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
onAuthStateChanged(auth, (user) => { if (user) resolveAuthReady(user.uid); });
signInAnonymously(auth).catch((err) => console.error("[LoadoutCloud] 익명 로그인 실패:", err));

async function getUid() {
  if (auth.currentUser) return auth.currentUser.uid;
  return authReady;
}

const LOADOUTS_COLLECTION = "sharedLoadouts";
const MAX_NAME_LEN = 30;
const MAX_DATA_LEN = 4000;
const LIST_LIMIT = 60;

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

window.LoadoutCloud = { saveLoadout, listLoadouts, toggleLike, deleteLoadout };
