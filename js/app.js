/* =========================================================================
   app.js — 탄약 선택 + 스탯/그래프 자동 갱신
   ========================================================================= */

const state = {
  activeTab: "search",
  filterCategory: "all",
  searchQuery: "",

  weaponFilters: {
    slotSize: new Set(),
    ammoCategory: new Set(),
    ammoEffect: new Set(),
  },

  // 도구(category:"tool") 전용 필터 — 분류(toolClass)/태그(toolTags)
  toolFilters: {
    toolClass: new Set(),
    toolTags: new Set(),
  },

  // 소모품(category:"consumable") 전용 필터 — 분류(consumableClass)/태그(consumableTags)
  consumableFilters: {
    consumableClass: new Set(),
    consumableTags: new Set(),
  },

  // 특성(category:"trait") 전용 필터 — 분류(traitClass)/태그(traitTags)
  traitFilters: {
    traitClass: new Set(),
    traitTags: new Set(),
  },

  // 로드아웃 빌더 무기 선택 모달 전용 필터 (메인 검색 필터와 별개로 관리)
  pickerWeaponFilters: {
    slotSize: new Set(),
    ammoCategory: new Set(),
    ammoEffect: new Set(),
  },

  // 로드아웃 빌더 도구/소모품 선택 모달 전용 필터 (역시 메인 검색 필터와 별개)
  pickerToolFilters: {
    toolClass: new Set(),
    toolTags: new Set(),
  },
  pickerConsumableFilters: {
    consumableClass: new Set(),
    consumableTags: new Set(),
  },
  pickerTraitFilters: {
    traitClass: new Set(),
    traitTags: new Set(),
  },

  loadout: {},
  // merged: true면 "도구/소모품" 통합 칸을 고르는 중이라는 뜻 — 서브탭(도구/소모품)으로 전환 가능
  picker: { onSelect: null, categoryFilter: null, merged: false },

  // 무기 상세 패널에서 현재 선택된 탄약 (무기 id 단위로 기억)
  selectedAmmo: {},        // { "weapon_frontier_73c": "compact_fmj", ... }

  // 무기별 "부위 데미지 기준 거리" (그래프 클릭으로 변경). 기본 10m.
  refRange: {},            // { "weapon_frontier_73c": 47, ... }

  // 자세히 보기 화면에서 현재 선택된 파생형 인덱스
  selectedVariantIdx: {},  // { "weapon_frontier_73c": 0, ... } 0=모무기, 1+=파생형

  // 비교 목록: { weaponId, ammoId } 쌍의 배열
  compareEntries: [],

  // 비교 목록 중 "총기 스탯 비교"에서 선택된 항목 ({ weaponId, ammoId } 쌍의 배열)
  statCompareSelection: [],

  charts: { detail: null, compare: null, compareOhkShotgun: null, compareOhkOther: null, bodypart: null, compareStats: null },

  // 맵 탭: 현재 보고 있는 지도 id, 켜져 있는 레이어 key 집합
  activeMapId: null,
  activeMapLayers: null,  // Set — 최초 진입 시 MAP_LAYERS의 defaultOn 값으로 채움
  mapLegendCollapsed: false,
  mapZoom: 1,
  mapPanX: 0,
  mapPanY: 0,

  // 맵 탭 거리 측정 — 기본 지도 기능(운영자 전용 아님, 별도 모드 켜기 없이 항상 동작).
  // 지도를 1km x 1km 정사각형으로 가정하고(대각선 1414m), 클릭한 지점들을 percent
  // 좌표로 저장해두고 이어서 거리(m)를 계산해서 보여준다.
  mapMeasurePoints: [], // [{x, y}, ...] percent 좌표

  // 맵 탭 편집(운영자 전용) — mapOverridePoints는 현재 지도의 "게시된" 지점(없으면
  // null, 정적 데이터를 그대로 씀). mapEditPoints는 편집 모드일 때만 쓰는 초안(아직
  // 미게시). mapCustomLayers는 운영자가 추가한 범례(전역, js/maps-data.js의
  // MAP_LAYERS와 합쳐서 씀).
  mapOperatorChecked: false,
  mapOperatorIdToken: null,
  mapCustomLayersLoaded: false,
  mapCustomLayers: [],
  mapOverridePoints: null,
  mapEditMode: false,
  mapEditPoints: null,
  mapEditSelectedLayerKey: null,

  // 커뮤니티 로드아웃: Firestore에서 받아온 목록(파싱+가격 계산까지 끝낸 캐시) +
  // 현재 정렬/가격 필터 상태. 정렬·필터를 바꿀 때는 재조회 없이 이 캐시로만 다시 그림.
  communityLoadouts: [],
  communitySort: "",       // "" | "date-asc" | "likes-desc" | "price-asc" | "price-desc"
  communityPriceMin: null,
  communityPriceMax: null,
  communityPage: 0,

  // 랜덤 로드아웃: 무기 칸수 상한 스위치 — 켜면 6칸까지, 끄면 5칸까지만 허용
  randomAllowSlot6: true,
  // 랜덤 로드아웃: 최소/최대 가격(Hunt Dollars) 범위 — 무기+탄약+필드 장비 합산 기준(특성 포인트는 별도라 미포함)
  randomMinPrice: 0,
  randomMaxPrice: 3000,
  // 랜덤 로드아웃: 희소(Scarce, 상점 구매 불가·필드 드랍 전용) 무기/도구/소모품 포함 여부 — 기본은 제외
  randomAllowScarce: false,
};

function loadoutKey(c, s) { return `${c}__${s}`; }

// 브라우저 기본 alert() 대신 사이트 디자인에 맞는 토스트 알림
let toastTimer = null;
function showToast(message, type = "error") {
  const toast = document.getElementById("site-toast");
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `site-toast site-toast-${type}`;
  toast.hidden = false;
  // 강제 리플로우 후 표시 클래스 적용 (트랜지션이 매번 다시 재생되도록)
  void toast.offsetWidth;
  toast.classList.add("show");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 250);
  }, 3200);
}

// 한글 단어 받침 유무에 따라 "이/가" 조사를 자동으로 붙여준다 (예: "도구"+가, "소모품"+이)
function withEulReulIga(word, withBatchim, withoutBatchim) {
  const lastChar = word[word.length - 1];
  const code = lastChar.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return word + withoutBatchim; // 한글 음절이 아니면 기본값
  const hasBatchim = code % 28 !== 0;
  return word + (hasBatchim ? withBatchim : withoutBatchim);
}

// 같은 sharedGroup을 쓰는 슬롯들(도구+소모품)의 전체 사용 칸 수 합산
function getSharedGroupUsage(sharedGroup) {
  // "field"(도구+소모품 공유 풀)는 통합 순서 배열(field__all)의 길이가 곧 사용량
  if (sharedGroup === "field") return (state.loadout["field__all"] || []).length;
  let count = 0;
  Object.entries(CATEGORIES).forEach(([catKey, catDef]) => {
    catDef.loadoutSlots.forEach((slotDef) => {
      if (slotDef.sharedGroup === sharedGroup) {
        const key = loadoutKey(catKey, slotDef.slotKey);
        count += (state.loadout[key] || []).length;
      }
    });
  });
  return count;
}

// 현재 로드아웃에 장착된 무기들의 슬롯 사이즈(칸수) 합계.
// excludeKey/excludeIndex를 주면 그 슬롯은 계산에서 제외 (그 자리를 교체하는 경우 중복 계산 방지)
function getTotalWeaponSlotSize(excludeKey, excludeIndex) {
  let total = 0;
  CATEGORIES.weapon.loadoutSlots.forEach((slotDef) => {
    const key = loadoutKey("weapon", slotDef.slotKey);
    (state.loadout[key] || []).forEach((slotData, idx) => {
      if (key === excludeKey && idx === excludeIndex) return;
      if (slotData?.item?.slotSize != null) total += slotData.item.slotSize;
    });
  });
  return total;
}

const WEAPON_SLOT_LIMIT = 6;

// 특성은 최대 15개까지만 로드아웃에 담을 수 있음(사용자 확인)
const TRAIT_MAX_COUNT = 15;


// 아이템을 카테고리에 맞는 로드아웃 슬롯 중 "첫 번째 빈 자리"에 자동으로 채워넣는다.
// (무기: 주무기 → 보조무기 순으로 탐색, 특성처럼 개수 제한이 없는 슬롯은 목록에 추가)
function addToLoadoutQuick(item, ammoId = null) {
  const catDef = CATEGORIES[item.category];
  if (!catDef) return { ok: false, message: "로드아웃에 추가할 수 없는 항목입니다." };

  for (const slotDef of catDef.loadoutSlots) {
    const key = slotDef.sharedGroup === "field" ? "field__all" : loadoutKey(item.category, slotDef.slotKey);
    if (slotDef.max === null) {
      // 공유 풀 용량 체크 (도구+소모품처럼 여러 카테고리가 칸을 나눠 쓰는 경우)
      if (slotDef.sharedGroup && getSharedGroupUsage(slotDef.sharedGroup) >= slotDef.sharedCapacity) {
        return { ok: false, message: "필드 장비 칸이 가득 찼습니다" };
      }
      // 특성은 공유 풀이 아니라 자체적으로 최대 개수 제한이 있음
      if (item.category === "trait" && state.loadout[key].length >= TRAIT_MAX_COUNT) {
        return { ok: false, message: `특성은 최대 ${TRAIT_MAX_COUNT}개까지만 담을 수 있습니다` };
      }
      if (!slotDef.allowDuplicates && state.loadout[key].includes(item.id)) {
        return { ok: false, message: "이미 추가되어 있습니다" };
      }
      // 투척/설치/타로/주사기 소모품은 같은 종류를 최대 4개까지만 담을 수 있음
      const stackGroup = getConsumableStackGroup(item);
      if (stackGroup) {
        const currentCount = state.loadout[key].filter((id) => id === item.id).length;
        if (currentCount >= CONSUMABLE_STACK_MAX) {
          return { ok: false, message: `${item.nameKo || item.name}은(는) 최대 ${CONSUMABLE_STACK_MAX}개까지만 담을 수 있습니다` };
        }
      }
      state.loadout[key].push(item.id);
      return { ok: true, slotLabel: slotDef.label };
    } else {
      const arr = state.loadout[key];
      // 무기는 0번 칸(대표 칸)에만 퀵 추가함. 1번 칸(듀얼 짝)은 같은 무기 한 종류로만
      // 채울 수 있어서 여기서 임의로 채우지 않고, 장비판의 "듀얼로 추가" 클릭으로만 채움.
      const emptyIdx = item.category === "weapon"
        ? (arr[0] === null ? 0 : -1)
        : arr.findIndex((v) => v === null);
      if (emptyIdx !== -1) {
        if (item.category === "weapon") {
          const otherTotal = getTotalWeaponSlotSize(key, emptyIdx);
          const newTotal = otherTotal + (item.slotSize || 0);
          if (newTotal > WEAPON_SLOT_LIMIT) {
            return { ok: false, message: `무기 칸수 합이 ${WEAPON_SLOT_LIMIT}칸을 초과합니다` };
          }
        }
        arr[emptyIdx] = { item, ammoId };
        return { ok: true, slotLabel: slotDef.max > 1 ? `${slotDef.label} ${emptyIdx + 1}` : slotDef.label };
      }
    }
  }
  return { ok: false, message: "빈 슬롯이 없습니다" };
}

// -------------------------------------------------------------------------
// 운영자 모드 — 제보 댓글에 "운영자" 자격으로 답글을 달기 위한 최소 기능.
// Firebase Auth SDK의 로그인 세션을 바꾸는 대신, 운영자 전용 refresh token을
// 브라우저에 붙여넣어 저장해두고 Firestore REST API를 직접 호출해서 댓글만 씀
// (권한은 딱 "댓글 작성" 하나뿐 — firestore.rules의 isOperator()가 그 외엔 전부 막아줌).
const OPERATOR_TOKEN_KEY = "hsddb_operator_refresh_token";
const FIREBASE_API_KEY = "AIzaSyD3SbLMnzxnDypLXa4kLizKJQkn30bl3CU";
const FIRESTORE_PROJECT_ID = "hsd-db-1a8d7";
// 사무소 신고 영상 업로드/조회/삭제를 중계하는 Cloudflare Worker(스팀 로그인 검증과 같은 Worker)
const OFFICE_REPORT_WORKER_URL = "https://potatokim.cisd456.workers.dev";


function getOperatorRefreshToken() {
  return localStorage.getItem(OPERATOR_TOKEN_KEY) || null;
}
function setOperatorRefreshToken(token) {
  if (token) localStorage.setItem(OPERATOR_TOKEN_KEY, token.trim());
  else localStorage.removeItem(OPERATOR_TOKEN_KEY);
}

// 저장된 refresh token으로 짧게 유효한 idToken을 새로 발급받음. 토큰이 없거나
// 만료/무효면 null (일반 방문자와 똑같이 취급되어 조용히 댓글창만 안 보임).
async function operatorAuthenticate() {
  const refreshToken = getOperatorRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { idToken: data.id_token, uid: data.user_id };
  } catch {
    return null;
  }
}

function randomFirestoreDocId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// Firebase JS SDK 없이 Firestore REST API를 직접 호출해서 댓글 문서를 만듦
// (createdAt은 서버 시각과 정확히 일치해야 하는 규칙이라 updateTransforms로 지정).
async function addCommentAsOperator(reportId, text, operatorAuth) {
  const docId = randomFirestoreDocId();
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents:commit`;
  const body = {
    writes: [{
      update: {
        name: `projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/reports/${reportId}/comments/${docId}`,
        fields: {
          text: { stringValue: text },
          ownerId: { stringValue: operatorAuth.uid },
        },
      },
      updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false },
    }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${operatorAuth.idToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "댓글 등록에 실패했습니다.");
  }
}

// 제보에 "해결됨" 표시를 붙이거나 뗌 — resolved 필드 하나만 부분 수정(updateMask)해서
// 다른 필드는 손대지 않음(규칙도 이 필드 하나만 바꾸는 요청만 허용).
async function setReportResolvedAsOperator(reportId, resolved, operatorAuth) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/reports/${reportId}?updateMask.fieldPaths=resolved`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${operatorAuth.idToken}` },
    body: JSON.stringify({ fields: { resolved: { booleanValue: resolved } } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "해결 표시 변경에 실패했습니다.");
  }
}

async function deleteReportAsOperator(reportId, operatorAuth) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/reports/${reportId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${operatorAuth.idToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "제보 삭제에 실패했습니다.");
  }
}

// Firestore REST 응답의 typed value({stringValue:"..."} 등)를 평범한 JS 값으로 변환 —
// 운영자가 스팀 인증 없이 사무소 게시판을 "열람"만 할 때 SDK 대신 REST로 직접 조회하는
// 용도로만 쓴다(쓰기는 여기 구현하지 않음 + 규칙도 열람만 허용).
function firestoreRestValueToJs(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.timestampValue !== undefined) return { seconds: Math.floor(new Date(v.timestampValue).getTime() / 1000) };
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(firestoreRestValueToJs);
  if (v.mapValue !== undefined) return firestoreRestFieldsToJs(v.mapValue.fields || {});
  return null;
}
function firestoreRestFieldsToJs(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = firestoreRestValueToJs(v);
  return out;
}

// JS 값 -> Firestore REST 타입 값. 맵 탭 지점/범례를 저장할 때(mapOverrides,
// mapCustomLayers) 중첩 객체·배열을 그대로 써야 해서 재귀적으로 변환한다.
function jsValueToFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(jsValueToFirestore) } };
  if (typeof v === "object") return { mapValue: { fields: jsToFirestoreFields(v) } };
  return { stringValue: String(v) };
}
function jsToFirestoreFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = jsValueToFirestore(v);
  return out;
}

// 파티 목록 — 운영자 열람 전용(REST). leaderId는 화면에 노출 안 함.
async function listOfficePartiesAsOperator(idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeParties`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error("파티 목록을 불러오지 못했습니다.");
  const data = await res.json();
  return (data.documents || []).map((d) => firestoreRestFieldsToJs(d.fields));
}

// 프로필 목록 — 운영자 열람 전용(REST). 화면엔 steamId를 노출하지 않지만(블라인드
// 원칙), 파티장 필터링(renderOperatorResumeList)에 쓰려고 값 자체는 같이 돌려준다.
async function listOfficeResumesAsOperator(idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeResumes`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error("프로필 목록을 불러오지 못했습니다.");
  const data = await res.json();
  return (data.documents || []).map((d) => ({ steamId: d.name.split("/").pop(), ...firestoreRestFieldsToJs(d.fields) }));
}

// -------------------------------------------------------------------------
// 맵 탭 지점/범례 — 운영자가 편집해서 "확정"하면 여기 저장된 값이 모든 방문자에게
// 보인다(읽기는 로그인 없이도 가능, 쓰기는 운영자만 — firestore.rules 참고). 지점이
// 없으면(운영자가 아직 확정한 적 없는 지도) 404가 나므로 null로 처리해서 정적
// 데이터(js/maps-data.js)를 그대로 쓴다.
// -------------------------------------------------------------------------

async function fetchMapOverridePoints(mapId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/mapOverrides/${mapId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return firestoreRestFieldsToJs(data.fields).points || {};
}

async function fetchMapCustomLayers() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/mapCustomLayers/main`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return firestoreRestFieldsToJs(data.fields).layers || [];
}

async function publishMapOverridePoints(mapId, points, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/mapOverrides/${mapId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: jsToFirestoreFields({ points }) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "지점 게시에 실패했습니다.");
  }
}

async function publishMapCustomLayers(layers, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/mapCustomLayers/main`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: jsToFirestoreFields({ layers }) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "범례 게시에 실패했습니다.");
  }
}

// 신고에 적힌 신고 대상 등록번호(targetMemberNumber)로 실제 스팀ID를 조회(운영자 전용,
// REST) — officeMemberNumberHistory는 한 번 배정되면 절대 안 바뀌는 영구 기록이라
// 시점과 무관하게 항상 정확하다(이력서를 나중에 재등록해서 새 번호를 받아도 예전
// 신고 기록의 정확성에는 영향이 없음).
async function resolveMemberNumberAsOperator(memberNumber, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeMemberNumberHistory/${memberNumber}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("등록번호를 조회하지 못했습니다.");
  const data = await res.json();
  return firestoreRestFieldsToJs(data.fields).steamId;
}

// 사무소 위반 신고 관리(운영자 전용, REST) — 목록 조회/처리·보류 표시/삭제.
// 신고자 본인이 아닌 운영자만 전체를 볼 수 있는 컬렉션이라 SDK 세션이 아니라 REST로 처리한다.
async function listOfficeReportsAsOperator(idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeReports`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error("신고 목록을 불러오지 못했습니다.");
  const data = await res.json();
  return (data.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...firestoreRestFieldsToJs(d.fields) }));
}

// 운영자가 스팀 로그인 없이도 신고 기능을 테스트할 수 있게, 운영자 uid로 직접
// 신고를 등록(REST) — SDK 세션은 운영자로 바뀌지 않으니(의도적으로 안 바꿈) 일반
// submitOfficeReport(SDK)로는 안 되고, 이 함수로 REST 인증 헤더를 직접 붙여 써야 한다.
// createdAt은 규칙이 request.time과 정확히 같아야 한다고 요구해서(클라이언트가 임의로
// 값을 못 넣게) updateTransforms로 서버 시각을 지정한다 — addCommentAsOperator와 동일 패턴.
async function submitOfficeReportAsOperator(description, videoUrl, idToken, incidentPartyNumber, targetMemberNumber) {
  const docId = randomFirestoreDocId();
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents:commit`;
  const fields = {
    reporterId: { stringValue: window.LoadoutCloud.OPERATOR_UID },
    description: { stringValue: (description || "").slice(0, 200) },
    videoUrl: { stringValue: videoUrl },
    incidentPartyNumber: { stringValue: incidentPartyNumber },
    targetMemberNumber: { stringValue: targetMemberNumber },
    resolved: { booleanValue: false },
    keep: { booleanValue: false },
  };
  const body = {
    writes: [{
      update: {
        name: `projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeReports/${docId}`,
        fields,
      },
      updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false },
    }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "신고 접수에 실패했습니다.");
  }
}

async function setOfficeReportFieldAsOperator(reportId, field, value, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeReports/${reportId}?updateMask.fieldPaths=${field}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: { [field]: { booleanValue: !!value } } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "처리에 실패했습니다.");
  }
}

async function deleteOfficeReportAsOperator(reportId, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeReports/${reportId}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error("삭제에 실패했습니다.");
}

// 신고 영상 — Cloudflare Worker(R2)를 통해 업로드/조회/삭제. Firebase Storage는
// 유료 요금제가 필요해서 안 쓴다. idToken은 본인 신고면 getMyIdToken(), 운영자
// 조회/삭제면 운영자 idToken(officeReportAdminIdToken)을 넘긴다.
const OFFICE_REPORT_VIDEO_ERROR_MESSAGES = {
  video_too_large: "영상 용량이 너무 큽니다(300MB 이하).",
  storage_full: "저장 공간이 가득 찼습니다. 잠시 후 다시 시도해주세요.",
  daily_limit_exceeded: "하루 신고 가능 횟수(5건)를 넘었습니다.",
  not_video: "영상 파일만 업로드할 수 있습니다.",
  unauthorized: "로그인 상태를 확인할 수 없습니다.",
  forbidden: "이 영상을 볼 권한이 없습니다.",
};

async function uploadOfficeReportVideo(file, idToken) {
  const res = await fetch(`${OFFICE_REPORT_WORKER_URL}/report-video`, {
    method: "POST",
    headers: { "Content-Type": file.type, Authorization: `Bearer ${idToken}` },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(OFFICE_REPORT_VIDEO_ERROR_MESSAGES[err?.error] || "영상 업로드에 실패했습니다.");
  }
  const data = await res.json();
  return data.key;
}

// 영상을 받아서 재생 가능한 blob URL로 바꿔 돌려준다 — <video src>는 커스텀 인증
// 헤더를 못 보내서, fetch로 직접 인증 헤더를 붙여 받아온 뒤 객체 URL로 바꿔야 한다.
async function fetchOfficeReportVideoObjectUrl(key, idToken) {
  const res = await fetch(`${OFFICE_REPORT_WORKER_URL}/report-video/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(OFFICE_REPORT_VIDEO_ERROR_MESSAGES[err?.error] || "영상을 불러오지 못했습니다.");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// "영상 보기" 버튼 — 누르면 그때 인증된 fetch로 영상을 받아와 그 자리에 <video>로 재생.
// getIdTokenFn은 본인 신고 목록이면 getMyIdToken, 운영자 패널이면 운영자 idToken을 돌려주는 함수.
function createOfficeReportVideoButton(videoKey, getIdTokenFn) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "office-btn office-btn-secondary";
  btn.textContent = "영상 보기";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "불러오는 중...";
    try {
      const idToken = await getIdTokenFn();
      const objectUrl = await fetchOfficeReportVideoObjectUrl(videoKey, idToken);
      const videoEl = document.createElement("video");
      videoEl.src = objectUrl;
      videoEl.controls = true;
      videoEl.className = "office-report-video-player";
      btn.replaceWith(videoEl);
    } catch (err) {
      showToast(err.message || "영상을 불러오지 못했습니다.");
      btn.disabled = false;
      btn.textContent = "영상 보기";
    }
  });
  return btn;
}

// 신고 관리 화면에서 파티번호 + 신고 대상 등록번호를 보여주는 영역 — "스팀ID 조회"를
// 누르면 officeMemberNumberHistory(영구 등록부)로 등록번호의 진짜 주인을 바로 찾는다.
// 이 매핑은 시점과 무관하게 항상 정확하다(등록번호가 나중에 새로 바뀌어도 예전
// 신고 기록은 그 당시 번호 그대로 남아있음).
// 밴 처리(운영자 전용, REST) — duration은 "1"/"3"/"7"/"30"(일수 문자열), "permanent"(영구),
// "unban"(해제) 중 하나. banned/bannedUntil을 항상 같이 써서 의도를 명확히 한다
// (firestore.rules 참고 — 기간이 지나면 자동으로 차단 아님으로 판정되므로 별도 해제 불필요).
async function setOfficeMemberBanAsOperator(steamId, duration, idToken) {
  const fields = duration === "permanent"
    ? { banned: true, bannedUntil: null }
    : duration === "unban"
      ? { banned: false, bannedUntil: null }
      : { banned: false, bannedUntil: new Date(Date.now() + Number(duration) * 24 * 60 * 60 * 1000) };
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/officeMembers/${steamId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: jsToFirestoreFields(fields) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || "차단 처리에 실패했습니다.");
  }
}

function createTargetLookupRow(incidentPartyNumber, targetMemberNumber, idToken) {
  const row = document.createElement("div");
  row.className = "muted-text";
  const labelSpan = document.createElement("p");
  labelSpan.textContent = `파티번호 · ${incidentPartyNumber} / 신고 대상 등록번호 · ${targetMemberNumber}`;
  row.appendChild(labelSpan);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "office-btn office-btn-secondary";
  btn.textContent = "스팀ID 조회";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "조회 중...";
    try {
      const steamId = await resolveMemberNumberAsOperator(targetMemberNumber, idToken);
      btn.replaceWith(document.createTextNode(steamId || "등록된 적 없는 번호입니다."));
      if (steamId) row.appendChild(createBanControlRow(steamId, idToken));
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "스팀ID 조회";
      showToast(err.message || "조회에 실패했습니다.");
    }
  });
  row.appendChild(btn);
  return row;
}

// 스팀ID가 조회된 뒤 붙는 차단 컨트롤 — 기간 선택 + 차단 버튼
function createBanControlRow(steamId, idToken) {
  const wrap = document.createElement("div");
  wrap.className = "office-ban-control";
  const select = document.createElement("select");
  select.innerHTML = `
    <option value="1">1일</option>
    <option value="3">3일</option>
    <option value="7">7일</option>
    <option value="30">30일</option>
    <option value="permanent">영구</option>
    <option value="unban">차단 해제</option>
  `;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "office-btn office-btn-secondary";
  btn.textContent = "적용";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await setOfficeMemberBanAsOperator(steamId, select.value, idToken);
      showToast("차단 상태가 변경됐습니다.", "info");
    } catch (err) {
      showToast(err.message || "차단 처리에 실패했습니다.");
    } finally {
      btn.disabled = false;
    }
  });
  wrap.appendChild(select);
  wrap.appendChild(btn);
  return wrap;
}

async function deleteOfficeReportVideo(key, idToken) {
  if (!key) return;
  await fetch(`${OFFICE_REPORT_WORKER_URL}/report-video/${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  }).catch(() => {});
}

// 신고 등록 후 1주일이 지났고, 운영자가 "보류"로 남겨두지 않았으면 자동 삭제 —
// 서버 스케줄 작업이 없는 정적 사이트라 진짜 "자동"은 아니고, 운영자가 신고 관리
// 패널을 열 때마다 오래된 것들을 정리하는 방식으로 대신한다.
const OFFICE_REPORT_AUTO_DELETE_MS = 7 * 24 * 60 * 60 * 1000;
async function cleanupExpiredOfficeReports(reports, idToken) {
  const now = Date.now();
  const expired = reports.filter((r) => {
    if (r.keep) return false;
    const ms = officeTimestampMillis(r.createdAt);
    return ms != null && now - ms > OFFICE_REPORT_AUTO_DELETE_MS;
  });
  for (const r of expired) {
    await deleteOfficeReportAsOperator(r.id, idToken).catch(() => {});
    await deleteOfficeReportVideo(r.videoUrl, idToken);
  }
  return expired.map((r) => r.id);
}

// -------------------------------------------------------------------------
// 사이트 업데이트 내역 — 새 항목은 배열 맨 앞에 추가(최신순으로 그대로 출력됨)
const CHANGELOG = [
  { date: "8.10", text: "맵에 거리 측정 기능 추가 — 지도를 그냥 클릭하면 지점이 찍히고 거리(m)가 표시됨(1km x 1km 가정), 클릭한 채로 끌면 기존처럼 지도 이동, 다음 지점 찍기 전까진 커서를 따라다니는 미리보기 선 표시, 우클릭으로 최근 지점부터 취소" },
  { date: "8.10", text: "폭탄 발사기/폭탄 창 한방컷(OHK) 거리를 활처럼 막대 하나로 통합(가슴 46m 기준 막대에 팔 29m/복부 39m 보조 눈금 표시)" },
  { date: "8.10", text: "센테니얼 포인트맨 여유탄 9발, 본하임 No. 3 매치 여유탄 20발로 수정" },
  { date: "8.10", text: "폭탄 발사기/폭탄 창(밤랜스) 작살 여유탄 6발, 철환탄 여유탄 4발, 왁스 파편탄 여유탄 4발로 수정" },
  { date: "8.10", text: "한손 쇠뇌 여유탄 수정 — 중독 볼트 8발, 드래곤 볼트 2발, 카오스/초크 볼트 각 5발" },
  { date: "8.8", text: "사무소: 구인방 리스트가 새로고침 없이 실시간으로 자동 갱신됨, 새 참가 신청/초대가 오면 알림음(종소리)과 탭 제목 깜빡임으로 알려줌" },
  { date: "8.8", text: "사무소: 내 파티 화면의 파티원 목록에 파티장 본인도 등록번호와 함께 표시" },
  { date: "8.7", text: "사무소 다시 오픈 — 스팀 로그인한 이용자 누구나 운영자 키 없이 이용 가능" },
  { date: "8.7", text: "사무소: 위반 시 기간제 차단(1/3/7/30일/영구) 도입, 신고는 사건 발생일로부터 3일 이내에만 접수 가능하도록 규칙 명시" },
  { date: "8.7", text: "맵 탭에 운영자 전용 지점/범례 추가·이동·삭제 편집 기능 추가" },
  { date: "8.7", text: "사무소: 초대·신청 수락 직전 상대가 프로필을 지워도 유령 파티원이 남지 않도록 수정" },
  { date: "8.3", text: "드래곤브레스탄 한방컷(OHK) 거리 실측치 추가(스펙터 1882 기본형/바요넷, 터미누스 기본형, 라이벌 78 메이스) 및 스펙터 1882 기본쉘 한방컷 거리 13m로 보정" },
  { date: "8.3", text: "사무소: 파티 목록에 모집 상태를 🟢(모집중+빈자리)/🔴(가득참 또는 모집마감) 동그라미로 표시" },
  { date: "8.3", text: "사무소: 로비 코드 전체공개 옵션 제거 — 이제 파티장 본인과 참가 승인(수락)된 파티원만 로비 코드를 볼 수 있음" },
  { date: "8.3", text: "사무소: 파티/프로필이 3시간 동안 갱신 안 되면 목록에서 자동으로 숨김 처리 + \"타이머 리셋\" 버튼 추가, 등록된 스팀 ID를 스스로 삭제하는 \"사무소 탈퇴\" 기능 추가" },
  { date: "8.2", text: "사무소: 전체 공개로 전환 — 파티장이 프로필 게시판에서 바로 초대 가능, 파티원 내보내기/나가기, 새 초대 실시간 알림 추가" },
  { date: "8.1", text: "사무소(망호 게시판) 신설 — 스팀 로그인 인증 후 파티 모집/참가 신청, 프로필 등록 가능" },
  { date: "8.1", text: "사무소: 파티 인원(듀오/트리오), 게임 모드(결전/사냥/상관없음), 선호 서버 복수 선택 등 매칭 조건 세분화, 합류 로비 코드 공개·비공개 설정" },
  { date: "7.31", text: "무기 상세(간략히/자세히 보기)에서 무기 평가 영역이 우측 하단 버튼과 겹치던 문제 수정" },
  { date: "7.31", text: "사냥용 활 Hundred Hands 착용 시 한방컷 그래프에서 7m 지점(부위구분없이 한방)을 보조 눈금으로 표시" },
  { date: "7.30", text: "무기 상세에 평가 기능 추가 — 하트(반대 표시 없음)와 한줄평 독립 작성, 한줄평 공감(👍)·삭제, 자세히 보기에서 전체 한줄평 확인 가능" },
  { date: "7.30", text: "커뮤니티 로드아웃에 정렬(오래된순/하트순) 및 날짜 표시, 페이지 나눔 추가" },
  { date: "7.30", text: "랜덤 로드아웃에서 근접무기/투척무기 도구가 여러 개 동시에 나오던 버그 수정" },
  { date: "7.29", text: "르맷 카빈 전용 탄약(FMJ/드래곤브레스/슬러그/신호탄) 스탯을 기본 르맷과 분리하고 위키 기준으로 수정" },
  { date: "7.29", text: "드래곤브레스탄 한방컷(OHK) 거리 실측치 반영 (로메로/스펙터/라이벌/르맷/르맷카빈/헤이메이커/홈스테드/터미누스 각 쇼티 포함)" },
  { date: "7.29", text: "제보내역에 댓글 기능 및 해결됨 표시 추가" },
  { date: "7.29", text: "로드아웃 빌더 특성 칸도 도구/소모품처럼 하나 고를 때마다 선택창이 닫히지 않고 계속 고를 수 있도록 수정" },
  { date: "7.29", text: "오류제보 탭 이름을 \"문의 및 오류 제보\"로 변경" },
  { date: "7.29", text: "우측 하단 업데이트 내역 탭 신설" },
  { date: "7.29", text: "우측 하단 오류제보 탭 신설" },
  { date: "7.28", text: "로드아웃 랜덤에 희소아이템 제거를 했음에도 희소 탄약이 계속해서 나오던 문제 수정" },
  { date: "7.28", text: "도구 소모품 카테고리에 전체 추가 — 이제 도구나 소모품 누르면 전부 보여준 상태로 필터링 가능" },
];

function init() {
  initLoadoutState();

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("site-logo").addEventListener("click", (e) => {
    e.preventDefault();
    switchTab("search");
  });
  document.getElementById("office-entry-btn").addEventListener("click", () => switchTab("office"));

  document.getElementById("search-input").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderItemGrid();
  });

  document.getElementById("picker-close-btn").addEventListener("click", closePicker);
  document.getElementById("picker-search-input").addEventListener("input", (e) => {
    renderPickerList(e.target.value.trim().toLowerCase());
  });

  document.getElementById("clear-loadout-btn").addEventListener("click", clearLoadout);
  document.getElementById("random-loadout-btn").addEventListener("click", generateRandomLoadout);
  document.getElementById("random-allow-slot6-toggle").addEventListener("change", (e) => {
    state.randomAllowSlot6 = e.target.checked;
  });
  document.getElementById("random-allow-scarce-toggle").addEventListener("change", (e) => {
    state.randomAllowScarce = e.target.checked;
  });
  // 최소/최대 가격 — 입력창과 슬라이더를 서로 동기화하고, 최소가 최대를 넘어가면 서로 밀어서
  // 항상 최소 <= 최대가 유지되게 함.
  const minPriceRange = document.getElementById("random-minprice-range");
  const minPriceInput = document.getElementById("random-minprice-input");
  const maxPriceRange = document.getElementById("random-maxprice-range");
  const maxPriceInput = document.getElementById("random-maxprice-input");

  function syncMinPrice(num) {
    state.randomMinPrice = num;
    minPriceInput.value = num;
    minPriceRange.value = Math.min(Number(minPriceRange.max), Math.max(Number(minPriceRange.min), num));
  }
  function syncMaxPrice(num) {
    state.randomMaxPrice = num;
    maxPriceInput.value = num;
    maxPriceRange.value = Math.min(Number(maxPriceRange.max), Math.max(Number(maxPriceRange.min), num));
  }

  minPriceRange.addEventListener("input", () => {
    syncMinPrice(Number(minPriceRange.value));
    if (state.randomMinPrice > state.randomMaxPrice) syncMaxPrice(state.randomMinPrice);
  });
  minPriceInput.addEventListener("input", () => {
    minPriceInput.value = minPriceInput.value.replace(/[^0-9]/g, "");
    syncMinPrice(Number(minPriceInput.value) || 0);
    if (state.randomMinPrice > state.randomMaxPrice) syncMaxPrice(state.randomMinPrice);
  });
  maxPriceRange.addEventListener("input", () => {
    syncMaxPrice(Number(maxPriceRange.value));
    if (state.randomMaxPrice < state.randomMinPrice) syncMinPrice(state.randomMaxPrice);
  });
  maxPriceInput.addEventListener("input", () => {
    maxPriceInput.value = maxPriceInput.value.replace(/[^0-9]/g, "");
    syncMaxPrice(Number(maxPriceInput.value) || 0);
    if (state.randomMaxPrice < state.randomMinPrice) syncMinPrice(state.randomMaxPrice);
  });
  document.getElementById("goto-analysis-btn").addEventListener("click", () => switchTab("analysis"));
  document.getElementById("clear-compare-btn").addEventListener("click", () => {
    state.compareEntries = [];
    renderAnalysis();
  });

  document.getElementById("map-legend-collapse-btn").addEventListener("click", () => {
    state.mapLegendCollapsed = !state.mapLegendCollapsed;
    renderMapLegendPanel();
  });
  document.getElementById("map-legend-enable-all-btn").addEventListener("click", () => {
    state.activeMapLayers = new Set(effectiveMapLayers().map((l) => l.key));
    renderMapLegendPanel();
    renderMapViewport();
  });
  document.getElementById("map-legend-disable-all-btn").addEventListener("click", () => {
    state.activeMapLayers = new Set();
    renderMapLegendPanel();
    renderMapViewport();
  });

  document.getElementById("map-zoom-in-btn").addEventListener("click", () => setMapZoom(state.mapZoom + 0.5));
  document.getElementById("map-zoom-out-btn").addEventListener("click", () => setMapZoom(state.mapZoom - 0.5));
  document.getElementById("map-zoom-reset-btn").addEventListener("click", () => resetMapView());
  setupMapPanZoom();
  setupMapEditInteractions();
  setupMapEditControls();
  setupMapMeasureInteractions();

  document.getElementById("community-save-btn").addEventListener("click", handleCommunitySave);
  document.getElementById("community-sort-select").addEventListener("change", (e) => {
    state.communitySort = e.target.value;
    state.communityPage = 0;
    renderCommunityLoadoutList();
  });
  document.getElementById("community-price-min").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
    const v = e.target.value.trim();
    state.communityPriceMin = v === "" ? null : Number(v);
    state.communityPage = 0;
    renderCommunityLoadoutList();
  });
  document.getElementById("community-price-max").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
    const v = e.target.value.trim();
    state.communityPriceMax = v === "" ? null : Number(v);
    state.communityPage = 0;
    renderCommunityLoadoutList();
  });
  renderCommunityLoadouts();

  // 무기 스탯(피해/재장전속도 등)에 마우스를 올리면 커서 오른쪽에 설명 표시
  // (동적으로 다시 그려지는 요소라 document에 이벤트 위임)
  const statTooltip = document.getElementById("stat-tooltip");
  document.addEventListener("mousemove", (e) => {
    const row = e.target.closest(".stat-row[data-stat-key]");
    if (!row) {
      if (!statTooltip.hidden) statTooltip.hidden = true;
      return;
    }
    const desc = STAT_DESCRIPTIONS[row.dataset.statKey];
    if (!desc) {
      statTooltip.hidden = true;
      return;
    }
    statTooltip.hidden = false;
    statTooltip.innerHTML = desc.split("\n").map((line) => `<p>${line}</p>`).join("");
    const TOOLTIP_W = 280;
    const offsetRight = e.clientX + 16;
    const left = (offsetRight + TOOLTIP_W > window.innerWidth) ? (e.clientX - TOOLTIP_W - 16) : offsetRight;
    statTooltip.style.left = `${Math.max(4, left)}px`;
    statTooltip.style.top = `${e.clientY + 4}px`;
  });

  renderCategoryFilters();
  renderWeaponFilters();
  renderToolFilters();
  renderConsumableFilters();
  renderTraitFilters();
  renderItemGrid();
  renderLoadoutBoard();

  setupReportWidget();
  setupChangelogWidget();
  setupOfficeChangelogPopup();
  setupOfficeTab();
  handleSteamOpenIdCallback();
}

function setupReportWidget() {
  const fabBtn = document.getElementById("report-fab-btn");
  const overlay = document.getElementById("report-modal-overlay");
  const closeBtn = document.getElementById("report-modal-close-btn");
  const formView = document.getElementById("report-form-view");
  const textarea = document.getElementById("report-textarea");
  const charCount = document.getElementById("report-char-count");
  const submitBtn = document.getElementById("report-submit-btn");
  const msgEl = document.getElementById("report-modal-msg");
  const captchaRow = document.getElementById("report-captcha-row");
  const captchaLabel = document.getElementById("report-captcha-label");
  const captchaInput = document.getElementById("report-captcha-input");
  const historyBtn = document.getElementById("report-history-btn");
  const historyView = document.getElementById("report-history-view");
  const historyCloseBtn = document.getElementById("report-history-close-btn");
  const historyListEl = document.getElementById("report-history-list");
  const REPORT_MAX_LEN = 1000;
  let historyLoaded = false;

  // 같은 브라우저에서 10회 넘게 제보하면, 다음 문제를 풀어야 제출 가능
  // (서버가 없는 정적 사이트라 스크립트 공격까진 못 막지만, 사람이 UI로 반복 제출하는 건 막아줌)
  let captchaAnswer = null;
  const rollCaptcha = () => {
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    captchaAnswer = a + b;
    captchaLabel.textContent = `스팸 방지: ${a} + ${b} = ?`;
    captchaInput.value = "";
  };

  const openModal = () => {
    overlay.hidden = false;
    msgEl.hidden = true;
    historyView.hidden = true;
    formView.hidden = false;
    const needsCaptcha = window.LoadoutCloud?.reportNeedsCaptcha?.();
    captchaRow.hidden = !needsCaptcha;
    if (needsCaptcha) rollCaptcha();
    textarea.focus();
  };
  const closeModal = () => { overlay.hidden = true; };

  fabBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });

  textarea.addEventListener("input", () => {
    charCount.textContent = `${textarea.value.length} / ${REPORT_MAX_LEN}`;
  });

  submitBtn.addEventListener("click", async () => {
    if (!window.LoadoutCloud) {
      msgEl.textContent = "기능을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.";
      msgEl.classList.add("error");
      msgEl.hidden = false;
      return;
    }
    if (!captchaRow.hidden && Number(captchaInput.value) !== captchaAnswer) {
      msgEl.textContent = "확인 문제 답이 올바르지 않습니다.";
      msgEl.classList.add("error");
      msgEl.hidden = false;
      rollCaptcha();
      return;
    }
    submitBtn.disabled = true;
    try {
      await window.LoadoutCloud.submitReport(textarea.value, state.activeTab);
      textarea.value = "";
      charCount.textContent = `0 / ${REPORT_MAX_LEN}`;
      msgEl.textContent = "제보가 접수되었습니다. 감사합니다!";
      msgEl.classList.remove("error");
      msgEl.hidden = false;
      historyLoaded = false; // 방금 제출한 내용이 내역에 바로 반영되도록 다음에 열 때 새로 불러옴
      if (!captchaRow.hidden) rollCaptcha();
    } catch (err) {
      msgEl.textContent = err.message || "제출에 실패했습니다.";
      msgEl.classList.add("error");
      msgEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  // 운영자 모드 — 톱니 버튼으로 refresh token을 붙여넣어 저장(로그인)하거나 지움(로그아웃).
  // 저장된 토큰이 유효하면 다른 사람 제보에도 댓글/해결 표시를 남길 수 있음.
  const opModeBtn = document.getElementById("report-operator-mode-btn");
  const refreshOpModeBtn = async () => {
    const auth = await operatorAuthenticate();
    opModeBtn.classList.toggle("active", !!auth);
  };
  refreshOpModeBtn();
  opModeBtn.addEventListener("click", async () => {
    if (getOperatorRefreshToken()) {
      if (confirm("운영자 모드를 끌까요?")) {
        setOperatorRefreshToken(null);
        await refreshOpModeBtn();
        showToast("운영자 모드를 껐습니다.", "info");
      }
      return;
    }
    const token = prompt("운영자 refresh token을 붙여넣어주세요.");
    if (!token) return;
    setOperatorRefreshToken(token);
    const auth = await operatorAuthenticate();
    if (!auth) {
      setOperatorRefreshToken(null);
      showToast("토큰이 유효하지 않습니다.");
      return;
    }
    await refreshOpModeBtn();
    showToast("운영자 모드가 켜졌습니다.", "info");
    historyLoaded = false;
    if (!historyView.hidden) historyBtn.click();
  });

  // 제보내역 보기 — 문의 및 오류 제보 창은 그대로 두고 내용만 내역 화면으로 전환.
  // "돌아가기"를 누르면 전체 창을 닫는 게 아니라 제출 화면으로만 돌아옴.
  // 댓글은 해당 제보를 올린 본인과 운영자만 작성 가능(Firestore 규칙이 실제로 강제) —
  // 여기서는 그 조건에 맞는 사람에게만 입력창을 보여줌(다른 사람은 읽기만 가능).
  const renderComments = (wrap, comments, operatorUid) => {
    wrap.innerHTML = "";
    comments.forEach((c) => {
      const row = document.createElement("div");
      row.className = "reportbox-comment";

      const authorEl = document.createElement("span");
      authorEl.className = "reportbox-comment-author";
      authorEl.textContent = c.ownerId === operatorUid ? "운영자" : "제보자";

      const textEl = document.createElement("span");
      textEl.className = "reportbox-comment-text";
      textEl.textContent = c.text || "";

      row.appendChild(authorEl);
      row.appendChild(textEl);
      wrap.appendChild(row);
    });
  };

  const renderCommentSection = async (item, report, currentUid, operatorUid, operatorAuth) => {
    const section = document.createElement("div");
    section.className = "reportbox-comments";
    item.appendChild(section);

    try {
      const comments = await window.LoadoutCloud.listComments(report.id);
      renderComments(section, comments, operatorUid);
    } catch {
      // 댓글 로딩 실패는 조용히 무시(제보 본문은 이미 보임)
    }

    const canComment = !!operatorAuth || (currentUid && currentUid === report.ownerId);
    if (!canComment) return;

    const form = document.createElement("div");
    form.className = "reportbox-comment-form";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 500;
    input.placeholder = "댓글 남기기...";
    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.textContent = "등록";
    form.appendChild(input);
    form.appendChild(sendBtn);
    item.appendChild(form);

    sendBtn.addEventListener("click", async () => {
      if (!input.value.trim()) return;
      sendBtn.disabled = true;
      try {
        if (operatorAuth) await addCommentAsOperator(report.id, input.value, operatorAuth);
        else await window.LoadoutCloud.addComment(report.id, input.value);
        input.value = "";
        const comments = await window.LoadoutCloud.listComments(report.id);
        renderComments(section, comments, operatorUid);
      } catch (err) {
        showToast(err.message || "댓글 등록에 실패했습니다.");
      } finally {
        sendBtn.disabled = false;
      }
    });
  };

  const renderHistoryList = async (reports) => {
    historyListEl.innerHTML = "";
    if (reports.length === 0) {
      historyListEl.textContent = "아직 접수된 제보가 없습니다.";
      return;
    }
    const currentUid = await window.LoadoutCloud.getCurrentUid().catch(() => null);
    const operatorUid = window.LoadoutCloud.OPERATOR_UID;
    const operatorAuth = await operatorAuthenticate();

    reports.forEach((r) => {
      const item = document.createElement("div");
      item.className = "reportbox-item";

      const meta = document.createElement("div");
      meta.className = "reportbox-meta";
      const dateStr = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("ko-KR") : "";
      meta.textContent = [dateStr, r.context].filter(Boolean).join(" · ");
      if (r.resolved) {
        const badge = document.createElement("span");
        badge.className = "reportbox-resolved-badge";
        badge.textContent = "해결됨";
        meta.appendChild(badge);
      }

      // 남이 남긴 자유 텍스트라 반드시 textContent로만 그린다(XSS 방지)
      const textEl = document.createElement("div");
      textEl.className = "reportbox-text";
      textEl.textContent = r.message || "";

      item.appendChild(meta);
      item.appendChild(textEl);

      // 운영자 모드일 때만 해결/미해결 토글 버튼 노출
      if (operatorAuth) {
        const resolveBtn = document.createElement("button");
        resolveBtn.type = "button";
        resolveBtn.className = "reportbox-resolve-btn";
        resolveBtn.textContent = r.resolved ? "해결 취소" : "해결 처리";
        resolveBtn.addEventListener("click", async () => {
          resolveBtn.disabled = true;
          try {
            const next = !r.resolved;
            await setReportResolvedAsOperator(r.id, next, operatorAuth);
            r.resolved = next;
            historyLoaded = false;
            await renderHistoryList(reports);
          } catch (err) {
            showToast(err.message || "해결 표시 변경에 실패했습니다.");
            resolveBtn.disabled = false;
          }
        });
        item.appendChild(resolveBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "reportbox-resolve-btn";
        deleteBtn.textContent = "삭제";
        deleteBtn.addEventListener("click", async () => {
          if (!confirm("이 제보를 삭제할까요? 되돌릴 수 없습니다.")) return;
          deleteBtn.disabled = true;
          try {
            await deleteReportAsOperator(r.id, operatorAuth);
            historyLoaded = false;
            const reports = await window.LoadoutCloud.listReports();
            await renderHistoryList(reports);
          } catch (err) {
            showToast(err.message || "제보 삭제에 실패했습니다.");
            deleteBtn.disabled = false;
          }
        });
        item.appendChild(deleteBtn);
      }

      historyListEl.appendChild(item);
      renderCommentSection(item, r, currentUid, operatorUid, operatorAuth);
    });
  };

  historyBtn.addEventListener("click", async () => {
    formView.hidden = true;
    historyView.hidden = false;
    if (historyLoaded) return;
    historyListEl.textContent = "불러오는 중...";
    if (!window.LoadoutCloud) {
      historyListEl.textContent = "기능을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.";
      return;
    }
    try {
      const reports = await window.LoadoutCloud.listReports();
      await renderHistoryList(reports);
      historyLoaded = true;
    } catch {
      historyListEl.textContent = "제보내역을 불러오지 못했습니다.";
    }
  });

  historyCloseBtn.addEventListener("click", () => {
    historyView.hidden = true;
    formView.hidden = false;
  });
}

function setupChangelogWidget() {
  const fabBtn = document.getElementById("changelog-fab-btn");
  const overlay = document.getElementById("changelog-modal-overlay");
  const closeBtn = document.getElementById("changelog-modal-close-btn");
  const listEl = document.getElementById("changelog-list");

  listEl.innerHTML = "";
  CHANGELOG.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "changelog-item";

    const dateEl = document.createElement("span");
    dateEl.className = "changelog-date";
    dateEl.textContent = entry.date;

    const textEl = document.createElement("span");
    textEl.className = "changelog-text";
    textEl.textContent = entry.text;

    item.appendChild(dateEl);
    item.appendChild(textEl);
    listEl.appendChild(item);
  });

  const openModal = () => { overlay.hidden = false; };
  const closeModal = () => { overlay.hidden = true; };

  fabBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });
}

// 사무소 탭 전용 "새 소식" 팝업 — 전체 업데이트 내역과는 별개로, 사무소("사무소"로
// 시작하는 항목)에 새 변경사항이 생긴 뒤 사무소 탭에 처음 들어왔을 때만 한 번 자동으로
// 뜬다. 마지막으로 본 항목을 localStorage에 저장해두고, 그 이후에 추가된 사무소 항목만
// 모아서 보여준 뒤 즉시 "확인함"으로 기록한다(같은 세션에서 탭을 여러 번 왔다갔다 해도
// 다시 뜨지 않음).
const OFFICE_CHANGELOG_SEEN_KEY = "hsddb_office_changelog_seen";
function setupOfficeChangelogPopup() {
  const overlay = document.getElementById("office-changelog-modal-overlay");
  const closeBtn = document.getElementById("office-changelog-modal-close-btn");
  const closeModal = () => { overlay.hidden = true; };
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeModal();
  });
}

function maybeShowOfficeChangelogPopup() {
  const officeEntries = CHANGELOG.filter((e) => e.text.startsWith("사무소"));
  if (officeEntries.length === 0) return;
  const marker = (e) => `${e.date}|${e.text}`;
  const latestMarker = marker(officeEntries[0]);
  const lastSeen = localStorage.getItem(OFFICE_CHANGELOG_SEEN_KEY);
  if (lastSeen === latestMarker) return;
  const seenIndex = officeEntries.findIndex((e) => marker(e) === lastSeen);
  const newEntries = seenIndex === -1 ? officeEntries : officeEntries.slice(0, seenIndex);
  localStorage.setItem(OFFICE_CHANGELOG_SEEN_KEY, latestMarker);
  if (newEntries.length === 0) return;

  const listEl = document.getElementById("office-changelog-list");
  listEl.innerHTML = "";
  newEntries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "changelog-item";
    const dateEl = document.createElement("span");
    dateEl.className = "changelog-date";
    dateEl.textContent = entry.date;
    const textEl = document.createElement("span");
    textEl.className = "changelog-text";
    textEl.textContent = entry.text;
    item.appendChild(dateEl);
    item.appendChild(textEl);
    listEl.appendChild(item);
  });
  document.getElementById("office-changelog-modal-overlay").hidden = false;
}

// 사무소 탭 — 처음엔 규칙 안내 + "스팀으로 로그인" 화면, 이미 스팀 인증을 마친 uid면
// 바로 등록 완료 화면. 등록 여부 조회는 Firestore 요청이 들어가므로 사무소 탭에 처음
// 들어갈 때만 지연 로딩한다(loadOfficeMembership은 switchTab에서 호출). 스팀 로그인은
// 페이지 전체를 스팀으로 이동시켰다가 돌아오는 방식이라, 돌아온 직후엔 탭 상태가
// 초기화돼 있으므로 init()에서 별도로 콜백을 처리한다.
let officeMembershipLoaded = false;
let myPartyApplicationsUnsub = null;
let knownPendingApplicantIds = null;
// 운영자가 스팀 인증 없이 게시판을 열람만 하는 모드 — 켜져 있으면 파티/프로필 등록
// 등 쓰기 폼이 있는 왼쪽 열은 아예 숨기고, 목록은 SDK 대신 REST(운영자 토큰)로 조회한다.
let officeOperatorViewActive = false;
let officeOperatorIdToken = null;
// 신고 관리(운영자 전용) 버튼 노출 여부 — 실제 스팀 등록이 있는 회원 화면이든 운영자
// 열람 모드든 상관없이, 운영자 키가 있으면 항상 "신고 관리"를 볼 수 있어야 하므로
// showOfficeMemberView/showOfficeOperatorView 양쪽에서 공통으로 이 값을 갱신한다.
let officeReportAdminIdToken = null;

// 운영자 키가 있으면 "신고 관리" 버튼을 노출하고, 그 REST idToken을 저장해둔다.
async function refreshOfficeReportAdminAccess() {
  const opAuth = await operatorAuthenticate();
  officeReportAdminIdToken = opAuth ? opAuth.idToken : null;
  document.getElementById("office-report-admin-btn").hidden = !opAuth;
}

// 새 신청/초대 알림용 사운드 + 탭 제목 깜빡임 — 보조 모니터에 인력사무소를 띄워두고
// 게임하다가도 알아챌 수 있게 하기 위함. 외부 음원 파일 없이 Web Audio API로 짧은
// 비프음을 직접 만들어 재생한다(브라우저 자동재생 정책 때문에 실패할 수 있어 조용히
// 무시). 탭 제목은 지금 탭을 보고 있지 않을 때만 깜빡이고, 다시 보면 바로 멈춘다.
// "띠링" 두 음이 살짝 시차를 두고 이어지는 맑은 종소리 — 각 음마다 배음(2.4배)을
// 섞어 종 특유의 쨍한 울림을 내고, 짧은 어택 + 지수 감쇠로 종이 울리다 잦아드는 느낌을 준다.
function playOfficeNotifySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const notes = [
      { freq: 1760, start: 0, duration: 0.5, peak: 0.5 },     // "띠" (A6)
      { freq: 2349, start: 0.09, duration: 0.6, peak: 0.52 }, // "링" (D7)
    ];
    notes.forEach(({ freq, start, duration, peak }) => {
      [{ ratio: 1, peakMul: 1 }, { ratio: 2.4, peakMul: 0.5 }].forEach(({ ratio, peakMul }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq * ratio;
        const notePeak = peak * peakMul;
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(notePeak, now + start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    });
  } catch {
    // 오디오 컨텍스트를 못 만들거나 자동재생이 막힌 경우 조용히 무시
  }
}

const OFFICE_ORIGINAL_TITLE = document.title;
let officeTitleFlashInterval = null;
function startOfficeTitleFlash(message) {
  if (!document.hidden) return; // 지금 이 탭을 보고 있으면 깜빡일 필요 없음
  if (officeTitleFlashInterval) return;
  let flashOn = false;
  officeTitleFlashInterval = setInterval(() => {
    document.title = flashOn ? OFFICE_ORIGINAL_TITLE : message;
    flashOn = !flashOn;
  }, 1000);
}
function stopOfficeTitleFlash() {
  if (!officeTitleFlashInterval) return;
  clearInterval(officeTitleFlashInterval);
  officeTitleFlashInterval = null;
  document.title = OFFICE_ORIGINAL_TITLE;
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) stopOfficeTitleFlash();
});

// 내 파티에 들어오는 신청을 실시간 감시 — 새 신청이 오면(대기중 상태가 새로 생기면)
// 지금 어떤 탭/모드를 보고 있든 바로 토스트로 알리고 신청 목록을 새로 그린다.
function setupMyPartyApplicationsWatch() {
  if (!window.LoadoutCloud || !window.LoadoutCloud.watchMyPartyApplications) return;
  if (myPartyApplicationsUnsub) { myPartyApplicationsUnsub(); myPartyApplicationsUnsub = null; }
  knownPendingApplicantIds = null;
  myPartyApplicationsUnsub = window.LoadoutCloud.watchMyPartyApplications((applicants) => {
    const pendingIds = new Set(applicants.filter((a) => a.status === "pending").map((a) => a.applicantId));
    if (knownPendingApplicantIds !== null) {
      const newCount = [...pendingIds].filter((id) => !knownPendingApplicantIds.has(id)).length;
      if (newCount > 0) {
        showToast(`새 참가 신청이 ${newCount}건 도착했습니다.`, "info");
        renderMyParty();
        playOfficeNotifySound();
        startOfficeTitleFlash(`🔔 새 참가 신청 ${newCount}건`);
      }
    }
    knownPendingApplicantIds = pendingIds;
  });
}

// 내가 받은 초대를 실시간 감시 — setupMyPartyApplicationsWatch(파티장용)와 대칭으로,
// 다른 탭을 보고 있어도 새 초대가 오면 토스트로 바로 알리고 목록을 새로 그린다.
let myApplicationsUnsub = null;
let knownInvitedLeaderIds = null;
function setupMyApplicationsWatch() {
  if (!window.LoadoutCloud || !window.LoadoutCloud.watchMyApplications) return;
  if (myApplicationsUnsub) { myApplicationsUnsub(); myApplicationsUnsub = null; }
  knownInvitedLeaderIds = null;
  myApplicationsUnsub = window.LoadoutCloud.watchMyApplications((apps) => {
    const invitedIds = new Set(apps.filter((a) => a.status === "invited").map((a) => a.leaderId));
    if (knownInvitedLeaderIds !== null) {
      const newCount = [...invitedIds].filter((id) => !knownInvitedLeaderIds.has(id)).length;
      if (newCount > 0) {
        showToast(`새 파티 초대가 ${newCount}건 도착했습니다.`, "info");
        renderMyApplications();
        playOfficeNotifySound();
        startOfficeTitleFlash(`🔔 새 파티 초대 ${newCount}건`);
      }
    }
    knownInvitedLeaderIds = invitedIds;
  });
}

function setupOfficeTab() {
  const agreeCheckbox = document.getElementById("office-agree-checkbox");
  const registerBtn = document.getElementById("office-register-btn");

  agreeCheckbox.addEventListener("change", () => {
    registerBtn.disabled = !agreeCheckbox.checked;
  });

  registerBtn.addEventListener("click", () => {
    if (!window.LoadoutCloud || !agreeCheckbox.checked) return;
    window.location.href = window.LoadoutCloud.buildSteamLoginUrl();
  });

  // 로그인 후엔 이용규칙/권장사항/신고와 처벌 안내가 화면에서 사라지므로,
  // 언제든 다시 볼 수 있도록 별도 모달로 열어줌
  const rulesBtn = document.getElementById("office-rules-btn");
  const rulesOverlay = document.getElementById("office-rules-modal-overlay");
  const rulesCloseBtn = document.getElementById("office-rules-modal-close-btn");
  const openRulesModal = () => { rulesOverlay.hidden = false; };
  const closeRulesModal = () => { rulesOverlay.hidden = true; };
  rulesBtn.addEventListener("click", openRulesModal);
  rulesCloseBtn.addEventListener("click", closeRulesModal);
  rulesOverlay.addEventListener("click", (e) => { if (e.target === rulesOverlay) closeRulesModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !rulesOverlay.hidden) closeRulesModal();
  });

  // 신고하기 모달 — 실제 스팀 등록이 있는 회원만 버튼이 보인다(showOfficeMemberView 참고).
  const reportBtn = document.getElementById("office-report-btn");
  const reportOverlay = document.getElementById("office-report-modal-overlay");
  const reportCloseBtn = document.getElementById("office-report-modal-close-btn");
  const openReportModal = () => { reportOverlay.hidden = false; renderMyOfficeReports(); };
  const closeReportModal = () => { reportOverlay.hidden = true; };
  reportBtn.addEventListener("click", openReportModal);
  reportCloseBtn.addEventListener("click", closeReportModal);
  reportOverlay.addEventListener("click", (e) => { if (e.target === reportOverlay) closeReportModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !reportOverlay.hidden) closeReportModal();
  });
  document.getElementById("office-report-recent-btn").addEventListener("click", renderRecentPartyRecord);

  // 최근 기록에서 등록번호를 누르면 뜨는 "가입 당시 정보" 팝업 닫기 처리
  const joinInfoOverlay = document.getElementById("office-join-info-modal-overlay");
  const joinInfoCloseBtn = document.getElementById("office-join-info-modal-close-btn");
  const closeJoinInfoModal = () => { joinInfoOverlay.hidden = true; };
  joinInfoCloseBtn.addEventListener("click", closeJoinInfoModal);
  joinInfoOverlay.addEventListener("click", (e) => { if (e.target === joinInfoOverlay) closeJoinInfoModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !joinInfoOverlay.hidden) closeJoinInfoModal();
  });

  const reportMsgEl = document.getElementById("office-report-msg");
  const reportSubmitBtn = document.getElementById("office-report-submit-btn");
  reportSubmitBtn.addEventListener("click", async () => {
    if (!window.LoadoutCloud) return;
    reportMsgEl.hidden = true;
    const fileInput = document.getElementById("office-report-video-file");
    const descInput = document.getElementById("office-report-desc");
    const numberInput = document.getElementById("office-report-party-number");
    const targetInput = document.getElementById("office-report-target-number");
    const file = fileInput.files[0];
    if (!file) {
      reportMsgEl.textContent = "영상 파일을 선택해주세요.";
      reportMsgEl.classList.add("error");
      reportMsgEl.hidden = false;
      return;
    }
    const incidentPartyNumber = numberInput.value.trim();
    if (!/^\d{8}$/.test(incidentPartyNumber)) {
      reportMsgEl.textContent = "파티번호(8자리)를 정확히 입력해주세요.";
      reportMsgEl.classList.add("error");
      reportMsgEl.hidden = false;
      return;
    }
    const targetMemberNumber = targetInput.value.trim();
    if (!/^\d{9}$/.test(targetMemberNumber)) {
      reportMsgEl.textContent = "신고 대상 등록번호(9자리)를 정확히 입력해주세요.";
      reportMsgEl.classList.add("error");
      reportMsgEl.hidden = false;
      return;
    }
    reportSubmitBtn.disabled = true;
    reportSubmitBtn.textContent = "업로드 중...";
    try {
      // 운영자 열람 모드(스팀 로그인 없이 운영자 키만 있는 상태)에서는 SDK 세션이
      // 운영자가 아니라서 getMyIdToken/submitOfficeReport(SDK)를 못 쓰고, 운영자
      // REST idToken으로 대신 처리한다(신고 기능 테스트용).
      const idToken = officeOperatorViewActive ? officeReportAdminIdToken : await window.LoadoutCloud.getMyIdToken();
      const videoKey = await uploadOfficeReportVideo(file, idToken);
      if (officeOperatorViewActive) {
        await submitOfficeReportAsOperator(descInput.value, videoKey, idToken, incidentPartyNumber, targetMemberNumber);
      } else {
        await window.LoadoutCloud.submitOfficeReport({ description: descInput.value, videoUrl: videoKey, incidentPartyNumber, targetMemberNumber });
      }
      fileInput.value = "";
      descInput.value = "";
      numberInput.value = "";
      targetInput.value = "";
      reportMsgEl.textContent = officeOperatorViewActive
        ? "신고가 접수됐습니다. \"신고 관리\"에서 확인하세요."
        : "신고가 접수됐습니다.";
      reportMsgEl.classList.remove("error");
      reportMsgEl.hidden = false;
      if (!officeOperatorViewActive) renderMyOfficeReports();
    } catch (err) {
      reportMsgEl.textContent = err.message || "신고 접수에 실패했습니다.";
      reportMsgEl.classList.add("error");
      reportMsgEl.hidden = false;
    } finally {
      reportSubmitBtn.disabled = false;
      reportSubmitBtn.textContent = "신고 제출";
    }
  });

  // 신고 관리(운영자 전용) 모달 — refreshOfficeReportAdminAccess가 버튼 노출을 관리
  const reportAdminBtn = document.getElementById("office-report-admin-btn");
  const reportAdminOverlay = document.getElementById("office-report-admin-modal-overlay");
  const reportAdminCloseBtn = document.getElementById("office-report-admin-modal-close-btn");
  const openReportAdminModal = () => { reportAdminOverlay.hidden = false; renderOfficeReportAdmin(); };
  const closeReportAdminModal = () => { reportAdminOverlay.hidden = true; };
  reportAdminBtn.addEventListener("click", openReportAdminModal);
  reportAdminCloseBtn.addEventListener("click", closeReportAdminModal);
  reportAdminOverlay.addEventListener("click", (e) => { if (e.target === reportAdminOverlay) closeReportAdminModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !reportAdminOverlay.hidden) closeReportAdminModal();
  });

  // 사무소 탈퇴 — 등록해둔 스팀 ID를 스스로 지운다. 파티/프로필/신청·초대 내역까지
  // 같이 정리되므로(deleteMyOfficeMembership 참고) 되돌릴 수 없다는 걸 미리 확인시킨다.
  document.getElementById("office-withdraw-btn").addEventListener("click", async () => {
    if (!window.LoadoutCloud) return;
    if (!confirm("사무소를 탈퇴할까요? 등록된 스팀 ID와 파티/프로필, 신청·초대 내역이 모두 삭제되며 되돌릴 수 없습니다.")) return;
    try {
      await window.LoadoutCloud.deleteMyOfficeMembership();
      if (myPartyApplicationsUnsub) { myPartyApplicationsUnsub(); myPartyApplicationsUnsub = null; }
      if (myApplicationsUnsub) { myApplicationsUnsub(); myApplicationsUnsub = null; }
      if (partyListUnsub) { partyListUnsub(); partyListUnsub = null; }
      document.getElementById("office-member-view").hidden = true;
      officeMembershipLoaded = false;
      loadOfficeMembership();
      showToast("사무소 탈퇴가 완료됐습니다.", "info");
    } catch (err) {
      showToast(err.message || "탈퇴에 실패했습니다.");
    }
  });

  setupOfficePartyBoard();
}

// 차단된 계정 화면 — 영구 차단이면 그대로, 기간제 차단이면 해제 시각을 같이 보여준다.
function showOfficeBannedView(membership) {
  document.getElementById("office-banned-view").hidden = false;
  const detailEl = document.getElementById("office-banned-detail");
  if (membership.banned) {
    detailEl.textContent = "영구 차단된 계정입니다.";
  } else if (membership.bannedUntil) {
    const ms = officeTimestampMillis(membership.bannedUntil);
    detailEl.textContent = ms ? `차단 해제 예정: ${new Date(ms).toLocaleString("ko-KR")}` : "";
  } else {
    detailEl.textContent = "";
  }
}

// 인증된 회원 화면으로 전환 + 기본 모드(파티) 렌더 — loadOfficeMembership과
// handleSteamOpenIdCallback 양쪽에서 공통으로 씀
function showOfficeMemberView(steamId) {
  officeOperatorViewActive = false;
  officeOperatorIdToken = null;
  document.getElementById("office-col-write").hidden = false;
  document.getElementById("office-withdraw-btn").hidden = false;
  document.getElementById("office-report-btn").hidden = false;
  document.getElementById("office-member-status").textContent = `인증 완료 · SteamID: ${steamId}`;
  document.getElementById("office-member-view").hidden = false;
  document.querySelectorAll(".office-mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.officeMode === "party"));
  document.getElementById("office-mode-party").hidden = false;
  document.getElementById("office-mode-resume").hidden = true;
  document.getElementById("office-list-party").hidden = false;
  document.getElementById("office-list-resume").hidden = true;
  setupPartyListWatch();
  renderMyParty();
  setupMyPartyApplicationsWatch();
  setupMyApplicationsWatch();
  refreshOfficeReportAdminAccess();
}

// 운영자 열람 화면 — 스팀 인증(officeMembers 등록) 없이 파티/프로필 목록만 REST로
// 조회해서 보여준다. 왼쪽 작성 열(파티 등록, 프로필 등록 등 쓰기 폼) 자체를 통째로
// 숨겨서 파티 생성/프로필 등록을 할 수 없게 한다(규칙에서도 이중으로 막혀 있음).
function showOfficeOperatorView(opAuth) {
  officeOperatorViewActive = true;
  officeOperatorIdToken = opAuth.idToken;
  officeReportAdminIdToken = opAuth.idToken;
  document.getElementById("office-member-status").textContent = "운영자 열람 모드 (스팀 인증 없이 목록만 조회 · 신고는 운영자 계정으로 테스트 가능)";
  document.getElementById("office-member-view").hidden = false;
  document.getElementById("office-col-write").hidden = true;
  document.getElementById("office-withdraw-btn").hidden = true;
  // 신고 기능은 운영자 키만으로도 테스트할 수 있어야 해서(스팀 로그인 없이), 신고
  // 관련 두 버튼은 예외적으로 운영자 열람 모드에서도 보여준다.
  document.getElementById("office-report-btn").hidden = false;
  document.getElementById("office-report-admin-btn").hidden = false;
  document.querySelectorAll(".office-mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.officeMode === "party"));
  document.getElementById("office-list-party").hidden = false;
  document.getElementById("office-list-resume").hidden = true;
  renderOperatorPartyList();
}

async function loadOfficeMembership() {
  if (officeMembershipLoaded) return;
  const loadingEl = document.getElementById("office-loading");
  const introView = document.getElementById("office-intro-view");
  const memberView = document.getElementById("office-member-view");
  const bannedView = document.getElementById("office-banned-view");

  loadingEl.hidden = false;
  introView.hidden = true;
  memberView.hidden = true;
  bannedView.hidden = true;
  if (!window.LoadoutCloud) {
    loadingEl.textContent = "기능을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.";
    return;
  }
  try {
    const opAuth = await operatorAuthenticate();
    if (opAuth) {
      const membership = await window.LoadoutCloud.getMyOfficeMembership();
      loadingEl.hidden = true;
      if (!membership) {
        showOfficeOperatorView(opAuth);
      } else if (window.LoadoutCloud.isOfficeMembershipBanned(membership)) {
        showOfficeBannedView(membership);
      } else {
        showOfficeMemberView(membership.steamId);
      }
      officeMembershipLoaded = true;
      return;
    }
    const membership = await window.LoadoutCloud.getMyOfficeMembership();
    loadingEl.hidden = true;
    if (!membership) {
      introView.hidden = false;
    } else if (window.LoadoutCloud.isOfficeMembershipBanned(membership)) {
      showOfficeBannedView(membership);
    } else {
      showOfficeMemberView(membership.steamId);
    }
    officeMembershipLoaded = true;
  } catch {
    loadingEl.textContent = "사무소 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.";
  }
}

// 스팀 로그인 후 돌아온 직후(?steamAuth=1&openid.mode=id_res...)라면 검증 → 로그인 →
// 사무소 등록까지 이어서 처리하고, 처리 후엔 URL에서 openid 파라미터를 지운다(새로고침해도
// 같은 로그인 응답을 재검증하려 들지 않게).
async function handleSteamOpenIdCallback() {
  if (!window.LoadoutCloud) return;
  const params = window.LoadoutCloud.getSteamOpenIdParamsFromUrl();
  if (!params) return;

  history.replaceState(null, "", `${location.origin}${location.pathname}`);
  officeMembershipLoaded = true; // 아래에서 직접 상태를 채우므로 switchTab의 자동 로딩은 건너뜀
  switchTab("office");

  const loadingEl = document.getElementById("office-loading");
  const introView = document.getElementById("office-intro-view");
  const memberView = document.getElementById("office-member-view");
  const bannedView = document.getElementById("office-banned-view");
  const introMsgEl = document.getElementById("office-intro-msg");

  loadingEl.hidden = false;
  loadingEl.textContent = "스팀 로그인 확인 중...";
  introView.hidden = true;
  memberView.hidden = true;
  bannedView.hidden = true;

  try {
    const steamId = await window.LoadoutCloud.verifySteamLoginAndSignIn(params);
    const membership = await window.LoadoutCloud.ensureOfficeMembership(steamId);
    loadingEl.hidden = true;
    if (window.LoadoutCloud.isOfficeMembershipBanned(membership)) {
      showOfficeBannedView(membership);
    } else {
      showOfficeMemberView(steamId);
    }
  } catch (err) {
    loadingEl.hidden = true;
    introView.hidden = false;
    introMsgEl.textContent = err.message || "스팀 인증에 실패했습니다.";
    introMsgEl.classList.add("error");
    introMsgEl.hidden = false;
  }
}

// 사무소 파티 게시판 — 파티/인력 모드 전환(왼쪽 작성구간 + 오른쪽 목록구간이 같이 바뀜) +
// 파티 만들기/코드 저장/이력서 저장 버튼 배선. 각 모드의 실제 렌더링은 전환 시,
// 그리고 회원 화면에 처음 들어갈 때(showOfficeMemberView)도 호출된다.
function setupOfficePartyBoard() {
  document.querySelectorAll(".office-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".office-mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
      const mode = btn.dataset.officeMode;
      document.getElementById("office-mode-party").hidden = mode !== "party";
      document.getElementById("office-mode-resume").hidden = mode !== "resume";
      document.getElementById("office-list-party").hidden = mode !== "party";
      document.getElementById("office-list-resume").hidden = mode !== "resume";
      if (officeOperatorViewActive) {
        if (mode === "party") renderOperatorPartyList();
        else renderOperatorResumeList();
      } else if (mode === "party") {
        renderPartyList();
        renderMyParty();
      } else {
        renderResumeList();
        renderMyResume();
        renderMyApplications();
      }
    });
  });

  document.getElementById("office-party-refresh-btn").addEventListener("click", () => {
    officeOperatorViewActive ? renderOperatorPartyList() : renderPartyList();
  });
  document.getElementById("office-resume-refresh-btn").addEventListener("click", () => {
    officeOperatorViewActive ? renderOperatorResumeList() : renderResumeList();
  });

  const saveMsgEl = document.getElementById("office-myparty-msg");
  const codeInput = document.getElementById("office-myparty-code-input");

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
  });

  // 활동서버 체크박스 — "상관없음"은 다른 서버 선택과 배타적으로 동작(하나를 고르면
  // 나머지는 자동으로 해제)
  const partyServerAnyCb = document.getElementById("office-myparty-server-any");
  const partyServerCbs = Array.from(document.querySelectorAll(".office-myparty-server-cb"));
  partyServerAnyCb.addEventListener("change", () => {
    if (partyServerAnyCb.checked) partyServerCbs.forEach((cb) => { cb.checked = false; });
  });
  partyServerCbs.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) partyServerAnyCb.checked = false;
    });
  });
  const readMyPartyServers = () => (
    partyServerAnyCb.checked ? ["상관없음"] : partyServerCbs.filter((cb) => cb.checked).map((cb) => cb.value)
  );

  const readMyPartyForm = () => ({
    activeServers: readMyPartyServers(),
    partyMmr: document.getElementById("office-myparty-mmr").value,
    minKda: document.getElementById("office-myparty-kda").value,
    combatStyle: document.getElementById("office-myparty-style").value,
    voice: document.getElementById("office-myparty-voice").checked,
    partyType: document.getElementById("office-myparty-type").value,
    gameMode: document.getElementById("office-myparty-mode").value,
  });

  // 파티 등록/수정 — 모집 정보와 로비 코드를 한 번에 저장. 파티 유형/게임 모드/로비 코드는
  // 필수라서 안 채워져 있으면 아예 저장을 시작하지 않는다.
  document.getElementById("office-myparty-save-btn").addEventListener("click", async () => {
    if (!window.LoadoutCloud) return;
    saveMsgEl.hidden = true;
    if (!document.getElementById("office-myparty-type").value || !document.getElementById("office-myparty-mode").value) {
      saveMsgEl.textContent = "파티 유형과 게임 모드를 선택해주세요.";
      saveMsgEl.classList.add("error");
      saveMsgEl.hidden = false;
      return;
    }
    if (!/^\d{6}$/.test(codeInput.value)) {
      saveMsgEl.textContent = "로비 코드를 숫자 6자리로 입력해주세요.";
      saveMsgEl.classList.add("error");
      saveMsgEl.hidden = false;
      return;
    }
    try {
      await window.LoadoutCloud.saveMyParty(readMyPartyForm());
      await window.LoadoutCloud.setMyPartyCode(codeInput.value);
      saveMsgEl.textContent = "저장했습니다.";
      saveMsgEl.classList.remove("error");
      saveMsgEl.hidden = false;
      renderMyParty();
      renderPartyList();
    } catch (err) {
      saveMsgEl.textContent = err.message || "저장에 실패했습니다.";
      saveMsgEl.classList.add("error");
      saveMsgEl.hidden = false;
    }
  });

  document.getElementById("office-myparty-close-btn").addEventListener("click", async () => {
    try {
      await window.LoadoutCloud.setMyPartyStatus("closed");
      renderMyParty();
      renderPartyList();
    } catch (err) {
      showToast(err.message || "처리에 실패했습니다.");
    }
  });

  document.getElementById("office-myparty-reopen-btn").addEventListener("click", async () => {
    try {
      await window.LoadoutCloud.setMyPartyStatus("open");
      renderMyParty();
      renderPartyList();
    } catch (err) {
      showToast(err.message || "처리에 실패했습니다.");
    }
  });

  document.getElementById("office-myparty-delete-btn").addEventListener("click", async () => {
    if (!confirm("파티를 해산할까요? 받은 신청과 로비 코드도 모두 삭제됩니다.")) return;
    try {
      await window.LoadoutCloud.deleteMyParty();
      renderMyParty();
      renderPartyList();
    } catch (err) {
      showToast(err.message || "파티 해산에 실패했습니다.");
    }
  });

  document.getElementById("office-myparty-renew-btn").addEventListener("click", async () => {
    try {
      await window.LoadoutCloud.renewMyParty();
      showToast("타이머를 리셋했습니다.", "info");
      renderMyParty();
      renderPartyList();
    } catch (err) {
      showToast(err.message || "처리에 실패했습니다.");
    }
  });

  // 선호 서버 체크박스 — "상관없음"은 다른 서버 선택과 배타적으로 동작(하나를 고르면
  // 나머지는 자동으로 해제)
  const resumeServerAnyCb = document.getElementById("office-myresume-server-any");
  const resumeServerCbs = Array.from(document.querySelectorAll(".office-myresume-server-cb"));
  resumeServerAnyCb.addEventListener("change", () => {
    if (resumeServerAnyCb.checked) resumeServerCbs.forEach((cb) => { cb.checked = false; });
  });
  resumeServerCbs.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) resumeServerAnyCb.checked = false;
    });
  });
  const readMyResumeServers = () => (
    resumeServerAnyCb.checked ? ["상관없음"] : resumeServerCbs.filter((cb) => cb.checked).map((cb) => cb.value)
  );

  const resumeMsgEl = document.getElementById("office-myresume-msg");
  document.getElementById("office-myresume-save-btn").addEventListener("click", async () => {
    if (!window.LoadoutCloud) return;
    resumeMsgEl.hidden = true;
    try {
      await window.LoadoutCloud.saveMyResume({
        preferredServers: readMyResumeServers(),
        mmr: document.getElementById("office-myresume-mmr").value,
        kda: document.getElementById("office-myresume-kda").value,
        preferredStyle: document.getElementById("office-myresume-style").value,
        voice: document.getElementById("office-myresume-voice").checked,
        preferredPartyType: document.getElementById("office-myresume-type").value,
        preferredGameMode: document.getElementById("office-myresume-mode").value,
      });
      resumeMsgEl.textContent = "저장했습니다.";
      resumeMsgEl.classList.remove("error");
      resumeMsgEl.hidden = false;
      renderMyResume();
      renderResumeList();
    } catch (err) {
      resumeMsgEl.textContent = err.message || "저장에 실패했습니다.";
      resumeMsgEl.classList.add("error");
      resumeMsgEl.hidden = false;
    }
  });

  document.getElementById("office-myresume-delete-btn").addEventListener("click", async () => {
    if (!confirm("프로필을 삭제할까요?")) return;
    try {
      await window.LoadoutCloud.deleteMyResume();
      renderMyResume();
      renderResumeList();
    } catch (err) {
      showToast(err.message || "프로필 삭제에 실패했습니다.");
    }
  });

  document.getElementById("office-myresume-renew-btn").addEventListener("click", async () => {
    try {
      await window.LoadoutCloud.renewMyResume();
      showToast("타이머를 리셋했습니다.", "info");
      renderMyResume();
      renderResumeList();
    } catch (err) {
      showToast(err.message || "처리에 실패했습니다.");
    }
  });
}

function formatPartyFields(p) {
  return [
    p.partyNumber ? `파티번호: ${p.partyNumber}` : null,
    p.partyType ? `유형: ${p.partyType}` : null,
    p.gameMode ? `모드: ${p.gameMode}` : null,
    `서버: ${(p.activeServers || []).join(", ")}`,
    `파티 MMR: ${p.partyMmr}`,
    p.minKda ? `최소 KDA: ${p.minKda}` : null,
    p.combatStyle ? `전투 성향: ${p.combatStyle}` : null,
    `음성: ${p.voice ? "사용" : "미사용"}`,
  ].filter(Boolean).join(" · ");
}

function formatResumeFields(r) {
  return [
    r.resumeNumber ? `등록번호: ${r.resumeNumber}` : null,
    r.preferredPartyType ? `선호 인원: ${r.preferredPartyType}` : null,
    r.preferredGameMode ? `선호 모드: ${r.preferredGameMode}` : null,
    r.preferredServers && r.preferredServers.length ? `선호 서버: ${r.preferredServers.join(", ")}` : null,
    r.mmr ? `MMR: ${r.mmr}` : null,
    r.kda ? `KDA: ${r.kda}` : null,
    r.preferredStyle ? `선호 성향: ${r.preferredStyle}` : null,
    `음성: ${r.voice ? "사용" : "미사용"}`,
  ].filter(Boolean).join(" · ");
}

function partyMaxSize(partyType) {
  return partyType === "트리오" ? 3 : 2;
}

// 모집중이고 아직 인원이 안 찼으면 🟢, 인원이 다 찼거나 모집을 마감했으면 🔴
function partyStatusDot(party) {
  const isFull = 1 + (party.acceptedCount || 0) >= partyMaxSize(party.partyType);
  const isOpen = party.status === "open";
  return isOpen && !isFull ? "🟢" : "🔴";
}

// 파티/프로필 모두 등록(또는 마지막 갱신) 후 3시간이 지나면 만료 처리 — 목록에서는
// 안 보이게 하고, 본인 관리 화면에는 "타이머 리셋" 버튼으로 다시 살릴 수 있게 안내한다.
const OFFICE_EXPIRY_MS = 3 * 60 * 60 * 1000;
function officeTimestampMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return null;
}
function isOfficeEntryExpired(ts) {
  const ms = officeTimestampMillis(ts);
  if (ms == null) return false;
  return Date.now() - ms > OFFICE_EXPIRY_MS;
}

// 만료(목록 숨김)까지 남은 시간을 "N시간 M분 후 목록에서 자동 숨김" 형태로 — 이미 만료됐거나
// 타임스탬프가 없으면 null(표시 안 함, 만료 후엔 office-my*-expired-msg가 대신 안내함).
function formatOfficeRemainingTime(ts, windowMs = OFFICE_EXPIRY_MS, suffix = "목록에서 자동 숨김") {
  const ms = officeTimestampMillis(ts);
  if (ms == null) return null;
  const remaining = windowMs - (Date.now() - ms);
  if (remaining <= 0) return null;
  const totalMinutes = Math.ceil(remaining / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const timeText = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  return `${timeText} 후 ${suffix}`;
}

// 파티 목록 — 모집 중인 파티를 전부 보여준다(내 파티도 포함, "내 파티" 표시만 붙임).
// 신청자의 uid는 화면 어디에도 노출하지 않는다(메시지 내용만 보여줌).
// 목록 DOM을 실제로 그리는 부분 — 한 번 불러온 값을 그릴 때(renderPartyList)와
// 실시간 구독이 새 값을 줄 때(setupPartyListWatch) 둘 다 이 함수를 공유해서 쓴다.
function renderPartyListItems(parties, myUid, hasResume) {
  const listEl = document.getElementById("office-party-list");
  const activeParties = parties.filter((p) => !isOfficeEntryExpired(p.renewedAt || p.createdAt));
  listEl.innerHTML = "";
  if (activeParties.length === 0) {
    listEl.textContent = "현재 등록된 파티가 없습니다.";
    return;
  }
  activeParties.forEach((party) => {
    const isMine = party.leaderId === myUid;
    const isClosed = party.status !== "open";
    const item = document.createElement("div");
    item.className = "office-party-item";

    const descEl = document.createElement("p");
    descEl.className = "office-party-desc";
    descEl.textContent = (isMine ? "[내 파티] " : "") + (isClosed ? "[모집 마감] " : "") + formatPartyFields(party);
    item.appendChild(descEl);

    const headcountEl = document.createElement("p");
    headcountEl.className = "office-headcount-badge";
    headcountEl.textContent = `${partyStatusDot(party)} 인원: ${1 + (party.acceptedCount || 0)}/${partyMaxSize(party.partyType)}명`;
    item.appendChild(headcountEl);


    if (!isMine && isClosed) {
      const closedMsg = document.createElement("p");
      closedMsg.className = "office-blocked-msg";
      closedMsg.textContent = "모집이 마감된 파티입니다.";
      item.appendChild(closedMsg);
    } else if (!isMine && !hasResume) {
      const noResumeMsg = document.createElement("p");
      noResumeMsg.className = "office-blocked-msg";
      noResumeMsg.textContent = "프로필을 먼저 등록해야 참가 신청을 할 수 있습니다.";
      item.appendChild(noResumeMsg);
    } else if (!isMine) {
      const applyRow = document.createElement("div");
      applyRow.className = "office-party-apply-row";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 200;
      input.placeholder = "간단한 메시지(선택)";
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "office-btn office-btn-primary";
      applyBtn.textContent = "참가 신청";
      applyRow.appendChild(input);
      applyRow.appendChild(applyBtn);
      item.appendChild(applyRow);

      applyBtn.addEventListener("click", async () => {
        applyBtn.disabled = true;
        try {
          await window.LoadoutCloud.applyToParty(party.leaderId, input.value);
          applyBtn.textContent = "신청 완료";
          input.disabled = true;
        } catch (err) {
          showToast(err.message || "신청에 실패했습니다.");
          applyBtn.disabled = false;
        }
      });
    }

    listEl.appendChild(item);
  });
}

async function renderPartyList() {
  const listEl = document.getElementById("office-party-list");
  if (!window.LoadoutCloud) return;
  listEl.textContent = "불러오는 중...";
  try {
    const [parties, myUid, myResume] = await Promise.all([
      window.LoadoutCloud.listAllParties(),
      window.LoadoutCloud.getCurrentUid(),
      window.LoadoutCloud.getMyResume().catch(() => null),
    ]);
    renderPartyListItems(parties, myUid, !!myResume);
  } catch {
    listEl.textContent = "파티 목록을 불러오지 못했습니다.";
  }
}

// 구인방 목록을 실시간(Firestore 구독)으로 유지 — 보조 모니터에 띄워놓고 게임하다가도
// 다른 사람이 파티를 새로 만들거나 상태를 바꾸면 새로고침 버튼 없이 바로 반영된다.
// 신청 메시지를 입력하던 중에 갑자기 목록이 다시 그려져 입력값이 날아가지 않도록,
// 지금 목록 안의 뭔가에 포커스가 가 있으면(메시지 입력 중 등) 이번 업데이트는
// 건너뛴다 — 포커스를 벗어나면 다음 업데이트 때 자연스럽게 최신 상태로 맞춰진다.
let partyListUnsub = null;
function setupPartyListWatch() {
  if (!window.LoadoutCloud || !window.LoadoutCloud.watchAllParties) {
    renderPartyList();
    return;
  }
  if (partyListUnsub) { partyListUnsub(); partyListUnsub = null; }
  Promise.all([
    window.LoadoutCloud.getCurrentUid(),
    window.LoadoutCloud.getMyResume().catch(() => null),
  ]).then(([myUid, myResume]) => {
    const hasResume = !!myResume;
    partyListUnsub = window.LoadoutCloud.watchAllParties((parties) => {
      const listEl = document.getElementById("office-party-list");
      if (listEl.contains(document.activeElement)) return;
      renderPartyListItems(parties, myUid, hasResume);
    });
  });
}

// 파티 목록(운영자 열람 전용) — 읽기 전용, 참가 신청 등 쓰기 관련 UI는 아예 만들지 않는다.
async function renderOperatorPartyList() {
  const listEl = document.getElementById("office-party-list");
  listEl.textContent = "불러오는 중...";
  try {
    const parties = await listOfficePartiesAsOperator(officeOperatorIdToken);
    const activeParties = parties.filter((p) => !isOfficeEntryExpired(p.renewedAt || p.createdAt));
    listEl.innerHTML = "";
    if (activeParties.length === 0) {
      listEl.textContent = "현재 등록된 파티가 없습니다.";
      return;
    }
    activeParties.forEach((party) => {
      const isClosed = party.status !== "open";
      const item = document.createElement("div");
      item.className = "office-party-item";

      const descEl = document.createElement("p");
      descEl.className = "office-party-desc";
      descEl.textContent = (isClosed ? "[모집 마감] " : "") + formatPartyFields(party);
      item.appendChild(descEl);

      const headcountEl = document.createElement("p");
      headcountEl.className = "office-headcount-badge";
      headcountEl.textContent = `${partyStatusDot(party)} 인원: ${1 + (party.acceptedCount || 0)}/${partyMaxSize(party.partyType)}명`;
      item.appendChild(headcountEl);

      listEl.appendChild(item);
    });
  } catch (err) {
    listEl.textContent = err.message || "파티 목록을 불러오지 못했습니다.";
  }
}

// 내 파티 — 모집 정보/상태 + 받은 신청 목록. 지원자는 uid 없이 이력서(있으면)+메시지만 보여줌.
async function renderMyParty() {
  if (!window.LoadoutCloud) return;
  const mmrInput = document.getElementById("office-myparty-mmr");
  const kdaInput = document.getElementById("office-myparty-kda");
  const styleInput = document.getElementById("office-myparty-style");
  const voiceInput = document.getElementById("office-myparty-voice");
  const closeBtn = document.getElementById("office-myparty-close-btn");
  const reopenBtn = document.getElementById("office-myparty-reopen-btn");
  const deleteBtn = document.getElementById("office-myparty-delete-btn");
  const renewBtn = document.getElementById("office-myparty-renew-btn");
  const expiredMsgEl = document.getElementById("office-myparty-expired-msg");
  const applicantListEl = document.getElementById("office-applicant-list");
  const headcountEl = document.getElementById("office-myparty-headcount");
  const timerEl = document.getElementById("office-myparty-timer");

  headcountEl.hidden = true;
  headcountEl.textContent = "";
  expiredMsgEl.hidden = true;
  timerEl.hidden = true;
  timerEl.textContent = "";
  let party = null;
  try {
    party = await window.LoadoutCloud.getMyParty();
    closeBtn.hidden = !party || party.status !== "open";
    reopenBtn.hidden = !party || party.status !== "closed";
    deleteBtn.hidden = !party;
    renewBtn.hidden = !party;
    if (party) {
      const lastActive = party.renewedAt || party.createdAt;
      expiredMsgEl.hidden = !isOfficeEntryExpired(lastActive);
      const remainingText = formatOfficeRemainingTime(lastActive);
      timerEl.textContent = remainingText || "";
      timerEl.hidden = !remainingText;
      document.getElementById("office-myparty-type").value = party.partyType || "";
      document.getElementById("office-myparty-mode").value = party.gameMode || "";
      const activeServers = party.activeServers || [];
      document.getElementById("office-myparty-server-any").checked = activeServers.includes("상관없음");
      document.querySelectorAll(".office-myparty-server-cb").forEach((cb) => { cb.checked = activeServers.includes(cb.value); });
      mmrInput.value = party.partyMmr || "";
      kdaInput.value = party.minKda || "";
      styleInput.value = party.combatStyle || "";
      voiceInput.checked = !!party.voice;
      const code = await window.LoadoutCloud.getPartyCode(party.leaderId).catch(() => null);
      document.getElementById("office-myparty-code-input").value = code || "";
      headcountEl.textContent = `${partyStatusDot(party)} 현재 인원: ${1 + (party.acceptedCount || 0)}/${partyMaxSize(party.partyType)}명 · 파티번호: ${party.partyNumber}`;
      headcountEl.hidden = false;
    }
  } catch {
    // 조회 실패해도 새로 만들기 폼은 그대로 씀
  }

  const membersListEl = document.getElementById("office-party-members-list");
  const sentInvitesListEl = document.getElementById("office-sent-invites-list");
  membersListEl.textContent = "불러오는 중...";
  applicantListEl.textContent = "불러오는 중...";
  sentInvitesListEl.textContent = "불러오는 중...";
  try {
    const applicants = await window.LoadoutCloud.listApplicationsForMyParty();
    const members = applicants.filter((a) => a.status === "accepted");
    const sentInvites = applicants.filter((a) => a.status === "invited");
    const others = applicants.filter((a) => a.status !== "accepted" && a.status !== "invited");

    membersListEl.innerHTML = "";
    if (party) {
      const selfItem = document.createElement("div");
      selfItem.className = "office-applicant-item";
      const selfInfoWrap = document.createElement("div");
      selfInfoWrap.className = "office-applicant-info";
      const selfResumeEl = document.createElement("p");
      selfResumeEl.className = "office-applicant-resume";
      selfResumeEl.textContent = "내 프로필 불러오는 중...";
      selfInfoWrap.appendChild(selfResumeEl);
      window.LoadoutCloud.getMyResume().then((resume) => {
        selfResumeEl.textContent = `${resume ? formatResumeFields(resume) : "등록번호 정보 없음"} · 본인(파티장)`;
      }).catch(() => {
        selfResumeEl.textContent = "내 프로필 정보를 불러오지 못했습니다.";
      });
      selfItem.appendChild(selfInfoWrap);
      membersListEl.appendChild(selfItem);
    }
    if (members.length === 0) {
      if (!party) membersListEl.textContent = "아직 파티원이 없습니다.";
    } else {
      for (const m of members) {
        const item = document.createElement("div");
        item.className = "office-applicant-item";

        const infoWrap = document.createElement("div");
        infoWrap.className = "office-applicant-info";
        const resumeEl = document.createElement("p");
        resumeEl.className = "office-applicant-resume";
        resumeEl.textContent = "프로필 불러오는 중...";
        infoWrap.appendChild(resumeEl);
        window.LoadoutCloud.getApplicantResume(m.applicantId).then((resume) => {
          resumeEl.textContent = resume ? formatResumeFields(resume) : "프로필을 작성하지 않은 파티원입니다.";
        });
        item.appendChild(infoWrap);

        const actionsEl = document.createElement("div");
        actionsEl.className = "office-applicant-actions";
        const kickBtn = document.createElement("button");
        kickBtn.type = "button";
        kickBtn.className = "office-btn office-btn-outline";
        kickBtn.textContent = "내보내기";
        kickBtn.addEventListener("click", async () => {
          if (!confirm("이 파티원을 내보낼까요?")) return;
          try {
            await window.LoadoutCloud.kickApplicant(m.applicantId);
            renderMyParty();
            renderPartyList();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        actionsEl.appendChild(kickBtn);
        item.appendChild(actionsEl);

        membersListEl.appendChild(item);
      }
    }

    applicantListEl.innerHTML = "";
    if (others.length === 0) {
      applicantListEl.textContent = "받은 신청이 없습니다.";
    }
    for (const a of others) {
      const item = document.createElement("div");
      item.className = "office-applicant-item";

      const infoWrap = document.createElement("div");
      infoWrap.className = "office-applicant-info";

      const resumeEl = document.createElement("p");
      resumeEl.className = "office-applicant-resume";
      resumeEl.textContent = "프로필 불러오는 중...";
      infoWrap.appendChild(resumeEl);
      window.LoadoutCloud.getApplicantResume(a.applicantId).then((resume) => {
        resumeEl.textContent = resume ? formatResumeFields(resume) : "프로필을 작성하지 않은 신청자입니다.";
      });

      if (a.message) {
        const msgEl = document.createElement("p");
        msgEl.className = "office-applicant-msg";
        msgEl.textContent = a.message;
        infoWrap.appendChild(msgEl);
      }
      item.appendChild(infoWrap);

      if (a.status === "pending") {
        const actionsEl = document.createElement("div");
        actionsEl.className = "office-applicant-actions";
        const acceptBtn = document.createElement("button");
        acceptBtn.type = "button";
        acceptBtn.className = "office-btn office-btn-primary";
        acceptBtn.textContent = "수락";
        acceptBtn.addEventListener("click", async () => {
          try {
            await window.LoadoutCloud.respondToApplication(a.applicantId, true);
            renderMyParty();
            renderPartyList();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        const declineBtn = document.createElement("button");
        declineBtn.type = "button";
        declineBtn.className = "office-btn office-btn-outline";
        declineBtn.textContent = "거절";
        declineBtn.addEventListener("click", async () => {
          try {
            await window.LoadoutCloud.respondToApplication(a.applicantId, false);
            renderMyParty();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        actionsEl.appendChild(acceptBtn);
        actionsEl.appendChild(declineBtn);
        item.appendChild(actionsEl);
      } else {
        const statusEl = document.createElement("span");
        statusEl.className = "office-applicant-status";
        statusEl.textContent = a.status === "declined" ? "거절됨" : "내보냄";
        item.appendChild(statusEl);
      }

      applicantListEl.appendChild(item);
    }

    sentInvitesListEl.innerHTML = "";
    if (sentInvites.length === 0) {
      sentInvitesListEl.textContent = "보낸 초대가 없습니다.";
    } else {
      for (const inv of sentInvites) {
        const item = document.createElement("div");
        item.className = "office-applicant-item";

        const infoWrap = document.createElement("div");
        infoWrap.className = "office-applicant-info";
        const resumeEl = document.createElement("p");
        resumeEl.className = "office-applicant-resume";
        resumeEl.textContent = "프로필 불러오는 중...";
        infoWrap.appendChild(resumeEl);
        window.LoadoutCloud.getApplicantResume(inv.applicantId).then((resume) => {
          resumeEl.textContent = resume ? formatResumeFields(resume) : "프로필을 작성하지 않은 상대입니다.";
        });
        item.appendChild(infoWrap);

        const actionsEl = document.createElement("div");
        actionsEl.className = "office-applicant-actions";
        const statusEl = document.createElement("span");
        statusEl.className = "office-applicant-status";
        statusEl.textContent = "수락 대기중";
        actionsEl.appendChild(statusEl);
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "office-btn office-btn-outline";
        cancelBtn.textContent = "초대 취소";
        cancelBtn.addEventListener("click", async () => {
          if (!confirm("보낸 초대를 취소할까요?")) return;
          try {
            await window.LoadoutCloud.cancelInvite(inv.applicantId);
            renderMyParty();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        actionsEl.appendChild(cancelBtn);
        item.appendChild(actionsEl);

        sentInvitesListEl.appendChild(item);
      }
    }
  } catch {
    membersListEl.textContent = "파티원 목록을 불러오지 못했습니다.";
    applicantListEl.textContent = "신청 목록을 불러오지 못했습니다.";
    sentInvitesListEl.textContent = "보낸 초대 목록을 불러오지 못했습니다.";
  }
}

// 내 이력서 — 저장하면 오른쪽 "인력 목록"에 신원 정보 없이 공개됨.
// 파티를 등록한 상태면 이력서 작성 자체를 막는다(폼 비활성화 + 안내 문구).
async function renderMyResume() {
  if (!window.LoadoutCloud) return;
  const blockedMsgEl = document.getElementById("office-myresume-blocked-msg");
  const formEl = document.querySelector("#office-mode-resume .office-field-form");
  const saveBtn = document.getElementById("office-myresume-save-btn");
  const deleteBtn = document.getElementById("office-myresume-delete-btn");
  const renewBtn = document.getElementById("office-myresume-renew-btn");
  const expiredMsgEl = document.getElementById("office-myresume-expired-msg");
  const timerEl = document.getElementById("office-myresume-timer");

  expiredMsgEl.hidden = true;
  timerEl.hidden = true;
  timerEl.textContent = "";
  try {
    const party = await window.LoadoutCloud.getMyParty();
    const blocked = !!party;
    blockedMsgEl.hidden = !blocked;
    formEl.querySelectorAll("input, select").forEach((el) => { el.disabled = blocked; });
    saveBtn.disabled = blocked;
    if (blocked) {
      deleteBtn.hidden = true;
      renewBtn.hidden = true;
      return;
    }
  } catch {
    // 파티 조회 실패해도 이력서 폼은 그대로 씀
  }

  try {
    const resume = await window.LoadoutCloud.getMyResume();
    deleteBtn.hidden = !resume;
    renewBtn.hidden = !resume;
    if (!resume) return;
    expiredMsgEl.hidden = !isOfficeEntryExpired(resume.updatedAt);
    const remainingText = formatOfficeRemainingTime(resume.updatedAt);
    timerEl.textContent = remainingText || "";
    timerEl.hidden = !remainingText;
    document.getElementById("office-myresume-type").value = resume.preferredPartyType || "";
    document.getElementById("office-myresume-mode").value = resume.preferredGameMode || "";
    const servers = resume.preferredServers || [];
    document.getElementById("office-myresume-server-any").checked = servers.includes("상관없음");
    document.querySelectorAll(".office-myresume-server-cb").forEach((cb) => { cb.checked = servers.includes(cb.value); });
    document.getElementById("office-myresume-mmr").value = resume.mmr || "";
    document.getElementById("office-myresume-kda").value = resume.kda || "";
    document.getElementById("office-myresume-style").value = resume.preferredStyle || "";
    document.getElementById("office-myresume-voice").checked = !!resume.voice;
  } catch {
    // 조회 실패해도 새로 작성하는 폼은 그대로 씀
  }
}

// 프로필 목록 — 등록된 이력서 전체를 신원 정보 없이 쭉 보여줌 + 인원수 표시.
// 내가 파티장(활성 파티 있음)이면 각 프로필 옆에 "초대" 버튼이 붙는다 — steamId는
// 초대 대상 지정 용도로만 쓰고 화면 텍스트로는 절대 보여주지 않는다(블라인드 유지).
async function renderResumeList() {
  const listEl = document.getElementById("office-resume-list");
  const countEl = document.getElementById("office-resume-count");
  if (!window.LoadoutCloud) return;
  listEl.textContent = "불러오는 중...";
  try {
    const [resumes, myParty, allParties] = await Promise.all([
      window.LoadoutCloud.listAllResumes(),
      window.LoadoutCloud.getMyParty().catch(() => null),
      window.LoadoutCloud.listAllParties().catch(() => []),
    ]);
    // 파티장은 이제 등록번호(파티원 식별용)를 받으려고 이력서를 계속 갖고 있지만,
    // "인력 목록"엔 계속 안 보여야 한다(파티장이지 구직자가 아니므로) — 현재 파티장
    // 목록과 대조해서 걸러낸다.
    const currentLeaderIds = new Set(allParties.map((p) => p.leaderId));
    const activeResumes = resumes.filter((r) => !isOfficeEntryExpired(r.updatedAt) && !currentLeaderIds.has(r.steamId));
    countEl.textContent = `(${activeResumes.length}명)`;
    listEl.innerHTML = "";
    if (activeResumes.length === 0) {
      listEl.textContent = "등록된 프로필이 없습니다.";
      return;
    }
    activeResumes.forEach((resume) => {
      const item = document.createElement("div");
      item.className = "office-resume-item";

      const textEl = document.createElement("p");
      textEl.className = "office-resume-item-text";
      textEl.textContent = formatResumeFields(resume);
      item.appendChild(textEl);

      if (myParty) {
        const inviteRow = document.createElement("div");
        inviteRow.className = "office-party-apply-row";
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 200;
        input.placeholder = "초대 메시지(선택)";
        const inviteBtn = document.createElement("button");
        inviteBtn.type = "button";
        inviteBtn.className = "office-btn office-btn-primary";
        inviteBtn.textContent = "초대";
        inviteRow.appendChild(input);
        inviteRow.appendChild(inviteBtn);
        item.appendChild(inviteRow);

        inviteBtn.addEventListener("click", async () => {
          inviteBtn.disabled = true;
          try {
            await window.LoadoutCloud.inviteToParty(resume.steamId, input.value);
            inviteBtn.textContent = "초대 완료";
            input.disabled = true;
          } catch (err) {
            showToast(err.message || "초대에 실패했습니다.");
            inviteBtn.disabled = false;
          }
        });
      }

      listEl.appendChild(item);
    });
  } catch {
    countEl.textContent = "";
    listEl.textContent = "인력 목록을 불러오지 못했습니다.";
  }
}

// 프로필 목록(운영자 열람 전용) — 읽기 전용, 초대 등 쓰기 관련 UI는 아예 만들지 않는다.
async function renderOperatorResumeList() {
  const listEl = document.getElementById("office-resume-list");
  const countEl = document.getElementById("office-resume-count");
  listEl.textContent = "불러오는 중...";
  try {
    const [resumes, parties] = await Promise.all([
      listOfficeResumesAsOperator(officeOperatorIdToken),
      listOfficePartiesAsOperator(officeOperatorIdToken),
    ]);
    const currentLeaderIds = new Set(parties.map((p) => p.leaderId));
    const activeResumes = resumes.filter((r) => !isOfficeEntryExpired(r.updatedAt) && !currentLeaderIds.has(r.steamId));
    countEl.textContent = `(${activeResumes.length}명)`;
    listEl.innerHTML = "";
    if (activeResumes.length === 0) {
      listEl.textContent = "등록된 프로필이 없습니다.";
      return;
    }
    activeResumes.forEach((resume) => {
      const item = document.createElement("div");
      item.className = "office-resume-item";

      const textEl = document.createElement("p");
      textEl.className = "office-resume-item-text";
      textEl.textContent = formatResumeFields(resume);
      item.appendChild(textEl);

      listEl.appendChild(item);
    });
  } catch (err) {
    countEl.textContent = "";
    listEl.textContent = err.message || "인력 목록을 불러오지 못했습니다.";
  }
}

// 최근 기록의 등록번호를 누르면 그 사람이 이 파티에 가입할 당시의 프로필 정보
// (가입 시점 스냅샷, officePartyRoster에 같이 저장됨)를 팝업으로 보여준다 —
// 실명은 아니지만 "어떤 정보로 가입했었는지"를 봐서 누군지 기억을 돕는 용도.
// 이 기능 이전에 만들어진 로스터 항목은 스냅샷이 없어 안내 문구만 뜬다.
function openOfficeJoinInfoModal(resumeSnapshot) {
  const overlay = document.getElementById("office-join-info-modal-overlay");
  const body = document.getElementById("office-join-info-modal-body");
  body.textContent = resumeSnapshot ? formatResumeFields(resumeSnapshot) : "가입 당시 정보가 없습니다.";
  overlay.hidden = false;
}

// "최근 기록" — 내가 참여했던 파티들의 파티번호와, 그때 같이 있었던 사람들의 등록번호
// (가명, 실명 아님)를 보여준다. 신고 폼에 뭘 적어야 할지 기억이 안 날 때 참고용.
async function renderRecentPartyRecord() {
  const wrap = document.getElementById("office-report-recent-list");
  if (!window.LoadoutCloud) return;
  wrap.hidden = false;
  wrap.textContent = "불러오는 중...";
  try {
    const myHistory = await window.LoadoutCloud.listMyPartyHistory();
    myHistory.sort((a, b) => (officeTimestampMillis(b.joinedAt) || 0) - (officeTimestampMillis(a.joinedAt) || 0));
    if (myHistory.length === 0) {
      wrap.textContent = "참여했던 파티 기록이 없습니다.";
      return;
    }
    wrap.innerHTML = "";
    for (const h of myHistory) {
      const box = document.createElement("div");
      box.className = "office-applicant-item";
      const title = document.createElement("p");
      title.className = "office-applicant-msg";
      title.textContent = `파티번호 · ${h.partyNumber}`;
      box.appendChild(title);
      const roster = await window.LoadoutCloud.getPartyRoster(h.partyNumber).catch(() => null);
      const list = document.createElement("ul");
      const members = roster?.members || [];
      let othersSeen = 0;
      members.forEach((m) => {
        const li = document.createElement("li");
        const isMe = m.memberNumber === h.memberNumberAtJoin;
        const roleText = m.role === "leader" ? "파티장" : "파티원";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "office-report-btn-quiet";
        if (isMe) {
          btn.textContent = `${m.memberNumber} — ${roleText}(본인)`;
        } else {
          othersSeen += 1;
          btn.textContent = `${m.memberNumber} — ${roleText}${othersSeen}`;
        }
        btn.addEventListener("click", () => openOfficeJoinInfoModal(m.resumeSnapshot));
        li.appendChild(btn);
        list.appendChild(li);
      });
      box.appendChild(list);
      wrap.appendChild(box);
    }
  } catch {
    wrap.textContent = "최근 기록을 불러오지 못했습니다.";
  }
}

// 내 신고 내역 — 신고하기 모달 안에서 제출 폼 밑에 같이 보여줌(제출한 사람 본인만 조회 가능)

async function renderMyOfficeReports() {
  const listEl = document.getElementById("office-report-mylist");
  if (!window.LoadoutCloud) return;
  listEl.textContent = "불러오는 중...";
  try {
    const reports = await window.LoadoutCloud.listMyOfficeReports();
    reports.sort((a, b) => (officeTimestampMillis(b.createdAt) || 0) - (officeTimestampMillis(a.createdAt) || 0));
    listEl.innerHTML = "";
    if (reports.length === 0) {
      listEl.textContent = "제출한 신고가 없습니다.";
      return;
    }
    reports.forEach((r) => {
      const item = document.createElement("div");
      item.className = "office-applicant-item";

      const infoWrap = document.createElement("div");
      infoWrap.className = "office-applicant-info";
      infoWrap.appendChild(createOfficeReportVideoButton(r.videoUrl, () => window.LoadoutCloud.getMyIdToken()));
      if (r.description) {
        const descEl = document.createElement("p");
        descEl.className = "office-applicant-msg";
        descEl.textContent = r.description;
        infoWrap.appendChild(descEl);
      }
      item.appendChild(infoWrap);

      const statusEl = document.createElement("span");
      statusEl.className = "office-applicant-status";
      statusEl.textContent = r.resolved ? "처리됨" : "처리 대기중";
      item.appendChild(statusEl);

      listEl.appendChild(item);
    });
  } catch {
    listEl.textContent = "신고 내역을 불러오지 못했습니다.";
  }
}

// 신고 관리(운영자 전용) — 전체 신고 조회 + 처리됨/보류 토글 + 삭제. 열 때마다 1주일
// 지났고 보류 아닌 신고는 자동으로 정리한다(서버 스케줄이 없어 "열 때마다"가 최선).
async function renderOfficeReportAdmin() {
  const listEl = document.getElementById("office-report-admin-list");
  const idToken = officeReportAdminIdToken;
  if (!idToken) {
    listEl.textContent = "운영자 권한이 필요합니다.";
    return;
  }
  listEl.textContent = "불러오는 중...";
  try {
    let reports = await listOfficeReportsAsOperator(idToken);
    const deletedIds = await cleanupExpiredOfficeReports(reports, idToken);
    if (deletedIds.length > 0) reports = reports.filter((r) => !deletedIds.includes(r.id));
    reports.sort((a, b) => (officeTimestampMillis(b.createdAt) || 0) - (officeTimestampMillis(a.createdAt) || 0));
    listEl.innerHTML = "";
    if (reports.length === 0) {
      listEl.textContent = "등록된 신고가 없습니다.";
    } else {
      reports.forEach((r) => {
        const item = document.createElement("div");
        item.className = "office-applicant-item";

        const infoWrap = document.createElement("div");
        infoWrap.className = "office-applicant-info";
        infoWrap.appendChild(createOfficeReportVideoButton(r.videoUrl, () => Promise.resolve(idToken)));
        if (r.description) {
          const descEl = document.createElement("p");
          descEl.className = "office-applicant-msg";
          descEl.textContent = r.description;
          infoWrap.appendChild(descEl);
        }
        if (r.incidentPartyNumber && r.targetMemberNumber) {
          infoWrap.appendChild(createTargetLookupRow(r.incidentPartyNumber, r.targetMemberNumber, idToken));
        }
        const remainText = r.keep ? null : formatOfficeRemainingTime(r.createdAt, OFFICE_REPORT_AUTO_DELETE_MS, "자동 삭제");
        if (remainText) {
          const timerEl = document.createElement("p");
          timerEl.className = "muted-text";
          timerEl.textContent = remainText;
          infoWrap.appendChild(timerEl);
        }
        item.appendChild(infoWrap);

        const actionsEl = document.createElement("div");
        actionsEl.className = "office-applicant-actions";

        const statusEl = document.createElement("span");
        statusEl.className = "office-applicant-status";
        statusEl.textContent = r.resolved ? "처리됨" : "처리 대기중";
        actionsEl.appendChild(statusEl);

        const resolveBtn = document.createElement("button");
        resolveBtn.type = "button";
        resolveBtn.className = "office-btn office-btn-secondary";
        resolveBtn.textContent = r.resolved ? "미처리로" : "처리됨으로";
        resolveBtn.addEventListener("click", async () => {
          try {
            await setOfficeReportFieldAsOperator(r.id, "resolved", !r.resolved, idToken);
            renderOfficeReportAdmin();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        actionsEl.appendChild(resolveBtn);

        const keepBtn = document.createElement("button");
        keepBtn.type = "button";
        keepBtn.className = "office-btn office-btn-secondary";
        keepBtn.textContent = r.keep ? "보류 해제" : "보류(자동삭제 방지)";
        keepBtn.addEventListener("click", async () => {
          try {
            await setOfficeReportFieldAsOperator(r.id, "keep", !r.keep, idToken);
            renderOfficeReportAdmin();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        actionsEl.appendChild(keepBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "office-btn office-btn-outline";
        deleteBtn.textContent = "삭제";
        deleteBtn.addEventListener("click", async () => {
          if (!confirm("이 신고를 삭제할까요?")) return;
          try {
            await deleteOfficeReportAsOperator(r.id, idToken);
            await deleteOfficeReportVideo(r.videoUrl, idToken);
            renderOfficeReportAdmin();
          } catch (err) {
            showToast(err.message || "삭제에 실패했습니다.");
          }
        });
        actionsEl.appendChild(deleteBtn);

        item.appendChild(actionsEl);
        listEl.appendChild(item);
      });
    }
    if (deletedIds.length > 0) showToast(`오래된 신고 ${deletedIds.length}건이 자동 삭제됐습니다.`, "info");
  } catch (err) {
    listEl.textContent = err.message || "신고 목록을 불러오지 못했습니다.";
  }
}

// 내 신청 현황(수락된 건에 한해서만 로비 코드를 추가로 불러와 보여줌) + 받은 초대
// (파티장이 프로필 게시판 보고 먼저 초대한 건 — 수락/거절 필요)
async function renderMyApplications() {
  const listEl = document.getElementById("office-myapps-list");
  const invitesListEl = document.getElementById("office-received-invites-list");
  if (!window.LoadoutCloud) return;
  listEl.textContent = "불러오는 중...";
  invitesListEl.textContent = "불러오는 중...";
  try {
    const allApps = await window.LoadoutCloud.listMyApplications();
    const receivedInvites = allApps.filter((a) => a.status === "invited");
    const apps = allApps.filter((a) => a.status !== "invited");

    invitesListEl.innerHTML = "";
    if (receivedInvites.length === 0) {
      invitesListEl.textContent = "받은 초대가 없습니다.";
    } else {
      for (const inv of receivedInvites) {
        const item = document.createElement("div");
        item.className = "office-applicant-item";

        const infoWrap = document.createElement("div");
        infoWrap.className = "office-applicant-info";
        const partyEl = document.createElement("p");
        partyEl.className = "office-applicant-resume";
        partyEl.textContent = "파티 정보 불러오는 중...";
        infoWrap.appendChild(partyEl);
        window.LoadoutCloud.getPartyByLeaderId(inv.leaderId).then((party) => {
          partyEl.textContent = party ? formatPartyFields(party) : "파티 정보를 불러오지 못했습니다.";
        });
        if (inv.message) {
          const msgEl = document.createElement("p");
          msgEl.className = "office-applicant-msg";
          msgEl.textContent = inv.message;
          infoWrap.appendChild(msgEl);
        }
        item.appendChild(infoWrap);

        const actionsEl = document.createElement("div");
        actionsEl.className = "office-applicant-actions";
        const acceptBtn = document.createElement("button");
        acceptBtn.type = "button";
        acceptBtn.className = "office-btn office-btn-primary";
        acceptBtn.textContent = "수락";
        acceptBtn.addEventListener("click", async () => {
          try {
            await window.LoadoutCloud.respondToInvite(inv.leaderId, true);
            renderMyApplications();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        const declineBtn = document.createElement("button");
        declineBtn.type = "button";
        declineBtn.className = "office-btn office-btn-outline";
        declineBtn.textContent = "거절";
        declineBtn.addEventListener("click", async () => {
          try {
            await window.LoadoutCloud.respondToInvite(inv.leaderId, false);
            renderMyApplications();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        actionsEl.appendChild(acceptBtn);
        actionsEl.appendChild(declineBtn);
        item.appendChild(actionsEl);

        invitesListEl.appendChild(item);
      }
    }

    listEl.innerHTML = "";
    if (apps.length === 0) {
      listEl.textContent = "신청한 파티가 없습니다.";
      return;
    }
    for (const a of apps) {
      const item = document.createElement("div");
      item.className = "office-myapp-item";

      const statusEl = document.createElement("span");
      statusEl.className = "office-myapp-status";
      statusEl.textContent = a.status === "pending" ? "대기중"
        : a.status === "accepted" ? "수락됨"
        : a.status === "kicked" ? "파티에서 내보내짐"
        : "거절됨";
      item.appendChild(statusEl);

      if (a.status === "accepted") {
        const codeEl = document.createElement("span");
        codeEl.className = "office-myapp-code";
        codeEl.textContent = "로비 코드 확인 중...";
        item.appendChild(codeEl);
        window.LoadoutCloud.getPartyCode(a.leaderId).then((code) => {
          codeEl.textContent = code ? `로비 코드: ${code}` : "파티장이 아직 로비 코드를 등록하지 않았습니다.";
        });

        const leaveBtn = document.createElement("button");
        leaveBtn.type = "button";
        leaveBtn.className = "office-btn office-btn-outline";
        leaveBtn.textContent = "파티 나가기";
        leaveBtn.addEventListener("click", async () => {
          if (!confirm("이 파티에서 나갈까요?")) return;
          try {
            await window.LoadoutCloud.leaveParty(a.leaderId);
            renderMyApplications();
          } catch (err) {
            showToast(err.message || "처리에 실패했습니다.");
          }
        });
        item.appendChild(leaveBtn);
      }

      listEl.appendChild(item);
    }
  } catch {
    listEl.textContent = "신청 현황을 불러오지 못했습니다.";
    invitesListEl.textContent = "받은 초대를 불러오지 못했습니다.";
  }
}

function initLoadoutState() {
  state.loadout = {};
  Object.entries(CATEGORIES).forEach(([catKey, catDef]) => {
    catDef.loadoutSlots.forEach((slotDef) => {
      const key = loadoutKey(catKey, slotDef.slotKey);
      state.loadout[key] = slotDef.max === null ? [] : new Array(slotDef.max).fill(null);
    });
  });
  // 도구+소모품 공유 풀("field")은 실제로는 이 배열 하나로 순서까지 관리함(드래그 앤 드롭
  // 재정렬을 위해 카테고리 구분 없이 뒤섞인 순서 그대로 저장) — 위 루프가 만든
  // tool__tool/consumable__consumable 배열은 더 이상 실사용하지 않는 레거시 자리표시자.
  state.loadout["field__all"] = [];
}

function switchTab(tabName) {
  state.activeTab = tabName;
  const statTooltip = document.getElementById("stat-tooltip");
  if (statTooltip) statTooltip.hidden = true;
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `tab-${tabName}`;
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  if (tabName === "analysis") renderAnalysis();
  if (tabName === "maps") renderMapsTab();
  if (tabName === "office") {
    loadOfficeMembership();
    maybeShowOfficeChangelogPopup();
  }
}

// -------------------------------------------------------------------------
// 필터 UI
// -------------------------------------------------------------------------
function renderCategoryFilters() {
  const wrap = document.getElementById("category-filters");
  wrap.innerHTML = "";
  Object.entries(CATEGORIES).forEach(([key, def]) => {
    wrap.appendChild(createCategoryFilterButton(key, def.label, def.image));
  });
  // 첫 번째 카테고리를 기본 선택 상태로 (기존에는 "전체" 버튼이 기본 선택이었음)
  const firstBtn = wrap.querySelector(".cat-filter-btn");
  if (firstBtn && state.filterCategory === "all") {
    state.filterCategory = firstBtn.dataset.category;
    firstBtn.classList.add("active");
  }
}

function createCategoryFilterButton(categoryKey, labelText, imageSrc) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cat-filter-btn" + (categoryKey === "all" ? " active" : "");
  btn.dataset.category = categoryKey;

  if (imageSrc) {
    btn.classList.add("cat-filter-btn-icon");
    btn.title = labelText;
    const img = document.createElement("img");
    img.src = imageSrc;
    img.alt = labelText;
    img.className = "cat-filter-img";
    img.onerror = () => { btn.classList.remove("cat-filter-btn-icon"); btn.textContent = labelText; };
    btn.appendChild(img);
    const span = document.createElement("span");
    span.textContent = labelText;
    btn.appendChild(span);
  } else {
    btn.textContent = labelText;
  }

  btn.addEventListener("click", () => {
    state.filterCategory = categoryKey;
    document.querySelectorAll(".cat-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateWeaponFilterVisibility();
    updateToolFilterVisibility();
    updateConsumableFilterVisibility();
    updateTraitFilterVisibility();
    // 카테고리를 바꿀 때 이전에 열려있던 상세 패널을 닫음 — 안 닫으면 예를 들어
    // 무기를 보다가 "도구" 탭을 눌러도 이전 무기의 상세 패널이 그대로 남아있어서
    // 마치 탭 전환이 안 되는 것처럼 보임(그리드 자체는 바뀌지만 화면상 안 보일 수 있음).
    const detailPanel = document.getElementById("item-detail-panel");
    if (detailPanel) detailPanel.hidden = true;
    if (state.charts.detail) { state.charts.detail.destroy(); state.charts.detail = null; }
    renderItemGrid();
  });
  return btn;
}

function renderWeaponFilters() {
  const wrap = document.getElementById("weapon-filters");
  wrap.innerHTML = "";
  Object.entries(WEAPON_FILTERS).forEach(([filterKey, def]) => {
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    // 탄약효과 그룹은 선택된 탄종(들)에 따라 옵션을 합집합으로 좁힘 (탄종 미선택 시 전체 표시)
    let options = def.options;
    if (filterKey === "ammoEffect") {
      const available = getAvailableAmmoEffectValues(state.weaponFilters.ammoCategory);
      if (available) options = def.options.filter((opt) => available.has(opt.value));
    }

    options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.weaponFilters[filterKey].has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        // 이미지가 있으면 텍스트 대신 아이콘으로 (이름은 title 툴팁으로)
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        const set = state.weaponFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        if (filterKey === "ammoCategory") pruneAmmoEffectFilter(state.weaponFilters);
        renderWeaponFilters(); // 탄종이 바뀌었을 수 있으니 필터 UI 전체를 다시 그림
        renderItemGrid();
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
  updateWeaponFilterVisibility();
}

function updateWeaponFilterVisibility() {
  const show = state.filterCategory === "weapon" || state.filterCategory === "all";
  document.getElementById("weapon-filters").hidden = !show;
}

// 도구(TOOL_FILTERS: toolClass/toolTags) 검색 필터 UI — 무기 필터와 동일한 구성 요소 재사용
function renderToolFilters() {
  const wrap = document.getElementById("tool-filters");
  wrap.innerHTML = "";
  Object.entries(TOOL_FILTERS).forEach(([filterKey, def]) => {
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    def.options.forEach((opt) => {
      const set = state.toolFilters[filterKey];
      const isAll = opt.value === "__all__";
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (isAll ? set.size === 0 : set.has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        if (isAll) set.clear();
        else if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        renderToolFilters();
        renderItemGrid();
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
  updateToolFilterVisibility();
}

function updateToolFilterVisibility() {
  const show = state.filterCategory === "tool" || state.filterCategory === "all";
  document.getElementById("tool-filters").hidden = !show;
}

// 소모품(CONSUMABLE_FILTERS: consumableClass/consumableTags) 검색 필터 UI — 도구 필터와 동일한 구성 요소 재사용
function renderConsumableFilters() {
  const wrap = document.getElementById("consumable-filters");
  wrap.innerHTML = "";
  Object.entries(CONSUMABLE_FILTERS).forEach(([filterKey, def]) => {
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    def.options.forEach((opt) => {
      const set = state.consumableFilters[filterKey];
      const isAll = opt.value === "__all__";
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (isAll ? set.size === 0 : set.has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        if (isAll) set.clear();
        else if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        renderConsumableFilters();
        renderItemGrid();
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
  updateConsumableFilterVisibility();
}

function updateConsumableFilterVisibility() {
  const show = state.filterCategory === "consumable" || state.filterCategory === "all";
  document.getElementById("consumable-filters").hidden = !show;
}

// 특성(TRAIT_FILTERS: traitClass/traitTags) 검색 필터 UI — 도구/소모품 필터와 동일한 구성 요소 재사용
function renderTraitFilters() {
  const wrap = document.getElementById("trait-filters");
  wrap.innerHTML = "";
  Object.entries(TRAIT_FILTERS).forEach(([filterKey, def]) => {
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    def.options.forEach((opt) => {
      const set = state.traitFilters[filterKey];
      const isAll = opt.value === "__all__";
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (isAll ? set.size === 0 : set.has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        if (isAll) set.clear();
        else if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        renderTraitFilters();
        renderItemGrid();
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
  updateTraitFilterVisibility();
}

function updateTraitFilterVisibility() {
  const show = state.filterCategory === "trait" || state.filterCategory === "all";
  document.getElementById("trait-filters").hidden = !show;
}

// -------------------------------------------------------------------------
// 결과 그리드
// -------------------------------------------------------------------------
// 선택된 탄종(들)에서 실제로 쓰이는 탄약 효과들의 합집합을 구함.
// 탄종을 하나도 선택 안 했으면 null(=전체 다 보여줌)을 반환.
function getAvailableAmmoEffectValues(categorySet) {
  if (!categorySet || categorySet.size === 0) return null;
  const set = new Set();
  ITEMS.forEach((item) => {
    if (item.category !== "weapon") return;
    const cats = [item.ammoCategory, ...(item.secondaryAmmoCategories || [])];
    if (cats.some((c) => categorySet.has(c))) {
      (item.ammoEffects || []).forEach((e) => set.add(e));
    }
  });
  return set;
}

// 탄종 필터가 바뀐 뒤, 더 이상 유효하지 않은 탄약효과 선택은 정리(prune)함
function pruneAmmoEffectFilter(filterState) {
  const available = getAvailableAmmoEffectValues(filterState.ammoCategory);
  if (available === null) return;
  [...filterState.ammoEffect].forEach((v) => {
    if (!available.has(v)) filterState.ammoEffect.delete(v);
  });
}

// 모무기 + 파생형 하나를 합쳐서 완전한 무기 객체로 만듦 (buildWeaponVariantsList와 동일한 병합 규칙)
function mergeWeaponVariant(parentItem, v) {
  return {
    ...parentItem,
    ...v,
    stats: { ...parentItem.stats, ...(v.stats || {}) },
    chamber: { ...(parentItem.chamber || {}), ...(v.chamber || {}) },
    variants: undefined,
    _trueParentId: parentItem.id,
  };
}

// 한글 이름이 있으면 "한글 (English)" 형태로, 없으면 영문 이름 그대로 표시.
// 이름이 노출되는 모든 곳(카드/상세보기/로드아웃/비교/피커/툴팁 등)에서 공용으로 사용.
function displayName(item) {
  if (!item) return "";
  return item.nameKo ? `${item.nameKo} (${item.name})` : item.name;
}

// ITEMS를 "모무기 + 모든 파생형"이 각각 독립된 카드로 검색/필터링 되도록 평탄화한 리스트로 변환.
// 파생형은 _trueParentId(원 무기 id), _variantIndex(자세히 보기 탭 인덱스, 0=모무기)를 함께 갖는다.
function getFlattenedWeaponItems() {
  const flat = [];
  ITEMS.forEach((item) => {
    if (item.category !== "weapon") {
      flat.push(item);
      return;
    }
    flat.push({ ...item, _trueParentId: item.id, _variantIndex: 0 });
    (item.variants || []).forEach((v, idx) => {
      flat.push({ ...mergeWeaponVariant(item, v), _variantIndex: idx + 1 });
    });
  });
  return flat;
}

// id로 아이템을 찾되, 모무기뿐 아니라 파생형 id도 찾아서 병합된 완전한 객체로 반환.
// (비교 목록/로드아웃 등에서 파생형 id가 저장돼 있어도 정상적으로 조회되도록)
function findItemById(id) {
  for (const item of ITEMS) {
    if (item.id === id) return item;
    if (item.category === "weapon" && Array.isArray(item.variants)) {
      const v = item.variants.find((vv) => vv.id === id);
      if (v) return mergeWeaponVariant(item, v);
    }
  }
  return null;
}


function getFilteredItems(extra = {}) {
  const category = extra.category !== undefined ? extra.category : state.filterCategory;
  const query = extra.query !== undefined ? extra.query : state.searchQuery;
  const useWeaponFilters = extra.useWeaponFilters !== false;
  const filterSource = extra.filterSource || state.weaponFilters;
  const useToolFilters = extra.useToolFilters !== false;
  const toolFilterSource = extra.toolFilterSource || state.toolFilters;
  const useConsumableFilters = extra.useConsumableFilters !== false;
  const consumableFilterSource = extra.consumableFilterSource || state.consumableFilters;
  const useTraitFilters = extra.useTraitFilters !== false;
  const traitFilterSource = extra.traitFilterSource || state.traitFilters;

  return getFlattenedWeaponItems().filter((item) => {
    if (category && category !== "all" && item.category !== category) return false;
    if (query && !item.name.toLowerCase().includes(query) && !(item.nameKo || "").includes(query)) return false;
    if (useWeaponFilters && item.category === "weapon") {
      const f = filterSource;
      if (f.slotSize.size > 0 && !f.slotSize.has(item.slotSize)) return false;
      if (f.ammoCategory.size > 0) {
        const cats = [item.ammoCategory, ...(item.secondaryAmmoCategories || [])];
        const ok = [...f.ammoCategory].some((c) => cats.includes(c));
        if (!ok) return false;
      }
      if (f.ammoEffect.size > 0) {
        const effects = item.ammoEffects || [];
        const ok = [...f.ammoEffect].some((e) => effects.includes(e));
        if (!ok) return false;
      }
    }
    if (useToolFilters && item.category === "tool") {
      const f = toolFilterSource;
      if (f.toolClass.size > 0 && !f.toolClass.has(item.toolClass)) return false;
      if (f.toolTags.size > 0) {
        const tags = item.toolTags || [];
        const ok = [...f.toolTags].some((t) => tags.includes(t));
        if (!ok) return false;
      }
    }
    if (useConsumableFilters && item.category === "consumable") {
      const f = consumableFilterSource;
      if (f.consumableClass.size > 0 && !f.consumableClass.has(item.consumableClass)) return false;
      if (f.consumableTags.size > 0) {
        const tags = item.consumableTags || [];
        const ok = [...f.consumableTags].some((t) => tags.includes(t));
        if (!ok) return false;
      }
    }
    if (useTraitFilters && item.category === "trait") {
      const f = traitFilterSource;
      if (f.traitClass.size > 0 && !f.traitClass.has(item.traitClass)) return false;
      if (f.traitTags.size > 0) {
        const tags = item.traitTags || [];
        const ok = [...f.traitTags].some((t) => tags.includes(t));
        if (!ok) return false;
      }
    }
    return true;
  });
}

function renderItemGrid() {
  const grid = document.getElementById("item-grid");
  const items = getFilteredItems();
  grid.innerHTML = "";
  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-msg">아이템이 없습니다. data.js의 ITEMS 배열에 데이터를 추가해주세요.</p>`;
    return;
  }
  items.forEach((item) => grid.appendChild(createItemCard(item)));
}

function createItemCard(item) {
  const card = document.createElement("div");
  card.className = "item-card";
  const cat = CATEGORIES[item.category];
  const imgHTML = item.image
    ? `<img src="${item.image}" alt="${displayName(item)}" class="item-card-img" onerror="this.style.display='none'">`
    : `<div class="item-card-icon">${cat ? cat.icon : ""}</div>`;

  // 무기 카드: 이름 + 이미지 + 칸수 + 가격 + (자세히 보기 버튼)
  if (item.category === "weapon") {
    card.innerHTML = `
      ${imgHTML}
      <div class="item-card-name" title="${displayName(item)}">${displayName(item)}</div>
      <div class="item-card-meta">
        <span class="item-card-slots"><img src="images/ui/slot_${item.slotSize || 1}.png" alt="${item.slotSize}칸" class="slot-icon"></span>
        ${item.scarce
          ? `<span class="item-card-price"><img src="images/ui/scarce.png" alt="Scarce" class="dollar-icon" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`
          : item.price != null ? `<span class="item-card-price"><img src="images/ui/hunt_dollars.png" alt="$" class="dollar-icon">${item.price}</span>` : ""}
      </div>
      <button class="item-card-detail-btn" type="button">자세히 보기 ›</button>`;

    // 버튼은 자세히 보기 화면 열기 (이벤트 전파 차단)
    // 파생형 카드라면(_trueParentId가 자기 자신 id와 다르면) 모무기를 찾아서, 그 파생형 탭이 바로 선택된 채로 열어줌
    card.querySelector(".item-card-detail-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const parent = ITEMS.find((i) => i.id === (item._trueParentId || item.id)) || item;
      state.selectedVariantIdx[parent.id] = item._variantIndex || 0;
      openBodyPartView(parent, item.defaultAmmo || (item.ammoTypes && item.ammoTypes[0]));
    });
  } else if (item.category === "trait") {
    // 특성 카드: 이름 + 이미지 + (태그 있으면 태그 아이콘) + 업그레이드 포인트/희소 표시
    const tagIcons = (item.traitTags || [])
      .map((t) => TRAIT_FILTERS.traitTags.options.find((o) => o.value === t))
      .filter(Boolean);
    card.innerHTML = `
      ${imgHTML}
      <div class="item-card-name" title="${displayName(item)}">${displayName(item)}</div>
      <div class="item-card-meta">
        <div class="item-card-trait-tags">${tagIcons.map((t) => `<img src="${t.image}" alt="${t.label}" title="${t.label}" class="trait-tag-icon">`).join("")}</div>
        ${item.traitTags && item.traitTags.includes("scarce")
          ? `<span class="item-card-price"><img src="images/ui/scarce.png" alt="Scarce" class="dollar-icon" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`
          : item.price != null ? `<span class="item-card-price"><img src="images/ui/upgrade_points.webp" alt="업그레이드 포인트" class="dollar-icon">${item.price}</span>` : ""}
      </div>`;
  } else {
    card.innerHTML = `
      ${imgHTML}
      <div class="item-card-name" title="${displayName(item)}">${displayName(item)}</div>
      <div class="item-card-category">${cat ? cat.label : item.category}</div>`;
  }

  // 카드 본체 클릭: 우측 요약 패널 열기
  card.addEventListener("click", () => renderItemDetail(item));

  // 무기 카드는 호버 시 핵심 스탯 미리보기 툴팁 표시
  if (item.category === "weapon" && item.stats) {
    card.addEventListener("mouseenter", () => showHoverPreview(card, item));
    card.addEventListener("mouseleave", hideHoverPreview);
  }

  return card;
}

// -------------------------------------------------------------------------
// 무기 카드 호버 미리보기 (핵심 스탯 4개만 빠르게 확인)
// -------------------------------------------------------------------------
function showHoverPreview(cardEl, item) {
  let tooltip = document.getElementById("hover-preview");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "hover-preview";
    document.body.appendChild(tooltip);
  }

  const s = item.stats;
  tooltip.innerHTML = `
    <div class="hover-preview-title">${displayName(item)}</div>
    <div class="hover-preview-stats">
      <div><span>피해</span><b>${s.damage ?? "-"}</b></div>
      <div><span>드롭 사거리</span><b>${s.dropRange ?? "-"}m</b></div>
      <div><span>탄속</span><b>${s.muzzleVelocity ?? "-"}</b></div>
      <div><span>사이클 시간</span><b>${s.cycleTime ?? "-"}</b></div>
    </div>
  `;

  const rect = cardEl.getBoundingClientRect();
  tooltip.style.left = `${rect.right + 10}px`;
  tooltip.style.top = `${rect.top}px`;
  tooltip.hidden = false;

  // 화면 오른쪽 밖으로 나가면 카드 왼쪽에 표시
  requestAnimationFrame(() => {
    const tRect = tooltip.getBoundingClientRect();
    if (tRect.right > window.innerWidth) {
      tooltip.style.left = `${rect.left - tRect.width - 10}px`;
    }
    if (tRect.bottom > window.innerHeight) {
      tooltip.style.top = `${window.innerHeight - tRect.height - 10}px`;
    }
  });
}

function hideHoverPreview() {
  const tooltip = document.getElementById("hover-preview");
  if (tooltip) tooltip.hidden = true;
}

// -------------------------------------------------------------------------
// 아이템 상세 — 무기일 때는 탄약 선택 UI 포함
// -------------------------------------------------------------------------
function renderItemDetail(item) {
  const panel = document.getElementById("item-detail-panel");
  panel.hidden = false;
  if (state.charts.detail) { state.charts.detail.destroy(); state.charts.detail = null; }

  if (item.category === "weapon") {
    // 현재 선택된 탄약 (없으면 기본탄)
    const selectedAmmoId = state.selectedAmmo[item.id] || item.defaultAmmo || (item.ammoTypes && item.ammoTypes[0]);
    panel.innerHTML = renderWeaponDetailHTML(item, selectedAmmoId);
    bindDetailClose(panel);
    bindAmmoTabs(item);
    bindCompareButton(item, selectedAmmoId);
    bindLoadoutQuickAddButton(item, selectedAmmoId);
    bindWeaponReviewSection(item, { root: panel });
    drawWeaponChart(item, selectedAmmoId);
  } else if (item.category === "tool") {
    panel.innerHTML = renderToolDetailHTML(item);
    bindDetailClose(panel);
    bindLoadoutQuickAddButton(item);
  } else if (item.category === "consumable") {
    panel.innerHTML = renderConsumableDetailHTML(item);
    bindDetailClose(panel);
    bindLoadoutQuickAddButton(item);
  } else if (item.category === "trait") {
    panel.innerHTML = renderTraitDetailHTML(item);
    bindDetailClose(panel);
    bindLoadoutQuickAddButton(item);
  } else {
    panel.innerHTML = renderGenericDetailHTML(item);
    bindDetailClose(panel);
    bindLoadoutQuickAddButton(item);
  }
}

function bindDetailClose(panel) {
  panel.querySelector("#detail-close-btn")?.addEventListener("click", () => {
    panel.hidden = true;
    if (state.charts.detail) { state.charts.detail.destroy(); state.charts.detail = null; }
  });
}

function bindAmmoTabs(item) {
  document.querySelectorAll(".ammo-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedAmmo[item.id] = btn.dataset.ammoId;
      renderItemDetail(item); // 다시 그림
    });
  });
}

function bindCompareButton(item, ammoId) {
  document.querySelector("#detail-add-compare-btn")?.addEventListener("click", () => {
    const exists = state.compareEntries.some((e) => e.weaponId === item.id && e.ammoId === ammoId);
    if (exists) {
      state.compareEntries = state.compareEntries.filter((e) => !(e.weaponId === item.id && e.ammoId === ammoId));
    } else {
      state.compareEntries.push({ weaponId: item.id, ammoId });
    }
    renderItemDetail(item);
  });
}

// DB 검색 화면 → 로드아웃 빌더로 "장바구니에 담듯" 바로 추가하는 버튼
function bindLoadoutQuickAddButton(item, ammoId = null) {
  const btn = document.querySelector("#detail-add-loadout-btn");
  if (!btn) return;
  const originalText = btn.textContent;
  btn.addEventListener("click", () => {
    const result = addToLoadoutQuick(item, ammoId);
    if (result.ok) renderLoadoutBoard();
    btn.textContent = result.ok ? `✓ ${result.slotLabel}에 추가됨` : result.message;
    btn.classList.toggle("added", result.ok);
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove("added");
    }, 1600);
  });
}

// -------------------------------------------------------------------------
// 자세히 보기 — 파생형 탭 + 스탯표 + 부위별 데미지 (큰 모달)
// -------------------------------------------------------------------------

// 모무기 + 파생형들을 합쳐서 "탭에 표시할 무기 리스트" 만들기
// 파생형의 비어있는 필드는 모무기 값으로 채워서 완전한 무기 객체로 변환
function buildWeaponVariantsList(parentItem) {
  const list = [{ ...parentItem, _isParent: true, _displayName: displayName(parentItem) + " (기본)" }];

  if (!Array.isArray(parentItem.variants)) return list;

  parentItem.variants.forEach((v) => {
    // 모무기 위에 파생형의 값을 얹어서 완전한 객체로 만듦
    const merged = {
      ...parentItem,
      ...v,
      // stats는 깊은 머지 (객체끼리 합쳐야 함)
      stats: { ...parentItem.stats, ...(v.stats || {}) },
      chamber: { ...(parentItem.chamber || {}), ...(v.chamber || {}) },
      _isParent: false,
      _displayName: displayName(v),
      // 파생형 자체에는 variants 가 없도록
      variants: undefined,
    };
    list.push(merged);
  });

  return list;
}

function openBodyPartView(parentItem, ammoId) {
  const overlay = document.getElementById("bodypart-overlay");
  const content = document.getElementById("bodypart-content");

  // 근접무기는 탄약/거리 개념이 아예 없어서 훨씬 단순한 전용 레이아웃 사용
  if (parentItem.ammoCategory === "melee") {
    renderMeleeBodyPartView(parentItem, overlay, content);
    return;
  }

  // 자세히 보기 화면에서 현재 보고 있는 파생형 인덱스 (기본은 모무기)
  if (state.selectedVariantIdx[parentItem.id] == null) {
    state.selectedVariantIdx[parentItem.id] = 0;
  }
  const variantsList = buildWeaponVariantsList(parentItem);
  const currentIdx = Math.min(state.selectedVariantIdx[parentItem.id], variantsList.length - 1);
  const currentItem = variantsList[currentIdx];

  // 파생형에 따라 사용 가능한 탄약이 다를 수 있음. 현재 ammoId가 없으면 기본탄으로 폴백.
  let activeAmmoId = ammoId;
  if (!activeAmmoId || !(currentItem.ammoTypes || []).includes(activeAmmoId)) {
    activeAmmoId = currentItem.defaultAmmo || (currentItem.ammoTypes && currentItem.ammoTypes[0]);
  }

  const { stats, chamber, ammo } = resolveWeaponWithAmmo(currentItem, activeAmmoId);
  const baseDmg = stats.damage ?? 0;

  // 기준 거리: 무기별로 저장. 없으면 10m.
  const refRange = state.refRange[parentItem.id] ?? 10;
  const distMult = ammo?.falloff ? interpolateFalloff(ammo.falloff, refRange) : 1;

  // 데미지 계산식: 표기 데미지(baseDmg, 예: 110)는
  //   "유저에게 안 보이는 무기 데미지(X)" × 가슴 배율(1.3) × 거리감쇠값(20m 이내 가슴 = 1)
  //   로 이미 만들어진 값이므로, X = baseDmg / 가슴배율 로 역산한 뒤
  //   부위별 데미지 = X × 부위 배율 × 거리감쇠값(distMult) 로 계산한다.
  //   (※ 관통 시 추가되는 감쇠값은 아직 미반영 — 추후 여기에 곱셈으로 추가 예정)
  const hiddenWeaponDamage = baseDmg / CHEST_MULTIPLIER; // X

  // 일부 탄약은 부위별 배율이 표준(BODY_PART_MULTIPLIERS)과 다름(사용자 실측 확인) —
  // 그런 경우만 ammo.bodyPartMultiplierOverrides로 해당 부위 배율을 덮어씀
  const partMultOverrides = ammo?.bodyPartMultiplierOverrides || {};
  const partInfo = {};
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([key, def]) => {
    if (def.multiplier == null) partInfo[key] = { dmg: null };
    else {
      const mult = partMultOverrides[key] ?? def.multiplier;
      partInfo[key] = { dmg: Math.round(hiddenWeaponDamage * mult * distMult) };
    }
  });

  // 파생형 탭들
  const inBpCompare = state.compareEntries.some((e) => e.weaponId === currentItem.id && e.ammoId === activeAmmoId);

  const variantTabs = variantsList.map((v, idx) => {
    const active = idx === currentIdx ? "active" : "";
    return `<button class="variant-tab ${active}" data-variant-idx="${idx}" type="button">${v._displayName}</button>`;
  }).join("");

  // 탄약 탭들 (현재 선택된 무기 기준)
  const ammoTabs = (currentItem.ammoTypes || []).map((aid) => {
    const a = AMMO_TYPES[aid];
    if (!a) return "";
    const active = aid === activeAmmoId ? "active" : "";
    const visual = a.image
      ? `<img src="${a.image}" alt="${a.label}" class="ammo-tab-img" onerror="this.outerHTML='<span class=ammo-tab-icon>${a.icon ?? "•"}</span>'">`
      : `<span class="ammo-tab-icon">${a.icon ?? "•"}</span>`;
    return `
      <button class="ammo-tab ${active}" data-bp-ammo-id="${aid}" type="button" title="${a.label}${a.scarce ? " (Scarce)" : a.cost ? ` ($${a.cost})` : ""}">
        ${visual}
      </button>`;
  }).join("");

  // 무기 자체가 샷건/근접무기이거나(거리 기반 데미지 개념이 없음), 지금 선택된 탄약 자체가 샷건탄인 경우 마네킹을 숨김
  const isShotgun = currentItem.ammoCategory === "shotgun" || currentItem.ammoCategory === "melee" || ammo?.category === "shotgun";

  // 이 무기의 어떤 탄약도 거리별 데이터(낙하곡선/한방컷)를 안 가지고 있으면(예: 슈레더, 화염소총처럼 탄종이 하나뿐이고
  // 그마저 거리 데이터가 없는 경우) "거리별 데미지" 그래프 섹션 자체를 숨기고 있는 스탯만 보여줌
  const hasAnyGraphData = (currentItem.ammoTypes || []).some((aid) => {
    const a = AMMO_TYPES[aid];
    return a && (a.falloff || a.ohkRange);
  });

  // 탄약 종류가 1개뿐이면(고를 게 없음) 탭 아이콘 목록은 숨김 (비교/로드아웃 버튼은 그대로 유지)
  const hasMultipleAmmo = (currentItem.ammoTypes || []).length > 1;

  content.innerHTML = `
    <button id="bodypart-close-btn" type="button">✕</button>
    <h2>${displayName(parentItem)} <span class="bodypart-ammo">${ammo?.label ?? ""}</span></h2>
    ${variantsList.length > 1 ? `<div class="variant-tabs variant-tabs-compact">${variantTabs}</div>` : ""}
    ${currentItem.description ? `<p class="variant-desc">${currentItem.description}</p>` : ""}

    <!-- 본문: 좌측 마네킹(샷건 제외) / 중앙 무기이미지+기본정보+스탯 / 우측 그래프+특수탄+효과 -->
    <div class="bodypart-layout ${isShotgun ? "bodypart-layout--no-figure" : ""}">
      ${isShotgun ? "" : `
      <!-- 좌측: 마네킹 -->
      <div class="bodypart-figure-col">
        <div class="bodypart-figure">
          ${renderBodyFigureSVG(partInfo, refRange)}
        </div>
      </div>`}

      <!-- 중앙: 무기 이미지 → 기본정보 → 총기 스탯 -->
      <div class="bodypart-weapon-col">
        ${currentItem.image
          ? `<img src="${currentItem.image}" alt="${displayName(currentItem)}" class="bp-weapon-img" onerror="this.style.display='none'">`
          : `<div class="bp-weapon-img-placeholder">무기 이미지 없음</div>`}

        <!-- 탄약 상태: [탄약 아이콘] 장탄/예비탄 [칸수 아이콘] | [달러 아이콘] 가격 -->
        <div class="ammo-status-row">
          ${ammo?.image ? `<img src="${ammo.image}" alt="${ammo.label}" class="ammo-status-icon">` : ""}
          <span class="ammo-status-count">${chamber.loaded ?? "-"}/${chamber.extra ?? "-"}</span>
          <img src="images/ui/slot_${currentItem.slotSize || 1}.png" alt="${currentItem.slotSize}칸" class="ammo-status-slots">
          ${currentItem.scarce
            ? `<img src="images/ui/scarce.png" alt="Scarce" class="ammo-status-dollar" title="Scarce (상점 구매 불가, 월드에서만 획득)">`
            : currentItem.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${currentItem.price}</span>` : ""}
        </div>

        <!-- 총기 스탯: 탄약 바꾸면 이 자리에서 바로 갱신됨 -->
        <div class="detail-stats bp-stats-inline">
          ${statRowSimple("피해", stats.damage, "damage", "정보없음")}
          ${statRowSimple("낙하 범위", stats.dropRange, "dropRange")}
          ${statRowSimple("발사속도", stats.rateOfFire, "rateOfFire")}
          ${statRowSimple("사이클 시간", stats.cycleTime, "cycleTime")}
          ${statRowSimple("분산도", stats.spread, "spread")}
          ${statRowSimple("흔들림", stats.sway, "sway")}
          ${statRowSimple("수직 반동", stats.verticalRecoil, "verticalRecoil")}
          ${statRowSimple("재장전 속도", stats.reloadSpeed, "reloadSpeed")}
          ${statRowSimple("총구속도", stats.muzzleVelocity, "muzzleVelocity")}
          ${statRowSimple("약공격 피해", stats.meleeLight, "meleeLight")}
          ${statRowSimple("강공격 피해", stats.meleeHeavy, "meleeHeavy")}
          ${statRowSimple("기력 소모(강공격)", stats.staminaConsumption, "staminaConsumption")}
        </div>
      </div>

      <!-- 우측: 그래프 → 특수탄 탭 → 특수탄 효과 -->
      <div class="bodypart-graph-col">
        ${hasAnyGraphData ? `
        <h4 class="bp-chart-heading">거리별 피해 <span class="bodypart-hint">— 그래프를 클릭하여 거리 선택</span></h4>
        <div class="bp-chart-wrap"><canvas id="bp-chart"></canvas></div>
        ` : ""}

        <div class="ammo-tabs-row">
          ${hasMultipleAmmo ? `<div class="ammo-tabs">${ammoTabs}</div>` : ""}
          <button id="bp-add-compare-btn" type="button" class="compare-btn-inline ${inBpCompare ? "added" : ""}">
            ${inBpCompare ? "✓ 비교 목록에 추가됨" : "+ 비교 목록에 추가"}
          </button>
          <button id="bp-add-loadout-btn" type="button" class="compare-btn-inline">+ 로드아웃에 추가</button>
        </div>

        <!-- 탄약 효과 (특수탄 근처에 배치) -->
        <div class="status-effect-box">
          <h4>효과</h4>
          ${ammo?.description ? `<p class="ammo-desc-text">${ammo.description}</p>` : ""}
          ${ammo?.specialEffects?.length
            ? `<ul class="status-effect-list">${ammo.specialEffects.map((e) => `<li>${e}</li>`).join("")}</ul>`
            : (ammo?.description ? "" : `<p class="muted-text">이 탄약에는 특수 효과가 없습니다.</p>`)}
          ${hasAnyGraphData ? `<p class="status-effect-note">※ 계산 결과는 반올림 등으로 인해 실제와 최대 1m까지 차이가 날 수 있습니다.</p>` : ""}
        </div>

        ${stats.muzzleVelocity ? renderLeadshotCalcHTML(stats.muzzleVelocity) : ""}
      </div>
    </div>

    ${renderWeaponReviewSectionHTML()}
  `;

  overlay.hidden = false;

  // 닫기
  document.getElementById("bodypart-close-btn").addEventListener("click", closeBodyPartView);
  overlay.addEventListener("click", (e) => {
    if (e.target.id === "bodypart-overlay") closeBodyPartView();
  });

  // 파생형 탭 클릭
  content.querySelectorAll(".variant-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedVariantIdx[parentItem.id] = Number(btn.dataset.variantIdx);
      openBodyPartView(parentItem, activeAmmoId); // 같은 ammoId로 다시 그림
    });
  });

  // 탄약 탭 클릭
  content.querySelectorAll(".ammo-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      openBodyPartView(parentItem, btn.dataset.bpAmmoId);
    });
  });

  // 비교 목록 추가/제거
  document.getElementById("bp-add-compare-btn")?.addEventListener("click", () => {
    const exists = state.compareEntries.some((e) => e.weaponId === currentItem.id && e.ammoId === activeAmmoId);
    if (exists) {
      state.compareEntries = state.compareEntries.filter((e) => !(e.weaponId === currentItem.id && e.ammoId === activeAmmoId));
    } else {
      state.compareEntries.push({ weaponId: currentItem.id, ammoId: activeAmmoId });
    }
    openBodyPartView(parentItem, activeAmmoId); // 버튼 상태 갱신을 위해 다시 그림
  });

  // 로드아웃에 바로 추가 ("장바구니 담기"처럼)
  document.getElementById("bp-add-loadout-btn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const result = addToLoadoutQuick(currentItem, activeAmmoId);
    if (result.ok) renderLoadoutBoard();
    const original = "+ 로드아웃에 추가";
    btn.textContent = result.ok ? `✓ ${result.slotLabel}에 추가됨` : result.message;
    btn.classList.toggle("added", result.ok);
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("added");
    }, 1600);
  });

  if (stats.muzzleVelocity) bindLeadshotCalc(stats.muzzleVelocity);

  bindWeaponReviewSection(currentItem, { full: true, root: content });

  // 거리별 데미지 그래프 그리기
  drawBodyPartChart(currentItem, activeAmmoId, refRange, parentItem);
}

// 근접무기 전용 "자세히 보기" — 마네킹/그래프/탄약탭 없이 근접 스탯만 표시
function renderMeleeBodyPartView(item, overlay, content) {
  const stats = item.stats || {};
  const inCompare = state.compareEntries.some((e) => e.weaponId === item.id && e.ammoId == null);

  content.innerHTML = `
    <button id="bodypart-close-btn" type="button">✕</button>
    <h2>${displayName(item)}</h2>
    ${item.description ? `<p class="variant-desc">${item.description}</p>` : ""}

    <div class="bodypart-layout bodypart-layout--no-figure">
      <div class="bodypart-weapon-col">
        ${item.image
          ? `<img src="${item.image}" alt="${displayName(item)}" class="bp-weapon-img" onerror="this.style.display='none'">`
          : `<div class="bp-weapon-img-placeholder">무기 이미지 없음</div>`}

        <!-- 근접무기는 탄약이 없어서 칸수/가격만 표시 -->
        <div class="ammo-status-row">
          <img src="images/ui/slot_${item.slotSize || 1}.png" alt="${item.slotSize}칸" class="ammo-status-slots">
          ${item.scarce
            ? `<img src="images/ui/scarce.png" alt="Scarce" class="ammo-status-dollar" title="Scarce (상점 구매 불가, 월드에서만 획득)">`
            : item.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
        </div>

        <div class="detail-stats bp-stats-inline">
          ${statRowSimple("약공격 피해", stats.meleeLight, "meleeLight")}
          ${statRowSimple("강공격 피해", stats.meleeHeavy, "meleeHeavy")}
          ${statRowSimple("기력 소모(강공격)", stats.staminaConsumption, "staminaConsumption")}
        </div>
      </div>

      <div class="bodypart-graph-col">
        <div class="ammo-tabs-row">
          <button id="bp-add-compare-btn" type="button" class="compare-btn-inline ${inCompare ? "added" : ""}">
            ${inCompare ? "✓ 비교 목록에 추가됨" : "+ 비교 목록에 추가"}
          </button>
          <button id="bp-add-loadout-btn" type="button" class="compare-btn-inline">+ 로드아웃에 추가</button>
        </div>
      </div>
    </div>

    ${renderWeaponReviewSectionHTML()}
  `;

  overlay.hidden = false;

  document.getElementById("bodypart-close-btn").addEventListener("click", closeBodyPartView);
  overlay.addEventListener("click", (e) => {
    if (e.target.id === "bodypart-overlay") closeBodyPartView();
  });

  document.getElementById("bp-add-compare-btn")?.addEventListener("click", () => {
    const exists = state.compareEntries.some((e) => e.weaponId === item.id && e.ammoId == null);
    if (exists) {
      state.compareEntries = state.compareEntries.filter((e) => !(e.weaponId === item.id && e.ammoId == null));
    } else {
      state.compareEntries.push({ weaponId: item.id, ammoId: null });
    }
    renderMeleeBodyPartView(item, overlay, content);
  });

  bindWeaponReviewSection(item, { full: true, root: content });

  document.getElementById("bp-add-loadout-btn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const result = addToLoadoutQuick(item, null);
    if (result.ok) renderLoadoutBoard();
    const original = "+ 로드아웃에 추가";
    btn.textContent = result.ok ? `✓ ${result.slotLabel}에 추가됨` : result.message;
    btn.classList.toggle("added", result.ok);
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("added");
    }, 1600);
  });
}

// 자세히 보기 화면 내 그래프 (클릭해도 그래프 자체는 다시 그려지지 않음)
// 현재 선택된 탄약 기준으로 "가슴 정조준 한방컷(OHK) 거리" 데이터를 가져옴
// (탄약 자체에 ohkRange가 있을 때만 표시 — 슬러그/드래곤브레스/신호탄 등 다른 탄약에는 적용 안 됨)
function getOhkRangeForCurrentAmmo(item, ammoId) {
  const ammo = AMMO_TYPES[ammoId];
  if (!ammo) return null;
  return (ammo.ohkRange || ammo.ohkRangeVariants) ? ammo : null;
}

// 샷건류: 거리별 데미지 그래프 대신 초록(보장)→노랑(불안정)→빨강(불가) 막대로 표시
// title: 막대 상단 라벨(부위별 데이터 등 "가슴 정조준" 기준이 아닐 때 덮어쓰기용)
// 슬러그처럼 펠릿 분산이 없는 단일 탄자 탄약은 불안정 구간이 존재하지 않음 —
// ohkRange에 unstableEnd를 안 주면(guaranteed만 있으면) 노랑 구간 없이 보장→불가로 바로 전환되는
// 2단 막대로 표시(불안정 관련 눈금/범례도 생략).
function renderOhkRangeBar(ohkRange, maxDisplay, title) {
  const { guaranteed } = ohkRange;
  const hasUnstable = ohkRange.unstableEnd != null && ohkRange.noneFrom != null;
  const unstableEnd = hasUnstable ? ohkRange.unstableEnd : guaranteed;
  const noneFrom = hasUnstable ? ohkRange.noneFrom : guaranteed;
  const gPct = (guaranteed / maxDisplay) * 100;
  const nPct = (noneFrom / maxDisplay) * 100;
  const maxLabel = Math.ceil(maxDisplay);

  // extraMarks: 랜덤/불안정 구간이 아니라 확정적인 보조 기준선(예: 활의 Hundred Hands 착용 시
  // "7m까지는 부위 무관 한방")을 안내하기 위한 눈금+범례 — 막대 색상 자체(초록/빨강)는 바꾸지 않음.
  const extraMarks = ohkRange.extraMarks || [];

  return `
    <div class="ohk-range-box">
      <h4 class="ohk-range-title">${title ?? "가슴 정조준 기준 한방컷(OHK) 거리"}</h4>
      <div class="ohk-range-bar" style="background: linear-gradient(to right,
        var(--success) 0%, var(--success) ${gPct}%,
        ${hasUnstable ? "#d4c25e" : "var(--success)"} ${gPct}%,
        var(--danger-strong) ${nPct}%,
        var(--danger-strong) 100%);"></div>
      <div class="ohk-range-ticks">
        <span style="left:0%">0m</span>
        ${extraMarks.map((m) => `<span style="left:${(m.at / maxDisplay) * 100}%">${m.at}m</span>`).join("")}
        <span style="left:${gPct}%">${guaranteed}m</span>
        ${hasUnstable ? `<span style="left:${nPct}%">${noneFrom}m</span>` : ""}
        <span style="left:100%">${maxLabel}m</span>
      </div>
      <p class="ohk-range-legend">
        <span><i class="ohk-swatch" style="background:var(--success)"></i>${guaranteed}m까지 한방</span>
        ${hasUnstable ? `<span><i class="ohk-swatch" style="background:#d4c25e"></i>${unstableEnd}m까지 불안정</span>` : ""}
        <span><i class="ohk-swatch" style="background:var(--danger-strong)"></i>${noneFrom}m 이후부터 불가</span>
        ${extraMarks.map((m) => `<span><i class="ohk-swatch" style="background:var(--success)"></i>${m.label}</span>`).join("")}
      </p>
      <p class="status-effect-note">※ 실측 기반 참고용 수치이며, ${hasUnstable ? "펠릿 분산 특성상 " : ""}오차가 있을 수 있습니다.</p>
    </div>
  `;
}

// 탄약 하나에 딸린 OHK 막대를 전부 이어붙여 렌더링:
// - ammo.ohkRange: 기본(가슴 정조준 기준) 막대 1개
// - ammo.ohkRangeVariants: [{ label, ohkRange }, ...] 부위별/특성 적용 시 등 추가 막대(기본 막대 바로 아래 순서대로 표시)
// 최대 거리는 샷건 20m / 그 외 한방무기 50m로 고정(무기비교 그래프와 동일한 스케일 통일 규칙 —
// 무기마다 막대 스케일이 다르면 비교가 어려워서 자세히 보기에서도 동일하게 고정함).
function renderOhkRangeSection(ammo, item) {
  const isShotgun = item?.ammoCategory === "shotgun" || ammo.category === "shotgun";
  const maxDisplay = isShotgun ? 20 : 50;
  let html = "";
  if (ammo.ohkRange) html += renderOhkRangeBar(ammo.ohkRange, maxDisplay);
  if (ammo.ohkRangeVariants) {
    ammo.ohkRangeVariants.forEach((v) => {
      html += renderOhkRangeBar(v.ohkRange, maxDisplay, v.label);
    });
  }
  return html;
}

function drawBodyPartChart(currentItem, ammoId, refRange, parentItem) {
  const canvas = document.getElementById("bp-chart");
  if (!canvas) return;

  // 이전 차트 정리
  if (state.charts.bodypart) {
    state.charts.bodypart.destroy();
    state.charts.bodypart = null;
  }

  // 샷건류(낙하곡선 없음): 한방컷 보장거리 데이터가 있으면 그래프 대신 색상 막대로 표시
  const ohkAmmo = getOhkRangeForCurrentAmmo(currentItem, ammoId);
  if (ohkAmmo) {
    canvas.outerHTML = renderOhkRangeSection(ohkAmmo, currentItem);
    return;
  }

  const ds = buildFalloffDataset(currentItem, ammoId, "#ece6d3", 100);
  if (!ds) {
    canvas.outerHTML = `<p class="empty-msg">거리별 데이터 없음</p>`;
    return;
  }
  ds.fill = true;
  ds.backgroundColor = "rgba(236, 230, 211, 0.12)";

  const maxDmg = Math.max(...ds.data.map((d) => d.y));
  const canOHK = maxDmg >= HUNTER_HP;

  const opts = chartOptions("거리 (m)", "피해", { showOHK: canOHK, refRange, xMax: 100, yStepSize: 25 });
  // 애니메이션 비활성화 — 클릭마다 그래프가 다시 올라오는 효과 제거
  opts.animation = false;
  opts.animations = { colors: false, x: false, y: false };
  opts.transitions = { active: { animation: { duration: 0 } } };

  // 어디를 맞춰도(가장 배율 낮은 부위 기준) N발컷이 보장되는 거리 계산 → 연한 세로 점선으로 표시
  const { lines: killLines, partLabel: weakestPartLabel } = computeGuaranteedKillLines(currentItem, ammoId, 100);
  opts.plugins.guaranteedKillLines = { lines: killLines };

  state.charts.bodypart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { datasets: [ds] },
    options: opts,
    plugins: [btkLinesPlugin, guaranteedKillLinesPlugin],
  });

  // 그래프 클릭 → 거리만 갱신 → 마네킹과 표만 새로 그림 (그래프는 그대로 유지)
  canvas.onclick = (evt) => {
    const chart = state.charts.bodypart;
    if (!chart) return;
    const rect = canvas.getBoundingClientRect();
    const xPixel = evt.clientX - rect.left;
    const xValue = Math.round(chart.scales.x.getValueForPixel(xPixel));
    const clamped = Math.max(0, Math.min(100, xValue));
    state.refRange[parentItem.id] = clamped;
    refreshBodyPartDamage(currentItem, ammoId, parentItem);
  };

  // 세로 점선에 마우스를 가져다 대면 커서 옆에 "N발컷 보장" 안내 표시
  const killTooltip = document.getElementById("bp-kill-tooltip");
  canvas.onmousemove = (evt) => {
    const chart = state.charts.bodypart;
    if (!chart || !killTooltip || killLines.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const xPixel = evt.clientX - rect.left;
    const hit = killLines.find((l) => Math.abs(chart.scales.x.getPixelForValue(l.range) - xPixel) < 6);
    if (hit) {
      killTooltip.hidden = false;
      killTooltip.textContent = `${Math.round(hit.range)}m 이내 — 최소피해(${weakestPartLabel}) 기준 ${hit.n} BTK`;
      killTooltip.style.left = `${evt.clientX + 14}px`;
      killTooltip.style.top = `${evt.clientY + 14}px`;
    } else {
      killTooltip.hidden = true;
    }
  };
  canvas.onmouseleave = () => { if (killTooltip) killTooltip.hidden = true; };
}

// 거리만 바뀌었을 때: 마네킹 + 부제목 + BTK 표만 다시 그리기 (그래프는 그대로 유지)
function refreshBodyPartDamage(currentItem, ammoId, parentItem) {
  const { stats, ammo } = resolveWeaponWithAmmo(currentItem, ammoId);
  const baseDmg = stats.damage ?? 0;
  const refRange = state.refRange[parentItem.id] ?? 10;
  const distMult = ammo?.falloff ? interpolateFalloff(ammo.falloff, refRange) : 1;

  // 데미지 계산식: X(숨겨진 무기 데미지) = 표기데미지 / 가슴배율
  //   부위 데미지 = X × 부위 배율 × 거리감쇠값
  const hiddenWeaponDamage = baseDmg / CHEST_MULTIPLIER; // X

  const partMultOverrides = ammo?.bodyPartMultiplierOverrides || {};
  const partInfo = {};
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([key, def]) => {
    if (def.multiplier == null) partInfo[key] = { dmg: null };
    else {
      const mult = partMultOverrides[key] ?? def.multiplier;
      partInfo[key] = { dmg: Math.round(hiddenWeaponDamage * mult * distMult) };
    }
  });

  // 마네킹만 다시 그리기
  const figureEl = document.querySelector(".bodypart-figure");
  if (figureEl) figureEl.innerHTML = renderBodyFigureSVG(partInfo, refRange);
}

// 단순 스탯 행 (자세히 보기용 — 화살표 표기 없음). key를 주면 마우스오버 시 설명 툴팁이 뜸.
// fallback을 주면 값이 없을 때 행 자체를 숨기는 대신 그 문구(예: "정보없음")를 표시함.
function statRowSimple(label, value, key, fallback) {
  if (value == null) {
    if (fallback == null) return "";
    return `<div class="stat-row" ${key ? `data-stat-key="${key}"` : ""}><span>${label}</span><b class="stat-nodata">${fallback}</b></div>`;
  }
  return `<div class="stat-row" ${key ? `data-stat-key="${key}"` : ""}><span>${label}</span><b>${value}</b></div>`;
}

// 무기 스탯 설명 (Hunt: Showdown 공식 위키 원문을 한글로 번역)
const STAT_DESCRIPTIONS = {
  damage: "가슴(상체) 10m 거리에서 명중했을 때의 피해 값입니다.\n샷건은 10m 근접사격 시 평균 피해 기준입니다.",
  dropRange: "탄환이 조준점보다 대략 머리 높이(20cm)만큼 떨어지는 거리(m)입니다.\n조준(ADS) 시 HUD에 표시됩니다.\n탄종, 탄속, 총열 길이, 무기 작동 방식에 따라 낙하율이 달라집니다.",
  rateOfFire: "분당 발사 가능 횟수이며, 재장전 시간도 포함된 값입니다.",
  cycleTime: "다음 사격이 가능해지기까지 걸리는 시간(초)입니다.\n단발 무기는 재장전 시간도 포함됩니다.\n듀얼 웰드의 경우, 먼저 발사한 무기가 다시 준비되는 데 걸리는 시간입니다.",
  spread: "허리 조준(히프파이어) 상태에서 조준선이 벌어지는 정도를 상대적으로 나타낸 값입니다.\n샷건은 상대적으로 더 넓은 분산도를 가집니다.",
  sway: "조준(ADS) 상태에서 무기가 흔들리는 정도를 상대적으로 나타낸 값입니다.",
  verticalRecoil: "사격 후 수직 반동의 세기(도, degree)입니다.",
  reloadSpeed: "탄창이 빈 상태에서 완전히 재장전하는 데 걸리는 시간(초)입니다.\n클립 재장전이나, 마지막 탄을 넣기 전 무기를 조작해야 하는 등의 특수 동작 시간도 포함됩니다.",
  muzzleVelocity: "탄환이 발사될 때의 속도(m/s)입니다.\n탄환은 포물선을 그리며 날아갑니다.",
  meleeLight: "근접 약공격이 상체에 명중했을 때의 피해 값입니다.",
  meleeHeavy: "근접 강공격이 상체에 명중했을 때의 피해 값입니다.",
  staminaConsumption: "근접 약공격 또는 강공격 시 소모되는 기력(100 기준)입니다.",
  // 도구(Tool) 전용 스탯 — huntshowdown.wiki.gg/wiki/Tools "Tool Statistics" 섹션 기준
  damagePerTick: "효과가 지속되는 동안 틱마다 들어가는 피해입니다.",
  effectRadius: "효과가 적용되는 반경(m)입니다.",
  effectDuration: "효과가 지속되는 시간(초)입니다.",
  fuseTimer: "기폭(폭발)까지 걸리는 시간(초)입니다.",
  throwRange: "던질 수 있는 최대 거리(m)입니다.",
  staminaConsumptionHeavy: "근접 강공격 시 소모되는 기력(100 기준)입니다.",
  staminaConsumptionThrow: "투척 시 소모되는 기력(100 기준)입니다.",
  controlRange: "Stalker Beetle 등을 조종할 수 있는 최대 거리(m)입니다.",
};

function closeBodyPartView() {
  document.getElementById("bodypart-overlay").hidden = true;
  const killTooltip = document.getElementById("bp-kill-tooltip");
  if (killTooltip) killTooltip.hidden = true;
  const statTooltip = document.getElementById("stat-tooltip");
  if (statTooltip) statTooltip.hidden = true;
  if (state.charts.bodypart) {
    state.charts.bodypart.destroy();
    state.charts.bodypart = null;
  }
}

// 마네킹 이미지 + 데미지 숫자 오버레이
// 이미지: 1024x1536
function renderBodyFigureSVG(partInfo, refRange) {
  const display = (key) => {
    const info = partInfo[key];
    if (!info) return "";
    return info.dmg == null ? "?" : info.dmg;
  };

  return `
    <svg viewBox="0 0 1024 1536" xmlns="http://www.w3.org/2000/svg" class="body-svg">
      <!-- 배경 이미지: 빈 마네킹 -->
      <image href="images/ui/mannequin.png" x="0" y="0" width="1024" height="1536"/>

      <!-- 거리 표기 (좌상단) -->
      <text x="40" y="90" class="body-range">Range: ${refRange}m</text>

      <!-- 가슴 (중앙) -->
      <text x="510" y="420" class="body-num">${display("chest")}</text>

      <!-- 팔 (좌측 팔꿈치 부근에 하나만) -->
      <text x="270" y="600" class="body-num">${display("arm")}</text>

      <!-- 배 (중앙) -->
      <text x="510" y="720" class="body-num">${display("belly")}</text>

      <!-- 하체 (좌측 무릎 부근에 하나만) -->
      <text x="380" y="1100" class="body-num">${display("lower")}</text>
    </svg>
  `;
}

// 무기 + 탄약을 합쳐서 "실제 적용되는" 스탯/탄창 계산
function resolveWeaponWithAmmo(item, ammoId) {
  const ammo = AMMO_TYPES[ammoId];
  if (!ammo) return { stats: item.stats, chamber: item.chamber, ammo: null };
  const overrides = ammo.statOverrides || {};
  const stats = { ...item.stats, ...overrides };
  const chamber = { ...(item.chamber || {}) };
  if (overrides.ammoExtra != null) chamber.extra = overrides.ammoExtra;
  if (overrides.ammoLoaded != null) chamber.loaded = overrides.ammoLoaded;
  return { stats, chamber, ammo };
}

function renderWeaponDetailHTML(item, selectedAmmoId) {
  // 근접무기는 탄약/그래프 개념이 아예 없어서 훨씬 단순한 전용 레이아웃 사용
  if (item.ammoCategory === "melee") return renderMeleeDetailHTML(item);

  const { stats, chamber, ammo } = resolveWeaponWithAmmo(item, selectedAmmoId);
  const inCompare = state.compareEntries.some((e) => e.weaponId === item.id && e.ammoId === selectedAmmoId);

  // 탄약 탭들 (이미지/아이콘만, 이름은 hover 툴팁으로)
  const ammoTabs = (item.ammoTypes || []).map((aid) => {
    const a = AMMO_TYPES[aid];
    if (!a) return "";
    const active = aid === selectedAmmoId ? "active" : "";
    const visual = a.image
      ? `<img src="${a.image}" alt="${a.label}" class="ammo-tab-img" onerror="this.outerHTML='<span class=ammo-tab-icon>${a.icon ?? "•"}</span>'">`
      : `<span class="ammo-tab-icon">${a.icon ?? "•"}</span>`;
    return `
      <button class="ammo-tab ${active}" data-ammo-id="${aid}" type="button" title="${a.label}${a.scarce ? " (Scarce)" : a.cost ? ` ($${a.cost})` : ""}">
        ${visual}
      </button>`;
  }).join("");

  // 탄약 효과 텍스트
  const effectsHTML = (ammo?.specialEffects || []).map((e) => `<li>${e}</li>`).join("");

  // 탄약 종류가 1개뿐이면(예: 슈레더, 화염소총) 고를 게 없으니 "Ammo Types" 섹션 자체를 숨김
  const hasMultipleAmmo = (item.ammoTypes || []).length > 1;

  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${displayName(item)}</h2>

    ${item.image ? `<img src="${item.image}" alt="${displayName(item)}" class="detail-img" onerror="this.style.display='none'">` : ""}

    <!-- 한 줄: [탄약 아이콘] 장탄/예비탄 [칸수 아이콘] | [달러 아이콘] 가격 -->
    <div class="ammo-status-row">
      ${ammo?.image ? `<img src="${ammo.image}" alt="${ammo.label}" class="ammo-status-icon">` : ""}
      <span class="ammo-status-count">${chamber.loaded ?? "-"}/${chamber.extra ?? "-"}</span>
      <img src="images/ui/slot_${item.slotSize || 1}.png" alt="${item.slotSize}칸" class="ammo-status-slots">
      ${item.scarce
        ? `<img src="images/ui/scarce.png" alt="Scarce" class="ammo-status-dollar" title="Scarce (상점 구매 불가, 월드에서만 획득)">`
        : item.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
    </div>

    ${hasMultipleAmmo ? `
    <h4>Ammo Types</h4>
    <div class="ammo-tabs">${ammoTabs}</div>
    ` : ""}

    ${ammo?.description ? `<p class="detail-desc">${ammo.description}</p>` : ""}
    ${effectsHTML ? `<ul class="ammo-effects">${effectsHTML}</ul>` : ""}

    <h4>거리별 피해</h4>
    <div class="detail-chart-wrap"><canvas id="detail-chart"></canvas></div>

    <div class="detail-action-row">
      <button id="detail-add-compare-btn" type="button" class="compare-btn ${inCompare ? "added" : ""}">
        ${inCompare ? "✓ 비교 목록에 추가됨 (클릭하여 제거)" : "+ 비교 목록에 추가"}
      </button>
      <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
    </div>

    ${renderWeaponReviewSectionHTML()}
  `;
}

// -------------------------------------------------------------------------
// 리드샷(선조준) 계산기 — 게임 밖에서 참고용으로 쓰는 오프라인 계산기.
// FOV/해상도/목표 이동속도를 입력하면 해당 무기 탄속 기준으로 화면상 리드해야 할
// 픽셀 간격을 계산해서 보여줌(실시간 오버레이 아님, 값만 표시).
// -------------------------------------------------------------------------
const LEADSHOT_SETTINGS_KEY = "hsd_leadshot_settings";
const LEADSHOT_DEFAULTS = { fov: 90, width: 1920, height: 1080, targetSpeed: 4.5 };
const LEADSHOT_SPEED_PRESETS = [
  { label: "전력질주", value: 4.5 },
  { label: "뛰기", value: 2.5 },
  { label: "스트레이프", value: 2 },
];

function loadLeadshotSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEADSHOT_SETTINGS_KEY) || "{}");
    return { ...LEADSHOT_DEFAULTS, ...saved };
  } catch {
    return { ...LEADSHOT_DEFAULTS };
  }
}

function saveLeadshotSettings(settings) {
  localStorage.setItem(LEADSHOT_SETTINGS_KEY, JSON.stringify(settings));
}

function leadshotDegToRad(d) { return (d * Math.PI) / 180; }
function leadshotRadToDeg(r) { return (r * 180) / Math.PI; }

// 원본 C# 리드샷 계산식을 그대로 이식 (FOV 슬라이더 값 → 실제 화면 각도로 보정하는
// vfovMultiplier=2.08 상수 포함 — 게임의 FOV 표기가 표준 각도와 다르게 매핑되는 걸 보정)
function calcLeadshotPixels({ width, height, fov, targetSpeed, muzzleVelocity }) {
  if (!width || !height || !fov || !targetSpeed || !muzzleVelocity) return null;
  const VFOV_MULTIPLIER = 2.08;
  const fixedRatioFov = 2 * leadshotRadToDeg(Math.atan(Math.tan(leadshotDegToRad(fov) / 2) / (16 / 9)));
  const actualVfov = fixedRatioFov / VFOV_MULTIPLIER;
  const actualHfov = 2 * leadshotRadToDeg(Math.atan(Math.tan(leadshotDegToRad(actualVfov) / 2) * (width / height)));
  const velocityTangent = targetSpeed / muzzleVelocity;
  const pixelInterval = (0.5 * width * velocityTangent) / Math.tan(leadshotDegToRad(actualHfov) / 2);
  return Math.round(pixelInterval);
}

function renderLeadshotCalcHTML(muzzleVelocity) {
  const s = loadLeadshotSettings();
  const matchedSpeed = LEADSHOT_SPEED_PRESETS.some((p) => p.value === s.targetSpeed) ? s.targetSpeed : LEADSHOT_DEFAULTS.targetSpeed;
  const speedButtons = LEADSHOT_SPEED_PRESETS.map((p) => `
    <button type="button" class="leadshot-speed-btn ${p.value === matchedSpeed ? "active" : ""}" data-speed="${p.value}">
      ${p.label}<small>${p.value} m/s</small>
    </button>
  `).join("");
  return `
    <h4>리드샷 계산기 <span class="leadshot-hint" data-tooltip="표시되는 픽셀 값은 타겟과의 거리와 무관하게 항상 동일합니다.">?</span></h4>
    <div class="leadshot-calc" data-muzzle-velocity="${muzzleVelocity}">
      <div class="leadshot-inputs">
        <label>FOV<input type="text" inputmode="decimal" id="leadshot-fov" value="${s.fov}"></label>
        <div class="leadshot-speed-field">
          <span class="leadshot-speed-label">목표 이동속도</span>
          <div class="leadshot-speed-buttons">${speedButtons}</div>
        </div>
        <label>해상도 너비<input type="text" inputmode="numeric" id="leadshot-width" value="${s.width}"></label>
        <label>해상도 높이<input type="text" inputmode="numeric" id="leadshot-height" value="${s.height}"></label>
      </div>
      <div class="leadshot-result">
        리드 간격 <b id="leadshot-result-px">-</b> px
        <span class="leadshot-result-note">(탄속 ${muzzleVelocity}m/s 기준)</span>
      </div>
    </div>
  `;
}

function bindLeadshotCalc(muzzleVelocity) {
  const calc = document.querySelector(".leadshot-calc");
  if (!calc) return;
  const fovInput = document.getElementById("leadshot-fov");
  const widthInput = document.getElementById("leadshot-width");
  const heightInput = document.getElementById("leadshot-height");
  const resultEl = document.getElementById("leadshot-result-px");
  const speedBtns = calc.querySelectorAll(".leadshot-speed-btn");

  const sanitizeDecimal = (el) => { el.value = el.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); };
  const sanitizeInt = (el) => { el.value = el.value.replace(/[^0-9]/g, ""); };

  function currentSpeed() {
    const active = calc.querySelector(".leadshot-speed-btn.active");
    return active ? Number(active.dataset.speed) : LEADSHOT_DEFAULTS.targetSpeed;
  }

  function recalc() {
    const settings = {
      fov: Number(fovInput.value) || 0,
      targetSpeed: currentSpeed(),
      width: Number(widthInput.value) || 0,
      height: Number(heightInput.value) || 0,
    };
    saveLeadshotSettings(settings);
    const px = calcLeadshotPixels({ ...settings, muzzleVelocity });
    resultEl.textContent = px != null && Number.isFinite(px) ? px : "-";
  }

  [[fovInput, sanitizeDecimal], [widthInput, sanitizeInt], [heightInput, sanitizeInt]]
    .forEach(([el, sanitize]) => {
      el.addEventListener("input", () => { sanitize(el); recalc(); });
    });

  speedBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      speedBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      recalc();
    });
  });

  recalc();
}

// 근접무기 전용 간략히 보기 — 탄약/그래프 없이 근접 스탯만 표시
function renderMeleeDetailHTML(item) {
  const stats = item.stats || {};
  const inCompare = state.compareEntries.some((e) => e.weaponId === item.id && e.ammoId == null);
  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${displayName(item)}</h2>

    ${item.image ? `<img src="${item.image}" alt="${displayName(item)}" class="detail-img" onerror="this.style.display='none'">` : ""}

    <!-- 한 줄: 칸수 | 가격 (근접무기는 탄약이 없어서 장탄/예비탄 표시 없음) -->
    <div class="ammo-status-row">
      <img src="images/ui/slot_${item.slotSize || 1}.png" alt="${item.slotSize}칸" class="ammo-status-slots">
      ${item.scarce
        ? `<img src="images/ui/scarce.png" alt="Scarce" class="ammo-status-dollar" title="Scarce (상점 구매 불가, 월드에서만 획득)">`
        : item.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
    </div>

    ${item.description ? `<p class="detail-desc">${item.description}</p>` : ""}

    <h4>근접 스탯</h4>
    <div class="bp-stats-inline">
      ${statRowSimple("약공격 피해", stats.meleeLight, "meleeLight")}
      ${statRowSimple("강공격 피해", stats.meleeHeavy, "meleeHeavy")}
      ${statRowSimple("기력 소모(강공격)", stats.staminaConsumption, "staminaConsumption")}
    </div>

    <div class="detail-action-row">
      <button id="detail-add-compare-btn" type="button" class="compare-btn ${inCompare ? "added" : ""}">
        ${inCompare ? "✓ 비교 목록에 추가됨 (클릭하여 제거)" : "+ 비교 목록에 추가"}
      </button>
      <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
    </div>

    ${renderWeaponReviewSectionHTML()}
  `;
}

// -------------------------------------------------------------------------
// 무기 평가 — 오른쪽 간략히보기 패널(compact: 대표 한줄평 1개 + 더보기)과
// 자세히 보기 오버레이(full: 전체 한줄평 목록 + 각 한줄평 공감(👍)) 양쪽에서 공용으로 씀.
// 하트(무기 자체에 대한 좋아요)와 한줄평은 서로 완전히 독립 — 하나를 끄거나 지워도
// 다른 하나는 그대로 남음(사용자 확인). 반대(싫어요) 개념 없이 하트만 집계.
// 무기당(파생형 포함) 1인 1개.
// -------------------------------------------------------------------------
function renderWeaponReviewSectionHTML() {
  return `
    <div id="weapon-review-section">
      <h4>무기 평가</h4>
      <div id="weapon-review-heart-row">
        <button id="weapon-review-heart-btn" type="button" disabled>♥ -</button>
      </div>
      <div id="weapon-review-comment-row">
        <input type="text" id="weapon-review-comment-input" maxlength="300" placeholder="한줄평 남기기 (선택)" disabled>
        <button id="weapon-review-comment-submit-btn" type="button" disabled>저장</button>
      </div>
      <div id="weapon-review-list">불러오는 중...</div>
    </div>
  `;
}

// root: 이 안에서만 id를 찾음 — 오른쪽 간략히보기 패널과 자세히 보기 오버레이가
// 동시에 DOM에 떠 있을 때(오버레이는 패널 위에 겹쳐 뜸) 같은 id(#weapon-review-*)가
// 문서에 두 벌 존재하게 되어, document.getElementById만 쓰면 항상 먼저 나오는 쪽(패널)만
// 잡혀서 오버레이 쪽 하트/한줄평/공감이 반영 안 되는 버그가 있었음 — 컨테이너로 범위를 좁혀서 해결.
function bindWeaponReviewSection(item, options = {}) {
  const full = !!options.full;
  const root = options.root || document;
  const heartBtn = root.querySelector("#weapon-review-heart-btn");
  const input = root.querySelector("#weapon-review-comment-input");
  const submitBtn = root.querySelector("#weapon-review-comment-submit-btn");
  const listEl = root.querySelector("#weapon-review-list");
  if (!heartBtn) return;

  // 파생형마다 스탯이 실제로 다른 별개 무기 취급이라(예: 르맷 vs 르맷 카빈), 평가도
  // 파생형별로 따로 집계한다(item.id 자체가 이미 파생형까지 구분된 값).
  const weaponId = item.id;

  const sortByAgreeThenRecent = (a, b) =>
    b.agreeCount - a.agreeCount || (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);

  let myUid = null;

  const renderCommentRow = (r, showAgree) => {
    const row = document.createElement("div");
    row.className = "weapon-review-item";
    const textEl = document.createElement("span");
    textEl.className = "weapon-review-item-text";
    // 남이 남긴 자유 텍스트라 반드시 textContent로만 그린다(XSS 방지)
    textEl.textContent = r.text;
    row.appendChild(textEl);

    const actions = document.createElement("div");
    actions.className = "weapon-review-item-actions";

    if (showAgree) {
      const agreeBtn = document.createElement("button");
      agreeBtn.type = "button";
      agreeBtn.className = `weapon-review-agree-btn${r.iAgreed ? " agreed" : ""}`;
      agreeBtn.textContent = `👍 ${r.agreeCount}`;
      agreeBtn.addEventListener("click", async () => {
        if (!window.LoadoutCloud) return;
        agreeBtn.disabled = true;
        try {
          await window.LoadoutCloud.toggleWeaponCommentAgree(weaponId, r.id, r.iAgreed);
          await refresh();
        } catch {
          showToast("처리에 실패했습니다.");
        } finally {
          agreeBtn.disabled = false;
        }
      });
      actions.appendChild(agreeBtn);
    }

    // 본인이 남긴 한줄평에만 삭제 버튼 표시(하트는 그대로 두고 한줄평 텍스트만 지움)
    if (myUid && r.id === myUid) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "weapon-review-delete-btn";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", async () => {
        if (!window.LoadoutCloud) return;
        delBtn.disabled = true;
        try {
          await window.LoadoutCloud.saveWeaponComment(weaponId, "");
          await refresh();
        } catch {
          showToast("삭제에 실패했습니다.");
          delBtn.disabled = false;
        }
      });
      actions.appendChild(delBtn);
    }

    row.appendChild(actions);
    return row;
  };

  const renderList = (reviews) => {
    const withText = reviews.filter((r) => r.text);
    listEl.innerHTML = "";
    if (withText.length === 0) {
      listEl.textContent = "아직 한줄평이 없습니다.";
      return;
    }
    const sorted = [...withText].sort(sortByAgreeThenRecent);
    if (full) {
      sorted.forEach((r) => listEl.appendChild(renderCommentRow(r, true)));
      return;
    }
    // 간략히보기: 공감 많이 받은 대표 한줄평 1개만 + 자세히 보기로 이동하는 링크
    listEl.appendChild(renderCommentRow(sorted[0], false));
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.id = "weapon-review-more-btn";
    moreBtn.textContent = `한줄평 ${withText.length}개 전체 보기 →`;
    moreBtn.addEventListener("click", () => {
      const parent = ITEMS.find((i) => i.id === (item._trueParentId || item.id)) || item;
      state.selectedVariantIdx[parent.id] = item._variantIndex || 0;
      openBodyPartView(parent, item.defaultAmmo || (item.ammoTypes && item.ammoTypes[0]));
    });
    listEl.appendChild(moreBtn);
  };

  const refresh = async () => {
    if (!window.LoadoutCloud) return;
    try {
      if (myUid == null) myUid = await window.LoadoutCloud.getCurrentUid().catch(() => null);
      const { reviews, likeCount, myReview } = await window.LoadoutCloud.getWeaponReviews(weaponId);
      heartBtn.textContent = `♥ ${likeCount}`;
      heartBtn.classList.toggle("liked", !!myReview?.liked);
      heartBtn.disabled = false;
      input.disabled = false;
      submitBtn.disabled = false;
      input.value = myReview?.text || "";
      renderList(reviews);
    } catch {
      listEl.textContent = "평가를 불러오지 못했습니다.";
    }
  };

  heartBtn.addEventListener("click", async () => {
    if (!window.LoadoutCloud) return;
    heartBtn.disabled = true;
    try {
      const currentlyLiked = heartBtn.classList.contains("liked");
      await window.LoadoutCloud.setWeaponHeart(weaponId, !currentlyLiked);
      await refresh();
    } catch {
      showToast("처리에 실패했습니다.");
      heartBtn.disabled = false;
    }
  });

  submitBtn.addEventListener("click", async () => {
    if (!window.LoadoutCloud) return;
    submitBtn.disabled = true;
    try {
      await window.LoadoutCloud.saveWeaponComment(weaponId, input.value);
      await refresh();
    } catch {
      showToast("저장에 실패했습니다.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  refresh();
}

// 도구(Tool) 스탯 표시 순서/라벨 — 무기 스탯란(STAT_DEFS)과 동일한 스타일로,
// 도구 전용 스탯(effectRadius 등)과 무기 스탯 체계를 쓰는 도구(Flare Pistol 등)의
// 스탯을 하나의 표에서 함께 다룰 수 있도록 키를 합쳐놓음. item.stats에 없는 키는
// statRowSimple이 알아서 건너뜀.
const TOOL_STAT_DEFS = [
  { key: "damage", label: "피해" },
  { key: "damagePerTick", label: "틱당 피해" },
  { key: "dropRange", label: "낙하 범위" },
  { key: "effectRadius", label: "효과 반경" },
  { key: "effectDuration", label: "효과 지속" },
  { key: "fuseTimer", label: "기폭 시간" },
  { key: "throwRange", label: "투척 사거리" },
  { key: "controlRange", label: "조종 거리" },
  { key: "rateOfFire", label: "발사속도" },
  { key: "cycleTime", label: "사이클 시간" },
  { key: "spread", label: "분산도" },
  { key: "sway", label: "흔들림" },
  { key: "verticalRecoil", label: "수직 반동" },
  { key: "reloadSpeed", label: "재장전 속도" },
  { key: "muzzleVelocity", label: "총구속도" },
  { key: "meleeLight", label: "약공격 피해" },
  { key: "meleeHeavy", label: "강공격 피해" },
  { key: "staminaConsumption", label: "기력 소모(약공격)" },
  { key: "staminaConsumptionHeavy", label: "기력 소모(강공격)" },
  { key: "staminaConsumptionThrow", label: "기력 소모(투척)" },
];

// 도구(category:"tool") 전용 요약 패널 — 무기 자세히보기의 스탯란(detail-stats/bp-stats-inline)과
// 동일한 스타일 재사용. 잠금 계급 등 부가 텍스트는 표시하지 않고, 탄약 대신 수량(uses)을 표시.
// (사용자 확인 — 도구/소모품은 마네킹/그래프가 있는 전용 "자세히 보기" 화면 자체가 필요 없음)
function renderToolDetailHTML(item) {
  const stats = item.stats || {};
  const countHTML = item.chamber
    ? `<span class="ammo-status-count">${item.chamber.loaded ?? "-"}/${item.chamber.extra ?? "-"}</span>`
    : item.uses != null
      ? `<span class="ammo-status-count">수량 ${item.uses}</span>`
      : "";

  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${displayName(item)}</h2>

    ${item.image ? `<img src="${item.image}" alt="${displayName(item)}" class="detail-img detail-img--tool" onerror="this.style.display='none'">` : ""}

    <!-- 한 줄: 수량(또는 탄약) | 가격 -->
    <div class="ammo-status-row">
      ${countHTML}
      ${item.scarce
        ? `<img src="images/ui/scarce.png" alt="Scarce" class="ammo-status-dollar" title="Scarce (상점 구매 불가, 월드에서만 획득)">`
        : item.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
    </div>

    <h4>도구 스탯</h4>
    <div class="detail-stats bp-stats-inline">
      ${TOOL_STAT_DEFS.map((d) => statRowSimple(d.label, stats[d.key], d.key)).join("")}
    </div>

    <div class="detail-action-row">
      <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
    </div>
  `;
}

// 소모품(category:"consumable") 전용 요약 패널 — 도구와 동일한 스탯란 스타일 재사용.
// 소모품은 1회용이라 도구처럼 수량/탄약 표시가 없고, 가격만 표시.
// 설명 문단은 "스탯만 봐서는 뭘 하는 아이템인지 알기 어려운" 종류만 표시함
// (주사기류=지속효과/치유, 박스류=재보급, 타로 카드) — 폭탄류는 피해/범위 스탯으로
// 충분히 설명되니 생략(사용자 확인 2026-07-16).
const CONSUMABLE_DESC_CLASSES = ["resupply", "over_time", "healing", "tarot"];
function renderConsumableDetailHTML(item) {
  const stats = item.stats || {};
  const showDesc = CONSUMABLE_DESC_CLASSES.includes(item.consumableClass);
  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${displayName(item)}</h2>

    ${item.image ? `<img src="${item.image}" alt="${displayName(item)}" class="detail-img detail-img--tool" onerror="this.style.display='none'">` : ""}

    <div class="ammo-status-row">
      ${item.scarce
        ? `<img src="images/ui/scarce.png" alt="Scarce" class="ammo-status-dollar" title="Scarce (상점 구매 불가, 월드에서만 획득)">`
        : item.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
    </div>

    ${showDesc && item.description ? `<p class="detail-desc">${item.description}</p>` : ""}

    <h4>소모품 스탯</h4>
    <div class="detail-stats bp-stats-inline">
      ${TOOL_STAT_DEFS.map((d) => statRowSimple(d.label, stats[d.key], d.key)).join("")}
    </div>

    <div class="detail-action-row">
      <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
    </div>
  `;
}

// 특성(category:"trait") 전용 요약 패널 — 대부분 텍스트 효과라 스탯란은 값이 있을 때만 표시.
function renderTraitDetailHTML(item) {
  const stats = item.stats || {};
  const hasNumericStats = TOOL_STAT_DEFS.some((d) => stats[d.key] != null);
  const tagLabels = (item.traitTags || [])
    .map((t) => TRAIT_FILTERS.traitTags.options.find((o) => o.value === t)?.label)
    .filter(Boolean);
  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${displayName(item)}</h2>

    ${(item.detailImage || item.image) ? `<img src="${item.detailImage || item.image}" alt="${displayName(item)}" class="detail-img detail-img--trait" onerror="this.style.display='none'">` : ""}

    ${item.price != null ? `
    <div class="ammo-status-row">
      <img src="images/ui/upgrade_points.webp" alt="업그레이드 포인트" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>
    </div>` : ""}

    ${tagLabels.length ? `<div class="trait-tag-badges">${tagLabels.map((l) => `<span class="trait-tag-badge">${l}</span>`).join("")}</div>` : ""}

    ${item.description ? `<p class="detail-desc">${item.description}</p>` : ""}

    ${hasNumericStats ? `
    <h4>스탯</h4>
    <div class="detail-stats bp-stats-inline">
      ${TOOL_STAT_DEFS.map((d) => statRowSimple(d.label, stats[d.key], d.key)).join("")}
    </div>` : ""}

    <div class="detail-action-row">
      <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
    </div>
  `;
}

// 탄약이 기본값에서 바뀐 스탯은 화살표 표기
function statRow(label, value, baseValue) {
  if (value == null) return "";
  const changed = baseValue != null && value !== baseValue;
  const arrow = changed ? `<span class="stat-base">${baseValue} →</span> ` : "";
  return `<div class="stat-row ${changed ? "stat-changed" : ""}"><span>${label}</span><b>${arrow}${value}</b></div>`;
}

function overrideMark(val, baseVal) {
  if (val == null) return "-";
  if (baseVal != null && val !== baseVal) {
    return `<span class="stat-base">${baseVal} →</span> ${val}`;
  }
  return val;
}

function renderGenericDetailHTML(item) {
  const cat = CATEGORIES[item.category];
  const metaList = Object.entries(item.meta || {})
    .map(([key, val]) => `<li><span>${key}</span>: ${val}</li>`).join("");
  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${displayName(item)}</h2>
    <p class="detail-category">${cat?.label ?? item.category}</p>
    ${item.image ? `<img src="${item.image}" alt="${displayName(item)}" class="detail-img" onerror="this.style.display='none'">` : ""}
    ${item.description ? `<p class="detail-desc">${item.description}</p>` : ""}
    <h4>세부 정보</h4>
    <ul class="detail-meta">${metaList || "<li>없음</li>"}</ul>

    <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
  `;
}

// -------------------------------------------------------------------------
// Chart.js
// -------------------------------------------------------------------------
function buildFalloffDataset(item, ammoId, color, xMax = 100) {
  const { stats, ammo } = resolveWeaponWithAmmo(item, ammoId);
  if (!ammo || !ammo.falloff || ammo.falloff.length === 0) return null;

  const baseDmg = stats.damage ?? 0;
  const keypoints = ammo.falloff;
  const maxRange = keypoints[keypoints.length - 1][0];

  // 키포인트(꺾이는 지점) 거리값 Set — 그래프에 점으로 표시할 위치
  const keypointRanges = new Set(keypoints.map(([r]) => r));

  // 1m 단위로 촘촘하게 데이터를 만들어야 마우스오버 시 커서 위치의 거리(m)가
  // 정확하게 표시됨. 단, 반올림(Math.round)을 하면 평평한 구간에서 값이
  // 계단식으로 튀어보이므로, 실제 값(소수)을 그대로 저장해 선은 완전히
  // 매끈하게 유지하고, 반올림은 툴팁에 표시할 때만 한다.
  const dataMax = Math.min(maxRange, xMax);
  const data = [];
  for (let r = 0; r <= dataMax; r++) {
    data.push({ x: r, y: baseDmg * interpolateFalloff(keypoints, r) });
  }

  return {
    label: `${displayName(item)} · ${ammo.label}`,
    data,
    borderColor: color,
    backgroundColor: color + "22",
    borderWidth: 2,
    tension: 0,
    stepped: false,
    fill: false,
    // 점은 꺾이는 지점(keypoint)에만 보이게
    pointRadius: (ctx) => keypointRanges.has(ctx.parsed?.x) ? 3 : 0,
    pointHoverRadius: (ctx) => keypointRanges.has(ctx.parsed?.x) ? 5 : 3,
    pointBackgroundColor: color,
    pointBorderColor: color,
    pointHitRadius: 10,
  };
}

// 거리별 데미지 낙하 곡선(falloff)이 없는 무기(샷건 등 OHK 바 방식)인지 확인하고,
// 있다면 { item, ammo, color, ohkRange } 형태로 반환. falloff가 있으면(=일반 낙하 그래프
// 대상이면) null — 낙하 곡선 그래프와 OHK 거리 비교 그래프는 서로 겹치지 않게 분리해서 그림.
function getOhkCompareEntry(item, ammoId, color) {
  const { ammo } = resolveWeaponWithAmmo(item, ammoId);
  if (!ammo || ammo.falloff || !ammo.ohkRange) return null;
  return { item, ammo, color, ohkRange: ammo.ohkRange };
}

// 키포인트 배열에서 임의의 거리 r에 해당하는 배율을 선형 보간
// falloff 곡선에서 특정 배율(targetMult)에 도달하는 거리를 역으로 찾음.
// falloff는 거리가 늘어날수록 배율이 같거나 줄어든다고 가정.
// 반환값: 그 거리(m) 또는 null(0m에서도 도달 불가능한 경우)
function findRangeForMultiplier(keypoints, targetMult, maxRange) {
  const m0 = keypoints[0][1];
  if (targetMult > m0) return null; // 0m에서도 이 배율에 못 미침 → 불가능

  for (let i = 0; i < keypoints.length - 1; i++) {
    const [r1, m1] = keypoints[i];
    const [r2, m2] = keypoints[i + 1];
    if (targetMult <= m1 && targetMult >= m2) {
      if (m1 === m2) return r1;
      const t = (m1 - targetMult) / (m1 - m2);
      return r1 + t * (r2 - r1);
    }
  }
  // falloff 데이터 끝까지도 targetMult 이상을 유지하는 경우 → 표시 범위 끝까지 보장
  const lastMult = keypoints[keypoints.length - 1][1];
  if (targetMult <= lastMult) return Math.min(keypoints[keypoints.length - 1][0], maxRange);
  return null;
}

function interpolateFalloff(keypoints, r) {
  if (r <= keypoints[0][0]) return keypoints[0][1];
  if (r >= keypoints[keypoints.length - 1][0]) return keypoints[keypoints.length - 1][1];
  for (let i = 0; i < keypoints.length - 1; i++) {
    const [r1, m1] = keypoints[i];
    const [r2, m2] = keypoints[i + 1];
    if (r >= r1 && r <= r2) {
      const t = (r - r1) / (r2 - r1);
      return m1 + (m2 - m1) * t;
    }
  }
  return keypoints[keypoints.length - 1][1];
}

function drawWeaponChart(item, ammoId) {
  const canvas = document.getElementById("detail-chart");
  if (!canvas) return;

  // 샷건류(낙하곡선 없음): 한방컷 보장거리 데이터가 있으면 그래프 대신 색상 막대로 표시
  const ohkAmmo = getOhkRangeForCurrentAmmo(item, ammoId);
  if (ohkAmmo) {
    canvas.outerHTML = renderOhkRangeSection(ohkAmmo, item);
    return;
  }

  const ds = buildFalloffDataset(item, ammoId, "#ece6d3");
  if (!ds) {
    canvas.outerHTML = `<p class="empty-msg">거리별 데이터 없음</p>`;
    return;
  }
  ds.fill = true;
  ds.backgroundColor = "rgba(236, 230, 211, 0.12)";

  // 이 무기가 1발 킬(OHK)이 가능한가? — 최대 데미지가 150 이상이면 표시
  const maxDmg = Math.max(...ds.data.map((d) => d.y));
  const canOHK = maxDmg >= HUNTER_HP;

  const currentRef = state.refRange[item.id] ?? 10;

  state.charts.detail = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { datasets: [ds] },
    options: chartOptions("거리 (m)", "피해", { showOHK: canOHK, refRange: currentRef }),
    plugins: [btkLinesPlugin, refRangePlugin],
  });

  // 그래프 클릭 → 클릭한 x값을 기준 거리로 저장
  canvas.onclick = (evt) => {
    const chart = state.charts.detail;
    if (!chart) return;
    const xScale = chart.scales.x;
    const rect = canvas.getBoundingClientRect();
    const xPixel = evt.clientX - rect.left;
    const xValue = Math.round(xScale.getValueForPixel(xPixel));
    const clamped = Math.max(0, Math.min(100, xValue));
    state.refRange[item.id] = clamped;

    // 차트 옵션 갱신해서 즉시 다시 그림
    chart.options.btkLines.refRange = clamped;
    chart.update("none");

    // 부위 데미지 화면이 열려있으면 같이 갱신
    if (!document.getElementById("bodypart-overlay").hidden) {
      openBodyPartView(item, ammoId);
    }
  };
}

function chartOptions(xLabel, yLabel, opts = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    btkLines: { showOHK: opts.showOHK === true, refRange: opts.refRange },
    interaction: { mode: "index", intersect: false, axis: "x" },
    plugins: {
      legend: { labels: { color: "#aba894" } },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: (items) => items.length ? `거리: ${items[0].parsed.x}m` : "",
          label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { type: "linear", min: 0, max: opts.xMax ?? 100,
           title: { display: true, text: xLabel, color: "#aba894" },
           ticks: { color: "#aba894" }, grid: { color: "rgba(77, 86, 64, 0.3)" } },
      y: { beginAtZero: true, max: 150, title: { display: true, text: yLabel, color: "#aba894" },
           ticks: { color: "#aba894", stepSize: opts.yStepSize ?? 30 }, grid: { color: "rgba(77, 86, 64, 0.3)" } },
    },
  };
}

// BTK/OHK 가이드 라인은 표시하지 않음 (요청에 따라 비활성화)
const btkLinesPlugin = {
  id: "btkLines",
  afterDatasetsDraw() {
    // 의도적으로 빈 함수
  },
};

// 기준 거리 플러그인 — 시각적 선/라벨은 표시하지 않고 상태만 유지
// (그래프 클릭으로 거리는 갱신되지만 화면에는 선이 안 그려짐)
const refRangePlugin = {
  id: "refRange",
  afterDatasetsDraw() {
    // 의도적으로 빈 함수 — 세로선 제거 요청 반영
  },
};

// 어디를 맞춰도(가장 배율이 낮은 부위 기준) N발컷이 보장되는 거리를 계산
function computeGuaranteedKillLines(currentItem, ammoId, maxRange) {
  const { stats, ammo } = resolveWeaponWithAmmo(currentItem, ammoId);
  const baseDmg = stats.damage ?? 0;
  const keypoints = ammo?.falloff;
  if (!keypoints || !keypoints.length || baseDmg <= 0) return { lines: [], partLabel: "" };

  // 데미지 배율이 가장 낮은 부위 찾기 (예: 하체)
  let lowestKey = null;
  let lowestMult = Infinity;
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([k, def]) => {
    if (def.multiplier != null && def.multiplier < lowestMult) {
      lowestMult = def.multiplier;
      lowestKey = k;
    }
  });
  if (lowestKey === null) return { lines: [], partLabel: "" };
  const partLabel = BODY_PART_MULTIPLIERS[lowestKey].label;

  const lines = [];
  [3, 2, 1].forEach((n) => {
    // 가장 약한 부위를 맞춰도 n발에 죽으려면 필요한 "표기 데미지(가슴 환산)" 값
    const neededChestDmg = (HUNTER_HP * CHEST_MULTIPLIER) / (lowestMult * n);
    const targetMult = neededChestDmg / baseDmg;
    const range = findRangeForMultiplier(keypoints, targetMult, maxRange);
    if (range != null) lines.push({ n, range: Math.min(range, maxRange) });
  });
  return { lines, partLabel };
}

// N발컷 보장 거리를 연한 세로 점선으로 표시 (텍스트 라벨은 그리지 않고, 마우스오버 시 커서 옆에 안내)
const guaranteedKillLinesPlugin = {
  id: "guaranteedKillLines",
  afterDatasetsDraw(chart) {
    const lines = chart.options.plugins?.guaranteedKillLines?.lines;
    if (!lines || !lines.length) return;
    const { ctx, chartArea, scales } = chart;
    ctx.save();
    ctx.strokeStyle = "rgba(236, 230, 211, 0.28)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    lines.forEach((l) => {
      const x = scales.x.getPixelForValue(l.range);
      if (x < chartArea.left || x > chartArea.right) return;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    });
    ctx.restore();
  },
};

function drawGuideLine(ctx, scales, chartArea, yValue, color, label) {
  // y값이 차트 표시 범위를 벗어나면 그리지 않음
  if (yValue > scales.y.max || yValue < scales.y.min) return;

  const yPixel = scales.y.getPixelForValue(yValue);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(chartArea.left, yPixel);
  ctx.lineTo(chartArea.right, yPixel);
  ctx.stroke();

  // 라벨 (우측에 표기)
  ctx.textAlign = "right";
  ctx.fillText(label, chartArea.right - 6, yPixel - 8);
}

// -------------------------------------------------------------------------
// 모달
// -------------------------------------------------------------------------
// categoryFilter: "weapon" | "tool" | "consumable" | "trait" | "tool_consumable"(도구+소모품 통합 칸)
function openPicker(categoryFilter, onSelect) {
  const merged = categoryFilter === "tool_consumable";
  state.picker.merged = merged;
  state.picker.categoryFilter = merged ? "tool" : categoryFilter;
  state.picker.onSelect = onSelect;

  document.getElementById("picker-empty-state").hidden = true;
  document.getElementById("picker-content").hidden = false;

  document.getElementById("picker-title").textContent =
    merged ? "도구 & 소모품 선택" : `${CATEGORIES[categoryFilter]?.label ?? categoryFilter} 선택`;
  document.getElementById("picker-search-input").hidden = false;
  document.getElementById("picker-search-input").value = "";

  const subtabsWrap = document.getElementById("picker-subtabs");
  if (merged) {
    subtabsWrap.hidden = false;
    renderPickerSubtabs();
  } else {
    subtabsWrap.hidden = true;
    subtabsWrap.innerHTML = "";
  }

  showPickerFiltersFor(state.picker.categoryFilter);
  renderPickerList("");
}

// "도구 & 소모품" 통합 칸을 고를 때 위에 뜨는 도구/소모품 전환 탭
function renderPickerSubtabs() {
  const wrap = document.getElementById("picker-subtabs");
  wrap.innerHTML = "";
  [["tool", "도구"], ["consumable", "소모품"]].forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "picker-subtab-btn";
    if (state.picker.categoryFilter === key) btn.classList.add("active");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      state.picker.categoryFilter = key;
      showPickerFiltersFor(key);
      renderPickerSubtabs();
      renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
    });
    wrap.appendChild(btn);
  });
}

// 카테고리에 맞는 필터 UI만 보이도록 하고 나머지는 숨김 (매번 필터 상태 초기화)
function showPickerFiltersFor(categoryFilter) {
  state.pickerWeaponFilters = { slotSize: new Set(), ammoCategory: new Set(), ammoEffect: new Set() };
  const weaponWrap = document.getElementById("picker-weapon-filters");
  if (categoryFilter === "weapon") { weaponWrap.hidden = false; renderPickerWeaponFilters(); }
  else { weaponWrap.hidden = true; weaponWrap.innerHTML = ""; }

  state.pickerToolFilters = { toolClass: new Set(), toolTags: new Set() };
  const toolWrap = document.getElementById("picker-tool-filters");
  if (categoryFilter === "tool") { toolWrap.hidden = false; renderPickerToolFilters(); }
  else { toolWrap.hidden = true; toolWrap.innerHTML = ""; }

  state.pickerConsumableFilters = { consumableClass: new Set(), consumableTags: new Set() };
  const consumableWrap = document.getElementById("picker-consumable-filters");
  if (categoryFilter === "consumable") { consumableWrap.hidden = false; renderPickerConsumableFilters(); }
  else { consumableWrap.hidden = true; consumableWrap.innerHTML = ""; }

  state.pickerTraitFilters = { traitClass: new Set(), traitTags: new Set() };
  const traitWrap = document.getElementById("picker-trait-filters");
  if (categoryFilter === "trait") { traitWrap.hidden = false; renderPickerTraitFilters(); }
  else { traitWrap.hidden = true; traitWrap.innerHTML = ""; }
}

// 로드아웃 빌더의 무기 선택 모달 전용 필터 UI (메인 검색의 필터와 동일한 구성, 상태만 별도)
function renderPickerWeaponFilters() {
  const wrap = document.getElementById("picker-weapon-filters");
  wrap.innerHTML = "";
  Object.entries(WEAPON_FILTERS).forEach(([filterKey, def]) => {
    // 로드아웃 빌더 피커에서는 "탄약 종류"(ammoEffect) 필터를 없애고 목록을 곧바로
    // 붙여서 보여줌(사용자 요청) — 메인 검색 페이지의 renderWeaponFilters는 영향 없음.
    if (filterKey === "ammoEffect") return;
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    let options = def.options;
    if (filterKey === "ammoEffect") {
      const available = getAvailableAmmoEffectValues(state.pickerWeaponFilters.ammoCategory);
      if (available) options = def.options.filter((opt) => available.has(opt.value));
    }

    options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.pickerWeaponFilters[filterKey].has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        const set = state.pickerWeaponFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        if (filterKey === "ammoCategory") pruneAmmoEffectFilter(state.pickerWeaponFilters);
        renderPickerWeaponFilters();
        renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
}

// 로드아웃 빌더의 도구 선택 모달 전용 필터 UI (메인 검색의 도구 필터와 동일한 구성, 상태만 별도)
function renderPickerToolFilters() {
  const wrap = document.getElementById("picker-tool-filters");
  wrap.innerHTML = "";
  Object.entries(TOOL_FILTERS).forEach(([filterKey, def]) => {
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    def.options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.pickerToolFilters[filterKey].has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        const set = state.pickerToolFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        renderPickerToolFilters();
        renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
}

// 로드아웃 빌더의 소모품 선택 모달 전용 필터 UI (메인 검색의 소모품 필터와 동일한 구성, 상태만 별도)
function renderPickerConsumableFilters() {
  const wrap = document.getElementById("picker-consumable-filters");
  wrap.innerHTML = "";
  Object.entries(CONSUMABLE_FILTERS).forEach(([filterKey, def]) => {
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    def.options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.pickerConsumableFilters[filterKey].has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        const set = state.pickerConsumableFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        renderPickerConsumableFilters();
        renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
}

// 로드아웃 빌더의 특성 선택 모달 전용 필터 UI (메인 검색의 특성 필터와 동일한 구성, 상태만 별도)
function renderPickerTraitFilters() {
  const wrap = document.getElementById("picker-trait-filters");
  wrap.innerHTML = "";
  Object.entries(TRAIT_FILTERS).forEach(([filterKey, def]) => {
    const group = document.createElement("div");
    group.className = "weapon-filter-group";
    const label = document.createElement("span");
    label.className = "weapon-filter-label";
    label.textContent = def.label;
    group.appendChild(label);
    const chips = document.createElement("div");
    chips.className = "weapon-filter-chips";

    def.options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.pickerTraitFilters[filterKey].has(opt.value)) chip.classList.add("active");

      if (opt.image) {
        chip.classList.add("filter-chip-icon");
        chip.title = opt.label;
        const img = document.createElement("img");
        img.src = opt.image;
        img.alt = opt.label;
        img.className = `filter-chip-img filter-chip-img--${filterKey}`;
        img.onerror = () => { chip.classList.remove("filter-chip-icon"); chip.textContent = opt.label; };
        chip.appendChild(img);
      } else {
        chip.textContent = opt.label;
      }

      chip.addEventListener("click", () => {
        const set = state.pickerTraitFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
        else set.add(opt.value);
        renderPickerTraitFilters();
        renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
}

function closePicker() {
  document.getElementById("picker-content").hidden = true;
  document.getElementById("picker-empty-state").hidden = false;
  document.getElementById("picker-search-input").hidden = false;
  document.getElementById("picker-subtabs").hidden = true;
  document.getElementById("picker-weapon-filters").hidden = true;
  document.getElementById("picker-tool-filters").hidden = true;
  document.getElementById("picker-consumable-filters").hidden = true;
  document.getElementById("picker-trait-filters").hidden = true;
  state.picker.onSelect = null;
  state.picker.categoryFilter = null;
  state.picker.merged = false;
}

function renderPickerList(query) {
  const list = document.getElementById("picker-item-list");
  list.innerHTML = "";
  // 무기 선택창은 자리가 넓어졌으니 가로로 긴 카드로(무기 이미지가 원래 가로로 길어서 더 잘 보임)
  list.classList.toggle("picker-item-list--wide", state.picker.categoryFilter === "weapon");
  const items = getFilteredItems({
    category: state.picker.categoryFilter, query,
    useWeaponFilters: true, filterSource: state.pickerWeaponFilters,
    useToolFilters: true, toolFilterSource: state.pickerToolFilters,
    useConsumableFilters: true, consumableFilterSource: state.pickerConsumableFilters,
    useTraitFilters: true, traitFilterSource: state.pickerTraitFilters,
  });
  if (items.length === 0) {
    list.innerHTML = `<p class="empty-msg">선택할 수 있는 아이템이 없습니다.</p>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "picker-item-row";
    row.innerHTML = `
      ${item.image ? `<img src="${item.image}" alt="" class="picker-item-thumb${item.category === "weapon" ? " picker-item-thumb--weapon" : ""}" onerror="this.style.display='none'">` : `<span class="picker-item-thumb-placeholder"></span>`}
      <span class="picker-item-name">${displayName(item)}</span>
      ${(() => {
        const isTraitScarce = item.category === "trait" && item.traitTags?.includes("scarce");
        if (item.scarce || isTraitScarce) {
          return `<span class="picker-item-price"><img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`;
        }
        if (item.price == null) return "";
        // 특성은 헌트 달러가 아니라 업그레이드 포인트를 씀(재화가 다름)
        const priceIcon = item.category === "trait" ? "images/ui/upgrade_points.webp" : "images/ui/hunt_dollars.png";
        const priceAlt = item.category === "trait" ? "업그레이드 포인트" : "$";
        return `<span class="picker-item-price"><img src="${priceIcon}" alt="${priceAlt}">${item.price}</span>`;
      })()}
    `;
    row.addEventListener("click", () => {
      // 무기는 클릭하면 바로 확정하지 않고 탄약 선택 단계로 이동
      // (이중탄약 무기는 여기서 "주 탄약"만 고르고, 2번째/언더배럴 탄약은 기본값으로 자동
      //  채워진 뒤 장비판에서 따로 다시 고를 수 있음 — openPrimaryAmmoPicker/openSecondaryAmmoPicker)
      if (item.category === "weapon" && item.ammoTypes && item.ammoTypes.length > 0) {
        renderPickerAmmoStep(item, { ammoIds: getPrimaryAmmoOptions(item) });
      } else if (state.picker.onSelect) {
        state.picker.onSelect(item, null);
      }
    });
    list.appendChild(row);
  });
}

// 무기 선택 후 탄약을 고르는 단계 (가격도 함께 표시)
// options.ammoIds: 보여줄 탄약 id 목록(기본은 weaponItem.ammoTypes 전체)
// options.title: 상단 타이틀 접미사(기본 "탄약 선택")
// options.onPick(ammoId): 탄약을 클릭했을 때 실행할 콜백(기본은 state.picker.onSelect(weaponItem, ammoId))
function renderPickerAmmoStep(weaponItem, options = {}) {
  const ammoIds = options.ammoIds || weaponItem.ammoTypes;
  const titleSuffix = options.title || "탄약 선택";
  const onPick = options.onPick || ((ammoId) => { if (state.picker.onSelect) state.picker.onSelect(weaponItem, ammoId); });

  document.getElementById("picker-title").textContent = `${displayName(weaponItem)} — ${titleSuffix}`;
  document.getElementById("picker-search-input").hidden = true;

  const list = document.getElementById("picker-item-list");
  list.innerHTML = "";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "picker-back-btn";
  backBtn.textContent = "← 무기 목록으로";
  backBtn.addEventListener("click", () => {
    document.getElementById("picker-search-input").hidden = false;
    document.getElementById("picker-title").textContent =
      `${CATEGORIES[state.picker.categoryFilter]?.label ?? state.picker.categoryFilter} 선택`;
    renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
  });
  list.appendChild(backBtn);

  ammoIds.forEach((ammoId) => {
    const ammo = AMMO_TYPES[ammoId];
    if (!ammo) return;
    const row = document.createElement("div");
    row.className = "picker-item-row";
    row.innerHTML = `
      ${ammo.image ? `<img src="${ammo.image}" alt="" class="picker-item-thumb" onerror="this.style.display='none'">` : `<span class="picker-item-thumb-placeholder"></span>`}
      <span class="picker-item-name">${ammo.label}${ammoId === weaponItem.defaultAmmo ? " (기본)" : ""}</span>
      ${ammo.scarce
        ? `<span class="picker-item-price picker-item-scarce"><img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`
        : ammo.cost != null ? `<span class="picker-item-price"><img src="images/ui/hunt_dollars.png" alt="$">${ammo.cost}</span>` : ""}
    `;
    row.addEventListener("click", () => onPick(ammoId));
    list.appendChild(row);
  });
}

// -------------------------------------------------------------------------
// 로드아웃 — 오른쪽 장비판(실제 게임 로드아웃 창 스타일) + 왼쪽 피커 패널
// -------------------------------------------------------------------------

// 현재 로드아웃에 담긴 아이템들의 헌트 달러 총합 (Scarce 아이템/특성의 업그레이드 포인트는 제외)
function calculateLoadoutTotal() {
  let total = 0;
  CATEGORIES.weapon.loadoutSlots.forEach((slotDef) => {
    const key = loadoutKey("weapon", slotDef.slotKey);
    (state.loadout[key] || []).forEach((slotData) => {
      if (!slotData) return;
      if (slotData.item?.price != null && !slotData.item.scarce) total += slotData.item.price;
      if (slotData.ammoId) {
        const ammo = AMMO_TYPES[slotData.ammoId];
        if (ammo && ammo.cost != null && !ammo.scarce) total += ammo.cost;
      }
      if (slotData.ammoId2) {
        const ammo2 = AMMO_TYPES[slotData.ammoId2];
        if (ammo2 && ammo2.cost != null && !ammo2.scarce) total += ammo2.cost;
      }
    });
  });
  (state.loadout["field__all"] || []).forEach((itemId) => {
    const item = ITEMS.find((i) => i.id === itemId);
    if (item && item.price != null && !item.scarce) total += item.price;
  });
  return total;
}

// calculateLoadoutTotal()과 동일한 계산을, 커뮤니티 로드아웃(직렬화된 {w,f,t} 형식)에도
// 쓸 수 있도록 state.loadout이 아니라 인자로 받은 객체 기준으로 계산
function calculateSerializedLoadoutTotal(obj) {
  let total = 0;
  if (!obj) return total;
  Object.values(obj.w || {}).forEach((arr) => {
    (arr || []).forEach((slot) => {
      if (!slot || !slot.id) return;
      const item = findItemById(slot.id);
      if (item && item.price != null && !item.scarce) total += item.price;
      if (slot.a) {
        const ammo = AMMO_TYPES[slot.a];
        if (ammo && ammo.cost != null && !ammo.scarce) total += ammo.cost;
      }
      if (slot.a2) {
        const ammo2 = AMMO_TYPES[slot.a2];
        if (ammo2 && ammo2.cost != null && !ammo2.scarce) total += ammo2.cost;
      }
    });
  });
  (obj.f || []).forEach((id) => {
    const item = findItemById(id);
    if (item && item.price != null && !item.scarce) total += item.price;
  });
  return total;
}

// 장비 칸 하나(빈 칸/채워진 칸 공용) — 이미지, 클릭(고르기), ✕(비우기)를 한번에 처리
// weaponSize: "sm"(1~2칸 무기) | "lg"(3칸 이상 무기) — wide 칸에서만 사용, 미지정 시 기본(3칸) 크기
// ammoHalf: 이중탄약 무기의 탄약칸 2개를 각각 절반 크기로 줄여서 나란히 붙일 때 true
// stackCount: 2 이상이면 우측 하단에 "xN" 배지 표시(투척/설치/타로/주사기 스택)
// locked: true면 스택으로 인해 못 쓰게 된 칸 — 클릭 불가, 검정으로 잠긴 표시만 함
function createEquipBox({ image, title, empty, small, wide, weaponSize, ammoHalf, stackCount, locked, draggable, shellSize, onClick, onClear, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const box = document.createElement("div");
  box.className = "equip-box"
    + (empty ? " equip-box-empty" : "")
    + (small ? " equip-box-small" : "")
    + (wide ? " equip-box-wide" : "")
    + (wide && weaponSize === "sm" ? " equip-box-wide--sm" : "")
    + (wide && weaponSize === "lg" ? " equip-box-wide--lg" : "")
    + (ammoHalf ? " equip-box-ammo-half" : "")
    + (shellSize === "base" ? " equip-box-shell-base" : "")
    + (shellSize === "special" ? " equip-box-shell-special" : "")
    + (shellSize === "special-tight" ? " equip-box-shell-special-tight" : "")
    + (locked ? " equip-box-locked" : "");
  if (title) box.title = title;
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.onerror = () => { img.style.display = "none"; };
    box.appendChild(img);
  }
  if (stackCount > 1) {
    const badge = document.createElement("span");
    badge.className = "equip-box-stack-badge";
    badge.textContent = `x${stackCount}`;
    box.appendChild(badge);
  }
  if (onClear) {
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "equip-box-clear";
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", (e) => { e.stopPropagation(); onClear(); });
    box.appendChild(clearBtn);
  }
  if (draggable) {
    box.draggable = true;
    box.classList.add("equip-box-draggable");
    box.addEventListener("dragstart", (e) => {
      // Firefox 등 일부 브라우저는 dragstart에서 dataTransfer.setData를 안 부르면
      // 드래그가 아예 시작되지 않거나 drop이 정상적으로 안 걸리는 경우가 있어 추가.
      e.dataTransfer?.setData("text/plain", "equip-box");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      box.classList.add("equip-box-dragging");
      onDragStart?.(e);
    });
    box.addEventListener("dragend", () => { box.classList.remove("equip-box-dragging"); onDragEnd?.(); });
  }
  if (onDragOver) {
    box.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      onDragOver(e);
    });
    box.addEventListener("dragenter", (e) => { e.preventDefault(); box.classList.add("equip-box-drop-target"); });
    box.addEventListener("dragleave", () => box.classList.remove("equip-box-drop-target"));
  }
  if (onDrop) {
    box.addEventListener("drop", (e) => {
      e.preventDefault();
      box.classList.remove("equip-box-drop-target");
      onDrop(e);
    });
  }
  if (onClick && !locked) box.addEventListener("click", onClick);
  return box;
}

// 이중탄약(주 탄약 + 2번째 탄약) 무기인지 판정 —
// (1) secondaryAmmoCategories: 하부 총열 등 별도 카테고리 총열 보유(르맷/헤이메이커/드릴링류)
// (2) dualAmmoSlot: 단발/볼트액션이라 같은 카테고리 탄종 2개를 동시에 넣고 교체 가능(스팍스/베르티에류)
function isDualAmmoWeapon(item) {
  return !!(item && ((item.secondaryAmmoCategories && item.secondaryAmmoCategories.length > 0) || item.dualAmmoSlot));
}

// 주 탄약(기본 총열) 후보 목록 — secondaryAmmoCategories가 있는 무기는 item.ammoTypes가
// 주탄약+2번째탄약이 한 배열에 섞여 있으므로, 무기 자체의 ammoCategory와 일치하는 것만 걸러냄.
// 그 외(dualAmmoSlot만 있거나 일반 무기)는 ammoTypes 전체가 곧 주탄약 후보.
function getPrimaryAmmoOptions(item) {
  if (!item || !item.ammoTypes) return [];
  if (item.secondaryAmmoCategories && item.secondaryAmmoCategories.length > 0) {
    return item.ammoTypes.filter((id) => AMMO_TYPES[id]?.category === item.ammoCategory);
  }
  return item.ammoTypes;
}

// 2번째 탄약(하부 총열/두번째 장전) 후보 목록
function getSecondaryAmmoOptions(item) {
  if (!item || !item.ammoTypes) return [];
  if (item.secondaryAmmoCategories && item.secondaryAmmoCategories.length > 0) {
    return item.ammoTypes.filter((id) => item.secondaryAmmoCategories.includes(AMMO_TYPES[id]?.category));
  }
  if (item.dualAmmoSlot) return item.ammoTypes; // 같은 무기 2번째 탄종: 주탄약과 동일한 목록에서 선택
  return [];
}

// 2번째 탄약 기본값 — data.js의 ammoTypes 배열 순서상 항상 기본(무특수) 탄종이 먼저 오도록
// 정리되어 있어(예: 르맷의 "Shells"), 후보 목록의 첫 항목을 기본값으로 씀.
function getDefaultSecondaryAmmo(item) {
  const opts = getSecondaryAmmoOptions(item);
  return opts.length ? opts[0] : null;
}

// 소모품 중 "같은 종류 최대 4개까지 스택 가능"한 4가지 분류 판정 (투척/설치/타로/주사기).
// 주사기는 스키마에 별도 태그가 없어 id가 "_shot"으로 끝나는 걸로 식별함(Antidote/Regeneration/
// Stamina/Vitality/Recovery Shot 전부 이 규칙에 맞음).
const CONSUMABLE_STACK_MAX = 4;
function getConsumableStackGroup(item) {
  if (!item || item.category !== "consumable") return null;
  if (item.consumableTags?.includes("throwable")) return "throwable";
  if (item.consumableTags?.includes("placeable")) return "placeable";
  if (item.consumableClass === "tarot") return "tarot";
  if (item.id?.includes("_shot")) return "syringe";
  return null;
}

// 샷건 계열 탄약 중 "기본 쉘"(라벨이 영문 "Shells"인 무특수탄)인지 판정 —
// 기본 쉘은 이미지 자체가 세로로 길고 여백이 많아서 특수쉘과 나란히 두면 유독 커 보임.
function isBaseShotgunShell(ammo) {
  return !!(ammo && ammo.category === "shotgun" && ammo.label === "Shells");
}
// 샷건 계열 특수탄(슬러그/드래곤브레스/플리셰트/페니샷/신호탄 등)인지 판정
function isSpecialShotgunShell(ammo) {
  return !!(ammo && ammo.category === "shotgun" && ammo.label !== "Shells");
}
// 슬러그/플리셰트는 원본 이미지가 다른 특수탄보다 여백이 적어 유독 커 보여서 살짝만 더 작게
function isOversizedShotgunSpecial(ammo) {
  return !!(ammo && (ammo.effect === "slug" || ammo.effect === "flechette"));
}
function getShellSize(ammo) {
  if (isBaseShotgunShell(ammo)) return "base";
  if (isOversizedShotgunSpecial(ammo)) return "special-tight";
  if (isSpecialShotgunShell(ammo)) return "special";
  return undefined;
}

function openWeaponSlotPicker(key, index) {
  openPicker("weapon", (selectedItem, selectedAmmoId) => {
    const otherTotal = getTotalWeaponSlotSize(key, index);
    const newTotal = otherTotal + (selectedItem.slotSize || 0);
    if (newTotal > WEAPON_SLOT_LIMIT) {
      showToast(`무기 칸수 합이 ${WEAPON_SLOT_LIMIT}칸을 넘어서 장착할 수 없습니다. (다른 무기 ${otherTotal}칸 + 이 무기 ${selectedItem.slotSize}칸 = ${newTotal}칸)`);
      return;
    }
    state.loadout[key][index] = {
      item: selectedItem,
      ammoId: selectedAmmoId ?? null,
      ammoId2: isDualAmmoWeapon(selectedItem) ? getDefaultSecondaryAmmo(selectedItem) : null,
    };
    // 0번 칸(듀얼의 기준이 되는 칸)의 무기를 바꾸면, 기존에 채워져 있던 1번 칸(듀얼 짝)은
    // 더 이상 같은 무기가 아니게 되므로 함께 비움(듀얼은 같은 무기 한 종류로만 구성 가능).
    if (index === 0 && state.loadout[key].length > 1) {
      state.loadout[key][1] = null;
    }
    renderLoadoutBoard();
    closePicker();
  });
}

// 듀얼 짝(1번 칸)을 0번 칸과 무조건 동일한 무기+탄약으로 채움(듀얼은 같은 무기 한 종류로만 구성 가능)
function fillDualCompanion(key, index) {
  const first = state.loadout[key][0];
  if (!first || !first.item) return;
  const otherTotal = getTotalWeaponSlotSize(key, index);
  const newTotal = otherTotal + (first.item.slotSize || 0);
  if (newTotal > WEAPON_SLOT_LIMIT) {
    showToast(`무기 칸수 합이 ${WEAPON_SLOT_LIMIT}칸을 넘어서 장착할 수 없습니다. (다른 무기 ${otherTotal}칸 + 이 무기 ${first.item.slotSize}칸 = ${newTotal}칸)`);
    return;
  }
  state.loadout[key][index] = { item: first.item, ammoId: first.ammoId, ammoId2: first.ammoId2 ?? null };
  renderLoadoutBoard();
}

// 피커 패널을 "무기 탄약 재선택" 모드로 세팅(검색/서브탭/필터 다 숨기고 목록만)
function preparePickerPanelForAmmoStep() {
  state.picker.merged = false;
  state.picker.categoryFilter = "weapon";
  document.getElementById("picker-empty-state").hidden = true;
  document.getElementById("picker-content").hidden = false;
  document.getElementById("picker-subtabs").hidden = true;
  document.getElementById("picker-subtabs").innerHTML = "";
  document.getElementById("picker-weapon-filters").hidden = true;
  document.getElementById("picker-tool-filters").hidden = true;
  document.getElementById("picker-consumable-filters").hidden = true;
  document.getElementById("picker-trait-filters").hidden = true;
}

// 무기 행의 "주 탄약"칸을 클릭했을 때 — 주 탄약 후보만 다시 고르는 단계로 바로 이동.
// 듀얼(같은 무기 2정)인 경우 탄약은 공용이므로, 채워진 모든 칸(0번+1번)에 동일하게 반영함.
function openPrimaryAmmoPicker(key) {
  const arr = state.loadout[key];
  const weaponItem = arr[0]?.item;
  if (!weaponItem) return;
  preparePickerPanelForAmmoStep();
  // 뒤로가기(← 무기 목록으로) 후 아예 다른 무기를 고를 경우를 대비한 안전장치 —
  // 0번 칸(대표 칸) 무기를 통째로 교체하고, 듀얼 짝(1번 칸)은 더 이상 같은 무기가 아니므로 비움.
  state.picker.onSelect = (selectedItem, selectedAmmoId) => {
    const otherTotal = getTotalWeaponSlotSize(key, 0);
    const newTotal = otherTotal + (selectedItem.slotSize || 0);
    if (newTotal > WEAPON_SLOT_LIMIT) {
      showToast(`무기 칸수 합이 ${WEAPON_SLOT_LIMIT}칸을 넘어서 장착할 수 없습니다.`);
      return;
    }
    arr[0] = {
      item: selectedItem,
      ammoId: selectedAmmoId ?? null,
      ammoId2: isDualAmmoWeapon(selectedItem) ? getDefaultSecondaryAmmo(selectedItem) : null,
    };
    if (arr.length > 1) arr[1] = null;
    renderLoadoutBoard();
    closePicker();
  };
  renderPickerAmmoStep(weaponItem, {
    title: "탄약 선택",
    ammoIds: getPrimaryAmmoOptions(weaponItem),
    onPick: (ammoId) => {
      arr.forEach((slotData, idx) => {
        if (slotData && slotData.item) arr[idx] = { ...slotData, ammoId };
      });
      renderLoadoutBoard();
      closePicker();
    },
  });
}

// 무기 행의 "2번째 탄약(하부 총열/두번째 장전)"칸을 클릭했을 때 — 주 탄약과 별개로,
// 2번째 탄약 후보만 독립적으로 다시 고를 수 있음(르맷 등은 샷건 계열만 후보로 뜸).
function openSecondaryAmmoPicker(key) {
  const arr = state.loadout[key];
  const weaponItem = arr[0]?.item;
  if (!weaponItem) return;
  preparePickerPanelForAmmoStep();
  state.picker.onSelect = (selectedItem, selectedAmmoId) => {
    const otherTotal = getTotalWeaponSlotSize(key, 0);
    const newTotal = otherTotal + (selectedItem.slotSize || 0);
    if (newTotal > WEAPON_SLOT_LIMIT) {
      showToast(`무기 칸수 합이 ${WEAPON_SLOT_LIMIT}칸을 넘어서 장착할 수 없습니다.`);
      return;
    }
    arr[0] = {
      item: selectedItem,
      ammoId: selectedAmmoId ?? null,
      ammoId2: isDualAmmoWeapon(selectedItem) ? getDefaultSecondaryAmmo(selectedItem) : null,
    };
    if (arr.length > 1) arr[1] = null;
    renderLoadoutBoard();
    closePicker();
  };
  renderPickerAmmoStep(weaponItem, {
    title: weaponItem.secondaryAmmoCategories?.length ? "하부 총열 탄약 선택" : "2번째 탄약 선택",
    ammoIds: getSecondaryAmmoOptions(weaponItem),
    onPick: (ammoId) => {
      arr.forEach((slotData, idx) => {
        if (slotData && slotData.item) arr[idx] = { ...slotData, ammoId2: ammoId };
      });
      renderLoadoutBoard();
      closePicker();
    },
  });
}

// 대형 슬롯/소형 슬롯 한 줄 — 무기 칸(들) + 탄약 칸 + 줄 오른쪽 끝 가격
// 무기 용량 게이지 — 채워진 칸수만큼 사각형이 밝게 표시됨 (실제 게임 UI 참고)
function renderCapacityPips(used, max) {
  const wrap = document.createElement("div");
  wrap.className = "equip-capacity-pips";
  for (let i = 0; i < max; i++) {
    const pip = document.createElement("span");
    pip.className = "equip-pip" + (i < used ? " equip-pip-filled" : "");
    wrap.appendChild(pip);
  }
  return wrap;
}

function renderWeaponSlotsRow(slotDef) {
  const key = loadoutKey("weapon", slotDef.slotKey);
  const wrap = document.createElement("div");

  const rowEl = document.createElement("div");
  rowEl.className = "equip-row";
  const boxesWrap = document.createElement("div");
  boxesWrap.className = "equip-row-boxes";

  let rowTotal = 0;
  let rowScarce = false;
  let rowHasItem = false;
  let rowSlotSize = 0;

  // 슬롯은 기본 1칸. 다만 0번 칸에 권총(weaponClass==="handgun")이 들어가면 옆에
  // 같은 사이즈의 빈 칸을 하나 더 보여줘서 듀얼 구성(같은 권총 2정)을 지원함.
  // 듀얼은 권총만 가능 — 2칸짜리 소총/카빈 등은 slotSize가 작아도 듀얼 불가.
  // 프리시전/데드아이 등 정밀 조준경 부착형(noAkimbo:true)은 권총이어도 아킴보 불가.
  let visibleCount = 1;
  if (slotDef.max > 1) {
    const firstItem = state.loadout[key][0]?.item;
    if (firstItem && firstItem.weaponClass === "handgun" && !firstItem.noAkimbo) visibleCount = 2;
  }
  const isDualPair = visibleCount === 2;

  // 1단계: 무기 칸(들)만 먼저 그림 (탄약칸은 여기서 같이 넣지 않음 — 아래 2단계에서 한 번에 처리)
  for (let i = 0; i < visibleCount; i++) {
    const slotData = state.loadout[key][i];
    const item = slotData?.item || null;
    const ammo = slotData?.ammoId ? AMMO_TYPES[slotData.ammoId] : null;

    // 크기 결정: 아이템이 있으면 자기 slotSize 기준. 비어있는데 "듀얼용으로 추가된 칸"
    // (1번 칸이면서 visibleCount가 2로 확장된 경우)이면 옆 무기와 같은 sm 사이즈로 맞춤.
    const weaponSize = item
      ? (item.slotSize >= 3 ? "lg" : "sm")
      : (i > 0 && isDualPair ? "sm" : undefined);
    const isDualEmptySlot = i > 0 && isDualPair && !item;

    boxesWrap.appendChild(createEquipBox({
      image: item?.image,
      title: item ? displayName(item) : (isDualEmptySlot ? "듀얼로 추가 (같은 무기)" : undefined),
      empty: !item,
      wide: true,
      weaponSize,
      onClick: () => {
        // 듀얼 짝(1번 칸)이 비어있으면 별도로 무기를 고르지 않고 0번 칸과 무조건 같은
        // 무기+탄약으로 자동 채움 (듀얼은 같은 무기 한 종류로만 구성 가능)
        if (isDualEmptySlot) fillDualCompanion(key, i);
        else openWeaponSlotPicker(key, i);
      },
      onClear: item ? () => {
        state.loadout[key][i] = null;
        // 0번 칸(듀얼 기준 칸)을 비우면 짝(1번 칸)도 더 이상 의미가 없으므로 함께 비움
        if (i === 0 && state.loadout[key].length > 1) state.loadout[key][1] = null;
        renderLoadoutBoard();
      } : null,
    }));

    if (item) {
      rowHasItem = true;
      rowSlotSize += item.slotSize || 0;
      if (item.scarce) rowScarce = true;
      else if (item.price != null) rowTotal += item.price;
      if (ammo) {
        if (ammo.scarce) rowScarce = true;
        else if (ammo.cost != null) rowTotal += ammo.cost;
      }
      const ammo2 = slotData?.ammoId2 ? AMMO_TYPES[slotData.ammoId2] : null;
      if (ammo2) {
        if (ammo2.scarce) rowScarce = true;
        else if (ammo2.cost != null) rowTotal += ammo2.cost;
      }
    }
  }

  // 2단계: 탄약 칸 — 무기 칸 사이에 끼우지 않고, 채워진 무기 칸을 다 그린 뒤 항상 맨 오른쪽에
  // 표시(0번 칸 기준 탄약; 듀얼 무기 페어면 같은 무기라 탄약도 공용).
  // 이중탄약(주 탄약 + 2번째 탄약/하부 총열) 무기는 칸을 2개로 나눠서 각각 독립적으로 클릭해
  // 다시 고를 수 있게 함(르맷처럼 하부 총열이 있는 무기는 2번째 칸이 자연히 샷건쉘 계열로 표시됨).
  const primarySlotData = state.loadout[key][0];
  const primaryItem = primarySlotData?.item || null;
  const primaryAmmo = primarySlotData?.ammoId ? AMMO_TYPES[primarySlotData.ammoId] : null;
  if (primaryItem && primaryAmmo) {
    if (isDualAmmoWeapon(primaryItem)) {
      const secondaryAmmo = primarySlotData?.ammoId2 ? AMMO_TYPES[primarySlotData.ammoId2] : null;
      const primaryShellSize = getShellSize(primaryAmmo);
      const secondaryShellSize = getShellSize(secondaryAmmo);
      boxesWrap.appendChild(createEquipBox({
        image: primaryAmmo.image, title: primaryAmmo.label, small: true, ammoHalf: true, shellSize: primaryShellSize,
        onClick: () => openPrimaryAmmoPicker(key),
      }));
      boxesWrap.appendChild(createEquipBox({
        image: secondaryAmmo?.image, title: secondaryAmmo?.label || "탄약 선택", small: true, ammoHalf: true, shellSize: secondaryShellSize,
        empty: !secondaryAmmo,
        onClick: () => openSecondaryAmmoPicker(key),
      }));
    } else {
      const shellSize = getShellSize(primaryAmmo);
      boxesWrap.appendChild(createEquipBox({ image: primaryAmmo.image, title: primaryAmmo.label, small: true, shellSize, onClick: () => openPrimaryAmmoPicker(key) }));
    }
  }

  rowEl.appendChild(boxesWrap);

  const priceEl = document.createElement("span");
  priceEl.className = "equip-row-price";
  if (rowHasItem) {
    // 헌트달러로 사는 부분(무기/일반탄 가격)과 Scarce(필드 드랍 전용) 표시를 분리해서
    // 보여줌 — 합쳐서 "[Scarce 아이콘]가격" 식으로 보이면 마치 Scarce 아이템이 유료인
    //것처럼 오해를 살 수 있어서(예: 무기는 유료인데 탄약만 Scarce인 경우) 수정.
    let html = "";
    if (rowTotal > 0 || !rowScarce) {
      html += `<img src="images/ui/hunt_dollars.png" alt="$">${rowTotal}`;
    }
    if (rowScarce) {
      html += `<img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)">`;
    }
    priceEl.innerHTML = html;
  }
  rowEl.appendChild(priceEl);
  wrap.appendChild(rowEl);

  wrap.appendChild(renderCapacityPips(rowSlotSize, WEAPON_SLOT_LIMIT));
  return wrap;
}

// "도구 & 소모품" 통합 칸을 고르는 피커를 염 (도구/소모품 서브탭 포함)
function openFieldPicker() {
  openPicker("tool_consumable", (selectedItem) => {
    const key = "field__all";
    if (getSharedGroupUsage("field") >= 8) {
      showToast("필드 장비 칸이 가득 찼습니다 (8/8)");
      renderLoadoutBoard();
      closePicker();
      return;
    }
    // 투척/설치/타로/주사기 소모품은 같은 종류를 최대 4개까지만 담을 수 있음
    const stackGroup = getConsumableStackGroup(selectedItem);
    if (stackGroup) {
      const currentCount = (state.loadout[key] || []).filter((id) => id === selectedItem.id).length;
      if (currentCount >= CONSUMABLE_STACK_MAX) {
        showToast(`${selectedItem.nameKo || selectedItem.name}은(는) 최대 ${CONSUMABLE_STACK_MAX}개까지만 담을 수 있습니다.`);
        renderLoadoutBoard();
        closePicker();
        return;
      }
    }
    state.loadout[key].push(selectedItem.id);
    renderLoadoutBoard();
    // 도구/소모품은 여러 칸을 연달아 채우는 경우가 많아서, 하나 고를 때마다 창이 닫히지 않고
    // 계속 열려있게 유지 — 칸이 다 찼을 때만 자동으로 닫음.
    if (getSharedGroupUsage("field") >= 8) {
      closePicker();
    } else {
      renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
    }
  });
}

// 도구+소모품이 8칸을 공유하는 통합 섹션 (예전엔 도구 4/소모품 4로 나뉘어 있었지만 현재는 통합)
function renderFieldEquipmentSection() {
  const section = document.createElement("div");
  section.className = "equip-section";
  const heading = document.createElement("h3");
  heading.className = "equip-section-title";
  heading.textContent = "도구 및 소모품";
  section.appendChild(heading);

  // 도구+소모품은 실제로 이 배열 하나로 순서까지 관리함(카테고리 구분 없이 뒤섞인 순서
  // 그대로 저장) — 드래그 앤 드롭으로 도구/소모품을 자유롭게 섞어서 재배치할 수 있게 하기 위함.
  const fieldIds = state.loadout["field__all"] || [];

  const boxesWrap = document.createElement("div");
  boxesWrap.className = "equip-row-boxes equip-field-grid";
  let total = 0;
  let anyScarce = false;

  // 스택 그룹(투척/설치/타로/주사기)은 같은 id끼리 "처음 등장한 자리" 하나에 모아서
  // xN 배지로 표시. 그 외(도구, 스택 대상 아닌 소모품)는 기존처럼 각자 자기 칸을 씀.
  const displayList = []; // { item, count }
  const stackIndexById = new Map(); // id -> displayList 인덱스 (스택 그룹 전용)

  fieldIds.forEach((id) => {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return;
    const stackGroup = getConsumableStackGroup(item);
    if (stackGroup && stackIndexById.has(id)) {
      displayList[stackIndexById.get(id)].count += 1;
      return;
    }
    displayList.push({ item, count: 1 });
    if (stackGroup) stackIndexById.set(id, displayList.length - 1);
  });

  displayList.forEach((d) => {
    if (d.item.scarce) anyScarce = true;
    else if (d.item.price != null) total += d.item.price * d.count; // 스택된 개수만큼 가격도 반영
  });

  // 도구/소모품 칸을 드래그 앤 드롭으로 순서 재배치 — displayList(화면에 보이는 칸 단위,
  // 스택은 하나로 묶여서 통째로 이동)를 옮긴 뒤, 그 순서 그대로 field__all을 다시 만듦.
  function rebuildFieldArrayFromDisplayList(list) {
    const rebuilt = [];
    list.forEach((d) => {
      for (let i = 0; i < d.count; i++) rebuilt.push(d.item.id);
    });
    state.loadout["field__all"] = rebuilt;
  }

  let dragSourceIdx = null;

  displayList.forEach((d, dIdx) => {
    boxesWrap.appendChild(createEquipBox({
      image: d.item.image,
      title: d.count > 1 ? `${displayName(d.item)} x${d.count}` : displayName(d.item),
      stackCount: d.count,
      draggable: true,
      onDragStart: () => { dragSourceIdx = dIdx; },
      onDragOver: () => {},
      onDragEnd: () => { dragSourceIdx = null; },
      onDrop: () => {
        // 다른 칸들은 그대로 두고, 옮기는 칸과 놓인 칸 딱 2개만 자리를 맞바꿈(밀어내기 아님)
        if (dragSourceIdx === null || dragSourceIdx === dIdx) return;
        [displayList[dragSourceIdx], displayList[dIdx]] = [displayList[dIdx], displayList[dragSourceIdx]];
        rebuildFieldArrayFromDisplayList(displayList);
        renderLoadoutBoard();
      },
      onClear: () => {
        // 스택된 칸이면 마지막 1개만 제거(카운트만 줄어듦), 아니면 그 칸 자체를 제거
        const arr = state.loadout["field__all"];
        let lastIdx = -1;
        arr.forEach((id, i) => { if (id === d.item.id) lastIdx = i; });
        if (lastIdx !== -1) arr.splice(lastIdx, 1);
        renderLoadoutBoard();
      },
    }));
  });

  const capacity = 8;
  const totalUsed = fieldIds.length;
  const lockedCount = totalUsed - displayList.length; // 스택으로 인해 실제로는 쓰였지만 안 보이는 칸 수
  const emptyCount = capacity - totalUsed;

  for (let i = 0; i < emptyCount; i++) {
    boxesWrap.appendChild(createEquipBox({
      empty: true,
      onClick: () => openFieldPicker(),
      onDragOver: () => {},
      onDrop: () => {
        // 빈 칸에 드롭하면 목록 맨 뒤로 이동
        if (dragSourceIdx === null) return;
        const [moved] = displayList.splice(dragSourceIdx, 1);
        displayList.push(moved);
        rebuildFieldArrayFromDisplayList(displayList);
        renderLoadoutBoard();
      },
    }));
  }
  // 스택으로 못 쓰게 된 칸 — 그리드 맨 끝(우측 하단)부터 채워지도록 맨 나중에 추가
  for (let i = 0; i < lockedCount; i++) {
    boxesWrap.appendChild(createEquipBox({ locked: true, title: "스택으로 사용 중인 칸(추가 선택 불가)" }));
  }

  // 그리드(여러 줄로 감싸질 수 있음)와 가격을 같은 줄(equip-row)에 묶어서
  // 가격이 그리드 전체 높이 기준으로 상하 중앙에 오도록 함
  const rowEl = document.createElement("div");
  rowEl.className = "equip-row";
  rowEl.appendChild(boxesWrap);
  if (fieldIds.length > 0) {
    const priceEl = document.createElement("span");
    priceEl.className = "equip-row-price";
    let html = "";
    if (total > 0 || !anyScarce) {
      html += `<img src="images/ui/hunt_dollars.png" alt="$">${total}`;
    }
    if (anyScarce) {
      html += `<img src="images/ui/scarce.png" alt="Scarce" title="Scarce 아이템 포함">`;
    }
    priceEl.innerHTML = html;
    rowEl.appendChild(priceEl);
  }
  section.appendChild(rowEl);

  return section;
}

// 특성 섹션 — 도구/소모품처럼 항상 고정 TRAIT_MAX_COUNT(15)칸을 그대로 보여줌(채워진 칸/빈 칸 공존).
// 헤더 오른쪽에 현재 담은 특성들의 업그레이드 포인트 비용 총합을 배지로 표시(헌트 달러와는 다른 재화).
function renderTraitSection() {
  const section = document.createElement("div");
  section.className = "equip-section";

  const key = loadoutKey("trait", "trait");
  const ids = state.loadout[key] || [];
  const upgradeCostTotal = ids.reduce((sum, id) => {
    const item = ITEMS.find((i) => i.id === id);
    return sum + (item?.price != null ? item.price : 0);
  }, 0);

  const titleRow = document.createElement("div");
  titleRow.className = "equip-section-title-row";
  titleRow.innerHTML = `
    <h3 class="equip-section-title">특성</h3>
    <span class="equip-upgrade-cost"><img src="images/ui/upgrade_points.webp" alt="업그레이드 포인트" class="equip-upgrade-cost-icon">${upgradeCostTotal}</span>
  `;
  section.appendChild(titleRow);

  const boxesWrap = document.createElement("div");
  boxesWrap.className = "equip-row-boxes equip-trait-grid";

  function openAddTraitPicker() {
    openPicker("trait", (selectedItem) => {
      if (state.loadout[key].length >= TRAIT_MAX_COUNT) {
        showToast(`특성은 최대 ${TRAIT_MAX_COUNT}개까지만 담을 수 있습니다.`);
        renderLoadoutBoard();
        closePicker();
        return;
      }
      state.loadout[key].push(selectedItem.id);
      renderLoadoutBoard();
      // 도구/소모품과 동일하게, 하나 고를 때마다 창이 닫히지 않고 계속 열려있게 유지
      // — 칸이 다 찼을 때만 자동으로 닫음.
      if (state.loadout[key].length >= TRAIT_MAX_COUNT) {
        closePicker();
      } else {
        renderPickerList(document.getElementById("picker-search-input").value.trim().toLowerCase());
      }
    });
  }

  ids.forEach((id, idx) => {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return;
    boxesWrap.appendChild(createEquipBox({
      image: item.image,
      title: displayName(item),
      onClear: () => { state.loadout[key].splice(idx, 1); renderLoadoutBoard(); },
    }));
  });

  // 도구&소모품 칸과 동일하게, 채워진 칸 수와 무관하게 항상 15칸을 다 보여줌
  for (let i = ids.length; i < TRAIT_MAX_COUNT; i++) {
    boxesWrap.appendChild(createEquipBox({ empty: true, onClick: openAddTraitPicker }));
  }

  section.appendChild(boxesWrap);
  return section;
}

// 오른쪽 장비판 전체를 다시 그림 (총합 가격 헤더 + 대형/소형 슬롯 + 도구&소모품 + 특성)
function renderEquipmentPanel() {
  const panel = document.getElementById("loadout-equipment-panel");
  panel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "equip-header";
  header.innerHTML = `
    <h2>로드아웃 장비</h2>
    <span class="equip-total-price"><img src="images/ui/hunt_dollars.png" alt="$">${calculateLoadoutTotal()}</span>
  `;
  panel.appendChild(header);

  // 무기 용량 게이지 (양쪽 슬롯 무기 칸수 합계 / 최대치)
  const capSection = document.createElement("div");
  capSection.className = "equip-section";
  const capHeading = document.createElement("h3");
  capHeading.className = "equip-section-title";
  capHeading.textContent = "무기 용량";
  capSection.appendChild(capHeading);
  capSection.appendChild(renderCapacityPips(getTotalWeaponSlotSize(), WEAPON_SLOT_LIMIT));
  panel.appendChild(capSection);

  CATEGORIES.weapon.loadoutSlots.forEach((slotDef) => {
    const section = document.createElement("div");
    section.className = "equip-section";
    const heading = document.createElement("h3");
    heading.className = "equip-section-title";
    heading.textContent = slotDef.label;
    section.appendChild(heading);
    section.appendChild(renderWeaponSlotsRow(slotDef));
    panel.appendChild(section);
  });

  panel.appendChild(renderFieldEquipmentSection());
  panel.appendChild(renderTraitSection());
}

function renderLoadoutBoard() {
  renderEquipmentPanel();
}

function clearLoadout() { initLoadoutState(); renderLoadoutBoard(); }

// -------------------------------------------------------------------------
// 랜덤 로드아웃 — 아래 필수 조건을 만족하는 로드아웃을 무작위로 생성(사용자 확정 규칙)
//   1) 구급상자(tool_first_aid_kit) 정확히 1개
//   2) 근접무기(toolClass:"melee")와 투척무기(toolClass:"throwable_melee") 중 최소 1개
//      단, 무기 슬롯 자체에 근접무기(weaponClass:"melee")가 들어간 경우엔 이 조건 자체가 꺼짐
//   3) 2번에서 근접무기 "도구"가 뽑혔으면 화염 신호탄(tool_fusees) 필수 동반
//   4) 무기 두 자루 중 하나가 샷건이면 나머지 하나는 샷건 제외
//   5) 재생 주사/활력 주사(약한 버전 포함) 중 최소 1개
//   6) 타로 카드는 포함될 경우 "서로 다른 2종류 1장씩" 또는 "동일 카드 2장"까지만
//   7) 도구(category:"tool")는 중복 등장 불가(같은 도구 2개 이상 X)
//   8) 무기 칸수 합이 5칸/6칸이 되는 조합은 화면의 온/오프 스위치로 허용 여부를 조절
//   9) 특성: 희소 특성 제외, 10포인트를 정확히 다 채움(남기지 않음), 무기 조건부 특성은
//      해당 조건의 무기가 로드아웃에 없으면 등장하지 않음, 무기 칸수 합이 6칸이면 보급 장교 고정 등장
// -------------------------------------------------------------------------
function pickRandomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 무기 행(주슬롯/보조슬롯) 하나를 장착. dual이면 같은 무기+탄약으로 옆 칸(아킴보 짝)까지 채움.
function equipRandomWeaponRow(key, row) {
  const item = row.item;
  // 무기 자체뿐 아니라 탄약도 희소(Scarce)일 수 있어서(예: 덤덤탄), "희소 제외" 스위치가
  // 꺼져 있으면 탄약 후보에서도 희소 탄약을 뺀다(전부 희소뿐이면 어쩔 수 없이 그대로 사용).
  const ammoScarceOk = (id) => state.randomAllowScarce || !AMMO_TYPES[id]?.scarce;
  const primaryOptionsAll = getPrimaryAmmoOptions(item);
  const primaryOptions = primaryOptionsAll.filter(ammoScarceOk);
  const primaryPool = primaryOptions.length ? primaryOptions : primaryOptionsAll;
  const ammoId = primaryPool.length ? pickRandomItem(primaryPool) : (item.defaultAmmo || null);
  let ammoId2 = null;
  if (isDualAmmoWeapon(item)) {
    const secondaryOptionsAll = getSecondaryAmmoOptions(item);
    const secondaryOptions = secondaryOptionsAll.filter(ammoScarceOk);
    const secondaryPool = secondaryOptions.length ? secondaryOptions : secondaryOptionsAll;
    ammoId2 = secondaryPool.length ? pickRandomItem(secondaryPool) : getDefaultSecondaryAmmo(item);
  }
  state.loadout[key][0] = { item, ammoId, ammoId2 };
  if (row.dual) state.loadout[key][1] = { item, ammoId, ammoId2 };
}

// 무기 후보 풀 생성 — 아킴보 가능한 권총(핸드건, noAkimbo 아님)은 "듀얼 버전"을 완전히
// 별개의 무기 후보로 하나 더 추가해서, 페어(듀얼)가 다른 무기들과 동일한 확률로 뽑히게 함
// (예: 나강 M1895 단일 vs 나강 M1895 듀얼 vs 반달 73C ... 전부 똑같이 1/N 확률).
function buildWeaponRowPool(weaponPool) {
  const rows = [];
  weaponPool.forEach((w) => {
    rows.push({ item: w, dual: false });
    if (w.weaponClass === "handgun" && !w.noAkimbo) {
      rows.push({ item: w, dual: true });
    }
  });
  return rows;
}

// -------------------------------------------------------------------------
// 특성(무기 조건부) 판정 — 특정 무기(군)를 장착했을 때만 유효한 특성들의 조건 정의.
// 액션 방식(레버/볼트/펌프/단발/싱글액션 리볼버) 및 스코프 보유 여부는 사용자 확인을 거쳐
// 확정된 분류임(2026-07-27).
// -------------------------------------------------------------------------
const WEAPON_ACTION_TYPE = {
  // 레버액션
  weapon_frontier_73c: "lever", weapon_infantry_73l: "lever", weapon_marathon: "lever",
  weapon_ranger_73: "lever", weapon_vandal_73c: "lever", weapon_centennial: "lever",
  weapon_terminus: "lever",

  // 볼트액션
  weapon_vetterli_71: "bolt", weapon_sparks: "bolt", weapon_mako_1895: "bolt",
  weapon_krag: "bolt", weapon_lebel_1886: "bolt", weapon_mosin_nagant: "bolt",
  weapon_berthier_1892: "bolt", weapon_mosin_obrez: "bolt", weapon_1865_carbine: "bolt",

  // 펌프액션
  weapon_romero77: "pump",

  // 단발(비반복 단발 소총 — 폴링블록/트랩도어 등)
  weapon_maynard_sniper: "single_shot", weapon_springfield_1866: "single_shot",
  weapon_martini_henry: "single_shot", weapon_1890_cavalry: "single_shot",

  // 싱글액션 리볼버(패닝 대상) — 더블액션인 Officer/New Army는 제외
  weapon_conversion: "revolver_sa",
  weapon_lemat: "revolver_sa", weapon_nagant_m1895: "revolver_sa",
  weapon_scottfield: "revolver_sa",
  // weapon_bornheim_no3, weapon_dolch_96: 반자동 권총이라 리볼버 아님(사용자 확인)
  // weapon_rival78: 받는 액션 기반 특성 없음(사용자 확인)
};
// 파생형이 액션 방식 자체를 바꾸는 예외(모신-나강 아프토마트는 전자동 개조라 볼트액션 아님)
const WEAPON_ACTION_TYPE_OVERRIDE = { mosinnagant_avtomat: null };

function getWeaponActionType(item) {
  const id = item.id;
  if (Object.prototype.hasOwnProperty.call(WEAPON_ACTION_TYPE_OVERRIDE, id)) return WEAPON_ACTION_TYPE_OVERRIDE[id];
  const parentId = item._trueParentId || id;
  return WEAPON_ACTION_TYPE[parentId] || null;
}

// 스코프/애퍼처 보유 여부 — 파생형 이름 접미사로 판정(Deadeye/Marksman/Sniper/Precision/
// Bullseye=스코프, Aperture=애퍼처). Sparks(LRR)는 기본형부터 스코프 내장(Pistol 파생형 제외).
function hasScopeSight(item) {
  const parentId = item._trueParentId || item.id;
  if (parentId === "weapon_sparks" && !item.name.includes("Pistol")) return true;
  return ["Deadeye", "Marksman", "Sniper", "Precision", "Bullseye"].some((suf) => item.name.endsWith(suf));
}
function hasApertureSight(item) {
  return item.name.endsWith("Aperture");
}

// 필드(도구+소모품) 안에 특정 toolClass를 가진 도구가 있는지 확인
function fieldHasToolClass(fieldIds, toolClass) {
  return fieldIds.some((id) => {
    const it = ITEMS.find((i) => i.id === id);
    return it && it.category === "tool" && it.toolClass === toolClass;
  });
}

// 출혈/중독/화상 중 하나라도 일으킬 수 있는 장비(무기 탄약 효과 or 도구·소모품 태그)가
// 로드아웃에 있는지 확인 — 통각(Pain Sense) 특성 조건에 사용.
const AFFLICTION_AMMO_EFFECTS = ["bleed", "poison", "incendiary", "dragonbreath"];
const AFFLICTION_TAGS = ["rending", "poison", "fire"];
function hasAfflictionCausingGear(ctx) {
  const weaponHasEffect = ctx.weapons.some((w) => (w.ammoEffects || []).some((e) => AFFLICTION_AMMO_EFFECTS.includes(e)));
  const fieldHasEffect = ctx.fieldIds.some((id) => {
    const it = ITEMS.find((i) => i.id === id);
    const tags = it ? (it.toolTags || it.consumableTags || []) : [];
    return tags.some((t) => AFFLICTION_TAGS.includes(t));
  });
  return weaponHasEffect || fieldHasEffect;
}

// trait id → 조건 판정 함수.
// context = { weapons: [item,...](장착된 무기들), fieldIds: [...], hasAkimboPair: boolean }
const TRAIT_WEAPON_CONDITIONS = {
  trait_hundred_hands: (ctx) => ctx.weapons.some((w) => (w._trueParentId || w.id) === "weapon_hunting_bow"),
  trait_martialist: (ctx) => ctx.weapons.some((w) => (w._trueParentId || w.id) === "weapon_katana"),
  trait_bolt_thrower: (ctx) => ctx.weapons.some((w) => ["weapon_crossbow", "weapon_bomb_launcher", "weapon_hand_crossbow"].includes(w._trueParentId || w.id)),
  trait_assailant: (ctx) => ctx.fieldIds.some((id) => ["tool_throwing_knives", "tool_throwing_axes"].includes(id)),
  // 위키 기준: 볼트(크로스보우)/화살(헌팅 보우)/하푼(핸드 크로스보우, 봄 런처·봄 랜스)/
  // 투척 도끼/투척 나이프/투척 창 필요
  trait_blade_seer: (ctx) =>
    ctx.weapons.some((w) => ["weapon_crossbow", "weapon_hunting_bow", "weapon_hand_crossbow", "weapon_bomb_launcher"].includes(w._trueParentId || w.id)) ||
    ctx.fieldIds.some((id) => ["tool_throwing_axes", "tool_throwing_knives", "tool_throwing_spear"].includes(id)),
  trait_poacher: (ctx) => fieldHasToolClass(ctx.fieldIds, "trap"), // 덫류 도구가 있어야 유효
  trait_decoy_supply: (ctx) => fieldHasToolClass(ctx.fieldIds, "distraction"), // 교란 장치류 도구가 있어야 유효
  trait_pain_sense: (ctx) => hasAfflictionCausingGear(ctx), // 출혈/중독/화상을 일으킬 수 있는 장비가 있어야 유효
  trait_iron_eye: (ctx) => ctx.weapons.some((w) => ["bolt", "lever", "pump"].includes(getWeaponActionType(w))),
  trait_levering: (ctx) => ctx.weapons.some((w) => getWeaponActionType(w) === "lever"),
  trait_fanning: (ctx) => ctx.weapons.some((w) => getWeaponActionType(w) === "revolver_sa"),
  trait_fast_fingers: (ctx) => ctx.weapons.some((w) => getWeaponActionType(w) === "single_shot"),
  trait_scopesmith: (ctx) => ctx.weapons.some((w) => hasScopeSight(w)),
  trait_steady_aim: (ctx) => ctx.weapons.some((w) => hasScopeSight(w) || hasApertureSight(w)),
  // 위키 기준(사용자 확인) 적용 대상 무기(파생형 포함)
  trait_bulletgrubber: (ctx) => ctx.weapons.some((w) => [
    "weapon_marathon", "weapon_bornheim_no3", "weapon_berthier_1892", "weapon_lebel_1886",
    "weapon_mosin_nagant", "weapon_mosin_obrez", "weapon_specter1882", "weapon_terminus", "weapon_dolch_96",
  ].includes(w._trueParentId || w.id)),
  // 아킴보(듀얼) 페어를 실제로 만들었을 때만 유효
  trait_ambidextrous: (ctx) => !!ctx.hasAkimboPair,
};

function isTraitEligibleForRandomLoadout(trait, context) {
  const condition = TRAIT_WEAPON_CONDITIONS[trait.id];
  return condition ? condition(context) : true;
}

const TRAIT_RANDOM_BUDGET = 10;

// 특성 후보 중에서 정확히 targetPoints를 채우는 무작위 조합을 찾는다(백트래킹, 여러 번 시도).
function pickTraitsExactBudget(candidates, targetPoints) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const shuffled = shuffleArray(candidates);
    const chosen = [];
    let remaining = targetPoints;
    for (const t of shuffled) {
      if (remaining <= 0) break;
      if (t.price != null && t.price <= remaining && Math.random() < 0.6) {
        chosen.push(t);
        remaining -= t.price;
      }
    }
    if (remaining === 0) return chosen;
  }
  // 400번 시도해도 정확히 못 채우면(이론상 거의 발생 안 함) 그리디로 최대한 채움(0에 최대한 근접)
  const sorted = shuffleArray(candidates).sort((a, b) => b.price - a.price);
  const chosen = [];
  let remaining = targetPoints;
  for (const t of sorted) {
    if (t.price != null && t.price <= remaining) {
      chosen.push(t);
      remaining -= t.price;
    }
  }
  return chosen;
}

// 규칙은 기존과 완전히 동일(무기 2자루 시도, 근접/투척+화염신호탄 필수, 회복 주사기 필수 등)하되,
// 항목을 하나 확정할 때마다 예산(state.randomMaxPrice) 안에 드는지 바로 확인해서, 넘으면 그
// 항목을 취소하고 후보를 무작위로 바꿔가며 다시 시도한다 — 최대 가격을 초과한 조합은 절대 반영되지 않음.
// 도구/소모품 채우기(6번 규칙)처럼 원래도 다 못 채울 수 있던 부분은 그대로 못 채울 수 있고,
// 무기 2번째 자리도 원래 슬롯 한도 때문에 못 들어갈 수 있던 것처럼 예산 때문에 못 들어갈 수 있다.
// 다만 무기 최소 1자루 + 구급상자 + 회복 주사기 1개는 원래도 필수였던 항목이라, 예산 안에서
// 고를 수 있는 후보가 있는 한 반드시 채워지고, 극단적으로 예산이 부족할 때만 최후 수단으로
// 그중 가장 싼 후보를 예산 초과를 감수하고 넣는다(현실적으로 슬라이더 최소값에서는 발생하지 않음).
// 최소 가격은 여기서는 신경쓰지 않고, 호출하는 쪽(generateRandomLoadout)이 여러 번 시도해서 판단한다.
function buildRandomLoadoutOnce() {
  initLoadoutState();
  const cap = state.randomMaxPrice;
  const computeTotal = () => calculateSerializedLoadoutTotal(serializeCurrentLoadout());

  // 희소(Scarce, 상점 구매 불가·필드 드랍 전용) 무기/도구/소모품은 스위치가 꺼져 있으면
  // 후보 풀에서 아예 제외한다(특성의 희소 제외는 이 스위치와 무관하게 항상 적용되는 별개 규칙).
  const scarceOk = (item) => state.randomAllowScarce || !item.scarce;

  // 필드 쪽 필수 항목(구급상자+근접·투척무기(+화염신호탄)+회복 주사기)은 무기와 무관하게 최소
  // 비용이 정해져 있으므로, 무기를 고르기 전에 그 최소 비용만큼을 미리 예산에서 떼어놓는다.
  // 이렇게 해야 무기 하나만으로 예산을 거의 다 써버려서 뒤이어 나오는 필수 필드 항목이
  // 강제로 예산을 초과하게 되는 상황을 막을 수 있다(무기 선택이 필드보다 먼저 일어나기 때문).
  const meleeToolIds = ITEMS.filter((i) => i.category === "tool" && i.toolClass === "melee" && scarceOk(i)).map((i) => i.id);
  const throwableMeleeIds = ITEMS.filter((i) => i.category === "tool" && i.toolClass === "throwable_melee" && scarceOk(i)).map((i) => i.id);
  const fuseesOk = scarceOk(findItemById("tool_fusees"));
  const healShotIds = [
    "consumable_regeneration_shot", "consumable_regeneration_shot_weak",
    "consumable_vitality_shot", "consumable_vitality_shot_weak",
  ].filter((id) => scarceOk(findItemById(id)));

  const priceOf = (id) => findItemById(id)?.price ?? Infinity;
  const medkitPrice = priceOf("tool_first_aid_kit");
  const cheapestHealShotPrice = Math.min(...healShotIds.map(priceOf));
  const fuseesPrice = fuseesOk ? priceOf("tool_fusees") : 0;
  // 근접무기 장착 여부에 따라 필요한 후보군이 달라지므로(장착 시 투척무기만, 미장착 시 근접+투척무기),
  // 아직 무기를 고르기 전이라 어느 쪽이 될지 모름 — 두 경우 중 비용이 더 큰 쪽 기준으로 안전하게 예약.
  const cheapestThrowOrFusees = Math.min(...throwableMeleeIds.map(priceOf), ...(fuseesOk ? [fuseesPrice] : []));
  const cheapestMeleeOrThrowPlusFusees = Math.min(...meleeToolIds.map(priceOf), ...throwableMeleeIds.map(priceOf)) + fuseesPrice;
  const meleeOrThrowReserve = Math.max(cheapestThrowOrFusees, cheapestMeleeOrThrowPlusFusees);
  const fieldMandatoryReserve = [medkitPrice, cheapestHealShotPrice, meleeOrThrowReserve]
    .reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  const weaponCap = Math.max(0, cap - fieldMandatoryReserve);

  // 무기 한 자리(주슬롯/보조슬롯)를 예산 안에서 채운다. 후보를 무작위 순서로 하나씩 실제로
  // 장착해보고(탄약까지 랜덤 배정된 뒤에야 정확한 가격을 알 수 있음) targetCap 초과면 되돌리고 다음 후보를 시도.
  // mandatory=true면 targetCap 안에 드는 후보가 하나도 없어도 그중 가장 쌌던 조합을 강제로 확정한다.
  function fillWeaponSlot(key, candidateRows, mandatory, targetCap) {
    const shuffled = shuffleArray(candidateRows);
    let cheapest = null;
    for (const row of shuffled) {
      equipRandomWeaponRow(key, row);
      const total = computeTotal();
      if (total <= targetCap) return row;
      const slot0 = state.loadout[key][0] ? { ...state.loadout[key][0] } : null;
      const slot1 = row.dual ? (state.loadout[key][1] ? { ...state.loadout[key][1] } : null) : null;
      if (!cheapest || total < cheapest.total) cheapest = { row, slot0, slot1, total };
      state.loadout[key][0] = null;
      state.loadout[key][1] = null;
    }
    if (mandatory && cheapest) {
      state.loadout[key][0] = cheapest.slot0;
      state.loadout[key][1] = cheapest.slot1;
      return cheapest.row;
    }
    return null;
  }

  // 1) 무기: 주슬롯(필수, 최소 1자루 보장) + 보조슬롯(기존처럼 시도하되 슬롯 한도·샷건 1자루 제한·
  // 예산을 넘으면 원래도 그랬듯 못 들어갈 수 있음). 아킴보 가능한 권총은 "듀얼 버전"이 별개의
  // 무기 후보로 풀에 추가되어 다른 무기들과 동일한 확률로 뽑힘. 무기 칸수 스위치가 켜져 있으면
  // 6칸까지, 꺼져 있으면 5칸까지만 허용.
  const weaponPool = getFlattenedWeaponItems().filter((item) => item.category === "weapon" && scarceOk(item));
  const weaponRowPool = buildWeaponRowPool(weaponPool);
  const maxWeaponSlotTotal = state.randomAllowSlot6 ? WEAPON_SLOT_LIMIT : 5;

  const chosenWeapons = [];
  let usedSlotSize = 0;
  let hasAkimboPair = false;

  const primaryCandidates = weaponRowPool.filter((r) => (r.item.slotSize || 0) * (r.dual ? 2 : 1) <= maxWeaponSlotTotal);
  const primaryRow = fillWeaponSlot(loadoutKey("weapon", "primary"), primaryCandidates, true, weaponCap);
  if (primaryRow) {
    chosenWeapons.push(primaryRow.item);
    usedSlotSize += (primaryRow.item.slotSize || 0) * (primaryRow.dual ? 2 : 1);
    if (primaryRow.dual) hasAkimboPair = true;
  }

  const secondaryCandidates = weaponRowPool.filter((r) => {
    const cost = (r.item.slotSize || 0) * (r.dual ? 2 : 1);
    if (usedSlotSize + cost > maxWeaponSlotTotal) return false;
    if (r.item.weaponClass === "shotgun" && chosenWeapons.some((w) => w.weaponClass === "shotgun")) return false;
    return true;
  });
  const secondaryRow = fillWeaponSlot(loadoutKey("weapon", "secondary"), secondaryCandidates, false, weaponCap);
  if (secondaryRow) {
    chosenWeapons.push(secondaryRow.item);
    usedSlotSize += (secondaryRow.item.slotSize || 0) * (secondaryRow.dual ? 2 : 1);
    if (secondaryRow.dual) hasAkimboPair = true;
  }

  const totalWeaponSlotSize = usedSlotSize;
  const hasMeleeWeaponEquipped = chosenWeapons.some((w) => w.weaponClass === "melee");

  // 2) 필드 장비(도구+소모품, 공유 8칸) — 필수 항목부터 확정
  const field = state.loadout["field__all"];

  // 예산과 무관하게 강제 포함(단일 고정 항목이라 후보 검색 자체가 필요 없음)
  field.push("tool_first_aid_kit"); // 1) 구급상자 고정 1개

  // 선택 항목 하나를 예산 안에서 추가 시도. 넘으면 되돌리고 실패 반환(호출부가 다음 후보로 넘어감).
  function tryAddOptionalField(id) {
    if (!id || field.length >= 8) return false;
    field.push(id);
    if (computeTotal() <= cap) return true;
    field.pop();
    return false;
  }

  // 필수 항목 하나를 candidateIds 중에서 targetCap 안에 드는 걸로 확정(무작위 순서로 시도하다
  // 처음 맞는 걸 채택 — 반드시 가장 싼 것은 아니라서, targetCap은 이 뒤에 아직 채워야 할 다른
  // 필수 항목들의 최소 비용까지 미리 빼둔 값이어야 함. 하나도 안 들어가면 그중 가장 쌌던 걸
  // targetCap 초과를 감수하고 강제로 넣는다(항상 필수였던 항목이므로). 반환값: 실제로 확정된 id.
  function addMandatoryField(candidateIds, targetCap) {
    const shuffled = shuffleArray(candidateIds);
    let cheapestId = null;
    let cheapestTotal = Infinity;
    for (const id of shuffled) {
      field.push(id);
      const total = computeTotal();
      if (total <= targetCap) return id;
      field.pop();
      if (total < cheapestTotal) { cheapestTotal = total; cheapestId = id; }
    }
    if (cheapestId) field.push(cheapestId);
    return cheapestId;
  }

  // 아직 채워야 할 필수 항목이 남아있는 동안은 그만큼을 예산에서 미리 빼둔 목표치를 써서,
  // 지금 항목이 "일단 맞으니까" 남은 항목 몫까지 다 써버리는 일이 없게 한다.
  // (근접/투척무기 단계 → 화염신호탄(필요시) → 회복 주사기 순서로 확정되므로 역순으로 미리 뺌)
  const meleeStepTarget = cap - fuseesPrice - cheapestHealShotPrice;
  const fuseesStepTarget = cap - cheapestHealShotPrice;
  const healShotStepTarget = cap; // 마지막 필수 항목이라 더 뺄 게 없음

  // 무기 슬롯에 이미 근접무기(weaponClass:"melee")가 있으면: 도구칸의 근접무기(나이프류)는
  // 절대 등장하지 않고, 대신 투척무기 또는 화염 신호탄 중 최소 1개가 필수로 들어감.
  if (hasMeleeWeaponEquipped) {
    addMandatoryField([...throwableMeleeIds, ...(fuseesOk ? ["tool_fusees"] : [])], fuseesStepTarget);
  } else {
    // 2) 근접무기 또는 투척무기 중 1개는 필수
    const pickedId = addMandatoryField([...meleeToolIds, ...throwableMeleeIds], meleeStepTarget);
    if (meleeToolIds.includes(pickedId) && fuseesOk) addMandatoryField(["tool_fusees"], fuseesStepTarget); // 3) 근접무기 선택 시 화염 신호탄 필수
  }

  addMandatoryField(healShotIds, healShotStepTarget); // 5) 재생 주사/활력 주사 중 최소 1개(소모품은 중복 가능)

  // 6) 타로 카드는 다른 도구/소모품과 동일한 확률로 나머지 빈 칸을 채울 때 후보에 포함되되,
  // 전체 타로 장수만 최대 2장으로 제한(자연히 "다른 2종류 1장씩" 또는 "동일 카드 2장"만 나옴).
  const TAROT_RANDOM_MAX = 2;
  const tarotIds = ITEMS.filter((i) => i.category === "consumable" && i.consumableClass === "tarot").map((i) => i.id);

  // 나머지 빈 칸: 구급상자를 제외한 모든 도구/소모품(타로 포함) 중 무작위로 채움.
  // 7) 도구(category:"tool")는 중복 등장 불가 — 소모품은 기존 스택 한도만 그대로 준수.
  // 근접무기(나이프류)·투척무기는 위에서 이미 "최소 1개"가 확정됐으므로(2번 규칙), 여기서
  // 같은 두 toolClass의 도구가 추가로 더 뽑히지 않게 완전히 제외한다(나이프+헤비나이프+
  // 투척도끼가 한꺼번에 나오는 문제 방지).
  const fillCandidates = ITEMS.filter((i) =>
    (i.category === "tool" || i.category === "consumable") &&
    i.id !== "tool_first_aid_kit" &&
    i.toolClass !== "melee" &&
    i.toolClass !== "throwable_melee" &&
    scarceOk(i)
  );
  let guard = 0;
  while (field.length < 8 && fillCandidates.length && guard < 2000) {
    guard++;
    const cand = pickRandomItem(fillCandidates);
    if (cand.category === "tool") {
      if (field.includes(cand.id)) continue; // 7) 도구 중복 금지
    } else if (tarotIds.includes(cand.id)) {
      const totalTarotCount = field.filter((id) => tarotIds.includes(id)).length;
      if (totalTarotCount >= TAROT_RANDOM_MAX) continue;
    } else {
      const stackGroup = getConsumableStackGroup(cand);
      if (stackGroup) {
        const currentCount = field.filter((id) => id === cand.id).length;
        if (currentCount >= CONSUMABLE_STACK_MAX) continue;
      }
    }
    tryAddOptionalField(cand.id); // 예산을 넘으면 자동으로 취소되고 다음 후보로 계속 시도
  }

  // 3) 특성: 희소 특성 제외 + 무기 조건부 특성 필터링 + 10포인트 정확히 채움 +
  // 무기 칸수 합 6칸이면 보급 장교(trait_quartermaster) 고정 등장
  // (특성은 업그레이드 포인트 예산이라 이 가격 합산과 무관 — 예산 제한과 상관없이 항상 기존 로직대로 채움)
  const traitContext = { weapons: chosenWeapons, fieldIds: field, hasAkimboPair };
  const eligibleTraits = ITEMS.filter((i) =>
    i.category === "trait" &&
    !(i.traitTags || []).includes("scarce") &&
    i.price != null &&
    isTraitEligibleForRandomLoadout(i, traitContext)
  );

  const traitKey = loadoutKey("trait", "trait");
  const chosenTraits = [];
  let traitBudget = TRAIT_RANDOM_BUDGET;
  if (totalWeaponSlotSize === 6) {
    const quartermaster = eligibleTraits.find((t) => t.id === "trait_quartermaster");
    if (quartermaster && quartermaster.price <= traitBudget) {
      chosenTraits.push(quartermaster);
      traitBudget -= quartermaster.price;
    }
  }
  const remainingCandidates = eligibleTraits.filter((t) => !chosenTraits.includes(t));
  chosenTraits.push(...pickTraitsExactBudget(remainingCandidates, traitBudget));
  state.loadout[traitKey] = chosenTraits.map((t) => t.id);
}

// 최대 가격은 buildRandomLoadoutOnce가 항상 지키므로, 여기서는 결과 총액이 최소 가격
// (state.randomMinPrice) 이상인지만 확인해서 아니면 다시 뽑는다. 시도 안에 최소 가격을 못
// 채우면(예: 최소~최대 범위가 너무 좁은 경우) 그동안 나온 것 중 총액이 가장 높았던 조합을 사용.
function generateRandomLoadout() {
  const minCap = state.randomMinPrice;
  const MAX_ATTEMPTS = 100;
  let bestSnapshot = null;
  let bestTotal = -Infinity;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    buildRandomLoadoutOnce();
    const total = calculateSerializedLoadoutTotal(serializeCurrentLoadout());
    if (total >= minCap) { bestSnapshot = null; break; } // 이미 state.loadout에 반영된 상태 그대로 사용
    if (total > bestTotal) {
      bestTotal = total;
      bestSnapshot = serializeCurrentLoadout();
    }
  }

  if (bestSnapshot) applySerializedLoadout(bestSnapshot);
  else renderLoadoutBoard();
  showToast("랜덤 로드아웃을 생성했습니다.", "info");
}

// -------------------------------------------------------------------------
// 커뮤니티 로드아웃 — 현재 로드아웃을 Firestore에 저장/공유, 남이 올린 것도 불러오기
//
// 무기 슬롯은 item 전체 객체 대신 id만 저장하고, 불러올 때 findItemById로
// 다시 찾는다. 존재하지 않는 id(삭제/변경된 아이템)는 조용히 무시(방어적 검증) —
// 남이 올린 데이터를 그대로 신뢰하지 않는다.
// -------------------------------------------------------------------------
function serializeCurrentLoadout() {
  const out = { w: {}, f: [], t: [] };
  CATEGORIES.weapon.loadoutSlots.forEach((slotDef) => {
    const key = loadoutKey("weapon", slotDef.slotKey);
    out.w[slotDef.slotKey] = (state.loadout[key] || []).map((slot) => {
      if (!slot || !slot.item) return null;
      return { id: slot.item.id, a: slot.ammoId ?? null, a2: slot.ammoId2 ?? null };
    });
  });
  out.f = (state.loadout["field__all"] || []).slice();
  out.t = (state.loadout[loadoutKey("trait", "trait")] || []).slice();
  return out;
}

function applySerializedLoadout(obj) {
  if (!obj || typeof obj !== "object") return false;
  initLoadoutState();
  CATEGORIES.weapon.loadoutSlots.forEach((slotDef) => {
    const key = loadoutKey("weapon", slotDef.slotKey);
    const arr = (obj.w && obj.w[slotDef.slotKey]) || [];
    const rebuilt = arr.map((slot) => {
      if (!slot || !slot.id) return null;
      const item = findItemById(slot.id);
      if (!item) return null;
      return {
        item,
        ammoId: (slot.a != null && AMMO_TYPES[slot.a]) ? slot.a : null,
        ammoId2: (slot.a2 != null && AMMO_TYPES[slot.a2]) ? slot.a2 : null,
      };
    });
    while (rebuilt.length < slotDef.max) rebuilt.push(null);
    state.loadout[key] = rebuilt.slice(0, slotDef.max);
  });
  state.loadout["field__all"] = (Array.isArray(obj.f) ? obj.f : [])
    .filter((id) => findItemById(id)).slice(0, 8);
  state.loadout[loadoutKey("trait", "trait")] = (Array.isArray(obj.t) ? obj.t : [])
    .filter((id) => findItemById(id)).slice(0, TRAIT_MAX_COUNT);
  renderLoadoutBoard();
  return true;
}

function showCommunitySaveMsg(text, isError) {
  const msg = document.getElementById("community-save-msg");
  msg.textContent = text;
  msg.hidden = false;
  msg.classList.toggle("error", !!isError);
}

async function handleCommunitySave() {
  const input = document.getElementById("community-name-input");
  const btn = document.getElementById("community-save-btn");
  if (!window.LoadoutCloud) {
    showCommunitySaveMsg("커뮤니티 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.", true);
    return;
  }
  btn.disabled = true;
  try {
    const dataStr = JSON.stringify(serializeCurrentLoadout());
    await window.LoadoutCloud.saveLoadout(input.value, dataStr);
    input.value = "";
    showCommunitySaveMsg("업로드 완료!", false);
    renderCommunityLoadouts();
  } catch (err) {
    showCommunitySaveMsg(err.message || "업로드에 실패했습니다.", true);
  } finally {
    btn.disabled = false;
  }
}

async function renderCommunityLoadouts() {
  const listEl = document.getElementById("community-loadout-list");
  if (!window.LoadoutCloud) {
    listEl.textContent = "커뮤니티 기능을 불러오는 중입니다...";
    return;
  }
  listEl.textContent = "불러오는 중...";
  try {
    const raw = await window.LoadoutCloud.listLoadouts();
    state.communityLoadouts = raw.map((entry) => {
      let parsed = null;
      try { parsed = JSON.parse(entry.data); } catch { /* 아래에서 무효 처리 */ }
      return {
        ...entry,
        parsed,
        totalCost: parsed ? calculateSerializedLoadoutTotal(parsed) : null,
      };
    });
    renderCommunityLoadoutList();
  } catch (err) {
    listEl.textContent = "목록을 불러오지 못했습니다.";
  }
}

// 정렬/가격 필터 컨트롤이 바뀔 때마다 재조회 없이 캐시(state.communityLoadouts)로만 다시 그림
function renderCommunityLoadoutList() {
  const listEl = document.getElementById("community-loadout-list");
  let entries = state.communityLoadouts.filter((e) => e.parsed != null);

  if (state.communityPriceMin != null) {
    entries = entries.filter((e) => e.totalCost >= state.communityPriceMin);
  }
  if (state.communityPriceMax != null) {
    entries = entries.filter((e) => e.totalCost <= state.communityPriceMax);
  }
  const createdAtMs = (e) => e.createdAt?.toMillis ? e.createdAt.toMillis() : 0;
  if (state.communitySort === "price-asc") {
    entries = [...entries].sort((a, b) => a.totalCost - b.totalCost);
  } else if (state.communitySort === "price-desc") {
    entries = [...entries].sort((a, b) => b.totalCost - a.totalCost);
  } else if (state.communitySort === "likes-desc") {
    entries = [...entries].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
  } else if (state.communitySort === "date-asc") {
    entries = [...entries].sort((a, b) => createdAtMs(a) - createdAtMs(b));
  }
  // 정렬/필터 없는 기본값("")은 Firestore 조회 자체가 이미 최신순(createdAt desc)이라 그대로 둠

  const pageEl = document.getElementById("community-pagination");
  listEl.innerHTML = "";
  if (entries.length === 0) {
    listEl.textContent = state.communityLoadouts.length === 0
      ? "아직 올라온 로드아웃이 없습니다."
      : "조건에 맞는 로드아웃이 없습니다.";
    pageEl.innerHTML = "";
    return;
  }

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  if (state.communityPage >= totalPages) state.communityPage = totalPages - 1;
  if (state.communityPage < 0) state.communityPage = 0;
  const pageEntries = entries.slice(state.communityPage * PAGE_SIZE, (state.communityPage + 1) * PAGE_SIZE);

  pageEntries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "community-loadout-row";

    const info = document.createElement("div");
    info.className = "community-loadout-info";

    // 이름은 반드시 textContent로만 그린다 — innerHTML에 남이 올린 텍스트를 절대 넣지 않음(XSS 방지)
    const nameSpan = document.createElement("span");
    nameSpan.className = "community-loadout-name";
    nameSpan.textContent = entry.name || "(이름 없음)";

    const priceSpan = document.createElement("span");
    priceSpan.className = "community-loadout-price";
    priceSpan.innerHTML = `<img src="images/ui/hunt_dollars.png" alt="$" class="dollar-icon">${entry.totalCost}`;

    info.appendChild(nameSpan);
    info.appendChild(priceSpan);

    // 패치마다 밸런스가 바뀌니 언제 올라온 로드아웃인지 알 수 있게 날짜 표시(예전에 올라온 것은 날짜 없이 표시)
    if (entry.createdAt?.toDate) {
      const dateSpan = document.createElement("span");
      dateSpan.className = "community-loadout-date";
      dateSpan.textContent = entry.createdAt.toDate().toLocaleDateString("ko-KR");
      info.appendChild(dateSpan);
    }

    const actions = document.createElement("div");
    actions.className = "community-loadout-actions";

    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.className = `community-loadout-like-btn${entry.isLiked ? " liked" : ""}`;
    likeBtn.textContent = `♥ ${entry.likeCount ?? 0}`;
    likeBtn.addEventListener("click", async () => {
      if (!window.LoadoutCloud) return;
      likeBtn.disabled = true;
      const wasLiked = entry.isLiked;
      try {
        await window.LoadoutCloud.toggleLike(entry.id, wasLiked);
        entry.isLiked = !wasLiked;
        entry.likeCount = (entry.likeCount ?? 0) + (wasLiked ? -1 : 1);
        likeBtn.textContent = `♥ ${entry.likeCount}`;
        likeBtn.classList.toggle("liked", entry.isLiked);
      } catch {
        showToast(wasLiked ? "좋아요 취소에 실패했습니다." : "좋아요 반영에 실패했습니다.");
      } finally {
        likeBtn.disabled = false;
      }
    });

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "community-loadout-load-btn";
    loadBtn.textContent = "불러오기";
    loadBtn.addEventListener("click", () => {
      applySerializedLoadout(entry.parsed);
      showToast("로드아웃을 불러왔습니다.");
    });

    actions.appendChild(likeBtn);
    actions.appendChild(loadBtn);

    // 내가 올린 글에만 삭제 버튼 표시 (서버가 ownerId로 판단해준 값 그대로 사용)
    if (entry.isMine) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "community-loadout-delete-btn";
      deleteBtn.textContent = "삭제";
      deleteBtn.addEventListener("click", async () => {
        if (!window.LoadoutCloud) return;
        if (!confirm(`"${entry.name}" 로드아웃을 삭제할까요?`)) return;
        deleteBtn.disabled = true;
        try {
          await window.LoadoutCloud.deleteLoadout(entry.id);
          state.communityLoadouts = state.communityLoadouts.filter((e) => e.id !== entry.id);
          renderCommunityLoadoutList();
        } catch {
          deleteBtn.disabled = false;
          showToast("삭제에 실패했습니다.");
        }
      });
      actions.appendChild(deleteBtn);
    }

    row.appendChild(info);
    row.appendChild(actions);
    listEl.appendChild(row);
  });

  // 20개 넘게 있으면 페이지 넘김 버튼 표시
  pageEl.innerHTML = "";
  if (totalPages > 1) {
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.textContent = "‹ 이전";
    prevBtn.disabled = state.communityPage === 0;
    prevBtn.addEventListener("click", () => { state.communityPage--; renderCommunityLoadoutList(); });

    const label = document.createElement("span");
    label.className = "community-pagination-label";
    label.textContent = `${state.communityPage + 1} / ${totalPages}`;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.textContent = "다음 ›";
    nextBtn.disabled = state.communityPage >= totalPages - 1;
    nextBtn.addEventListener("click", () => { state.communityPage++; renderCommunityLoadoutList(); });

    pageEl.appendChild(prevBtn);
    pageEl.appendChild(label);
    pageEl.appendChild(nextBtn);
  }
}

// -------------------------------------------------------------------------
// 분석 탭 — 무기+탄약 조합 비교
// -------------------------------------------------------------------------
const COMPARE_COLORS = ["#ece6d3", "#5c8a63", "#c25b4d", "#7ba0c4", "#b48ec4", "#d4c25e", "#c4865c"];

function renderAnalysis() {
  const listEl = document.getElementById("compare-weapon-list");
  const chartWrap = document.getElementById("compare-chart-wrap");
  const ohkSection = document.getElementById("compare-ohk-section");
  const ohkShotgunBlock = document.getElementById("compare-ohk-shotgun-block");
  const ohkShotgunWrap = document.getElementById("compare-ohk-shotgun-chart-wrap");
  const ohkOtherBlock = document.getElementById("compare-ohk-other-block");
  const ohkOtherWrap = document.getElementById("compare-ohk-other-chart-wrap");
  if (state.charts.compare) { state.charts.compare.destroy(); state.charts.compare = null; }
  if (state.charts.compareOhkShotgun) { state.charts.compareOhkShotgun.destroy(); state.charts.compareOhkShotgun = null; }
  if (state.charts.compareOhkOther) { state.charts.compareOhkOther.destroy(); state.charts.compareOhkOther = null; }

  if (state.compareEntries.length === 0) {
    listEl.innerHTML = `<p class="empty-msg">비교할 항목이 없습니다. DB 검색 → 무기 클릭 → 탄약 선택 → "비교 목록에 추가"를 눌러주세요.</p>`;
    chartWrap.innerHTML = "";
    ohkSection.hidden = true;
    ohkChartWrap.innerHTML = "";
    state.statCompareSelection = [];
    renderCompareStatsSection();
    return;
  }

  listEl.innerHTML = "";
  state.compareEntries.forEach((entry, idx) => {
    const item = findItemById(entry.weaponId);
    const ammo = AMMO_TYPES[entry.ammoId];
    if (!item || !ammo) return;
    const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
    const isSelected = state.statCompareSelection.some((s) => s.weaponId === entry.weaponId && s.ammoId === entry.ammoId);
    const chip = document.createElement("div");
    chip.className = `compare-chip ${isSelected ? "stat-selected" : ""}`;
    chip.style.borderColor = color;
    chip.title = "클릭하면 아래 총기 스탯 비교에 추가/제외됩니다";
    chip.innerHTML = `
      <span class="compare-swatch" style="background:${color}"></span>
      <span>${displayName(item)} · ${ammo.label}</span>
      <button class="slot-clear-btn" type="button">✕</button>
    `;
    chip.querySelector(".slot-clear-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      state.compareEntries.splice(idx, 1);
      state.statCompareSelection = state.statCompareSelection.filter((s) => !(s.weaponId === entry.weaponId && s.ammoId === entry.ammoId));
      renderAnalysis();
    });
    chip.addEventListener("click", () => {
      const exists = state.statCompareSelection.some((s) => s.weaponId === entry.weaponId && s.ammoId === entry.ammoId);
      if (exists) {
        state.statCompareSelection = state.statCompareSelection.filter((s) => !(s.weaponId === entry.weaponId && s.ammoId === entry.ammoId));
      } else {
        state.statCompareSelection.push({ weaponId: entry.weaponId, ammoId: entry.ammoId });
      }
      renderAnalysis();
    });
    listEl.appendChild(chip);
  });

  // 낙하 데미지 곡선(falloff)이 있는 일반 무기와, 없는 샷건/한방(OHK) 무기는 서로 축의
  // 의미가 달라서(거리별 "피해량" vs 거리별 "한방 가능 여부") 그래프를 완전히 분리해서 그림.
  // OHK 무기 중에서도 샷건(사거리 짧음)과 그 외(사거리 긺)는 축 스케일 차이가 커서
  // 한 그래프에 섞으면 짧은 막대가 안 보이므로 최대 거리 기준을 고정해 별도로 그림
  // (사용자 확인: 샷건 최대 20m, 그 외 한방무기 최대 50m로 통일).
  const falloffDatasets = [];
  const shotgunOhkEntries = [];
  const otherOhkEntries = [];
  state.compareEntries.forEach((entry, idx) => {
    const item = findItemById(entry.weaponId);
    if (!item) return;
    const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
    const falloffDs = buildFalloffDataset(item, entry.ammoId, color);
    if (falloffDs) {
      falloffDatasets.push(falloffDs);
      return;
    }
    const ohkEntry = getOhkCompareEntry(item, entry.ammoId, color);
    if (!ohkEntry) return;
    const isShotgun = item.ammoCategory === "shotgun" || ohkEntry.ammo.category === "shotgun";
    (isShotgun ? shotgunOhkEntries : otherOhkEntries).push(ohkEntry);
  });

  if (falloffDatasets.length > 0) {
    chartWrap.innerHTML = `<canvas id="compare-chart"></canvas>`;
    const canvas = document.getElementById("compare-chart");
    // 비교 중 무기들 중 하나라도 데미지가 150 이상이면 OHK 라인 표시
    const anyOHK = falloffDatasets.some((ds) => ds.data.some((d) => d.y >= HUNTER_HP));
    state.charts.compare = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { datasets: falloffDatasets },
      options: chartOptions("거리 (m)", "피해", { showOHK: anyOHK }),
      plugins: [btkLinesPlugin],
    });
  } else {
    chartWrap.innerHTML = "";
  }

  if (shotgunOhkEntries.length > 0) {
    ohkShotgunBlock.hidden = false;
    ohkShotgunWrap.innerHTML = `<canvas id="compare-ohk-shotgun-chart"></canvas>`;
    ohkShotgunWrap.style.height = `${Math.max(120, shotgunOhkEntries.length * 56 + 40)}px`;
    const canvas = document.getElementById("compare-ohk-shotgun-chart");
    state.charts.compareOhkShotgun = buildOhkBarChart(canvas, shotgunOhkEntries, 20);
  } else {
    ohkShotgunBlock.hidden = true;
    ohkShotgunWrap.innerHTML = "";
  }

  if (otherOhkEntries.length > 0) {
    ohkOtherBlock.hidden = false;
    ohkOtherWrap.innerHTML = `<canvas id="compare-ohk-other-chart"></canvas>`;
    ohkOtherWrap.style.height = `${Math.max(120, otherOhkEntries.length * 56 + 40)}px`;
    const canvas = document.getElementById("compare-ohk-other-chart");
    state.charts.compareOhkOther = buildOhkBarChart(canvas, otherOhkEntries, 50);
  } else {
    ohkOtherBlock.hidden = true;
    ohkOtherWrap.innerHTML = "";
  }

  ohkSection.hidden = shotgunOhkEntries.length === 0 && otherOhkEntries.length === 0;

  renderCompareStatsSection();
}

// 낙하 데미지 곡선이 없는 샷건/한방(OHK) 무기 전용 비교 그래프 — 거리(m) 값만 가로
// 막대로 비교(보장 구간 실색 + 불안정 구간 옅은 색을 이어 붙인 누적 막대).
// maxDistance: x축 최대값을 무기군별로 고정해서(샷건 20m / 그 외 50m) 서로 다른
// 사거리대의 무기를 나눠 그려도 항상 같은 스케일로 비교할 수 있게 함.
function buildOhkBarChart(canvas, ohkEntries, maxDistance) {
  const labels = ohkEntries.map((e) => `${displayName(e.item)} · ${e.ammo.label}`);
  const guaranteedData = ohkEntries.map((e) => e.ohkRange.guaranteed);
  const unstableData = ohkEntries.map((e) => {
    const { guaranteed, unstableEnd, noneFrom } = e.ohkRange;
    const hasUnstable = unstableEnd != null && noneFrom != null;
    return hasUnstable ? noneFrom - guaranteed : 0;
  });
  const colors = ohkEntries.map((e) => e.color);

  return new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "보장", data: guaranteedData, backgroundColor: colors, stack: "ohk", borderRadius: 3 },
        { label: "불안정", data: unstableData, backgroundColor: colors.map((c) => c + "55"), stack: "ohk", borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true, beginAtZero: true, max: maxDistance,
          title: { display: true, text: "거리 (m)", color: "#aba894" },
          ticks: { color: "#aba894" }, grid: { color: "rgba(77, 86, 64, 0.3)" },
        },
        y: { stacked: true, ticks: { color: "#aba894" }, grid: { display: false } },
      },
      plugins: {
        legend: { labels: { color: "#aba894" } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}m`,
          },
        },
      },
    },
  });
}

// 총기 스탯 비교 (칩 클릭으로 선택된 항목만 대상)
const STAT_DEFS = [
  { key: "damage", label: "피해" },
  { key: "dropRange", label: "낙하 범위" },
  { key: "rateOfFire", label: "발사속도" },
  { key: "cycleTime", label: "사이클 시간" },
  { key: "spread", label: "분산도" },
  { key: "sway", label: "흔들림" },
  { key: "verticalRecoil", label: "수직 반동" },
  { key: "reloadSpeed", label: "재장전 속도" },
  { key: "muzzleVelocity", label: "총구속도" },
  { key: "meleeLight", label: "약공격 피해" },
  { key: "meleeHeavy", label: "강공격 피해" },
  { key: "staminaConsumption", label: "기력 소모(강공격)" },
];

function renderCompareStatsSection() {
  const wrap = document.getElementById("compare-stats-wrap");
  if (state.charts.compareStats) { state.charts.compareStats.destroy(); state.charts.compareStats = null; }

  // 비교 목록에서 제거된 항목은 선택에서도 자동으로 정리
  state.statCompareSelection = state.statCompareSelection.filter((s) =>
    state.compareEntries.some((e) => e.weaponId === s.weaponId && e.ammoId === s.ammoId)
  );

  const selected = state.statCompareSelection
    .map((s) => {
      const item = findItemById(s.weaponId);
      const ammo = AMMO_TYPES[s.ammoId];
      if (!item || !ammo) return null;
      const { stats } = resolveWeaponWithAmmo(item, s.ammoId);
      return { item, ammo, stats };
    })
    .filter(Boolean);

  if (selected.length === 0) {
    wrap.style.height = "auto";
    wrap.innerHTML = `<p class="empty-msg">위 목록에서 총을 클릭하면 스탯을 비교할 수 있습니다.</p>`;
    return;
  }

  if (selected.length === 1) {
    wrap.style.height = "auto";
    const { item, ammo, stats } = selected[0];
    wrap.innerHTML = `
      <h4 class="compare-stats-single-title">${displayName(item)} · ${ammo.label}</h4>
      <div class="detail-stats">
        ${STAT_DEFS.map((d) => statRowSimple(d.label, stats[d.key], d.key)).join("")}
      </div>
    `;
    return;
  }

  // 2개 이상: 스탯마다 무기별 막대바를 나란히 표시 (게임 내 스탯 표기 스타일)
  wrap.style.height = "auto";

  const withColor = selected.map((s, idx) => ({ ...s, color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }));

  const blocks = STAT_DEFS.map((d) => {
    const rawValues = withColor.map((s) => s.stats[d.key] ?? 0);
    const maxVal = Math.max(...rawValues, 0.0001);
    const bars = withColor.map((s, i) => {
      const raw = rawValues[i];
      const pct = Math.max(2, Math.round((raw / maxVal) * 1000) / 10); // 0이어도 막대가 아예 안보이지 않게 최소 2%
      return `
        <div class="stat-compare-bar-row">
          <span class="stat-compare-swatch" style="background:${s.color}"></span>
          <span class="stat-compare-name" title="${displayName(s.item)} · ${s.ammo.label}">${displayName(s.item)} · ${s.ammo.label}</span>
          <span class="stat-compare-track"><span class="stat-compare-fill" style="width:${pct}%; background:${s.color}"></span></span>
          <b class="stat-compare-value">${raw}</b>
        </div>`;
    }).join("");
    return `
      <div class="stat-compare-block">
        <h5>${d.label}</h5>
        ${bars}
      </div>`;
  }).join("");

  wrap.innerHTML = `<div class="stat-compare-grid">${blocks}</div>`;
}

// -------------------------------------------------------------------------
// 맵 탭 — 인터랙티브 맵 (베이스 지도 + 레이어 오버레이)
// -------------------------------------------------------------------------
async function renderMapsTab() {
  if (!state.activeMapId && MAPS.length) state.activeMapId = MAPS[0].id;
  if (!state.activeMapLayers) {
    state.activeMapLayers = new Set(MAP_LAYERS.filter((l) => l.defaultOn).map((l) => l.key));
  }
  // 운영자 키 유무는 첫 진입 때 한 번만 확인 — 있으면 "지점 편집" 버튼을 보여준다.
  if (!state.mapOperatorChecked) {
    state.mapOperatorChecked = true;
    const opAuth = await operatorAuthenticate();
    if (opAuth) state.mapOperatorIdToken = opAuth.idToken;
    document.getElementById("map-edit-toggle-btn").hidden = !opAuth;
  }
  if (!state.mapCustomLayersLoaded) {
    state.mapCustomLayersLoaded = true;
    state.mapCustomLayers = await fetchMapCustomLayers().catch(() => []);
  }
  renderMapSelectRow();
  renderMapLegendPanel();
  await loadMapOverrideForActiveMap();
}

function getActiveMap() {
  return MAPS.find((m) => m.id === state.activeMapId) || null;
}

// 운영자가 확정 게시한 값이 있으면 그걸(mapOverridePoints), 없으면(404) 정적
// 데이터(js/maps-data.js)를 그대로 쓴다.
function getEffectivePoints(map) {
  if (!map) return {};
  return state.mapOverridePoints || map.layers;
}

// 화면에 지금 당장 그려야 할 지점 — 편집 모드면 아직 게시 전인 초안을,
// 아니면 게시된(또는 정적) 값을 보여준다.
function currentDisplayPoints(map) {
  if (state.mapEditMode && state.mapEditPoints) return state.mapEditPoints;
  return getEffectivePoints(map);
}

function effectiveMapLayers() {
  return MAP_LAYERS.concat(state.mapCustomLayers || []);
}

async function loadMapOverrideForActiveMap() {
  const map = getActiveMap();
  state.mapOverridePoints = map ? await fetchMapOverridePoints(map.id).catch(() => null) : null;
  // 범례 패널의 개수 표시는 이 fetch가 끝나기 전에 먼저 한 번 그려지므로(직전 지도의
  // 값으로 그려짐), 데이터를 받아온 뒤 여기서 다시 그려서 지도와 항상 같은 데이터를
  // 보여주게 맞춘다.
  renderMapLegendPanel();
  renderMapViewport();
}

function renderMapSelectRow() {
  const row = document.getElementById("map-select-row");
  row.innerHTML = MAPS.map((m) => `
    <button class="map-select-btn ${m.id === state.activeMapId ? "active" : ""}" type="button" data-map-id="${m.id}" ${state.mapEditMode ? "disabled" : ""}>${m.name}</button>
  `).join("");
  row.querySelectorAll(".map-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.mapEditMode) return;
      state.activeMapId = btn.dataset.mapId;
      resetMapView();
      state.mapMeasurePoints = []; // 다른 지도로 넘어가면 이전 지도 좌표는 의미 없으므로 초기화
      mapMeasureHoverPos = null;
      renderMapMeasureLayer();
      renderMapSelectRow();
      renderMapLegendPanel();
      loadMapOverrideForActiveMap();
    });
  });
}

// 왼쪽 접이식 범례(필터) 패널 — 레이어별 아이콘/이름/마커 개수/온오프 스위치.
// 편집 모드일 때는 각 항목을 눌러 "지금부터 찍을 범례"로 고를 수 있고, 맨 아래에
// 새 범례를 추가하는 작은 입력폼이 붙는다.
function renderMapLegendPanel() {
  const panel = document.getElementById("map-legend-panel");
  panel.classList.toggle("collapsed", state.mapLegendCollapsed);

  const map = getActiveMap();
  const points = currentDisplayPoints(map);
  const layers = effectiveMapLayers();
  const wrap = document.getElementById("map-layer-toggles");
  wrap.innerHTML = layers.map((l) => {
    const count = (points[l.key] || []).length;
    const checked = state.activeMapLayers.has(l.key) ? "checked" : "";
    const swatch = l.icon
      ? `<span class="map-layer-swatch map-layer-swatch-icon"><img src="${l.icon}" alt=""></span>`
      : `<i class="map-layer-swatch" style="background:${l.color}"></i>`;
    const selected = state.mapEditMode && state.mapEditSelectedLayerKey === l.key ? "map-layer-row-selected" : "";
    return `
      <div class="map-layer-row ${selected}" data-layer-key="${l.key}">
        ${swatch}
        <span class="map-layer-label">${l.label}</span>
        <span class="map-layer-count">${count}</span>
        <label class="map-layer-switch" data-layer-key="${l.key}">
          <input type="checkbox" ${checked}>
          <span class="switch-track"><span class="switch-thumb"></span></span>
        </label>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll(".map-layer-switch input").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.closest(".map-layer-switch").dataset.layerKey;
      if (input.checked) state.activeMapLayers.add(key);
      else state.activeMapLayers.delete(key);
      renderMapViewport();
    });
  });

  if (state.mapEditMode) {
    wrap.querySelectorAll(".map-layer-row").forEach((row) => {
      row.addEventListener("click", () => {
        const key = row.dataset.layerKey;
        state.mapEditSelectedLayerKey = key;
        state.activeMapLayers.add(key); // 안 보이는 레이어를 고르면 헷갈리니 자동으로 켜준다
        renderMapLegendPanel();
        renderMapViewport();
      });
    });
    renderMapAddLayerForm();
  }
}

// 편집 모드에서 범례 패널 맨 아래에 붙는 "새 범례 추가" 폼 — 추가해도 바로
// 게시되진 않고, "확정" 눌러야 mapCustomLayers에 반영된다.
function renderMapAddLayerForm() {
  const wrap = document.getElementById("map-layer-toggles");
  wrap.insertAdjacentHTML("beforeend", `
    <div id="map-add-layer-row">
      <input type="text" id="map-add-layer-label" placeholder="새 범례 이름" maxlength="20">
      <input type="color" id="map-add-layer-color" value="#c25b4d">
      <button id="map-add-layer-btn" type="button">추가</button>
    </div>
  `);
  document.getElementById("map-add-layer-btn").addEventListener("click", () => {
    const labelInput = document.getElementById("map-add-layer-label");
    const label = labelInput.value.trim();
    if (!label) return;
    const color = document.getElementById("map-add-layer-color").value;
    const key = `custom_${Date.now().toString(36)}`;
    state.mapCustomLayers.push({ key, label, color });
    labelInput.value = "";
    renderMapLegendPanel();
  });
}

function renderMapViewport() {
  const map = getActiveMap();
  const img = document.getElementById("map-base-img");
  const placeholder = document.getElementById("map-img-placeholder");
  const markersLayer = document.getElementById("map-markers-layer");
  document.getElementById("map-viewport").classList.toggle("map-edit-active", !!(state.mapEditMode && state.mapEditSelectedLayerKey));
  if (!map) {
    img.removeAttribute("src");
    markersLayer.innerHTML = "";
    return;
  }
  img.style.display = "";
  placeholder.hidden = true;
  img.src = map.image;
  img.alt = map.name;

  const points = currentDisplayPoints(map);
  const markersHTML = effectiveMapLayers()
    .filter((l) => state.activeMapLayers.has(l.key))
    .flatMap((l) => (points[l.key] || []).map((pt, idx) => ({ ...pt, layer: l, idx })))
    .map((pt) => `
      <div class="map-marker ${pt.layer.icon ? "map-marker-icon" : ""}" title="${pt.label ?? pt.layer.label}"
        style="left:${pt.x}%; top:${pt.y}%; ${pt.layer.icon ? "" : `background:${pt.layer.color};`}"
        data-layer-key="${pt.layer.key}" data-idx="${pt.idx}"
        >${pt.layer.icon ? `<img src="${pt.layer.icon}" class="map-marker-icon-img" alt="">` : ""}${state.mapEditMode ? `<span class="map-marker-delete" title="이 지점 삭제">×</span>` : ""}</div>
    `).join("");
  markersLayer.innerHTML = markersHTML;
}

// -------------------------------------------------------------------------
// 맵 확대/축소 + 드래그 이동
// -------------------------------------------------------------------------
const MAP_ZOOM_MIN = 1;
const MAP_ZOOM_MAX = 4;

function applyMapTransform() {
  const canvas = document.getElementById("map-viewport-canvas");
  canvas.style.transform = `translate(${state.mapPanX}px, ${state.mapPanY}px) scale(${state.mapZoom})`;
  // 마커는 지도가 확대돼도 화면상 크기가 그대로 유지되도록 반대 배율을 CSS 변수로 넘김(마커 CSS에서 사용)
  canvas.style.setProperty("--map-zoom", state.mapZoom);
}

// 확대된 캔버스가 뷰포트 바깥으로 빈 공간을 보이지 않게 팬 값을 범위 안으로 고정
function clampMapPan() {
  const viewport = document.getElementById("map-viewport");
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  const minX = -(state.mapZoom - 1) * w;
  const minY = -(state.mapZoom - 1) * h;
  state.mapPanX = Math.min(0, Math.max(minX, state.mapPanX));
  state.mapPanY = Math.min(0, Math.max(minY, state.mapPanY));
}

function setMapZoom(newZoom) {
  state.mapZoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, newZoom));
  clampMapPan();
  applyMapTransform();
}

// 마우스 커서 위치를 기준으로 확대/축소 — 커서가 가리키던 지도 지점이 화면에서 그대로 유지되도록
// 줌 배율이 바뀐 만큼 팬 값도 같이 보정한다.
function setMapZoomAtPoint(newZoom, clientX, clientY) {
  const viewport = document.getElementById("map-viewport");
  const rect = viewport.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  const clamped = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, newZoom));
  const ratio = clamped / state.mapZoom;
  state.mapPanX = mx - (mx - state.mapPanX) * ratio;
  state.mapPanY = my - (my - state.mapPanY) * ratio;
  state.mapZoom = clamped;
  clampMapPan();
  applyMapTransform();
}

function resetMapView() {
  state.mapZoom = 1;
  state.mapPanX = 0;
  state.mapPanY = 0;
  applyMapTransform();
}

function setupMapPanZoom() {
  const viewport = document.getElementById("map-viewport");
  const canvas = document.getElementById("map-viewport-canvas");

  // 휠 확대/축소는 살짝만 움직여도 자연스럽게 이어지도록 작은 단위로, 트랜지션(부드러운 애니메이션)과 함께
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    setMapZoomAtPoint(state.mapZoom + (e.deltaY < 0 ? 0.15 : -0.15), e.clientX, e.clientY);
  }, { passive: false });

  let dragging = false;
  let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
  let moved = false;

  viewport.addEventListener("mousedown", (e) => {
    moved = false;
    if (state.mapZoom <= 1) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = state.mapPanX;
    startPanY = state.mapPanY;
    viewport.classList.add("panning");
    canvas.classList.add("no-transition"); // 드래그 중엔 트랜지션 없이 손 움직임에 바로 반응
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    state.mapPanX = startPanX + dx;
    state.mapPanY = startPanY + dy;
    clampMapPan();
    applyMapTransform();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("panning");
    canvas.classList.remove("no-transition");
  });
}

// 편집 모드에서의 지도 조작 — 빈 자리 클릭(선택된 범례 필요)이면 지점 추가,
// 기존 지점을 눌러서 끌면 위치 이동, 우클릭하면 그 지점 삭제. 팬/줌 로직과는
// 독립적으로 자체적으로 클릭-드래그를 판별한다(줌 1배 초과 상태에서 패닝과
// 겹치는 경우까지는 다루지 않음 — 편집은 보통 기본 배율에서 이뤄짐).
function setupMapEditInteractions() {
  const viewport = document.getElementById("map-viewport");
  const markersLayer = document.getElementById("map-markers-layer");
  const img = document.getElementById("map-base-img");

  function clientToPercent(clientX, clientY) {
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(100, Math.max(0, Math.round(x * 10) / 10)),
      y: Math.min(100, Math.max(0, Math.round(y * 10) / 10)),
    };
  }

  let mode = null; // "drag-point" | "maybe-add"
  let draggingPoint = null;
  let downX = 0, downY = 0;

  viewport.addEventListener("mousedown", (e) => {
    if (!state.mapEditMode) return;
    if (e.target.closest(".map-marker-delete")) return; // 삭제 배지 클릭은 드래그 시작으로 안 침
    downX = e.clientX;
    downY = e.clientY;
    const markerEl = e.target.closest(".map-marker");
    if (markerEl) {
      mode = "drag-point";
      draggingPoint = { layerKey: markerEl.dataset.layerKey, idx: Number(markerEl.dataset.idx) };
    } else if (state.mapEditSelectedLayerKey) {
      mode = "maybe-add";
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (mode !== "drag-point" || !draggingPoint || !state.mapEditPoints) return;
    const { x, y } = clientToPercent(e.clientX, e.clientY);
    const arr = state.mapEditPoints[draggingPoint.layerKey];
    if (arr && arr[draggingPoint.idx]) {
      arr[draggingPoint.idx].x = x;
      arr[draggingPoint.idx].y = y;
      renderMapViewport();
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (mode === "maybe-add") {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist < 4 && state.mapEditPoints && state.mapEditSelectedLayerKey) {
        const { x, y } = clientToPercent(e.clientX, e.clientY);
        const key = state.mapEditSelectedLayerKey;
        if (!state.mapEditPoints[key]) state.mapEditPoints[key] = [];
        state.mapEditPoints[key].push({ x, y });
        renderMapViewport();
        renderMapLegendPanel();
      }
    }
    mode = null;
    draggingPoint = null;
  });

  function deleteMarker(markerEl) {
    if (!confirm("이 지점을 삭제할까요?")) return;
    const layerKey = markerEl.dataset.layerKey;
    const idx = Number(markerEl.dataset.idx);
    state.mapEditPoints[layerKey].splice(idx, 1);
    renderMapViewport();
    renderMapLegendPanel();
  }

  // 지점마다 붙는 × 배지를 눌러 삭제 — 우클릭(contextmenu)으로도 똑같이 가능하지만
  // 잘 안 알려지므로 항상 보이는 버튼도 같이 둔다.
  markersLayer.addEventListener("click", (e) => {
    if (!state.mapEditMode) return;
    const delBtn = e.target.closest(".map-marker-delete");
    if (!delBtn) return;
    e.stopPropagation();
    deleteMarker(delBtn.closest(".map-marker"));
  });

  markersLayer.addEventListener("contextmenu", (e) => {
    if (!state.mapEditMode) return;
    const markerEl = e.target.closest(".map-marker");
    if (!markerEl) return;
    e.preventDefault();
    deleteMarker(markerEl);
  });
}

// 지점 편집 켜기/끄기 + 확정(게시)/취소 버튼
function setupMapEditControls() {
  const toggleBtn = document.getElementById("map-edit-toggle-btn");
  const actionsRow = document.getElementById("map-edit-actions");
  const publishBtn = document.getElementById("map-edit-publish-btn");
  const cancelBtn = document.getElementById("map-edit-cancel-btn");

  function exitEditMode() {
    state.mapEditMode = false;
    state.mapEditPoints = null;
    state.mapEditSelectedLayerKey = null;
    toggleBtn.textContent = "지점 편집";
    actionsRow.hidden = true;
    renderMapSelectRow();
    renderMapLegendPanel();
    renderMapViewport();
  }

  toggleBtn.addEventListener("click", () => {
    if (state.mapEditMode) {
      if (!confirm("편집을 취소할까요? 게시하지 않은 변경사항은 사라집니다.")) return;
      exitEditMode();
      return;
    }
    const map = getActiveMap();
    state.mapEditPoints = JSON.parse(JSON.stringify(getEffectivePoints(map) || {}));
    state.mapEditMode = true;
    toggleBtn.textContent = "편집 종료";
    actionsRow.hidden = false;
    renderMapSelectRow();
    renderMapLegendPanel();
    renderMapViewport();
  });

  cancelBtn.addEventListener("click", () => {
    if (!confirm("편집을 취소할까요? 게시하지 않은 변경사항은 사라집니다.")) return;
    exitEditMode();
  });

  publishBtn.addEventListener("click", async () => {
    if (!state.mapOperatorIdToken) {
      showToast("운영자 인증이 필요합니다.");
      return;
    }
    const map = getActiveMap();
    if (!map) return;
    publishBtn.disabled = true;
    try {
      await publishMapOverridePoints(map.id, state.mapEditPoints, state.mapOperatorIdToken);
      await publishMapCustomLayers(state.mapCustomLayers, state.mapOperatorIdToken);
      state.mapOverridePoints = state.mapEditPoints;
      exitEditMode();
      showToast("지도가 게시됐습니다.", "info");
    } catch (err) {
      showToast(err.message || "게시에 실패했습니다.");
    } finally {
      publishBtn.disabled = false;
    }
  });
}

// -------------------------------------------------------------------------
// 맵 거리 측정 — 지도를 1km x 1km 정사각형(대각선 1414m)으로 가정하고, 클릭한 지점들
// 사이 거리(m)를 보여준다. 운영자 전용이 아니라 모든 이용자가 쓸 수 있고, 지점 편집
// 모드와는 독립적으로 동작한다. percent 좌표(0~100) 1%가 실제 10m에 해당한다.
function mapMeasureDistanceMeters(p1, p2) {
  const dx = (p2.x - p1.x) * 10;
  const dy = (p2.y - p1.y) * 10;
  return Math.round(Math.hypot(dx, dy));
}

// 마지막으로 찍은 지점과 지금 마우스 커서 위치를 잇는 미리보기 선/점 — 다음 지점을
// 찍기 전까지 커서를 따라다니며 실시간으로 거리를 보여준다. 지점이 하나도 없으면
// 이을 대상이 없으므로 표시하지 않는다.
let mapMeasureHoverPos = null;

function renderMapMeasureLayer() {
  const svg = document.getElementById("map-measure-layer");
  if (!svg) return;
  const points = state.mapMeasurePoints;
  let html = "";
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    html += `<line class="map-measure-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>`;
    html += `<text class="map-measure-label" x="${midX}" y="${midY}">${mapMeasureDistanceMeters(a, b)}m</text>`;
  }
  if (points.length > 0 && mapMeasureHoverPos) {
    const a = points[points.length - 1];
    const b = mapMeasureHoverPos;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    html += `<line class="map-measure-line map-measure-line-preview" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>`;
    html += `<text class="map-measure-label map-measure-label-preview" x="${midX}" y="${midY}">${mapMeasureDistanceMeters(a, b)}m</text>`;
    html += `<circle class="map-measure-point map-measure-point-preview" cx="${b.x}" cy="${b.y}" r="0.9"></circle>`;
  }
  points.forEach((p) => {
    html += `<circle class="map-measure-point" cx="${p.x}" cy="${p.y}" r="0.9"></circle>`;
  });
  svg.innerHTML = html;
}

// 기본 지도 기능(항상 켜져 있음, 별도 모드 전환 없음) — 지도를 그냥 클릭(드래그 아닌
// 순수 클릭)하면 지점을 추가, 우클릭하면 가장 최근 지점부터 하나씩 취소한다. 클릭한
// 채로 끌면(드래그) 기존 팬 기능이 그대로 동작하도록, mousedown~mouseup 사이 이동
// 거리가 4px을 넘으면 클릭으로 치지 않는다. 운영자의 "지점 편집" 모드 중엔 클릭이
// 지점 추가/이동 용도로 쓰이므로 거리 측정은 그 동안 비활성화한다.
function setupMapMeasureInteractions() {
  const viewport = document.getElementById("map-viewport");
  const img = document.getElementById("map-base-img");

  function clientToPercent(clientX, clientY) {
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(100, Math.max(0, Math.round(x * 10) / 10)),
      y: Math.min(100, Math.max(0, Math.round(y * 10) / 10)),
    };
  }

  let downX = 0, downY = 0, wasClick = false;

  viewport.addEventListener("mousedown", (e) => {
    if (state.mapEditMode || e.button !== 0) return; // 우클릭(취소)은 contextmenu에서 따로 처리
    downX = e.clientX;
    downY = e.clientY;
    wasClick = true;
  });

  window.addEventListener("mousemove", (e) => {
    if (!wasClick) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) wasClick = false;
  });

  window.addEventListener("mouseup", (e) => {
    if (state.mapEditMode || !wasClick) { wasClick = false; return; }
    wasClick = false;
    const { x, y } = clientToPercent(e.clientX, e.clientY);
    state.mapMeasurePoints.push({ x, y });
    renderMapMeasureLayer();
  });

  viewport.addEventListener("contextmenu", (e) => {
    if (state.mapEditMode || state.mapMeasurePoints.length === 0) return;
    e.preventDefault();
    state.mapMeasurePoints.pop();
    renderMapMeasureLayer();
  });

  // 마지막 지점 ~ 커서 위치를 잇는 미리보기 선을 실시간으로 갱신
  viewport.addEventListener("mousemove", (e) => {
    if (state.mapEditMode || state.mapMeasurePoints.length === 0) return;
    mapMeasureHoverPos = clientToPercent(e.clientX, e.clientY);
    renderMapMeasureLayer();
  });

  viewport.addEventListener("mouseleave", () => {
    if (!mapMeasureHoverPos) return;
    mapMeasureHoverPos = null;
    renderMapMeasureLayer();
  });
}

// -------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);
