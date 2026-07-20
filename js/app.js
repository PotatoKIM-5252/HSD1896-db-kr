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

  charts: { detail: null, compare: null, bodypart: null, compareStats: null },
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
    const key = loadoutKey(item.category, slotDef.slotKey);
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
      state.loadout[key].push(item.id);
      return { ok: true, slotLabel: slotDef.label };
    } else {
      const arr = state.loadout[key];
      const emptyIdx = arr.findIndex((v) => v === null);
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
function init() {
  initLoadoutState();

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderItemGrid();
  });

  document.getElementById("picker-close-btn").addEventListener("click", closePicker);
  document.getElementById("picker-search-input").addEventListener("input", (e) => {
    renderPickerList(e.target.value.trim().toLowerCase());
  });

  document.getElementById("clear-loadout-btn").addEventListener("click", clearLoadout);
  document.getElementById("goto-analysis-btn").addEventListener("click", () => switchTab("analysis"));
  document.getElementById("clear-compare-btn").addEventListener("click", () => {
    state.compareEntries = [];
    renderAnalysis();
  });

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
}

function initLoadoutState() {
  state.loadout = {};
  Object.entries(CATEGORIES).forEach(([catKey, catDef]) => {
    catDef.loadoutSlots.forEach((slotDef) => {
      const key = loadoutKey(catKey, slotDef.slotKey);
      state.loadout[key] = slotDef.max === null ? [] : new Array(slotDef.max).fill(null);
    });
  });
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
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.toolFilters[filterKey].has(opt.value)) chip.classList.add("active");

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
        const set = state.toolFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
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
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.consumableFilters[filterKey].has(opt.value)) chip.classList.add("active");

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
        const set = state.consumableFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
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
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";
      if (state.traitFilters[filterKey].has(opt.value)) chip.classList.add("active");

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
        const set = state.traitFilters[filterKey];
        if (set.has(opt.value)) set.delete(opt.value);
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
    if (query && !item.name.toLowerCase().includes(query)) return false;
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
    ? `<img src="${item.image}" alt="${item.name}" class="item-card-img" onerror="this.style.display='none'">`
    : `<div class="item-card-icon">${cat ? cat.icon : ""}</div>`;

  // 무기 카드: 이름 + 이미지 + 칸수 + 가격 + (자세히 보기 버튼)
  if (item.category === "weapon") {
    card.innerHTML = `
      ${imgHTML}
      <div class="item-card-name">${item.name}</div>
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
      <div class="item-card-name">${item.name}</div>
      <div class="item-card-meta">
        <div class="item-card-trait-tags">${tagIcons.map((t) => `<img src="${t.image}" alt="${t.label}" title="${t.label}" class="trait-tag-icon">`).join("")}</div>
        ${item.traitTags && item.traitTags.includes("scarce")
          ? `<span class="item-card-price"><img src="images/ui/scarce.png" alt="Scarce" class="dollar-icon" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`
          : item.price != null ? `<span class="item-card-price"><img src="images/ui/upgrade_points.webp" alt="업그레이드 포인트" class="dollar-icon">${item.price}</span>` : ""}
      </div>`;
  } else {
    card.innerHTML = `
      ${imgHTML}
      <div class="item-card-name">${item.name}</div>
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
    <div class="hover-preview-title">${item.name}</div>
    <div class="hover-preview-stats">
      <div><span>피해</span><b>${s.damage ?? "-"}</b></div>
      <div><span>드롭 사거리</span><b>${s.dropRange ?? "-"}m</b></div>
      <div><span>탄속</span><b>${s.muzzleVelocity ?? "-"}</b></div>
      <div><span>연사 속도</span><b>${s.rateOfFire ?? "-"}</b></div>
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
  const list = [{ ...parentItem, _isParent: true, _displayName: parentItem.name + " (기본)" }];

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
      _displayName: v.name,
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

  const partInfo = {};
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([key, def]) => {
    if (def.multiplier == null) partInfo[key] = { dmg: null };
    else partInfo[key] = { dmg: Math.round(hiddenWeaponDamage * def.multiplier * distMult) };
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
    <h2>${parentItem.name} <span class="bodypart-ammo">${ammo?.label ?? ""}</span></h2>
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
          ? `<img src="${currentItem.image}" alt="${currentItem.name}" class="bp-weapon-img" onerror="this.style.display='none'">`
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
          ${statRowSimple("피해", stats.damage, "damage")}
          ${statRowSimple("낙하 범위", stats.dropRange, "dropRange")}
          ${statRowSimple("발사속도", stats.rateOfFire, "rateOfFire")}
          ${statRowSimple("사이클 시간", stats.cycleTime, "cycleTime")}
          ${statRowSimple("분산도", stats.spread, "spread")}
          ${statRowSimple("흔들림", stats.sway, "sway")}
          ${statRowSimple("수직 반동", stats.verticalRecoil, "verticalRecoil")}
          ${statRowSimple("재장전 속도", stats.reloadSpeed, "reloadSpeed")}
          ${statRowSimple("총구속도", stats.muzzleVelocity, "muzzleVelocity")}
          ${statRowSimple("근접 피해", stats.meleeLight, "meleeLight")}
          ${statRowSimple("중형 근접 피해", stats.meleeHeavy, "meleeHeavy")}
          ${statRowSimple("기력 비용(강공격)", stats.staminaConsumption, "staminaConsumption")}
        </div>
      </div>

      <!-- 우측: 그래프 → 특수탄 탭 → 특수탄 효과 -->
      <div class="bodypart-graph-col">
        ${hasAnyGraphData ? `
        <h4 class="bp-chart-heading">거리별 데미지 <span class="bodypart-hint">— 그래프를 클릭하여 거리 선택</span></h4>
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
      </div>
    </div>
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

  // 거리별 데미지 그래프 그리기
  drawBodyPartChart(currentItem, activeAmmoId, refRange, parentItem);
}

// 근접무기 전용 "자세히 보기" — 마네킹/그래프/탄약탭 없이 근접 스탯만 표시
function renderMeleeBodyPartView(item, overlay, content) {
  const stats = item.stats || {};
  const inCompare = state.compareEntries.some((e) => e.weaponId === item.id && e.ammoId == null);

  content.innerHTML = `
    <button id="bodypart-close-btn" type="button">✕</button>
    <h2>${item.name}</h2>
    ${item.description ? `<p class="variant-desc">${item.description}</p>` : ""}

    <div class="bodypart-layout bodypart-layout--no-figure">
      <div class="bodypart-weapon-col">
        ${item.image
          ? `<img src="${item.image}" alt="${item.name}" class="bp-weapon-img" onerror="this.style.display='none'">`
          : `<div class="bp-weapon-img-placeholder">무기 이미지 없음</div>`}

        <!-- 근접무기는 탄약이 없어서 칸수/가격만 표시 -->
        <div class="ammo-status-row">
          <img src="images/ui/slot_${item.slotSize || 1}.png" alt="${item.slotSize}칸" class="ammo-status-slots">
          ${item.scarce
            ? `<img src="images/ui/scarce.png" alt="Scarce" class="ammo-status-dollar" title="Scarce (상점 구매 불가, 월드에서만 획득)">`
            : item.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
        </div>

        <div class="detail-stats bp-stats-inline">
          ${statRowSimple("근접 피해", stats.meleeLight, "meleeLight")}
          ${statRowSimple("강공격 피해", stats.meleeHeavy, "meleeHeavy")}
          ${statRowSimple("기력 비용(강공격)", stats.staminaConsumption, "staminaConsumption")}
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
  return ammo?.ohkRange ?? null;
}

// 샷건류: 거리별 데미지 그래프 대신 초록(보장)→노랑(불안정)→빨강(불가) 막대로 표시
function renderOhkRangeBar(ohkRange) {
  const { guaranteed, unstableEnd, noneFrom } = ohkRange;
  const maxDisplay = Math.max(noneFrom + 3, 15);
  const gPct = (guaranteed / maxDisplay) * 100;
  const nPct = (noneFrom / maxDisplay) * 100;
  const maxLabel = Math.ceil(maxDisplay);

  return `
    <div class="ohk-range-box">
      <h4 class="ohk-range-title">가슴 정조준 기준 한방컷(OHK) 거리</h4>
      <div class="ohk-range-bar" style="background: linear-gradient(to right,
        var(--success) 0%, var(--success) ${gPct}%,
        #d4c25e ${gPct}%,
        var(--danger-strong) ${nPct}%,
        var(--danger-strong) 100%);"></div>
      <div class="ohk-range-ticks">
        <span style="left:0%">0m</span>
        <span style="left:${gPct}%">${guaranteed}m</span>
        <span style="left:${nPct}%">${noneFrom}m</span>
        <span style="left:100%">${maxLabel}m</span>
      </div>
      <p class="ohk-range-legend">
        <span><i class="ohk-swatch" style="background:var(--success)"></i>${guaranteed}m까지 보장</span>
        <span><i class="ohk-swatch" style="background:#d4c25e"></i>${unstableEnd}m까지 불안정</span>
        <span><i class="ohk-swatch" style="background:var(--danger-strong)"></i>${noneFrom}m부터 불가</span>
      </p>
      <p class="status-effect-note">※ 실측 기반 참고용 수치이며, 펠릿 분산 특성상 오차가 있을 수 있습니다.</p>
    </div>
  `;
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
  const ohkRange = getOhkRangeForCurrentAmmo(currentItem, ammoId);
  if (ohkRange) {
    canvas.outerHTML = renderOhkRangeBar(ohkRange);
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

  const opts = chartOptions("거리 (m)", "데미지", { showOHK: canOHK, refRange, xMax: 100, yStepSize: 25 });
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
      killTooltip.textContent = `${Math.round(hit.range)}m 이내 — 최소데미지(${weakestPartLabel}) 기준 ${hit.n} BTK`;
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

  const partInfo = {};
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([key, def]) => {
    if (def.multiplier == null) partInfo[key] = { dmg: null };
    else partInfo[key] = { dmg: Math.round(hiddenWeaponDamage * def.multiplier * distMult) };
  });

  // 마네킹만 다시 그리기
  const figureEl = document.querySelector(".bodypart-figure");
  if (figureEl) figureEl.innerHTML = renderBodyFigureSVG(partInfo, refRange);
}

// 단순 스탯 행 (자세히 보기용 — 화살표 표기 없음). key를 주면 마우스오버 시 설명 툴팁이 뜸.
function statRowSimple(label, value, key) {
  if (value == null) return "";
  return `<div class="stat-row" ${key ? `data-stat-key="${key}"` : ""}><span>${label}</span><b>${value}</b></div>`;
}

// 무기 스탯 설명 (Hunt: Showdown 공식 위키 원문을 한글로 번역)
const STAT_DESCRIPTIONS = {
  damage: "가슴(상체) 10m 거리에서 명중했을 때의 데미지 값입니다.\n샷건은 10m 근접사격 시 평균 데미지 기준입니다.",
  dropRange: "탄환이 조준점보다 대략 머리 높이(20cm)만큼 떨어지는 거리(m)입니다.\n조준(ADS) 시 HUD에 표시됩니다.\n탄종, 탄속, 총열 길이, 무기 작동 방식에 따라 낙하율이 달라집니다.",
  rateOfFire: "분당 발사 가능 횟수이며, 재장전 시간도 포함된 값입니다.",
  cycleTime: "다음 사격이 가능해지기까지 걸리는 시간(초)입니다.\n단발 무기는 재장전 시간도 포함됩니다.\n듀얼 웰드의 경우, 먼저 발사한 무기가 다시 준비되는 데 걸리는 시간입니다.",
  spread: "허리 조준(히프파이어) 상태에서 조준선이 벌어지는 정도를 상대적으로 나타낸 값입니다.\n샷건은 상대적으로 더 넓은 분산도를 가집니다.",
  sway: "조준(ADS) 상태에서 무기가 흔들리는 정도를 상대적으로 나타낸 값입니다.",
  verticalRecoil: "사격 후 수직 반동의 세기(도, degree)입니다.",
  reloadSpeed: "탄창이 빈 상태에서 완전히 재장전하는 데 걸리는 시간(초)입니다.\n클립 재장전이나, 마지막 탄을 넣기 전 무기를 조작해야 하는 등의 특수 동작 시간도 포함됩니다.",
  muzzleVelocity: "탄환이 발사될 때의 속도(m/s)입니다.\n탄환은 포물선을 그리며 날아갑니다.",
  meleeLight: "라이트 근접 공격이 상체에 명중했을 때의 데미지 값입니다.",
  meleeHeavy: "헤비 근접 공격이 상체에 명중했을 때의 데미지 값입니다.",
  staminaConsumption: "라이트 또는 헤비 근접 공격 시 소모되는 기력(100 기준)입니다.",
  // 도구(Tool) 전용 스탯 — huntshowdown.wiki.gg/wiki/Tools "Tool Statistics" 섹션 기준
  damagePerTick: "효과가 지속되는 동안 틱마다 들어가는 데미지입니다.",
  effectRadius: "효과가 적용되는 반경(m)입니다.",
  effectDuration: "효과가 지속되는 시간(초)입니다.",
  fuseTimer: "기폭(폭발)까지 걸리는 시간(초)입니다.",
  throwRange: "던질 수 있는 최대 거리(m)입니다.",
  staminaConsumptionHeavy: "헤비 근접 공격 시 소모되는 기력(100 기준)입니다.",
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
    <h2>${item.name}</h2>

    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="detail-img" onerror="this.style.display='none'">` : ""}

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

    <h4>거리별 데미지</h4>
    <div class="detail-chart-wrap"><canvas id="detail-chart"></canvas></div>

    <div class="detail-action-row">
      <button id="detail-add-compare-btn" type="button" class="compare-btn ${inCompare ? "added" : ""}">
        ${inCompare ? "✓ 비교 목록에 추가됨 (클릭하여 제거)" : "+ 비교 목록에 추가"}
      </button>
      <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
    </div>
  `;
}

// 근접무기 전용 간략히 보기 — 탄약/그래프 없이 근접 스탯만 표시
function renderMeleeDetailHTML(item) {
  const stats = item.stats || {};
  const inCompare = state.compareEntries.some((e) => e.weaponId === item.id && e.ammoId == null);
  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${item.name}</h2>

    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="detail-img" onerror="this.style.display='none'">` : ""}

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
      ${statRowSimple("근접 피해", stats.meleeLight, "meleeLight")}
      ${statRowSimple("강공격 피해", stats.meleeHeavy, "meleeHeavy")}
      ${statRowSimple("기력 비용(강공격)", stats.staminaConsumption, "staminaConsumption")}
    </div>

    <div class="detail-action-row">
      <button id="detail-add-compare-btn" type="button" class="compare-btn ${inCompare ? "added" : ""}">
        ${inCompare ? "✓ 비교 목록에 추가됨 (클릭하여 제거)" : "+ 비교 목록에 추가"}
      </button>
      <button id="detail-add-loadout-btn" type="button" class="compare-btn">+ 로드아웃에 추가</button>
    </div>
  `;
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
    <h2>${item.name}</h2>

    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="detail-img detail-img--tool" onerror="this.style.display='none'">` : ""}

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
    <h2>${item.name}</h2>

    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="detail-img detail-img--tool" onerror="this.style.display='none'">` : ""}

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
    <h2>${item.name}</h2>

    ${(item.detailImage || item.image) ? `<img src="${item.detailImage || item.image}" alt="${item.name}" class="detail-img detail-img--trait" onerror="this.style.display='none'">` : ""}

    <div class="ammo-status-row">
      ${item.price != null ? `<img src="images/ui/upgrade_points.webp" alt="업그레이드 포인트" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
    </div>

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
    <h2>${item.name}</h2>
    <p class="detail-category">${cat?.label ?? item.category}</p>
    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="detail-img" onerror="this.style.display='none'">` : ""}
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
    label: `${item.name} · ${ammo.label}`,
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
  const ohkRange = getOhkRangeForCurrentAmmo(item, ammoId);
  if (ohkRange) {
    canvas.outerHTML = renderOhkRangeBar(ohkRange);
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
    options: chartOptions("거리 (m)", "데미지", { showOHK: canOHK, refRange: currentRef }),
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
      ${item.image ? `<img src="${item.image}" alt="" class="picker-item-thumb" onerror="this.style.display='none'">` : `<span class="picker-item-thumb-placeholder"></span>`}
      <span class="picker-item-name">${item.name}</span>
      ${item.scarce
        ? `<span class="picker-item-price"><img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`
        : item.price != null ? `<span class="picker-item-price"><img src="images/ui/hunt_dollars.png" alt="$">${item.price}</span>` : ""}
    `;
    row.addEventListener("click", () => {
      // 무기는 클릭하면 바로 확정하지 않고 탄약 선택 단계로 이동
      if (item.category === "weapon" && item.ammoTypes && item.ammoTypes.length > 0) {
        renderPickerAmmoStep(item);
      } else if (state.picker.onSelect) {
        state.picker.onSelect(item, null);
      }
    });
    list.appendChild(row);
  });
}

// 무기 선택 후 탄약을 고르는 단계 (가격도 함께 표시)
function renderPickerAmmoStep(weaponItem) {
  document.getElementById("picker-title").textContent = `${weaponItem.name} — 탄약 선택`;
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

  weaponItem.ammoTypes.forEach((ammoId) => {
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
    row.addEventListener("click", () => {
      if (state.picker.onSelect) state.picker.onSelect(weaponItem, ammoId);
    });
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
    });
  });
  ["tool", "consumable"].forEach((catKey) => {
    CATEGORIES[catKey].loadoutSlots.forEach((slotDef) => {
      const key = loadoutKey(catKey, slotDef.slotKey);
      (state.loadout[key] || []).forEach((itemId) => {
        const item = ITEMS.find((i) => i.id === itemId);
        if (item && item.price != null && !item.scarce) total += item.price;
      });
    });
  });
  return total;
}

// 장비 칸 하나(빈 칸/채워진 칸 공용) — 이미지, 클릭(고르기), ✕(비우기)를 한번에 처리
function createEquipBox({ image, title, empty, small, wide, onClick, onClear }) {
  const box = document.createElement("div");
  box.className = "equip-box"
    + (empty ? " equip-box-empty" : "")
    + (small ? " equip-box-small" : "")
    + (wide ? " equip-box-wide" : "");
  if (title) box.title = title;
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    img.onerror = () => { img.style.display = "none"; };
    box.appendChild(img);
  }
  if (onClear) {
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "equip-box-clear";
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", (e) => { e.stopPropagation(); onClear(); });
    box.appendChild(clearBtn);
  }
  if (onClick) box.addEventListener("click", onClick);
  return box;
}

// 무기 슬롯 하나를 고르는 피커를 염 (대형/소형 슬롯 공용)
function openWeaponSlotPicker(key, index) {
  openPicker("weapon", (selectedItem, selectedAmmoId) => {
    const otherTotal = getTotalWeaponSlotSize(key, index);
    const newTotal = otherTotal + (selectedItem.slotSize || 0);
    if (newTotal > WEAPON_SLOT_LIMIT) {
      showToast(`무기 칸수 합이 ${WEAPON_SLOT_LIMIT}칸을 넘어서 장착할 수 없습니다. (다른 무기 ${otherTotal}칸 + 이 무기 ${selectedItem.slotSize}칸 = ${newTotal}칸)`);
      return;
    }
    state.loadout[key][index] = { item: selectedItem, ammoId: selectedAmmoId ?? null };
    renderLoadoutBoard();
    closePicker();
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

  let rowTotal = 0;
  let rowScarce = false;
  let rowHasItem = false;
  let rowSlotSize = 0;

  for (let i = 0; i < slotDef.max; i++) {
    const slotData = state.loadout[key][i];
    const item = slotData?.item || null;
    const ammo = slotData?.ammoId ? AMMO_TYPES[slotData.ammoId] : null;

    const rowEl = document.createElement("div");
    rowEl.className = "equip-row";
    const boxesWrap = document.createElement("div");
    boxesWrap.className = "equip-row-boxes";

    boxesWrap.appendChild(createEquipBox({
      image: item?.image,
      title: item?.name,
      empty: !item,
      wide: true,
      onClick: () => openWeaponSlotPicker(key, i),
      onClear: item ? () => { state.loadout[key][i] = null; renderLoadoutBoard(); } : null,
    }));

    if (item && ammo) {
      boxesWrap.appendChild(createEquipBox({ image: ammo.image, title: ammo.label, small: true }));
      // 이중 탄약 무기 — (1) 하부 총열 등 별도 총열 보유(르맷/헤이메이커/드릴링류)
      // (2) 단발/볼트액션이라 탄종 2개를 동시에 넣고 교체 가능(스팍스/베르티에류, dualAmmoSlot)
      if ((item.secondaryAmmoCategories && item.secondaryAmmoCategories.length > 0) || item.dualAmmoSlot) {
        boxesWrap.appendChild(createEquipBox({ image: ammo.image, title: ammo.label, small: true }));
      }
    }

    rowEl.appendChild(boxesWrap);

    const priceEl = document.createElement("span");
    priceEl.className = "equip-row-price";
    if (item) {
      rowHasItem = true;
      rowSlotSize += item.slotSize || 0;
      if (item.scarce) {
        rowScarce = true;
        priceEl.innerHTML = `<img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)">`;
      } else if (item.price != null) {
        rowTotal += item.price;
      }
      if (ammo) {
        if (ammo.scarce) rowScarce = true;
        else if (ammo.cost != null) rowTotal += ammo.cost;
      }
      priceEl.innerHTML = rowScarce
        ? `<img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)">${rowTotal > 0 ? rowTotal : ""}`
        : `<img src="images/ui/hunt_dollars.png" alt="$">${rowTotal}`;
    }
    rowEl.appendChild(priceEl);
    wrap.appendChild(rowEl);
  }

  wrap.appendChild(renderCapacityPips(rowSlotSize, WEAPON_SLOT_LIMIT));
  return wrap;
}

// "도구 & 소모품" 통합 칸을 고르는 피커를 염 (도구/소모품 서브탭 포함)
function openFieldPicker() {
  openPicker("tool_consumable", (selectedItem) => {
    const cat = selectedItem.category; // "tool" | "consumable"
    const key = loadoutKey(cat, cat);
    if (getSharedGroupUsage("field") >= 8) {
      showToast("필드 장비 칸이 가득 찼습니다 (8/8)");
      renderLoadoutBoard();
      closePicker();
      return;
    }
    state.loadout[key].push(selectedItem.id);
    renderLoadoutBoard();
    closePicker();
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

  const toolKey = loadoutKey("tool", "tool");
  const consumableKey = loadoutKey("consumable", "consumable");
  const toolIds = state.loadout[toolKey] || [];
  const consumableIds = state.loadout[consumableKey] || [];
  const merged = [
    ...toolIds.map((id, idx) => ({ key: toolKey, idx, id })),
    ...consumableIds.map((id, idx) => ({ key: consumableKey, idx, id })),
  ];

  const boxesWrap = document.createElement("div");
  boxesWrap.className = "equip-row-boxes equip-field-grid";
  let total = 0;
  let anyScarce = false;

  merged.forEach((entry) => {
    const item = ITEMS.find((i) => i.id === entry.id);
    if (!item) return;
    if (item.scarce) anyScarce = true;
    else if (item.price != null) total += item.price;
    boxesWrap.appendChild(createEquipBox({
      image: item.image,
      title: item.name,
      onClear: () => { state.loadout[entry.key].splice(entry.idx, 1); renderLoadoutBoard(); },
    }));
  });

  const capacity = 8;
  for (let i = merged.length; i < capacity; i++) {
    boxesWrap.appendChild(createEquipBox({ empty: true, onClick: () => openFieldPicker() }));
  }

  // 그리드(여러 줄로 감싸질 수 있음)와 가격을 같은 줄(equip-row)에 묶어서
  // 가격이 그리드 전체 높이 기준으로 상하 중앙에 오도록 함
  const rowEl = document.createElement("div");
  rowEl.className = "equip-row";
  rowEl.appendChild(boxesWrap);
  if (merged.length > 0) {
    const priceEl = document.createElement("span");
    priceEl.className = "equip-row-price";
    priceEl.innerHTML = anyScarce
      ? `<img src="images/ui/scarce.png" alt="Scarce" title="Scarce 아이템 포함">${total > 0 ? total : ""}`
      : `<img src="images/ui/hunt_dollars.png" alt="$">${total}`;
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
    <span class="equip-upgrade-cost"><span class="equip-upgrade-cost-icon"></span>${upgradeCostTotal}</span>
  `;
  section.appendChild(titleRow);

  const boxesWrap = document.createElement("div");
  boxesWrap.className = "equip-row-boxes equip-field-grid";

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
      closePicker();
    });
  }

  ids.forEach((id, idx) => {
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return;
    boxesWrap.appendChild(createEquipBox({
      image: item.image,
      title: item.name,
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
// 분석 탭 — 무기+탄약 조합 비교
// -------------------------------------------------------------------------
const COMPARE_COLORS = ["#ece6d3", "#5c8a63", "#c25b4d", "#7ba0c4", "#b48ec4", "#d4c25e", "#c4865c"];

function renderAnalysis() {
  const listEl = document.getElementById("compare-weapon-list");
  const chartWrap = document.getElementById("compare-chart-wrap");
  if (state.charts.compare) { state.charts.compare.destroy(); state.charts.compare = null; }

  if (state.compareEntries.length === 0) {
    listEl.innerHTML = `<p class="empty-msg">비교할 항목이 없습니다. DB 검색 → 무기 클릭 → 탄약 선택 → "비교 목록에 추가"를 눌러주세요.</p>`;
    chartWrap.innerHTML = "";
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
      <span>${item.name} · ${ammo.label}</span>
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

  chartWrap.innerHTML = `<canvas id="compare-chart"></canvas>`;
  const canvas = document.getElementById("compare-chart");
  const datasets = state.compareEntries.map((entry, idx) => {
    const item = findItemById(entry.weaponId);
    if (!item) return null;
    return buildFalloffDataset(item, entry.ammoId, COMPARE_COLORS[idx % COMPARE_COLORS.length]);
  }).filter(Boolean);

  // 비교 중 무기들 중 하나라도 데미지가 150 이상이면 OHK 라인 표시
  const anyOHK = datasets.some((ds) => ds.data.some((d) => d.y >= HUNTER_HP));

  state.charts.compare = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { datasets },
    options: chartOptions("거리 (m)", "데미지", { showOHK: anyOHK }),
    plugins: [btkLinesPlugin],
  });

  renderCompareStatsSection();
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
  { key: "meleeLight", label: "근접 피해" },
  { key: "meleeHeavy", label: "중형 근접 피해" },
  { key: "staminaConsumption", label: "기력 비용(강공격)" },
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
      <h4 class="compare-stats-single-title">${item.name} · ${ammo.label}</h4>
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
          <span class="stat-compare-name" title="${s.item.name} · ${s.ammo.label}">${s.item.name} · ${s.ammo.label}</span>
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
document.addEventListener("DOMContentLoaded", init);
