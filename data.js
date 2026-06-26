/* =========================================================================
   data.js
   -------------------------------------------------------------------------
   헌트 쇼다운 DB의 모든 데이터를 정의하는 파일입니다.

   ⚠️ 주의: 아래 ITEMS 배열에 들어있는 항목들은 "예시(placeholder)" 데이터입니다.
   실제 헌트 쇼다운의 정확한 무기 스탯/특성 효과 등은 패치마다 바뀌고,
   제가 확인 없이 임의로 채워넣으면 잘못된 정보가 될 수 있어서
   일단 화면/검색/로드아웃/분석 기능이 정상 동작하는지 테스트할 수 있는
   "예시 데이터" 1~2개씩만 카테고리별로 넣어두었습니다.

   실제 데이터를 넣을 때는:
   1. id, category, name, slotType 은 필수
   2. tags 객체에 { 태그키: 가중치(1~3) } 형식으로 넣으면
      분석(analysis) 탭에서 자동으로 집계됩니다.
   ========================================================================= */

// 분석 탭에서 사용하는 "플레이스타일 태그" 정의
// key: 코드에서 쓰는 식별자, label: 화면에 보여줄 한글명, desc: 설명
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

// 카테고리 메타 정보 (UI 라벨, 로드아웃 슬롯 종류 등)
const CATEGORIES = {
  weapon:     { label: "무기",   icon: "🔫" },
  tool:       { label: "도구",   icon: "🧰" },
  consumable: { label: "소모품", icon: "🧪" },
  trait:      { label: "특성",   icon: "⭐" },
};

/**
 * 아이템 공통 스키마
 * {
 *   id: "unique_id",
 *   category: "weapon" | "tool" | "consumable" | "trait",
 *   name: "이름",
 *   slotType: 로드아웃에서 어떤 슬롯에 들어가는지
 *      - weapon: "primary" | "secondary"
 *      - tool: "tool"
 *      - consumable: "consumable"
 *      - trait: "trait"
 *   description: "설명 텍스트",
 *   tags: { tagKey: weight(1~3), ... },   // 분석에 사용
 *   meta: { ...카테고리별 부가 정보 (실제 스탯 등) }
 * }
 */
const ITEMS = [
  // ---------------- 무기 (예시) ----------------
  {
    id: "weapon_example_long",
    category: "weapon",
    name: "[예시] 장거리형 라이플",
    slotType: "primary",
    description: "예시 데이터입니다. 실제 무기명/스탯으로 교체해주세요.",
    tags: { long_range: 3, burst_damage: 2 },
    meta: { ammoType: "TODO", slotSize: "long", damageFalloff: "TODO", fireRate: "TODO" },
  },
  {
    id: "weapon_example_close",
    category: "weapon",
    name: "[예시] 근접형 샷건",
    slotType: "secondary",
    description: "예시 데이터입니다. 실제 무기명/스탯으로 교체해주세요.",
    tags: { close_range: 3, burst_damage: 3, mobility: 1 },
    meta: { ammoType: "TODO", slotSize: "medium", damageFalloff: "TODO", fireRate: "TODO" },
  },

  // ---------------- 도구 (예시) ----------------
  {
    id: "tool_example_detection",
    category: "tool",
    name: "[예시] 탐지용 도구",
    slotType: "tool",
    description: "예시 데이터입니다. 실제 도구명/효과로 교체해주세요.",
    tags: { detection: 3, utility: 1 },
    meta: { consumeOnUse: false },
  },
  {
    id: "tool_example_mobility",
    category: "tool",
    name: "[예시] 기동용 도구",
    slotType: "tool",
    description: "예시 데이터입니다. 실제 도구명/효과로 교체해주세요.",
    tags: { mobility: 3 },
    meta: { consumeOnUse: true },
  },

  // ---------------- 소모품 (예시) ----------------
  {
    id: "consumable_example_heal",
    category: "consumable",
    name: "[예시] 회복용 소모품",
    slotType: "consumable",
    description: "예시 데이터입니다. 실제 소모품명/효과로 교체해주세요.",
    tags: { sustain: 3 },
    meta: { stackable: true, maxStack: 3 },
  },
  {
    id: "consumable_example_area",
    category: "consumable",
    name: "[예시] 광역형 소모품",
    slotType: "consumable",
    description: "예시 데이터입니다. 실제 소모품명/효과로 교체해주세요.",
    tags: { area_control: 3, burst_damage: 1 },
    meta: { stackable: true, maxStack: 2 },
  },

  // ---------------- 특성 (예시) ----------------
  {
    id: "trait_example_stealth",
    category: "trait",
    name: "[예시] 은신 특성",
    slotType: "trait",
    description: "예시 데이터입니다. 실제 특성명/효과로 교체해주세요.",
    tags: { stealth: 3 },
    meta: { cost: "TODO" },
  },
  {
    id: "trait_example_sustain",
    category: "trait",
    name: "[예시] 생존 특성",
    slotType: "trait",
    description: "예시 데이터입니다. 실제 특성명/효과로 교체해주세요.",
    tags: { sustain: 2, mobility: 1 },
    meta: { cost: "TODO" },
  },
];
