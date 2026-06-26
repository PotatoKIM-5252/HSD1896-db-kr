/* =========================================================================
   app.js
   -------------------------------------------------------------------------
   data.js 에 정의된 TAGS / CATEGORIES / ITEMS 를 가지고
   1) DB 검색 탭
   2) 로드아웃 빌더 탭
   3) 분석 탭
   의 동작을 처리합니다.
   ========================================================================= */

const state = {
  activeTab: "search",
  filterCategory: "all",
  searchQuery: "",
  activeTags: new Set(),

  loadout: {
    primary: null,      // weapon item
    secondary: null,    // weapon item
    tool: [null, null],
    consumable: [null, null, null, null],
    trait: [],          // array of item ids
  },

  // 모달이 어떤 슬롯을 위해 열렸는지 기록 (선택 콜백)
  modal: {
    onSelect: null,
    categoryFilter: null,
  },
};

// -------------------------------------------------------------------------
// 초기화
// -------------------------------------------------------------------------
function init() {
  // 상단 탭 네비게이션
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // 카테고리 필터 버튼
  document.querySelectorAll(".cat-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filterCategory = btn.dataset.category;
      document.querySelectorAll(".cat-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderItemGrid();
    });
  });

  // 검색창
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderItemGrid();
  });

  // 모달 닫기
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.getElementById("modal-search-input").addEventListener("input", (e) => {
    renderModalList(e.target.value.trim().toLowerCase());
  });

  // 로드아웃 빌더 버튼들
  document.getElementById("add-trait-btn").addEventListener("click", () => {
    openModal("trait", (item) => {
      if (!state.loadout.trait.includes(item.id)) {
        state.loadout.trait.push(item.id);
      }
      renderLoadoutBoard();
      closeModal();
    });
  });

  document.getElementById("clear-loadout-btn").addEventListener("click", clearLoadout);
  document.getElementById("goto-analysis-btn").addEventListener("click", () => switchTab("analysis"));

  renderTagFilters();
  renderItemGrid();
  renderLoadoutBoard();
  bindLoadoutSlotClicks();
}

// -------------------------------------------------------------------------
// 탭 전환
// -------------------------------------------------------------------------
function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `tab-${tabName}`;
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  if (tabName === "analysis") renderAnalysis();
}

// -------------------------------------------------------------------------
// DB 검색 탭
// -------------------------------------------------------------------------
function renderTagFilters() {
  const wrap = document.getElementById("tag-filters");
  wrap.innerHTML = "";
  Object.entries(TAGS).forEach(([key, def]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tag-chip";
    chip.dataset.tag = key;
    chip.title = def.desc;
    chip.textContent = def.label;
    chip.addEventListener("click", () => {
      if (state.activeTags.has(key)) {
        state.activeTags.delete(key);
        chip.classList.remove("active");
      } else {
        state.activeTags.add(key);
        chip.classList.add("active");
      }
      renderItemGrid();
    });
    wrap.appendChild(chip);
  });
}

function getFilteredItems(extra = {}) {
  const category = extra.category !== undefined ? extra.category : state.filterCategory;
  const query = extra.query !== undefined ? extra.query : state.searchQuery;
  const tags = extra.tags !== undefined ? extra.tags : state.activeTags;

  return ITEMS.filter((item) => {
    if (category && category !== "all" && item.category !== category) return false;
    if (query && !item.name.toLowerCase().includes(query)) return false;
    if (tags && tags.size > 0) {
      const itemTagKeys = Object.keys(item.tags || {});
      const hasAll = [...tags].every((t) => itemTagKeys.includes(t));
      if (!hasAll) return false;
    }
    return true;
  });
}

function renderItemGrid() {
  const grid = document.getElementById("item-grid");
  const items = getFilteredItems();
  grid.innerHTML = "";

  if (items.length === 0) {
    grid.innerHTML = `<p class="empty-msg">조건에 맞는 아이템이 없습니다.</p>`;
    return;
  }

  items.forEach((item) => grid.appendChild(createItemCard(item)));
}

function createItemCard(item) {
  const card = document.createElement("div");
  card.className = "item-card";
  card.dataset.id = item.id;

  const cat = CATEGORIES[item.category];
  card.innerHTML = `
    <div class="item-card-icon">${cat ? cat.icon : ""}</div>
    <div class="item-card-name">${item.name}</div>
    <div class="item-card-category">${cat ? cat.label : item.category}</div>
  `;
  card.addEventListener("click", () => renderItemDetail(item));
  return card;
}

function renderItemDetail(item) {
  const panel = document.getElementById("item-detail-panel");
  panel.hidden = false;

  const tagList = Object.entries(item.tags || {})
    .map(([key, weight]) => `<li>${TAGS[key] ? TAGS[key].label : key} (가중치 ${weight})</li>`)
    .join("");

  const metaList = Object.entries(item.meta || {})
    .map(([key, val]) => `<li><span>${key}</span>: ${val}</li>`)
    .join("");

  panel.innerHTML = `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${item.name}</h2>
    <p class="detail-category">${CATEGORIES[item.category]?.label ?? item.category}</p>
    <p class="detail-desc">${item.description ?? ""}</p>
    <h4>관련 태그</h4>
    <ul class="detail-tags">${tagList || "<li>없음</li>"}</ul>
    <h4>세부 정보</h4>
    <ul class="detail-meta">${metaList || "<li>없음</li>"}</ul>
  `;
  document.getElementById("detail-close-btn").addEventListener("click", () => {
    panel.hidden = true;
  });
}

// -------------------------------------------------------------------------
// 모달 (로드아웃 슬롯용 아이템 선택기)
// -------------------------------------------------------------------------
function openModal(categoryFilter, onSelect) {
  state.modal.categoryFilter = categoryFilter;
  state.modal.onSelect = onSelect;

  document.getElementById("modal-overlay").hidden = false;
  document.getElementById("modal-title").textContent =
    `${CATEGORIES[categoryFilter]?.label ?? categoryFilter} 선택`;
  document.getElementById("modal-search-input").value = "";
  renderModalList("");
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
  state.modal.onSelect = null;
  state.modal.categoryFilter = null;
}

function renderModalList(query) {
  const list = document.getElementById("modal-item-list");
  list.innerHTML = "";

  const items = getFilteredItems({
    category: state.modal.categoryFilter,
    query,
    tags: new Set(),
  });

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-msg">선택할 수 있는 아이템이 없습니다.</p>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "modal-item-row";
    row.innerHTML = `<span>${item.name}</span>`;
    row.addEventListener("click", () => {
      if (state.modal.onSelect) state.modal.onSelect(item);
    });
    list.appendChild(row);
  });
}

// -------------------------------------------------------------------------
// 로드아웃 빌더 탭
// -------------------------------------------------------------------------
function bindLoadoutSlotClicks() {
  document.querySelectorAll("#loadout-board .slot").forEach((slotEl) => {
    slotEl.addEventListener("click", (e) => {
      // 슬롯 안의 제거 버튼을 눌렀을 때는 슬롯 선택 모달을 열지 않음
      if (e.target.closest(".slot-clear-btn")) return;

      const slotType = slotEl.dataset.slotType;
      const slotIndex = Number(slotEl.dataset.slotIndex);

      openModal(slotType === "primary" || slotType === "secondary" ? "weapon" : slotType, (item) => {
        assignToSlot(slotType, slotIndex, item);
        closeModal();
      });
    });
  });
}

function assignToSlot(slotType, slotIndex, item) {
  if (slotType === "primary" || slotType === "secondary") {
    state.loadout[slotType] = item;
  } else if (slotType === "tool" || slotType === "consumable") {
    state.loadout[slotType][slotIndex] = item;
  }
  renderLoadoutBoard();
}

function clearSlot(slotType, slotIndex) {
  if (slotType === "primary" || slotType === "secondary") {
    state.loadout[slotType] = null;
  } else if (slotType === "tool" || slotType === "consumable") {
    state.loadout[slotType][slotIndex] = null;
  }
  renderLoadoutBoard();
}

function removeTrait(itemId) {
  state.loadout.trait = state.loadout.trait.filter((id) => id !== itemId);
  renderLoadoutBoard();
}

function clearLoadout() {
  state.loadout.primary = null;
  state.loadout.secondary = null;
  state.loadout.tool = [null, null];
  state.loadout.consumable = [null, null, null, null];
  state.loadout.trait = [];
  renderLoadoutBoard();
}

function renderLoadoutBoard() {
  // 무기 슬롯
  fillSlotEl("primary", 0, state.loadout.primary);
  fillSlotEl("secondary", 0, state.loadout.secondary);

  // 도구 슬롯
  state.loadout.tool.forEach((item, i) => fillSlotEl("tool", i, item));

  // 소모품 슬롯
  state.loadout.consumable.forEach((item, i) => fillSlotEl("consumable", i, item));

  // 특성 목록
  const traitList = document.getElementById("trait-slot-list");
  traitList.innerHTML = "";
  if (state.loadout.trait.length === 0) {
    traitList.innerHTML = `<p class="empty-msg">추가된 특성이 없습니다.</p>`;
  } else {
    state.loadout.trait.forEach((id) => {
      const item = ITEMS.find((i) => i.id === id);
      if (!item) return;
      const row = document.createElement("div");
      row.className = "trait-row";
      row.innerHTML = `<span>${item.name}</span> <button class="slot-clear-btn" type="button">✕</button>`;
      row.querySelector(".slot-clear-btn").addEventListener("click", () => removeTrait(id));
      traitList.appendChild(row);
    });
  }
}

function fillSlotEl(slotType, slotIndex, item) {
  const slotEl = document.querySelector(
    `.slot[data-slot-type="${slotType}"][data-slot-index="${slotIndex}"]`
  );
  if (!slotEl) return;
  const contentEl = slotEl.querySelector(".slot-content");

  if (!item) {
    contentEl.innerHTML = "비어있음";
    slotEl.classList.remove("filled");
    return;
  }

  slotEl.classList.add("filled");
  contentEl.innerHTML = `<span>${item.name}</span> <button class="slot-clear-btn" type="button">✕</button>`;
  contentEl.querySelector(".slot-clear-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    clearSlot(slotType, slotIndex);
  });
}

// -------------------------------------------------------------------------
// 분석 탭
// -------------------------------------------------------------------------
function collectLoadoutItems() {
  const items = [];
  if (state.loadout.primary) items.push(state.loadout.primary);
  if (state.loadout.secondary) items.push(state.loadout.secondary);
  state.loadout.tool.forEach((i) => i && items.push(i));
  state.loadout.consumable.forEach((i) => i && items.push(i));
  state.loadout.trait.forEach((id) => {
    const item = ITEMS.find((i) => i.id === id);
    if (item) items.push(item);
  });
  return items;
}

function analyzeLoadout() {
  const items = collectLoadoutItems();
  const totals = {};
  Object.keys(TAGS).forEach((k) => (totals[k] = 0));

  items.forEach((item) => {
    Object.entries(item.tags || {}).forEach(([key, weight]) => {
      if (totals[key] !== undefined) totals[key] += weight;
    });
  });

  return { items, totals };
}

function renderAnalysis() {
  const summaryEl = document.getElementById("analysis-summary");
  const resultEl = document.getElementById("analysis-result");

  const { items, totals } = analyzeLoadout();

  if (items.length === 0) {
    summaryEl.innerHTML = `<p class="empty-msg">로드아웃 빌더 탭에서 아이템을 먼저 추가해주세요.</p>`;
    resultEl.innerHTML = "";
    return;
  }

  // 현재 구성 요약
  summaryEl.innerHTML = `
    <h2>현재 로드아웃</h2>
    <ul>${items.map((i) => `<li>${CATEGORIES[i.category]?.icon ?? ""} ${i.name}</li>`).join("")}</ul>
  `;

  const maxVal = Math.max(1, ...Object.values(totals));
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const strongest = sorted.filter(([, v]) => v > 0).slice(0, 2);
  const weakest = sorted.filter(([, v]) => v === 0);

  const bars = sorted
    .map(([key, val]) => {
      const pct = Math.round((val / maxVal) * 100);
      return `
        <div class="tag-bar-row">
          <span class="tag-bar-label" title="${TAGS[key].desc}">${TAGS[key].label}</span>
          <div class="tag-bar-track">
            <div class="tag-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="tag-bar-value">${val}</span>
        </div>
      `;
    })
    .join("");

  const strongText = strongest.length
    ? strongest.map(([k]) => TAGS[k].label).join(", ")
    : "뚜렷한 강점이 아직 없습니다.";

  const weakText = weakest.length
    ? weakest.map(([k]) => TAGS[k].label).join(", ")
    : "약점으로 보이는 영역이 없습니다.";

  resultEl.innerHTML = `
    <h2>플레이스타일 분석</h2>
    <div class="tag-bars">${bars}</div>
    <div class="analysis-text">
      <p><strong>강점:</strong> ${strongText}</p>
      <p><strong>약점(가중치 0):</strong> ${weakText}</p>
      <p class="analysis-note">
        ※ 이 분석은 각 아이템에 등록된 태그 가중치를 단순 합산한 결과입니다.
        실제 데이터가 채워지면 더 정교한 계산식으로 바꿀 수 있습니다.
      </p>
    </div>
  `;
}

// -------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);
