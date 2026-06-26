/* =========================================================================
   app.js
   -------------------------------------------------------------------------
   이 파일은 보통 손댈 필요가 없습니다. 카테고리나 아이템을 추가/수정하는
   작업은 전부 data.js 에서 합니다.

   이 파일이 하는 일:
   1) data.js 의 CATEGORIES 를 읽어서 검색 필터 버튼 / 로드아웃 슬롯을
      자동으로 화면에 만들어줍니다.
   2) DB 검색 탭: 검색, 카테고리 필터, 태그 필터를 처리합니다.
   3) 로드아웃 빌더 탭: 슬롯 클릭 → 아이템 선택 모달 → 슬롯에 저장을 처리합니다.
   4) 분석 탭: 로드아웃에 들어간 아이템들의 태그 가중치를 합산합니다.
   ========================================================================= */

const state = {
  activeTab: "search",
  filterCategory: "all",
  searchQuery: "",
  activeTags: new Set(),

  // CATEGORIES 설정을 바탕으로 initLoadoutState() 에서 자동으로 채워집니다.
  // 예: { "weapon__primary": [null], "weapon__secondary": [null],
  //       "tool__tool": [null, null], "trait__trait": [] }
  loadout: {},

  modal: {
    onSelect: null,
    categoryFilter: null,
  },
};

// 카테고리키 + 슬롯키를 합쳐서 loadout 객체의 고유 키를 만듭니다.
function loadoutKey(categoryKey, slotKey) {
  return `${categoryKey}__${slotKey}`;
}

// -------------------------------------------------------------------------
// 초기화
// -------------------------------------------------------------------------
function init() {
  initLoadoutState();

  // 상단 탭 네비게이션
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
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

  document.getElementById("clear-loadout-btn").addEventListener("click", clearLoadout);
  document.getElementById("goto-analysis-btn").addEventListener("click", () => switchTab("analysis"));

  renderCategoryFilters();
  renderTagFilters();
  renderItemGrid();
  renderLoadoutBoard();
}

// CATEGORIES 설정을 바탕으로 로드아웃 상태(state.loadout)의 뼈대를 만듭니다.
function initLoadoutState() {
  state.loadout = {};
  Object.entries(CATEGORIES).forEach(([catKey, catDef]) => {
    catDef.loadoutSlots.forEach((slotDef) => {
      const key = loadoutKey(catKey, slotDef.slotKey);
      // max가 숫자면 그 길이만큼 null로 채운 "고정 슬롯" 배열
      // max가 null이면 빈 배열로 시작하는 "목록형"
      state.loadout[key] = slotDef.max === null ? [] : new Array(slotDef.max).fill(null);
    });
  });
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

// CATEGORIES 설정을 읽어서 "전체" + 카테고리별 필터 버튼을 자동 생성합니다.
// 카테고리를 추가/삭제해도 이 함수는 그대로 두면 됩니다 (data.js만 고치면 됨).
function renderCategoryFilters() {
  const wrap = document.getElementById("category-filters");
  wrap.innerHTML = "";

  wrap.appendChild(createCategoryFilterButton("all", "전체"));
  Object.entries(CATEGORIES).forEach(([key, def]) => {
    wrap.appendChild(createCategoryFilterButton(key, `${def.icon} ${def.label}`));
  });
}

function createCategoryFilterButton(categoryKey, labelText) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cat-filter-btn" + (categoryKey === "all" ? " active" : "");
  btn.dataset.category = categoryKey;
  btn.textContent = labelText;
  btn.addEventListener("click", () => {
    state.filterCategory = categoryKey;
    document.querySelectorAll(".cat-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderItemGrid();
  });
  return btn;
}

// TAGS 설정을 읽어서 태그 필터 칩을 자동 생성합니다.
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
// CATEGORIES 설정을 읽어서 그룹/슬롯을 전부 자동으로 그립니다.
// 카테고리를 추가/삭제해도 이 함수들은 그대로 두면 됩니다 (data.js만 고치면 됨).
// -------------------------------------------------------------------------
function renderLoadoutBoard() {
  const board = document.getElementById("loadout-board");
  board.innerHTML = "";

  Object.entries(CATEGORIES).forEach(([catKey, catDef]) => {
    const groupEl = document.createElement("div");
    groupEl.className = "loadout-group";
    groupEl.dataset.group = catKey;

    const heading = document.createElement("h2");
    heading.textContent = `${catDef.icon} ${catDef.label}`;
    groupEl.appendChild(heading);

    catDef.loadoutSlots.forEach((slotDef) => {
      const key = loadoutKey(catKey, slotDef.slotKey);

      if (slotDef.max === null) {
        groupEl.appendChild(renderDynamicSlotGroup(catKey, slotDef, key));
      } else {
        for (let i = 0; i < slotDef.max; i++) {
          groupEl.appendChild(renderFixedSlot(catKey, slotDef, key, i));
        }
      }
    });

    board.appendChild(groupEl);
  });
}

// max가 숫자인 경우: "비어있음 / 채워짐" 형태의 고정 슬롯 하나를 그립니다.
function renderFixedSlot(catKey, slotDef, key, index) {
  const slotEl = document.createElement("div");
  slotEl.className = "slot";
  slotEl.dataset.loadoutKey = key;
  slotEl.dataset.slotIndex = String(index);

  const labelEl = document.createElement("span");
  labelEl.className = "slot-label";
  labelEl.textContent = slotDef.max > 1 ? `${slotDef.label} ${index + 1}` : slotDef.label;
  slotEl.appendChild(labelEl);

  const contentEl = document.createElement("div");
  contentEl.className = "slot-content";

  const item = state.loadout[key][index];
  if (item) {
    slotEl.classList.add("filled");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = item.name;
    contentEl.appendChild(nameSpan);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "slot-clear-btn";
    clearBtn.textContent = "✕";
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.loadout[key][index] = null;
      renderLoadoutBoard();
    });
    contentEl.appendChild(clearBtn);
  } else {
    contentEl.textContent = "비어있음";
  }
  slotEl.appendChild(contentEl);

  slotEl.addEventListener("click", (e) => {
    if (e.target.closest(".slot-clear-btn")) return;
    openModal(catKey, (selectedItem) => {
      state.loadout[key][index] = selectedItem;
      renderLoadoutBoard();
      closeModal();
    });
  });

  return slotEl;
}

// max가 null인 경우: 목록 + "추가" 버튼을 그립니다. (특성처럼 개수 제한 없는 슬롯)
function renderDynamicSlotGroup(catKey, slotDef, key) {
  const wrap = document.createElement("div");
  wrap.className = "loadout-dynamic-group";

  const listEl = document.createElement("div");
  listEl.className = "dynamic-list-items";

  const ids = state.loadout[key];
  if (ids.length === 0) {
    listEl.innerHTML = `<p class="empty-msg">추가된 ${slotDef.label}이 없습니다.</p>`;
  } else {
    ids.forEach((itemId) => {
      const item = ITEMS.find((i) => i.id === itemId);
      if (!item) return;

      const row = document.createElement("div");
      row.className = "trait-row";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = item.name;
      row.appendChild(nameSpan);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "slot-clear-btn";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        state.loadout[key] = state.loadout[key].filter((id) => id !== itemId);
        renderLoadoutBoard();
      });
      row.appendChild(removeBtn);

      listEl.appendChild(row);
    });
  }
  wrap.appendChild(listEl);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-item-btn";
  addBtn.textContent = `+ ${slotDef.label} 추가`;
  addBtn.addEventListener("click", () => {
    openModal(catKey, (selectedItem) => {
      if (!state.loadout[key].includes(selectedItem.id)) {
        state.loadout[key].push(selectedItem.id);
      }
      renderLoadoutBoard();
      closeModal();
    });
  });
  wrap.appendChild(addBtn);

  return wrap;
}

function clearLoadout() {
  initLoadoutState();
  renderLoadoutBoard();
}

// -------------------------------------------------------------------------
// 분석 탭
// -------------------------------------------------------------------------

// 현재 로드아웃에 들어있는 모든 아이템을 하나의 배열로 모읍니다.
// (고정 슬롯에는 아이템 객체가, 목록형 슬롯에는 id 문자열이 들어있다는 차이를
//  여기서 한 번에 처리합니다)
function collectLoadoutItems() {
  const items = [];
  Object.values(state.loadout).forEach((value) => {
    value.forEach((entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        const item = ITEMS.find((i) => i.id === entry);
        if (item) items.push(item);
      } else {
        items.push(entry);
      }
    });
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
