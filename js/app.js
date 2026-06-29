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

  // 비교 목록: { weaponId, ammoId } 쌍의 배열
  compareEntries: [],

  charts: { detail: null, compare: null },
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
      chip.textContent = opt.label;
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

  // 무기 카드: 이름 + 이미지 + 칸수 + 가격만 표시
  if (item.category === "weapon") {
    card.innerHTML = `
      ${imgHTML}
      <div class="item-card-name">${item.name}</div>
      <div class="item-card-meta">
        <span class="item-card-slots">${"▪".repeat(item.slotSize || 0)}</span>
        ${item.price != null ? `<span class="item-card-price">$${item.price}</span>` : ""}
      </div>`;
  } else {
    // 그 외(도구/소모품/특성): 이름 + 카테고리만
    card.innerHTML = `
      ${imgHTML}
      <div class="item-card-name">${item.name}</div>
      <div class="item-card-category">${cat ? cat.label : item.category}</div>`;
  }

  card.addEventListener("click", () => renderItemDetail(item));
  return card;
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

  document.querySelector("#detail-show-bodyparts-btn")?.addEventListener("click", () => {
    openBodyPartView(item, ammoId);
  });
}

// -------------------------------------------------------------------------
// 자세히 보기 - 부위별 데미지 화면
// -------------------------------------------------------------------------
function openBodyPartView(item, ammoId) {
  const { stats, ammo } = resolveWeaponWithAmmo(item, ammoId);
  const baseDmg = stats.damage ?? 0;

  const overlay = document.getElementById("bodypart-overlay");
  const content = document.getElementById("bodypart-content");

  // 기준 거리: 그래프에서 클릭한 값. 없으면 10m 기본.
  const refRange = state.refRange[item.id] ?? 10;
  const distMult = ammo?.falloff ? interpolateFalloff(ammo.falloff, refRange) : 1;
  const dmgAtRange = baseDmg * distMult;

  // 각 부위별 데미지
  const partInfo = {};
  Object.entries(BODY_PART_MULTIPLIERS).forEach(([key, def]) => {
    if (def.multiplier == null) {
      partInfo[key] = { dmg: null };
    } else {
      partInfo[key] = { dmg: Math.round(dmgAtRange * def.multiplier) };
    }
  });

  content.innerHTML = `
    <button id="bodypart-close-btn" type="button">✕</button>
    <h2>${item.name} <span class="bodypart-ammo">${ammo?.label ?? ""}</span></h2>
    <p class="bodypart-subtitle">
      Range: <b>${refRange}m</b> 기준 부위별 데미지 (헌터 HP ${HUNTER_HP})
      <span class="bodypart-hint">— 그래프 위를 클릭하면 거리를 바꿀 수 있어요</span>
    </p>

    <div class="bodypart-layout">
      <div class="bodypart-figure">
        ${renderBodyFigureSVG(partInfo, refRange)}
      </div>
      <div class="bodypart-table">
        <h4>부위별 BTK</h4>
        <table>
          <thead>
            <tr><th>부위</th><th>데미지</th><th>BTK</th></tr>
          </thead>
          <tbody>
            ${Object.entries(BODY_PART_MULTIPLIERS).map(([key, def]) => {
              const info = partInfo[key];
              if (info.dmg == null) {
                return `<tr><td>${def.label}</td><td class="muted">배율 없음</td><td>-</td></tr>`;
              }
              const btk = Math.ceil(HUNTER_HP / info.dmg);
              const ohk = info.dmg >= HUNTER_HP;
              return `<tr>
                <td>${def.label}</td>
                <td>${info.dmg}</td>
                <td class="${ohk ? "ohk" : ""}">${btk}발${ohk ? " (OHK)" : ""}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
        <p class="bodypart-note">
          ※ 머리 명중은 무조건 즉사이므로 별도 표시하지 않습니다.
        </p>
      </div>
    </div>
  `;

  overlay.hidden = false;

  document.getElementById("bodypart-close-btn").addEventListener("click", closeBodyPartView);
  overlay.addEventListener("click", (e) => {
    if (e.target.id === "bodypart-overlay") closeBodyPartView();
  });
}

function closeBodyPartView() {
  document.getElementById("bodypart-overlay").hidden = true;
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

      <!-- 가슴 -->
      <text x="510" y="420" class="body-num">${display("chest")}</text>

      <!-- 팔 (좌우 동일 값) -->
      <text x="335" y="430" class="body-num">${display("arm")}</text>
      <text x="685" y="430" class="body-num">${display("arm")}</text>

      <!-- 배 -->
      <text x="510" y="660" class="body-num">${display("belly")}</text>

      <!-- 하체 (좌우 동일 값) -->
      <text x="430" y="900" class="body-num">${display("lower")}</text>
      <text x="590" y="900" class="body-num">${display("lower")}</text>
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
  const baseStats = item.stats;
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

    <div class="detail-meta-row">
      ${item.price != null ? `<span>가격 <b>$${item.price}</b></span>` : ""}
      <span>칸수 <b>${item.slotSize ?? "?"}</b></span>
      ${item.updateAdded ? `<span class="detail-update">${item.updateAdded}</span>` : ""}
    </div>

    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="detail-img" onerror="this.style.display='none'">` : ""}

    <h4>Chamber</h4>
    <div class="detail-chamber">
      <div><span>Ammo Type</span><b>${ammo?.label ?? "-"}</b></div>
      <div><span>Loaded</span><b>${chamber.loaded ?? "-"}</b></div>
      <div><span>Extra</span><b>${overrideMark(chamber.extra, item.chamber?.extra)}</b></div>
    </div>

    <h4>Ammo Types</h4>
    <div class="ammo-tabs">${ammoTabs}</div>

    ${ammo?.description ? `<p class="detail-desc">${ammo.description}</p>` : ""}
    ${effectsHTML ? `<ul class="ammo-effects">${effectsHTML}</ul>` : ""}

    <h4>거리별 데미지</h4>
    <div class="detail-chart-wrap"><canvas id="detail-chart"></canvas></div>

    <h4>Stats</h4>
    <div class="detail-stats">
      ${statRow("Damage",              stats.damage,             baseStats.damage)}
      ${statRow("Drop Range",          stats.dropRange,          baseStats.dropRange)}
      ${statRow("Rate of Fire",        stats.rateOfFire,         baseStats.rateOfFire)}
      ${statRow("Cycle Time",          stats.cycleTime,          baseStats.cycleTime)}
      ${statRow("Spread",              stats.spread,             baseStats.spread)}
      ${statRow("Sway",                stats.sway,               baseStats.sway)}
      ${statRow("Vertical Recoil",     stats.verticalRecoil,     baseStats.verticalRecoil)}
      ${statRow("Reload Speed",        stats.reloadSpeed,        baseStats.reloadSpeed)}
      ${statRow("Muzzle Velocity",     stats.muzzleVelocity,     baseStats.muzzleVelocity)}
      ${statRow("Melee Damage",        stats.meleeLight,         baseStats.meleeLight)}
      ${statRow("Heavy Melee Damage",  stats.meleeHeavy,         baseStats.meleeHeavy)}
      ${statRow("Stamina Consumption", stats.staminaConsumption, baseStats.staminaConsumption)}
    </div>

    <button id="detail-add-compare-btn" type="button" class="compare-btn ${inCompare ? "added" : ""}">
      ${inCompare ? "✓ 비교 목록에 추가됨 (클릭하여 제거)" : "+ 비교 목록에 추가"}
    </button>
    <button id="detail-show-bodyparts-btn" type="button" class="bodyparts-btn">
      🎯 부위별 데미지 자세히 보기
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
function buildFalloffDataset(item, ammoId, color) {
  const { stats, ammo } = resolveWeaponWithAmmo(item, ammoId);
  if (!ammo || !ammo.falloff || ammo.falloff.length === 0) return null;

  const baseDmg = stats.damage ?? 0;
  const keypoints = ammo.falloff;
  const maxRange = keypoints[keypoints.length - 1][0];

  // 키포인트 거리값 Set (O(1) 조회용)
  const keypointRanges = new Set(keypoints.map(([r]) => r));

  // 1m 단위로 보간 데이터 생성 (그래프 표시 범위 200m까지만)
  const dataMax = Math.min(maxRange, 200);
  const data = [];
  for (let r = 0; r <= dataMax; r++) {
    const dmg = Math.round(baseDmg * interpolateFalloff(keypoints, r));
    data.push({ x: r, y: dmg });
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
    // 점을 키포인트에만 보이게: 키포인트면 3px, 아니면 0
    pointRadius: (ctx) => keypointRanges.has(ctx.parsed?.x) ? 3 : 0,
    // 마우스 hover 시에도 키포인트만 강조
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
  const ds = buildFalloffDataset(item, ammoId, "#f0a445");
  if (!ds) {
    canvas.outerHTML = `<p class="empty-msg">거리별 데이터 없음</p>`;
    return;
  }
  ds.fill = true;
  ds.backgroundColor = "rgba(240, 164, 69, 0.15)";

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
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      x: { type: "linear", min: 0, max: 200,
           title: { display: true, text: xLabel, color: "#aba894" },
           ticks: { color: "#aba894" }, grid: { color: "rgba(77, 86, 64, 0.3)" } },
      y: { beginAtZero: true, title: { display: true, text: yLabel, color: "#aba894" },
           ticks: { color: "#aba894" }, grid: { color: "rgba(77, 86, 64, 0.3)" } },
    },
  };
}

// BTK 가이드 라인 플러그인 (2BTK / OHK 가로선)
const btkLinesPlugin = {
  id: "btkLines",
  afterDatasetsDraw(chart) {
    const opts = chart.options.btkLines || {};
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.y) return;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.font = "11px Inter, sans-serif";
    ctx.textBaseline = "middle";
    drawGuideLine(ctx, scales, chartArea, 75, "rgba(123, 160, 196, 0.7)", "2BTK · 75");
    if (opts.showOHK) {
      drawGuideLine(ctx, scales, chartArea, 150, "rgba(194, 91, 77, 0.8)", "OHK · 150");
    }
    ctx.restore();
  },
};

// 기준 거리 세로선 플러그인 (그래프 클릭 시 표시)
const refRangePlugin = {
  id: "refRange",
  afterDatasetsDraw(chart) {
    const opts = chart.options.btkLines || {};
    const r = opts.refRange;
    if (r == null) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x) return;
    if (r < scales.x.min || r > scales.x.max) return;

    const xPixel = scales.x.getPixelForValue(r);
    // 해당 거리의 데이터 포인트 데미지 찾기
    const ds = chart.data.datasets[0];
    const point = ds?.data.find((d) => d.x === r);
    const dmgText = point ? ` · ${point.y} 데미지` : "";

    ctx.save();
    ctx.strokeStyle = "rgba(240, 164, 69, 0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xPixel, chartArea.top);
    ctx.lineTo(xPixel, chartArea.bottom);
    ctx.stroke();

    // 상단에 라벨
    ctx.fillStyle = "rgba(240, 164, 69, 0.95)";
    ctx.font = "12px Inter, sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = xPixel > chartArea.right - 100 ? "right" : "left";
    const labelX = xPixel > chartArea.right - 100 ? xPixel - 6 : xPixel + 6;
    ctx.fillText(`${r}m${dmgText}`, labelX, chartArea.top + 4);
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
const COMPARE_COLORS = ["#f0a445", "#5c8a63", "#c25b4d", "#7ba0c4", "#b48ec4", "#d4c25e", "#c4865c"];

function renderAnalysis() {
  const listEl = document.getElementById("compare-weapon-list");
  const chartWrap = document.getElementById("compare-chart-wrap");
  if (state.charts.compare) { state.charts.compare.destroy(); state.charts.compare = null; }

  if (state.compareEntries.length === 0) {
    listEl.innerHTML = `<p class="empty-msg">비교할 항목이 없습니다. DB 검색 → 무기 클릭 → 탄약 선택 → "비교 목록에 추가"를 눌러주세요.</p>`;
    chartWrap.innerHTML = "";
    return;
  }

  listEl.innerHTML = "";
  state.compareEntries.forEach((entry, idx) => {
    const item = ITEMS.find((i) => i.id === entry.weaponId);
    const ammo = AMMO_TYPES[entry.ammoId];
    if (!item || !ammo) return;
    const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
    const chip = document.createElement("div");
    chip.className = "compare-chip";
    chip.style.borderColor = color;
    chip.innerHTML = `
      <span class="compare-swatch" style="background:${color}"></span>
      <span>${item.name} · ${ammo.label}</span>
      <button class="slot-clear-btn" type="button">✕</button>
    `;
    chip.querySelector(".slot-clear-btn").addEventListener("click", () => {
      state.compareEntries.splice(idx, 1);
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
}

// -------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);
