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

  loadout: {},
  modal: { onSelect: null, categoryFilter: null },

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
      if (!slotDef.allowDuplicates && state.loadout[key].includes(item.id)) {
        return { ok: false, message: "이미 추가되어 있습니다" };
      }
      state.loadout[key].push(item.id);
      return { ok: true, slotLabel: slotDef.label };
    } else {
      const arr = state.loadout[key];
      const emptyIdx = arr.findIndex((v) => v === null);
      if (emptyIdx !== -1) {
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

  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.getElementById("modal-search-input").addEventListener("input", (e) => {
    renderModalList(e.target.value.trim().toLowerCase());
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
  wrap.appendChild(createCategoryFilterButton("all", "전체"));
  Object.entries(CATEGORIES).forEach(([key, def]) => {
    wrap.appendChild(createCategoryFilterButton(key, def.label, def.image));
  });
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
    def.options.forEach((opt) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip";

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
        if (set.has(opt.value)) { set.delete(opt.value); chip.classList.remove("active"); }
        else { set.add(opt.value); chip.classList.add("active"); }
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

// -------------------------------------------------------------------------
// 결과 그리드
// -------------------------------------------------------------------------
function getFilteredItems(extra = {}) {
  const category = extra.category !== undefined ? extra.category : state.filterCategory;
  const query = extra.query !== undefined ? extra.query : state.searchQuery;
  const useWeaponFilters = extra.useWeaponFilters !== false;

  return ITEMS.filter((item) => {
    if (category && category !== "all" && item.category !== category) return false;
    if (query && !item.name.toLowerCase().includes(query)) return false;
    if (useWeaponFilters && item.category === "weapon") {
      const f = state.weaponFilters;
      if (f.slotSize.size > 0 && !f.slotSize.has(item.slotSize)) return false;
      if (f.ammoCategory.size > 0 && !f.ammoCategory.has(item.ammoCategory)) return false;
      if (f.ammoEffect.size > 0) {
        const effects = item.ammoEffects || [];
        const ok = [...f.ammoEffect].some((e) => effects.includes(e));
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
        ${item.price != null ? `<span class="item-card-price"><img src="images/ui/hunt_dollars.png" alt="$" class="dollar-icon">${item.price}</span>` : ""}
      </div>
      <button class="item-card-detail-btn" type="button">자세히 보기 ›</button>`;

    // 버튼은 자세히 보기 화면 열기 (이벤트 전파 차단)
    card.querySelector(".item-card-detail-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openBodyPartView(item, item.defaultAmmo || (item.ammoTypes && item.ammoTypes[0]));
    });
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

  content.innerHTML = `
    <button id="bodypart-close-btn" type="button">✕</button>
    <h2>${parentItem.name} <span class="bodypart-ammo">${ammo?.label ?? ""}</span></h2>
    ${variantsList.length > 1 ? `<div class="variant-tabs variant-tabs-compact">${variantTabs}</div>` : ""}
    ${currentItem.description ? `<p class="variant-desc">${currentItem.description}</p>` : ""}

    <!-- 본문: 좌측 마네킹 / 중앙 무기이미지+기본정보+스탯 / 우측 그래프+특수탄+효과 -->
    <div class="bodypart-layout">
      <!-- 좌측: 마네킹 -->
      <div class="bodypart-figure-col">
        <div class="bodypart-figure">
          ${renderBodyFigureSVG(partInfo, refRange)}
        </div>
      </div>

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
          ${currentItem.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${currentItem.price}</span>` : ""}
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
        <h4 class="bp-chart-heading">거리별 데미지 <span class="bodypart-hint">— 그래프를 클릭하여 거리 선택</span></h4>
        <div class="bp-chart-wrap"><canvas id="bp-chart"></canvas></div>

        <div class="ammo-tabs-row">
          <div class="ammo-tabs">${ammoTabs}</div>
          <button id="bp-add-compare-btn" type="button" class="compare-btn-inline ${inBpCompare ? "added" : ""}">
            ${inBpCompare ? "✓ 비교 목록에 추가됨" : "+ 비교 목록에 추가"}
          </button>
          <button id="bp-add-loadout-btn" type="button" class="compare-btn-inline">+ 로드아웃에 추가</button>
        </div>

        <!-- 탄약 효과 (특수탄 근처에 배치) -->
        <div class="status-effect-box">
          <h4>효과</h4>
          ${ammo?.specialEffects?.length
            ? `<ul class="status-effect-list">${ammo.specialEffects.map((e) => `<li>${e}</li>`).join("")}</ul>`
            : `<p class="muted-text">이 탄약에는 특수 효과가 없습니다.</p>`}
          <p class="status-effect-note">※ 계산 결과는 반올림 등으로 인해 실제와 최대 1m까지 차이가 날 수 있습니다.</p>
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

// 자세히 보기 화면 내 그래프 (클릭해도 그래프 자체는 다시 그려지지 않음)
function drawBodyPartChart(currentItem, ammoId, refRange, parentItem) {
  const canvas = document.getElementById("bp-chart");
  if (!canvas) return;

  // 이전 차트 정리
  if (state.charts.bodypart) {
    state.charts.bodypart.destroy();
    state.charts.bodypart = null;
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

  const opts = chartOptions("거리 (m)", "데미지", { showOHK: canOHK, refRange, xMax: 100 });
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
  return { stats, chamber, ammo };
}

function renderWeaponDetailHTML(item, selectedAmmoId) {
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

  return `
    <button id="detail-close-btn" type="button">✕</button>
    <h2>${item.name}</h2>

    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="detail-img" onerror="this.style.display='none'">` : ""}

    <!-- 한 줄: [탄약 아이콘] 장탄/예비탄 [칸수 아이콘] | [달러 아이콘] 가격 -->
    <div class="ammo-status-row">
      ${ammo?.image ? `<img src="${ammo.image}" alt="${ammo.label}" class="ammo-status-icon">` : ""}
      <span class="ammo-status-count">${chamber.loaded ?? "-"}/${chamber.extra ?? "-"}</span>
      <img src="images/ui/slot_${item.slotSize || 1}.png" alt="${item.slotSize}칸" class="ammo-status-slots">
      ${item.price != null ? `<img src="images/ui/hunt_dollars.png" alt="$" class="ammo-status-dollar"><span class="ammo-status-price">${item.price}</span>` : ""}
    </div>

    <h4>Ammo Types</h4>
    <div class="ammo-tabs">${ammoTabs}</div>

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
      y: { beginAtZero: true, title: { display: true, text: yLabel, color: "#aba894" },
           ticks: { color: "#aba894" }, grid: { color: "rgba(77, 86, 64, 0.3)" } },
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
function openModal(categoryFilter, onSelect) {
  state.modal.categoryFilter = categoryFilter;
  state.modal.onSelect = onSelect;
  document.getElementById("modal-overlay").hidden = false;
  document.getElementById("modal-title").textContent =
    `${CATEGORIES[categoryFilter]?.label ?? categoryFilter} 선택`;
  document.getElementById("modal-search-input").hidden = false;
  document.getElementById("modal-search-input").value = "";
  renderModalList("");
}

function closeModal() {
  document.getElementById("modal-overlay").hidden = true;
  document.getElementById("modal-search-input").hidden = false;
  state.modal.onSelect = null;
  state.modal.categoryFilter = null;
}

function renderModalList(query) {
  const list = document.getElementById("modal-item-list");
  list.innerHTML = "";
  const items = getFilteredItems({
    category: state.modal.categoryFilter, query, useWeaponFilters: false,
  });
  if (items.length === 0) {
    list.innerHTML = `<p class="empty-msg">선택할 수 있는 아이템이 없습니다.</p>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "modal-item-row";
    row.innerHTML = `
      ${item.image ? `<img src="${item.image}" alt="" class="modal-item-thumb" onerror="this.style.display='none'">` : `<span class="modal-item-thumb-placeholder"></span>`}
      <span class="modal-item-name">${item.name}</span>
      ${item.price != null ? `<span class="modal-item-price"><img src="images/ui/hunt_dollars.png" alt="$">${item.price}</span>` : ""}
    `;
    row.addEventListener("click", () => {
      // 무기는 클릭하면 바로 확정하지 않고 탄약 선택 단계로 이동
      if (item.category === "weapon" && item.ammoTypes && item.ammoTypes.length > 0) {
        renderModalAmmoStep(item);
      } else if (state.modal.onSelect) {
        state.modal.onSelect(item, null);
      }
    });
    list.appendChild(row);
  });
}

// 무기 선택 후 탄약을 고르는 단계 (가격도 함께 표시)
function renderModalAmmoStep(weaponItem) {
  document.getElementById("modal-title").textContent = `${weaponItem.name} — 탄약 선택`;
  document.getElementById("modal-search-input").hidden = true;

  const list = document.getElementById("modal-item-list");
  list.innerHTML = "";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "modal-back-btn";
  backBtn.textContent = "← 무기 목록으로";
  backBtn.addEventListener("click", () => {
    document.getElementById("modal-search-input").hidden = false;
    document.getElementById("modal-title").textContent =
      `${CATEGORIES[state.modal.categoryFilter]?.label ?? state.modal.categoryFilter} 선택`;
    renderModalList(document.getElementById("modal-search-input").value.trim().toLowerCase());
  });
  list.appendChild(backBtn);

  weaponItem.ammoTypes.forEach((ammoId) => {
    const ammo = AMMO_TYPES[ammoId];
    if (!ammo) return;
    const row = document.createElement("div");
    row.className = "modal-item-row";
    row.innerHTML = `
      ${ammo.image ? `<img src="${ammo.image}" alt="" class="modal-item-thumb" onerror="this.style.display='none'">` : `<span class="modal-item-thumb-placeholder"></span>`}
      <span class="modal-item-name">${ammo.label}${ammoId === weaponItem.defaultAmmo ? " (기본)" : ""}</span>
      ${ammo.scarce
        ? `<span class="modal-item-price modal-item-scarce"><img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`
        : ammo.cost != null ? `<span class="modal-item-price"><img src="images/ui/hunt_dollars.png" alt="$">${ammo.cost}</span>` : ""}
    `;
    row.addEventListener("click", () => {
      if (state.modal.onSelect) state.modal.onSelect(weaponItem, ammoId);
    });
    list.appendChild(row);
  });
}

// -------------------------------------------------------------------------
// 로드아웃
// -------------------------------------------------------------------------
function renderLoadoutBoard() {
  const board = document.getElementById("loadout-board");
  board.innerHTML = "";
  Object.entries(CATEGORIES).forEach(([catKey, catDef]) => {
    const groupEl = document.createElement("div");
    groupEl.className = "loadout-group";
    const heading = document.createElement("h2");
    heading.innerHTML = catDef.image
      ? `<img src="${catDef.image}" alt="" class="loadout-group-icon" onerror="this.style.display='none'">${catDef.label}`
      : `${catDef.icon} ${catDef.label}`;
    groupEl.appendChild(heading);
    catDef.loadoutSlots.forEach((slotDef) => {
      const key = loadoutKey(catKey, slotDef.slotKey);
      if (slotDef.max === null) groupEl.appendChild(renderDynamicSlotGroup(catKey, slotDef, key));
      else for (let i = 0; i < slotDef.max; i++) groupEl.appendChild(renderFixedSlot(catKey, slotDef, key, i));
    });
    board.appendChild(groupEl);
  });
}

function renderFixedSlot(catKey, slotDef, key, index) {
  const slotEl = document.createElement("div");
  slotEl.className = "slot";
  const labelEl = document.createElement("span");
  labelEl.className = "slot-label";
  labelEl.textContent = slotDef.max > 1 ? `${slotDef.label} ${index + 1}` : slotDef.label;
  slotEl.appendChild(labelEl);

  // 무기 슬롯은 { item, ammoId } 형태로 저장됨 (도구/소모품은 ammoId가 항상 null)
  const slotData = state.loadout[key][index];
  const item = slotData?.item || null;
  const ammo = slotData?.ammoId ? AMMO_TYPES[slotData.ammoId] : null;

  const contentEl = document.createElement("div");
  contentEl.className = "slot-content";
  if (item) {
    slotEl.classList.add("filled");
    if (item.image) {
      const thumb = document.createElement("img");
      thumb.src = item.image;
      thumb.alt = "";
      thumb.className = "slot-thumb";
      thumb.onerror = () => { thumb.style.display = "none"; };
      contentEl.appendChild(thumb);
    }
    const nameSpan = document.createElement("span");
    nameSpan.className = "slot-item-name";
    nameSpan.textContent = item.name;
    contentEl.appendChild(nameSpan);

    if (item.price != null) {
      contentEl.insertAdjacentHTML(
        "beforeend",
        `<span class="slot-item-price"><img src="images/ui/hunt_dollars.png" alt="$">${item.price}</span>`
      );
    }

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
    const catImg = CATEGORIES[catKey]?.image;
    contentEl.innerHTML = catImg
      ? `<img src="${catImg}" alt="" class="slot-empty-icon" onerror="this.style.display='none'"><span class="slot-empty-text">비어있음</span>`
      : `<span class="slot-empty-text">비어있음</span>`;
  }
  slotEl.appendChild(contentEl);

  // 선택된 탄약이 있으면 무기 정보 아래에 탄약 한 줄 추가 (이름 + 가격)
  if (item && ammo) {
    const ammoRow = document.createElement("div");
    ammoRow.className = "slot-ammo-row";
    ammoRow.innerHTML = `
      ${ammo.image ? `<img src="${ammo.image}" alt="" class="slot-ammo-icon" onerror="this.style.display='none'">` : ""}
      <span class="slot-ammo-name">${ammo.label}</span>
      ${ammo.scarce
        ? `<span class="slot-item-price"><img src="images/ui/scarce.png" alt="Scarce" title="Scarce (상점 구매 불가, 월드에서만 획득)"></span>`
        : ammo.cost != null ? `<span class="slot-item-price"><img src="images/ui/hunt_dollars.png" alt="$">${ammo.cost}</span>` : ""}
    `;
    slotEl.appendChild(ammoRow);
  }

  slotEl.addEventListener("click", (e) => {
    if (e.target.closest(".slot-clear-btn")) return;
    openModal(catKey, (selectedItem, selectedAmmoId) => {
      state.loadout[key][index] = { item: selectedItem, ammoId: selectedAmmoId ?? null };
      renderLoadoutBoard();
      closeModal();
    });
  });
  return slotEl;
}

function renderDynamicSlotGroup(catKey, slotDef, key) {
  const wrap = document.createElement("div");
  wrap.className = "loadout-dynamic-group";
  const listEl = document.createElement("div");
  listEl.className = "dynamic-list-items";
  const ids = state.loadout[key];
  if (ids.length === 0) listEl.innerHTML = `<p class="empty-msg">${withEulReulIga(`추가된 ${slotDef.label}`, "이", "가")} 없습니다.</p>`;
  else ids.forEach((itemId, idx) => {
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) return;
    const row = document.createElement("div");
    row.className = "trait-row";
    row.innerHTML = `
      <span class="trait-row-main">
        ${item.image ? `<img src="${item.image}" alt="" class="trait-thumb" onerror="this.style.display='none'">` : ""}
        <span>${item.name}</span>
      </span>
    `;
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "slot-clear-btn";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      // id가 아니라 인덱스로 하나만 제거 (같은 아이템을 여러 개 챙긴 경우 전체가 지워지지 않도록)
      state.loadout[key].splice(idx, 1);
      renderLoadoutBoard();
    });
    row.appendChild(removeBtn);
    listEl.appendChild(row);
  });
  wrap.appendChild(listEl);

  const isFull = slotDef.sharedGroup && getSharedGroupUsage(slotDef.sharedGroup) >= slotDef.sharedCapacity;
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  if (isFull) {
    addBtn.className = "add-item-btn add-item-btn-disabled";
    addBtn.disabled = true;
    addBtn.textContent = `필드 장비 칸이 가득 찼습니다 (${slotDef.sharedCapacity}/${slotDef.sharedCapacity})`;
  } else {
    addBtn.className = "add-item-btn";
    addBtn.textContent = `+ ${slotDef.label} 추가`;
    addBtn.addEventListener("click", () => {
      openModal(catKey, (selectedItem) => {
        // 모달이 열려있는 동안 다른 경로로 칸이 다 찼을 수도 있으니 다시 확인
        if (slotDef.sharedGroup && getSharedGroupUsage(slotDef.sharedGroup) >= slotDef.sharedCapacity) {
          closeModal();
          renderLoadoutBoard();
          return;
        }
        if (!slotDef.allowDuplicates && state.loadout[key].includes(selectedItem.id)) {
          closeModal();
          return;
        }
        state.loadout[key].push(selectedItem.id);
        renderLoadoutBoard();
        closeModal();
      });
    });
  }
  wrap.appendChild(addBtn);
  return wrap;
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
    const item = ITEMS.find((i) => i.id === entry.weaponId);
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
    const item = ITEMS.find((i) => i.id === entry.weaponId);
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
      const item = ITEMS.find((i) => i.id === s.weaponId);
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
