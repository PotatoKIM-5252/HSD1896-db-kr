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
    drawWeaponChart(item, selectedAmmoId);
  } else {
    panel.innerHTML = renderGenericDetailHTML(item);
    bindDetailClose(panel);
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
  const dmgAtRange = baseDmg * distMult;

  // 부위별 데미지 계산
  //   표기 데미지(stats.damage)는 "10m, 가슴 맞춤" 기준이므로
  //   가슴 배율(1.3)로 한 번 나눠서 순수값을 구한 뒤 다른 부위 배율을 곱함
  //   == 표기데미지 × (부위배율 / 가슴배율)
  const partInfo = {};
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([key, def]) => {
    if (def.multiplier == null) partInfo[key] = { dmg: null };
    else partInfo[key] = { dmg: Math.round(dmgAtRange * def.multiplier / CHEST_MULTIPLIER) };
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
      <button class="ammo-tab ${active}" data-bp-ammo-id="${aid}" type="button" title="${a.label}${a.cost ? ` ($${a.cost})` : ""}">
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
          ${statRowSimple("피해", stats.damage)}
          ${statRowSimple("낙하 범위", stats.dropRange)}
          ${statRowSimple("발사속도", stats.rateOfFire)}
          ${statRowSimple("사이클 시간", stats.cycleTime)}
          ${statRowSimple("분산도", stats.spread)}
          ${statRowSimple("흔들림", stats.sway)}
          ${statRowSimple("수직 반동", stats.verticalRecoil)}
          ${statRowSimple("재장전 속도", stats.reloadSpeed)}
          ${statRowSimple("총구속도", stats.muzzleVelocity)}
          ${statRowSimple("근접 피해", stats.meleeLight)}
          ${statRowSimple("중형 근접 피해", stats.meleeHeavy)}
          ${statRowSimple("기력 비용(강공격)", stats.staminaConsumption)}
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
        </div>

        <!-- 탄약 효과 (특수탄 근처에 배치) -->
        <div class="status-effect-box">
          <h4>효과</h4>
          ${ammo?.specialEffects?.length
            ? `<ul class="status-effect-list">${ammo.specialEffects.map((e) => `<li>${e}</li>`).join("")}</ul>`
            : `<p class="muted-text">이 탄약에는 특수 효과가 없습니다.</p>`}
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

  const ds = buildFalloffDataset(currentItem, ammoId, "#ece6d3", 150);
  if (!ds) {
    canvas.outerHTML = `<p class="empty-msg">거리별 데이터 없음</p>`;
    return;
  }
  ds.fill = true;
  ds.backgroundColor = "rgba(236, 230, 211, 0.12)";

  const maxDmg = Math.max(...ds.data.map((d) => d.y));
  const canOHK = maxDmg >= HUNTER_HP;

  const opts = chartOptions("거리 (m)", "데미지", { showOHK: canOHK, refRange, xMax: 150 });
  // 애니메이션 비활성화 — 클릭마다 그래프가 다시 올라오는 효과 제거
  opts.animation = false;
  opts.animations = { colors: false, x: false, y: false };
  opts.transitions = { active: { animation: { duration: 0 } } };

  state.charts.bodypart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { datasets: [ds] },
    options: opts,
    plugins: [btkLinesPlugin],
  });

  // 그래프 클릭 → 거리만 갱신 → 마네킹과 표만 새로 그림 (그래프는 그대로 유지)
  canvas.onclick = (evt) => {
    const chart = state.charts.bodypart;
    if (!chart) return;
    const rect = canvas.getBoundingClientRect();
    const xPixel = evt.clientX - rect.left;
    const xValue = Math.round(chart.scales.x.getValueForPixel(xPixel));
    const clamped = Math.max(0, Math.min(150, xValue));
    state.refRange[parentItem.id] = clamped;
    refreshBodyPartDamage(currentItem, ammoId, parentItem);
  };
}

// 거리만 바뀌었을 때: 마네킹 + 부제목 + BTK 표만 다시 그리기 (그래프는 그대로 유지)
function refreshBodyPartDamage(currentItem, ammoId, parentItem) {
  const { stats, ammo } = resolveWeaponWithAmmo(currentItem, ammoId);
  const baseDmg = stats.damage ?? 0;
  const refRange = state.refRange[parentItem.id] ?? 10;
  const distMult = ammo?.falloff ? interpolateFalloff(ammo.falloff, refRange) : 1;
  const dmgAtRange = baseDmg * distMult;

  // 부위별 데미지 다시 계산 (가슴 기준 표기값을 변환)
  const partInfo = {};
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([key, def]) => {
    if (def.multiplier == null) partInfo[key] = { dmg: null };
    else partInfo[key] = { dmg: Math.round(dmgAtRange * def.multiplier / CHEST_MULTIPLIER) };
  });

  // 마네킹만 다시 그리기
  const figureEl = document.querySelector(".bodypart-figure");
  if (figureEl) figureEl.innerHTML = renderBodyFigureSVG(partInfo, refRange);
}

// 단순 스탯 행 (자세히 보기용 — 화살표 표기 없음)
function statRowSimple(label, value) {
  if (value == null) return "";
  return `<div class="stat-row"><span>${label}</span><b>${value}</b></div>`;
}

function closeBodyPartView() {
  document.getElementById("bodypart-overlay").hidden = true;
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
      <button class="ammo-tab ${active}" data-ammo-id="${aid}" type="button" title="${a.label}${a.cost ? ` ($${a.cost})` : ""}">
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

    <button id="detail-add-compare-btn" type="button" class="compare-btn ${inCompare ? "added" : ""}">
      ${inCompare ? "✓ 비교 목록에 추가됨 (클릭하여 제거)" : "+ 비교 목록에 추가"}
    </button>
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
  `;
}

// -------------------------------------------------------------------------
// Chart.js
// -------------------------------------------------------------------------
function buildFalloffDataset(item, ammoId, color, xMax = 200) {
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
    const clamped = Math.max(0, Math.min(200, xValue));
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
      x: { type: "linear", min: 0, max: opts.xMax ?? 200,
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
    category: state.modal.categoryFilter, query, useWeaponFilters: false,
  });
  if (items.length === 0) {
    list.innerHTML = `<p class="empty-msg">선택할 수 있는 아이템이 없습니다.</p>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "modal-item-row";
    row.innerHTML = `<span>${item.name}</span>`;
    row.addEventListener("click", () => { if (state.modal.onSelect) state.modal.onSelect(item); });
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
    heading.textContent = `${catDef.icon} ${catDef.label}`;
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

function renderDynamicSlotGroup(catKey, slotDef, key) {
  const wrap = document.createElement("div");
  wrap.className = "loadout-dynamic-group";
  const listEl = document.createElement("div");
  listEl.className = "dynamic-list-items";
  const ids = state.loadout[key];
  if (ids.length === 0) listEl.innerHTML = `<p class="empty-msg">추가된 ${slotDef.label}이 없습니다.</p>`;
  else ids.forEach((itemId) => {
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) return;
    const row = document.createElement("div");
    row.className = "trait-row";
    row.innerHTML = `<span>${item.name}</span>`;
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
  wrap.appendChild(listEl);
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-item-btn";
  addBtn.textContent = `+ ${slotDef.label} 추가`;
  addBtn.addEventListener("click", () => {
    openModal(catKey, (selectedItem) => {
      if (!state.loadout[key].includes(selectedItem.id)) state.loadout[key].push(selectedItem.id);
      renderLoadoutBoard();
      closeModal();
    });
  });
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
        ${STAT_DEFS.map((d) => statRowSimple(d.label, stats[d.key])).join("")}
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
