/* =========================================================================
   data.js
   -------------------------------------------------------------------------
   이 파일이 "유일하게 손대야 하는" 설정 파일입니다.

   - 새 카테고리(예: 방어구)를 추가하고 싶으면 → 아래 CATEGORIES 객체에
     한 항목만 추가하면 됩니다. index.html이나 app.js는 건드릴 필요 없습니다.
     (검색 필터 버튼, 로드아웃 슬롯이 자동으로 생깁니다)

   - 실제 아이템(무기/도구/소모품/특성)을 추가하고 싶으면 → 아래 ITEMS
     배열에 한 항목만 추가하면 됩니다.

   ⚠️ 주의: ITEMS 안의 데이터는 전부 "예시(placeholder)"입니다.
   실제 헌트 쇼다운 스탯/효과는 패치마다 바뀌기 때문에, 확인되지 않은 값을
   임의로 채워넣지 않았습니다. 이름에 [예시] 표시와 meta에 "TODO"가 있는
   값들은 실제 데이터로 교체해주세요.
   ========================================================================= */

// -------------------------------------------------------------------------
// 1. TAGS — 분석(analysis) 탭에서 쓰는 "플레이스타일" 태그 정의
//    아이템마다 이 태그키를 가중치(1~3)로 매겨두면, 로드아웃에 들어간
//    아이템들의 태그를 합산해서 강점/약점을 자동으로 계산합니다.
// -------------------------------------------------------------------------
const TAGS = {
  close_range:  { label: "근접전",        desc: "가까운 거리 교전에서의 강함" },
  long_range:   { label: "장거리 교전",   desc: "먼 거리 교전에서의 강함" },
  mobility:     { label: "기동성",        desc: "이동 속도, 로테이션, 빠른 재포지셔닝" },
  stealth:      { label: "은신/탐지회피", desc: "발소리, 시야, 들키지 않고 움직이는 능력" },
  detection:    { label: "탐지/정보",     desc: "상대 위치를 파악하는 능력" },
  sustain:      { label: "회복/지속력",   desc: "체력 회복, 장기전에서의 생존력" },
  burst_damage: { label: "순간 화력",     desc: "한 번에 큰 피해를 주는 능력" },
  utility:      { label: "유틸리티",      desc: "교전 외적인 상황 대응 능력(문/소리/시야 등)" },
  area_control: { label: "광역 제어",     desc: "공간/구역을 장악하거나 봉쇄하는 능력" },
};

// -------------------------------------------------------------------------
// 2. CATEGORIES — DB의 카테고리(무기/도구/소모품/특성 등)와
//    로드아웃 빌더에서 그 카테고리가 어떤 슬롯으로 쓰이는지 정의
//
//    loadoutSlots 안의 slotDef:
//      - slotKey : 내부에서 쓰는 식별자 (영문, 고유해야 함)
//      - label   : 화면에 보일 이름
//      - max     : 슬롯 개수
//                  - 숫자(1, 2, 4 등): 그 개수만큼 "고정 슬롯"이 생김
//                    (예: 주무기 1개, 도구 2개)
//                  - null: 개수 제한 없는 "목록형" (예: 특성처럼 여러 개 추가 가능)
// -------------------------------------------------------------------------
const CATEGORIES = {
  weapon: {
    label: "무기",
    icon: "🔫",
    loadoutSlots: [
      { slotKey: "primary", label: "주무기", max: 1 },
      { slotKey: "secondary", label: "보조무기", max: 1 },
    ],
  },
  tool: {
    label: "도구",
    icon: "🧰",
    loadoutSlots: [
      { slotKey: "tool", label: "도구", max: 2 },
    ],
  },
  consumable: {
    label: "소모품",
    icon: "🧪",
    loadoutSlots: [
      { slotKey: "consumable", label: "소모품", max: 4 },
    ],
  },
  trait: {
    label: "특성",
    icon: "⭐",
    loadoutSlots: [
      { slotKey: "trait", label: "특성", max: null },
    ],
  },

  // ── 카테고리를 새로 추가하고 싶을 때는 이렇게 통째로 하나만 추가하면 됩니다 ──
  // armor: {
  //   label: "방어구",
  //   icon: "🛡️",
  //   loadoutSlots: [
  //     { slotKey: "armor", label: "방어구", max: 1 },
  //   ],
  // },
};

// -------------------------------------------------------------------------
// 3. ITEMS — 실제 DB에 들어가는 아이템 목록 (지금은 전부 예시 데이터)
//
//    아이템 공통 스키마:
//    {
//      id: "고유 id (영문/숫자, 절대 중복되면 안 됨)",
//      category: CATEGORIES 의 key 중 하나 ("weapon" | "tool" | "consumable" | "trait" | ...),
//      name: "화면에 보일 이름",
//      description: "설명 텍스트",
//      tags: { 태그키: 가중치(1~3), ... },   // 분석(analysis)에 사용
//      meta: { ...카테고리별 부가 정보 (실제 스탯 등, 자유 형식) }
//    }
// -------------------------------------------------------------------------
const ITEMS = [
  // ---------------- 무기 (예시) ----------------
  {
    id: "weapon_example_long",
    category: "weapon",
    name: "[예시] 장거리형 라이플",
    description: "예시 데이터입니다. 실제 무기명/스탯으로 교체해주세요.",
    tags: { long_range: 3, burst_damage: 2 },
    meta: { ammoType: "TODO", slotSize: "long", damageFalloff: "TODO", fireRate: "TODO" },
  },
  {
    id: "weapon_example_close",
    category: "weapon",
    name: "[예시] 근접형 샷건",
    description: "예시 데이터입니다. 실제 무기명/스탯으로 교체해주세요.",
    tags: { close_range: 3, burst_damage: 3, mobility: 1 },
    meta: { ammoType: "TODO", slotSize: "medium", damageFalloff: "TODO", fireRate: "TODO" },
  },

  // ---------------- 도구 (예시) ----------------
  {
    id: "tool_example_detection",
    category: "tool",
    name: "[예시] 탐지용 도구",
    description: "예시 데이터입니다. 실제 도구명/효과로 교체해주세요.",
    tags: { detection: 3, utility: 1 },
    meta: { consumeOnUse: false },
  },
  {
    id: "tool_example_mobility",
    category: "tool",
    name: "[예시] 기동용 도구",
    description: "예시 데이터입니다. 실제 도구명/효과로 교체해주세요.",
    tags: { mobility: 3 },
    meta: { consumeOnUse: true },
  },

  // ---------------- 소모품 (예시) ----------------
  {
    id: "consumable_example_heal",
    category: "consumable",
    name: "[예시] 회복용 소모품",
    description: "예시 데이터입니다. 실제 소모품명/효과로 교체해주세요.",
    tags: { sustain: 3 },
    meta: { stackable: true, maxStack: 3 },
  },
  {
    id: "consumable_example_area",
    category: "consumable",
    name: "[예시] 광역형 소모품",
    description: "예시 데이터입니다. 실제 소모품명/효과로 교체해주세요.",
    tags: { area_control: 3, burst_damage: 1 },
    meta: { stackable: true, maxStack: 2 },
  },

  // ---------------- 특성 (예시) ----------------
  {
    id: "trait_example_stealth",
    category: "trait",
    name: "[예시] 은신 특성",
    description: "예시 데이터입니다. 실제 특성명/효과로 교체해주세요.",
    tags: { stealth: 3 },
    meta: { cost: "TODO" },
  },
  {
    id: "trait_example_sustain",
    category: "trait",
    name: "[예시] 생존 특성",
    description: "예시 데이터입니다. 실제 특성명/효과로 교체해주세요.",
    tags: { sustain: 2, mobility: 1 },
    meta: { cost: "TODO" },
  },
];
