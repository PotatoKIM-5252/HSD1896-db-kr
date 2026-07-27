// ===========================================================================
// 커뮤니티 로드아웃 저장/불러오기 — Firebase(Firestore) 연동
//
// 이 파일은 ES 모듈(index.html에서 type="module"로 로드)이라 app.js(일반 스크립트)와
// 직접 함수를 주고받을 수 없어서, window.LoadoutCloud에 필요한 함수만 얹어둔다.
// 모듈 스크립트는 자동으로 defer 처리되어 DOMContentLoaded 이전, app.js 실행 이후에
// 돌아가므로 app.js의 init()이 호출될 때는 window.LoadoutCloud가 이미 준비돼 있다.
//
// ⚠ 보안은 여기(클라이언트) 값 검증이 아니라 Firestore 보안 규칙이 담당한다.
//   apiKey 등은 원래 클라이언트에 노출되는 값이라 공개돼도 안전함.
// ===========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
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

const LOADOUTS_COLLECTION = "sharedLoadouts";
const MAX_NAME_LEN = 30;
const MAX_DATA_LEN = 4000;
const LIST_LIMIT = 60;

// 이름/데이터 길이 등은 UX용 1차 검증일 뿐, 실제 강제는 Firestore 보안 규칙에서 함
async function saveLoadout(name, dataStr) {
  const trimmedName = (name || "").trim().slice(0, MAX_NAME_LEN);
  if (!trimmedName) throw new Error("이름을 입력해주세요.");
  if (!dataStr || dataStr.length > MAX_DATA_LEN) throw new Error("로드아웃 데이터가 비어있거나 너무 큽니다.");
  await addDoc(collection(db, LOADOUTS_COLLECTION), {
    name: trimmedName,
    data: dataStr,
    createdAt: serverTimestamp(),
  });
}

async function listLoadouts() {
  const q = query(collection(db, LOADOUTS_COLLECTION), orderBy("createdAt", "desc"), limit(LIST_LIMIT));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

window.LoadoutCloud = { saveLoadout, listLoadouts };
