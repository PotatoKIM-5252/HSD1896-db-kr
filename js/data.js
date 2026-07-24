/* =========================================================================
   data.js
   -------------------------------------------------------------------------
   ▣ 손대야 할 곳은 이 파일뿐입니다.

   ▣ 구조
     1) HUNTER_HP         : 헌터 체력 (BTK 계산 기준값)
     2) BODY_PART_MULTIPLIERS : 부위별 데미지 배율 (자세히 보기에서 사용)
     3) CATEGORIES        : 카테고리(무기/도구/소모품/특성)와 로드아웃 슬롯 정의
     4) WEAPON_FILTERS    : 무기 필터(칸수/탄종/탄약효과) 옵션
     5) AMMO_TYPES        : 탄약 객체 — 거리 곡선과 무기 스탯 보정값을 보관
     6) ITEMS             : 실제 아이템(무기/도구/소모품/특성) 데이터
   ========================================================================= */

// -------------------------------------------------------------------------
// 1. HUNTER_HP — BTK 계산 기준
// -------------------------------------------------------------------------
const HUNTER_HP = 150;

// -------------------------------------------------------------------------
// 2. BODY_PART_MULTIPLIERS — 부위별 데미지 배율
//
//    ▣ 중요: 무기의 "표기 데미지"는 10m 거리, 가슴(×1.3) 맞췄을 때의 값입니다.
//      따라서 부위 데미지를 구할 때는
//        부위 데미지 = 표기데미지 × (부위배율 / 가슴배율 1.3)
//      예) Frontier 73C 표기 110 → 배: 110×(1.2/1.3)=102, 팔: 110×(0.9/1.3)=76, 하체: 110×(0.8/1.3)=68
//
//    ▣ 머리는 무조건 즉사라서 따로 표시하지 않습니다.
// -------------------------------------------------------------------------
const CHEST_MULTIPLIER = 1.3;   // 표기 데미지의 기준 (가슴 배율)

const BODY_PART_MULTIPLIERS = {
  chest:  { label: "가슴",  multiplier: 1.3 },
  arm:    { label: "팔",    multiplier: 0.9 },
  belly:  { label: "배",    multiplier: 1.2 },
  lower:  { label: "하체",  multiplier: 0.8 },
};

// -------------------------------------------------------------------------
// 1. CATEGORIES
// -------------------------------------------------------------------------
const CATEGORIES = {
  weapon: {
    label: "무기",
    icon: "🔫",
    image: "images/ui/categories/weapon.png",
    loadoutSlots: [
      // 주슬롯: 기본은 1개지만, 3칸 미만(권총 등) 무기를 넣으면 보조 슬롯과 동일하게
      // 옆에 한 칸이 더 생겨 소형 무기 2정을 나란히 넣을 수 있음(듀얼 구성).
      { slotKey: "primary", label: "주슬롯", max: 2 },
      // 소형 슬롯: 기본은 1개지만, 3칸 미만(권총 등) 무기를 넣으면 옆에 한 칸이 더 생겨
      // 소형 무기 2정을 나란히 넣을 수 있음(실제 게임의 "Small Slots" 듀얼 권총 구성).
      // 렌더링/빈칸 노출 조건은 js/app.js의 renderWeaponSlotsRow에서 처리.
      { slotKey: "secondary", label: "보조 슬롯", max: 2 },
    ],
  },
  tool: {
    label: "도구",
    icon: "🧰",
    image: "images/ui/categories/tool.png",
    // 도구+소모품이 "필드 장비" 8칸을 공유해서 나눠 씀 (도구만 8개, 소모품만 8개, 혹은 섞어서도 가능)
    loadoutSlots: [{ slotKey: "tool", label: "도구", max: null, sharedGroup: "field", sharedCapacity: 8, allowDuplicates: true }],
  },
  consumable: {
    label: "소모품",
    icon: "🧪",
    image: "images/ui/categories/consumable.png",
    // 소모품은 같은 아이템을 여러 개 챙길 수 있으므로 중복 허용, 하나당 공유 풀에서 1칸씩 차감
    loadoutSlots: [{ slotKey: "consumable", label: "소모품", max: null, sharedGroup: "field", sharedCapacity: 8, allowDuplicates: true }],
  },
  trait: {
    label: "특성",
    icon: "⭐",
    image: "images/ui/categories/trait.png",
    loadoutSlots: [{ slotKey: "trait", label: "특성", max: null }],
  },
};

// -------------------------------------------------------------------------
// 2. WEAPON_FILTERS
//
//    각 option에 image 필드를 넣으면, 검색 필터 칩이 텍스트 대신
//    그 이미지로 자동 표시됩니다. (image가 없으면 그냥 텍스트로 표시)
//    예: { value: "explosive", label: "폭발탄", image: "images/ui/ammo_explosive.png" }
// -------------------------------------------------------------------------
const WEAPON_FILTERS = {
  slotSize: {
    label: "무기 칸수",
    options: [
      { value: 1, label: "1칸", image: "images/ui/slot_1.png" },
      { value: 2, label: "2칸", image: "images/ui/slot_2.png" },
      { value: 3, label: "3칸", image: "images/ui/slot_3.png" },
      { value: 4, label: "4칸", image: "images/ui/slot_4.png" },
      { value: 5, label: "5칸", image: "images/ui/slot_5.png" },
    ],
  },
  ammoCategory: {
    label: "분류",
    options: [
      { value: "compact", label: "소형탄", image: "images/ui/ammo_compact.webp" },
      { value: "medium",  label: "중형탄", image: "images/ui/ammo_medium.webp" },
      { value: "long",    label: "롱탄",   image: "images/ui/ammo_long.webp" },
      { value: "shotgun", label: "샷건탄", image: "images/ui/ammo_shotgun.webp" },
      { value: "special", label: "특수탄", image: "images/ui/ammo_special.webp" },
      { value: "melee",   label: "근접무기", image: "images/ui/ammo_melee.webp" },
    ],
  },
  ammoEffect: {
    label: "탄약 종류",
    options: [
      { value: "explosive",     label: "폭발탄",       image: "images/ui/ammo_effect_icons/explosive.png" },
      { value: "bleed",         label: "출혈탄",       image: "images/ui/ammo_effect_icons/bleed.png" },
      { value: "subsonic",      label: "아음속탄",     image: "images/ui/ammo_effect_icons/subsonic.png" },
      { value: "poison",        label: "중독탄",       image: "images/ui/ammo_effect_icons/poison.png" },
      { value: "high_velocity", label: "고속탄",       image: "images/ui/ammo_effect_icons/high_velocity.png" },
      { value: "full_metal",    label: "전피갑탄(FMJ)", image: "images/ui/ammo_effect_icons/full_metal.png" },
      { value: "incendiary",    label: "소이탄",       image: "images/ui/ammo_effect_icons/incendiary.png" },
      { value: "spitzer",       label: "스피처",       image: "images/ui/ammo_effect_icons/spitzer.png" },
      { value: "flare",         label: "신호탄",       image: "images/ui/ammo_effect_icons/flare.png" },
      { value: "slug",          label: "슬러그",       image: "images/ui/ammo_effect_icons/slug.png" },
      { value: "pennyshot",     label: "페니샷",       image: "images/ui/ammo_effect_icons/pennyshot.png" },
      { value: "flechette",     label: "플리셰트",     image: "images/ui/ammo_effect_icons/flechette.png" },
      { value: "dragonbreath",  label: "드래곤브레스", image: "images/ui/ammo_effect_icons/dragonbreath_shell.png" },
      // 세열탄(Fragmentation)은 별도 항목 없음 — 실제 효과가 출혈+폭발+소이가 섞여있어서,
      // 해당 탄약을 쓰는 무기가 추가되면 ammoEffects에 "bleed","explosive","incendiary" 3개를 함께 태그할 것.
      // 철조망(Concertina Arrows)도 별도 항목 없음 — "Causes bleeding on Hunters"라 출혈탄과 동일 효과.
      // 해당 탄약을 쓰는 무기가 추가되면 ammoEffects에 "bleed"를 태그할 것.
      // ⚠ 철환탄(ball_shot)/혼돈탄(chaos)/질식탄(choke)/샷볼트(shot_bolt)는 샷건과 무관한 특수무기 1개씩만 쓰는
      //    항목이라 필터 목록에서 제외함 (Bomb Launcher/Lance, Hand Crossbow, Crossbow). 데이터 자체의 effect 태그는 유지.
    ],
  },
};

// -------------------------------------------------------------------------
// 2-1. TOOL_FILTERS — 도구(category:"tool") 전용 검색 필터
//
//   출처: huntshowdown.wiki.gg/wiki/Tools ✅ [확인됨]
//
//   toolClass(분류): 위키의 "List of Tools" 섹션 분류(Distraction/Healing/Fire·Light/
//     Melee/Throwable Melee/Pocket pistols/Traps/Others)를 그대로 옮김. 아이템당 1개만 배정
//     (weaponClass처럼 단일 값 — 아이템 필드명은 toolClass).
//     ⚠ 이 8분류는 위키가 "실제 인게임 분류와는 다르고, 더 나은 그룹핑을 위한 것"이라고
//     명시한 자체 편집 분류입니다(인게임 Arsenal 분류는 아래 toolTags 11종).
//
//   toolTags(태그): 위키가 실제로 "Tool Types"(인게임 Arsenal 필터)로 쓰는 11종.
//     한 아이템이 여러 태그를 동시에 가질 수 있음(ammoEffects처럼 배열, 아이템 필드명은 toolTags).
//     아이콘은 위키의 실제 Icon_Filter_*.png 원본을 그대로 사용.
// -------------------------------------------------------------------------
const TOOL_FILTERS = {
  toolClass: {
    label: "분류",
    options: [
      { value: "distraction",     label: "교란" },
      { value: "healing",         label: "치유" },
      { value: "fire_light",      label: "불/광원" },
      { value: "melee",           label: "근접무기" },
      { value: "throwable_melee", label: "투척무기" },
      { value: "pocket_pistol",   label: "포켓피스톨" },
      { value: "trap",            label: "함정" },
      { value: "other",           label: "기타" },
    ],
  },
  toolTags: {
    label: "태그",
    options: [
      { value: "throwable", label: "투척",   image: "images/ui/tool_effect_icons/throwable.png" },
      { value: "placeable", label: "설치",   image: "images/ui/tool_effect_icons/placeable.png" },
      { value: "rending",   label: "열상",   image: "images/ui/tool_effect_icons/rending.png" },
      { value: "healing",   label: "치유",   image: "images/ui/tool_effect_icons/healing.png" },
      { value: "noise",     label: "소음",   image: "images/ui/tool_effect_icons/noise.png" },
      { value: "explosive", label: "폭발",   image: "images/ui/tool_effect_icons/explosive.png" },
      { value: "fire",      label: "화염",   image: "images/ui/tool_effect_icons/fire.png" },
      { value: "poison",    label: "중독",   image: "images/ui/tool_effect_icons/poison.png" },
      { value: "vision",    label: "시야",   image: "images/ui/tool_effect_icons/vision.png" },
      { value: "light",     label: "광원",   image: "images/ui/tool_effect_icons/light.png" },
      { value: "melee",     label: "근접",   image: "images/ui/tool_effect_icons/melee.png" },
    ],
  },
};

// -------------------------------------------------------------------------
// 2-2. CONSUMABLE_FILTERS — 소모품(category:"consumable") 전용 검색 필터
//
//   출처: huntshowdown.wiki.gg/wiki/Consumables ✅ [확인됨]
//
//   consumableClass(분류): 위키의 "List of Consumables" 섹션 분류(Resupply/Fire·Light/
//     Explosion/Poison/Distraction/Effects over time/Healing/Beetle/Others)를 그대로 옮김.
//     아이템당 1개만 배정. ⚠ 이 9분류도 도구와 마찬가지로 위키가 "실제 인게임 분류와는
//     다르고 더 나은 그룹핑을 위한 것"이라고 명시한 자체 편집 분류입니다.
//
//   consumableTags(태그): 위키가 실제로 "Consumable Types"(인게임 Arsenal 필터)로 쓰는 10종.
//     도구(Tool)와 태그 자체는 완전히 동일(아이콘도 동일 파일 재사용) — 다만 "근접(Melee)"
//     태그만 위키가 명시적으로 "도구 전용, 소모품에는 없음"이라고 밝혀서 제외함.
// -------------------------------------------------------------------------
const CONSUMABLE_FILTERS = {
  consumableClass: {
    label: "분류",
    options: [
      { value: "resupply",   label: "재보급" },
      { value: "fire_light", label: "불/광원" },
      { value: "explosive",  label: "폭발" },
      { value: "poison",     label: "독" },
      { value: "distraction", label: "교란" },
      { value: "over_time",  label: "지속효과" },
      { value: "healing",    label: "치유" },
      { value: "beetle",     label: "딱정벌레" },
      { value: "other",      label: "기타" },
      // ⚠ 타로 카드는 위키에서 9분류와 별개인 독립 섹션("2.2 Tarot Cards")으로 다룸 —
      // 그 구조를 그대로 반영해 10번째 값으로 추가함(사용자에게 확인받은 9분류 자체를 바꾼 것은 아님).
      { value: "tarot",      label: "타로 카드" },
    ],
  },
  consumableTags: {
    label: "태그",
    options: [
      { value: "throwable", label: "투척", image: "images/ui/tool_effect_icons/throwable.png" },
      { value: "placeable", label: "설치", image: "images/ui/tool_effect_icons/placeable.png" },
      { value: "rending",   label: "열상", image: "images/ui/tool_effect_icons/rending.png" },
      { value: "healing",   label: "치유", image: "images/ui/tool_effect_icons/healing.png" },
      { value: "noise",     label: "소음", image: "images/ui/tool_effect_icons/noise.png" },
      { value: "explosive", label: "폭발", image: "images/ui/tool_effect_icons/explosive.png" },
      { value: "fire",      label: "화염", image: "images/ui/tool_effect_icons/fire.png" },
      { value: "poison",    label: "중독", image: "images/ui/tool_effect_icons/poison.png" },
      { value: "vision",    label: "시야", image: "images/ui/tool_effect_icons/vision.png" },
      { value: "light",     label: "광원", image: "images/ui/tool_effect_icons/light.png" },
      // ⚠ "melee" 태그는 위키에 "도구 전용"이라고 명시되어 있어 제외함.
    ],
  },
};

// -------------------------------------------------------------------------
// 2-3. TRAIT_FILTERS — 특성(category:"trait") 전용 검색 필터
//
//   출처: huntshowdown.wiki.gg/wiki/Traits ✅ [확인됨]
//
//   traitClass(분류): 위키가 실제 인게임 특성 메뉴에서 쓰는 4대 분류(Offensive/Defensive/
//     Movement/Supportive) 그대로. 아이템당 1개만 배정.
//
//   traitTags(태그): 위키의 "Type"(부가 특성 종류) 4종 — Burn(1회용: 발동 즉시 소모되어
//     사라짐)/Scarce(희소: 상점 구매 불가, 월드에서만 획득)/Solo(1인: 팀 없이 솔로로 플레이할 때만
//     추가 효과 발동)/Catalyst(촉매제: Catalyst 특성을 함께 보유했을 때만 추가 효과 발동).
//     한 특성이 여러 태그를 동시에 가질 수 있음(예: Remedy = Burn+Scarce).
// -------------------------------------------------------------------------
const TRAIT_FILTERS = {
  traitClass: {
    label: "분류",
    options: [
      { value: "attack",   label: "공격", image: "images/ui/trait_icons/attack.png" },
      { value: "defense",  label: "방어", image: "images/ui/trait_icons/defense.png" },
      { value: "movement", label: "이동", image: "images/ui/trait_icons/movement.png" },
      { value: "support",  label: "보조", image: "images/ui/trait_icons/support.png" },
    ],
  },
  traitTags: {
    label: "태그",
    options: [
      { value: "burn",     label: "1회용", image: "images/ui/trait_icons/burn.png" },
      { value: "scarce",   label: "희소", image: "images/ui/trait_icons/scarce.png" },
      { value: "solo",     label: "1인", image: "images/ui/trait_icons/solo.png" },
      { value: "catalyst", label: "촉매제", image: "images/ui/trait_icons/catalyst.png" },
    ],
  },
};

// -------------------------------------------------------------------------
// 3. AMMO_TYPES — 탄약 객체
//
//   스키마:
//   "ammo_id": {
//     label: "화면에 표시할 이름",
//     category: "compact" | "medium" | "long" | "shotgun" | "special",
//     effect: 효과(있을 때만, WEAPON_FILTERS.ammoEffect.options 의 value)
//     icon: "🟫" 같은 이모지 (이미지 경로로 바꿔도 됨)
//     description: "탄약 설명"
//     cost: 50,
//
//     // 거리별 데미지 곡선 — [거리(m), 배율(0~1)] 키포인트.
//     // 직선으로 이어지므로 꺾이는 지점만 적으면 됩니다.
//     falloff: [
//       [0,   1.00],   // 0m 에서 100% 데미지
//       [20,  1.00],   // 20m까지 평탄 유지 (effective range)
//       [80,  0.65],   // 80m에서 65%로 꺾임
//       [200, 0.40],
//       [300, 0.25],   // 최대 사거리에서의 최소값
//     ],
//
//     // 이 탄약을 사용할 때 무기 스탯을 덮어쓰는 값들 (이미지에서 "X → Y" 로 표기되던 부분)
//     statOverrides: {
//       damage: 104,            // 기본 데미지가 바뀌면 여기에
//       muzzleVelocity: 330,    // 탄속이 바뀌면 여기에
//       verticalRecoil: 8,
//       dropRange: 125,
//       ammoExtra: 15,          // 예비탄 수가 바뀌면 여기에
//     },
//
//     // 화면에 보여줄 추가 효과 텍스트(태그 형태)
//     specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
//
//     // (선택) 위 specialEffects가 "이 거리 이내에서만" 발동하는 효과라면 적어주세요.
//     // 적지 않으면 항상 발동하는 것으로 간주합니다. (자세히 보기의 "이 거리에서 적용되는 효과" 칸에 반영됨)
//     effectMaxRange: 20,
//   }
// -------------------------------------------------------------------------
const AMMO_TYPES = {

  // ── Compact 탄종 ──────────────────────────────────────────────────────
  compact: {
    label: "Compact",
    category: "compact",
    isBase: true,                // 기본탄 (특수탄이 아님)
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {},
  },

  compact_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.6182],
      [100, 0.5273],
    ],
    statOverrides: {
      dropRange: 125,
      verticalRecoil: 8,
      muzzleVelocity: 330,
    },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  compact_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6037],
      [100, 0.4999],
    ],
    statOverrides: {
      damage: 104,
      dropRange: 160,
      verticalRecoil: 8,
      muzzleVelocity: 500,
      ammoExtra: 15,
    },
  },

  compact_incendiary: {
    label: "소이탄",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {},
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,  // 20m 이내에서만 발화 효과 발동 (그 이상은 효과 미적용으로 가정)
  },

  compact_poison: {
    label: "중독탄",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {},
    specialEffects: ["중급 중독 효과 발생"],
  },

  compact_subsonic: {
    label: "아음속탄",
    category: "compact",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6179],
      [100, 0.5012],
    ],
    statOverrides: {
      dropRange: 110,
      muzzleVelocity: 263,
      ammoExtra: 34,
    },
    specialEffects: ["발사음 감소"],
  },

  // ── Infantry 73L 전용 탄약 (같은 Compact 탄종이라 낙하 곡선은 Frontier 73C와 동일하게 재사용) ──
  infantry73l_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {},
  },

  infantry73l_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.6182],
      [100, 0.5273],
    ],
    statOverrides: {
      dropRange: 130,
      verticalRecoil: 5,
      muzzleVelocity: 330,
    },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  infantry73l_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6037],
      [100, 0.4999],
    ],
    statOverrides: {
      damage: 104,
      dropRange: 170,
      verticalRecoil: 5,
      muzzleVelocity: 525,
      ammoExtra: 13,
    },
  },

  infantry73l_incendiary: {
    label: "소이탄",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {},
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,
  },

  infantry73l_poison: {
    label: "중독탄",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {},
    specialEffects: ["중급 중독 효과 발생"],
  },

  infantry73l_subsonic: {
    label: "아음속탄",
    category: "compact",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6179],
      [100, 0.5012],
    ],
    statOverrides: {
      dropRange: 115,
      muzzleVelocity: 263,
      ammoExtra: 24,
    },
    specialEffects: ["발사음 감소"],
  },

  // ── Marathon 전용 탄약 (실제 소스코드로 검증됨. 아음속탄 없음) ──
  marathon_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {},
  },

  marathon_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.6182],
      [100, 0.5273],
    ],
    statOverrides: {
      dropRange: 125,
      verticalRecoil: 9,
      muzzleVelocity: 360,
    },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  marathon_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6037],
      [100, 0.4999],
    ],
    statOverrides: {
      damage: 107,
      dropRange: 170,
      verticalRecoil: 9,
      muzzleVelocity: 555,
      ammoExtra: 16,
    },
  },

  marathon_incendiary: {
    label: "소이탄",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {},
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,
  },

  marathon_poison: {
    label: "중독탄",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {},
    specialEffects: ["중급 중독 효과 발생"],
  },


  // ── Ranger 73 / Vandal 73C / Bornheim No.3 / Conversion / LeMat / Nagant M1895 / New Army / Officer 전용 탄약 ──
  ranger73_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {  },
  },

  ranger73_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.6182],
      [100, 0.5273],
    ],
    statOverrides: { dropRange: 125, verticalRecoil: 6, muzzleVelocity: 330 },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  ranger73_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6037],
      [100, 0.4999],
    ],
    statOverrides: { damage: 104, dropRange: 160, verticalRecoil: 6, muzzleVelocity: 500, ammoExtra: 13 },
  },

  ranger73_incendiary: {
    label: "소이탄",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {  },
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,
  },

  ranger73_poison: {
    label: "중독탄",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  ranger73_subsonic: {
    label: "아음속탄",
    category: "compact",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6179],
      [100, 0.5012],
    ],
    statOverrides: { dropRange: 110, muzzleVelocity: 263, ammoExtra: 24 },
    specialEffects: ["발사음 감소"],
  },

  vandal73c_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {  },
  },

  vandal73c_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.6182],
      [100, 0.5273],
    ],
    statOverrides: { dropRange: 110, verticalRecoil: 11, muzzleVelocity: 310 },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  vandal73c_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6037],
      [100, 0.4999],
    ],
    statOverrides: { damage: 101, dropRange: 145, verticalRecoil: 12, muzzleVelocity: 470, ammoExtra: 14 },
  },

  vandal73c_incendiary: {
    label: "소이탄",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {  },
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,
  },

  vandal73c_poison: {
    label: "중독탄",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5018],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  vandal73c_subsonic: {
    label: "아음속탄",
    category: "compact",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6179],
      [100, 0.5012],
    ],
    statOverrides: { dropRange: 95, muzzleVelocity: 252, ammoExtra: 34 },
    specialEffects: ["발사음 감소"],
  },  bornheim_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5438],
      [60, 0.4695],
      [100, 0.4695],
    ],
    statOverrides: {  },
  },

  // ⚠ Bornheim No. 3 Match 전용 — 개머리판+연장총열/조준경으로 소총급 취급이 되면서
  //    낙하곡선도 권총군(bornheim_compact)이 아닌 공용 소총군 Compact 곡선을 사용.
  bornheim_match_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {  },
  },

  bornheim_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5535],
      [60, 0.4713],
      [100, 0.4713],
    ],
    statOverrides: { damage: 70, dropRange: 85, verticalRecoil: 7.5, muzzleVelocity: 455, ammoExtra: 10 },
  },

  bornheim_incendiary: {
    label: "소이탄",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5435],
      [60, 0.4736],
      [100, 0.4736],
    ],
    statOverrides: {  },
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,
  },

  bornheim_subsonic: {
    label: "아음속탄",
    category: "compact",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5392],
      [60, 0.4653],
      [100, 0.4653],
    ],
    statOverrides: { dropRange: 60, muzzleVelocity: 256, ammoExtra: 18 },
    specialEffects: ["발사음 감소"],
  },

  conversion_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5438],
      [60, 0.4695],
      [100, 0.4695],
    ],
    statOverrides: {  },
  },

  conversion_dumdum: {
    label: "덤덤탄(출혈)",
    category: "compact",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_compact_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5429],
      [60, 0.4671],
      [100, 0.4671],
    ],
    statOverrides: { dropRange: 70, muzzleVelocity: 270 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  conversion_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5473],
      [70, 0.4974],
      [100, 0.4974],
    ],
    statOverrides: { dropRange: 70, verticalRecoil: 6.5, muzzleVelocity: 270 },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  lemat_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5438],
      [60, 0.4695],
      [100, 0.4695],
    ],
    statOverrides: {  },
  },

  // ⚠ LeMat Carbine / Carbine Marksman 전용 — 개머리판+연장총열로 소총급 취급이 되면서
  //    낙하곡선도 권총군(lemat_compact)이 아닌 공용 소총군 Compact 곡선을 사용.
  lemat_carbine_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {  },
  },

  lemat_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5473],
      [70, 0.4974],
      [100, 0.4974],
    ],
    statOverrides: { dropRange: 70, verticalRecoil: 8, muzzleVelocity: 335 },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  lemat_incendiary: {
    label: "소이탄",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5435],
      [60, 0.4736],
      [100, 0.4736],
    ],
    statOverrides: {  },
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,
  },  nagant_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5438],
      [60, 0.4695],
      [100, 0.4695],
    ],
    statOverrides: {  },
  },

  nagant_dumdum: {
    label: "덤덤탄(출혈)",
    category: "compact",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_compact_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5429],
      [60, 0.4671],
      [100, 0.4671],
    ],
    statOverrides: { dropRange: 65, muzzleVelocity: 300 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  nagant_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5535],
      [60, 0.4713],
      [100, 0.4713],
    ],
    statOverrides: { damage: 87, dropRange: 80, verticalRecoil: 6, muzzleVelocity: 405, ammoExtra: 14 },
  },

  nagant_poison: {
    label: "중독탄",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  nagant_subsonic: {
    label: "아음속탄",
    category: "compact",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5392],
      [60, 0.4653],
      [100, 0.4653],
    ],
    statOverrides: { dropRange: 55, muzzleVelocity: 238, ammoExtra: 14 },
    specialEffects: ["발사음 감소"],
  },

  newarmy_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5438],
      [60, 0.4695],
      [100, 0.4695],
    ],
    statOverrides: {  },
  },

  newarmy_dumdum: {
    label: "덤덤탄(출혈)",
    category: "compact",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_compact_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5429],
      [60, 0.4671],
      [100, 0.4671],
    ],
    statOverrides: { dropRange: 70, muzzleVelocity: 200 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  newarmy_fmj: {
    label: "전피갑탄(FMJ)",
    category: "compact",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5473],
      [70, 0.4974],
      [100, 0.4974],
    ],
    statOverrides: { dropRange: 70, verticalRecoil: 7, muzzleVelocity: 200 },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  officer_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5438],
      [60, 0.4695],
      [100, 0.4695],
    ],
    statOverrides: {  },
  },

  // ⚠ Officer Carbine 전용 — 개머리판+연장총열로 소총급 취급이 되면서
  //    낙하곡선도 권총군(officer_compact)이 아닌 공용 소총군 Compact 곡선을 사용.
  //    (Update 1.3에서 "Compact Pistol Bullet" 서브클래스가 별도로 생긴 것과 대칭되는 처리)
  officer_carbine_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular_tight.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5011],
    ],
    statOverrides: {  },
  },

  officer_dumdum: {
    label: "덤덤탄(출혈)",
    category: "compact",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_compact_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5429],
      [60, 0.4671],
      [100, 0.4671],
    ],
    statOverrides: { dropRange: 65, muzzleVelocity: 300 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  officer_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5535],
      [60, 0.4713],
      [100, 0.4713],
    ],
    statOverrides: { damage: 87, dropRange: 80, verticalRecoil: 7.5, muzzleVelocity: 405, ammoExtra: 9 },
  },

  officer_poison: {
    label: "중독탄",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  officer_subsonic: {
    label: "아음속탄",
    category: "compact",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5392],
      [60, 0.4653],
      [100, 0.4653],
    ],
    statOverrides: { dropRange: 55, muzzleVelocity: 238, ammoExtra: 16 },
    specialEffects: ["발사음 감소"],
  },


  // ── Centennial 전용 탄약 (Medium 탄종 첫 실사용 무기) ──
  centennial_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: {  },
  },

  centennial_dumdum: {
    label: "덤덤탄(출혈)",
    category: "medium",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_medium_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 강한 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6322],
      [100, 0.5764],
    ],
    statOverrides: { dropRange: 125, muzzleVelocity: 480 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  centennial_fmj: {
    label: "전피갑탄(FMJ)",
    category: "medium",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_medium_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.64],
      [100, 0.6101],
    ],
    statOverrides: { dropRange: 125, verticalRecoil: 14, muzzleVelocity: 480 },
    specialEffects: ["40m부터 데미지 감소 시작"],
  },

  centennial_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.633],
      [100, 0.576],
    ],
    statOverrides: { damage: 116, dropRange: 155, verticalRecoil: 14, muzzleVelocity: 725, ammoExtra: 8 },
  },

  centennial_poison: {
    label: "중독탄",
    category: "medium",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_medium_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6296],
      [100, 0.5719],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  centennial_subsonic: {
    label: "아음속탄",
    category: "medium",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_medium_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 10,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6393],
      [100, 0.5788],
    ],
    statOverrides: { dropRange: 105, muzzleVelocity: 333, ammoExtra: 14 },
    specialEffects: ["발사음 감소"],
  },

  // ── Wildland 전용 탄약 ──
  // ⚠ Wildland는 낙하곡선 소스 데이터가 없어서, 사용자 확인 하에
  //    Centennial의 검증된 Medium 낙하곡선 값을 그대로 재사용함 (다른 스탯은 override 없음).
  wildland_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: {  },
  },

  // ⚠ Wildland 전용 탄약 — Hunt: Showdown 1896 Wiki 실제 "Ammo Types" 표 기준으로 검증 완료.
  //    (낙하곡선 자체 수치는 여전히 소스 데이터 없어 Centennial 값 재사용, statOverrides는 위키 실측치로 교체)
  wildland_dumdum: {
    label: "덤덤탄(출혈)",
    category: "medium",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_medium_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 강한 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6322],
      [100, 0.5764],
    ],
    statOverrides: { dropRange: 130, muzzleVelocity: 510 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  wildland_fmj: {
    label: "전피갑탄(FMJ)",
    category: "medium",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_medium_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.64],
      [100, 0.6101],
    ],
    statOverrides: { dropRange: 130, verticalRecoil: 14, muzzleVelocity: 510 },
    specialEffects: ["40m부터 데미지 감소 시작"],
  },

  wildland_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.633],
      [100, 0.576],
    ],
    statOverrides: { damage: 119, dropRange: 170, verticalRecoil: 14, muzzleVelocity: 775, ammoExtra: 8 },
  },

  wildland_poison: {
    label: "중독탄",
    category: "medium",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_medium_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6296],
      [100, 0.5719],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  wildland_subsonic: {
    label: "아음속탄",
    category: "medium",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_medium_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 10,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6393],
      [100, 0.5788],
    ],
    statOverrides: { dropRange: 110, muzzleVelocity: 336, ammoExtra: 18 },
    specialEffects: ["발사음 감소"],
  },


  // ── Drilling / Maynard Sniper / Springfield 1866 / 1865 Carbine / Vetterli 71 / Pax / Scottfield 전용 탄약 ──
  drilling_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: {  },
  },

  drilling_dumdum: {
    label: "덤덤탄(출혈)",
    category: "medium",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_medium_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 강한 출혈 효과.",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득) — 다른 무기의 덤덤탄과 동일하게 수정(기존엔 cost:0으로 잘못 표기됨)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6322],
      [100, 0.5764],
    ],
    statOverrides: { dropRange: 125, muzzleVelocity: 371 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  drilling_fmj: {
    label: "전피갑탄(FMJ)",
    category: "medium",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_medium_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.64],
      [100, 0.6101],
    ],
    statOverrides: { dropRange: 125, verticalRecoil: 16, muzzleVelocity: 371 },
    specialEffects: ["40m부터 데미지 감소 시작"],
  },

  drilling_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.633],
      [100, 0.576],
    ],
    statOverrides: { damage: 114, dropRange: 165, verticalRecoil: 16, muzzleVelocity: 655, ammoExtra: 13 },
  },

  maynard_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: {  },
  },

  maynard_dumdum: {
    label: "덤덤탄(출혈)",
    category: "medium",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_medium_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 강한 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6322],
      [100, 0.5764],
    ],
    statOverrides: { dropRange: 150, muzzleVelocity: 448 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  maynard_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.633],
      [100, 0.576],
    ],
    statOverrides: { damage: 137, dropRange: 170, verticalRecoil: 12, muzzleVelocity: 660, ammoExtra: 9 },
  },

  maynard_subsonic: {
    label: "아음속탄",
    category: "medium",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_medium_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 5,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6393],
      [100, 0.5788],
    ],
    statOverrides: { dropRange: 130, muzzleVelocity: 319, ammoExtra: 15 },
    specialEffects: ["발사음 감소"],
  },

  springfield1866_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: {  },
  },

  springfield1866_dumdum: {
    label: "덤덤탄(출혈)",
    category: "medium",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_medium_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 강한 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6322],
      [100, 0.5764],
    ],
    statOverrides: { dropRange: 155, muzzleVelocity: 440 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  springfield1866_explosive: {
    label: "폭발탄",
    category: "medium",
    effect: "explosive",
    image: "images/ui/ammo_effects/ammo_medium_explosive.png",
    icon: "💥",
    description: "폭발탄 - 광범위 폭발 데미지. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [100, 0.476],
    ],
    statOverrides: { damage: 125, dropRange: 120, muzzleVelocity: 370 },
  },

  springfield1866_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.633],
      [100, 0.576],
    ],
    statOverrides: { damage: 132, dropRange: 180, verticalRecoil: 10, muzzleVelocity: 615, ammoExtra: 8 },
  },

  springfield1866_poison: {
    label: "중독탄",
    category: "medium",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_medium_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 25,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6296],
      [100, 0.5719],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  carbine1865_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: {  },
  },

  carbine1865_fmj: {
    label: "전피갑탄(FMJ)",
    category: "medium",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_medium_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.64],
      [100, 0.6101],
    ],
    statOverrides: { dropRange: 105, verticalRecoil: 7, muzzleVelocity: 272 },
    specialEffects: ["40m부터 데미지 감소 시작"],
  },

  carbine1865_subsonic: {
    label: "아음속탄",
    category: "medium",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_medium_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 10,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6393],
      [100, 0.5788],
    ],
    statOverrides: { dropRange: 95, muzzleVelocity: 242, ammoExtra: 25 },
    specialEffects: ["발사음 감소"],
  },  vetterli71_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: {  },
  },

  vetterli71_fmj: {
    label: "전피갑탄(FMJ)",
    category: "medium",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_medium_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.64],
      [100, 0.6101],
    ],
    statOverrides: { dropRange: 115, verticalRecoil: 9, muzzleVelocity: 350 },
    specialEffects: ["40m부터 데미지 감소 시작"],
  },

  vetterli71_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.633],
      [100, 0.576],
    ],
    statOverrides: { damage: 123, dropRange: 140, verticalRecoil: 9, muzzleVelocity: 510, ammoExtra: 10 },
  },

  vetterli71_incendiary: {
    label: "소이탄",
    category: "medium",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_medium_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6385],
      [100, 0.5769],
    ],
    statOverrides: {  },
    specialEffects: ["30m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 30,
  },

  vetterli71_subsonic: {
    label: "아음속탄",
    category: "medium",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_medium_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 10,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6393],
      [100, 0.5788],
    ],
    statOverrides: { dropRange: 100, muzzleVelocity: 266, ammoExtra: 24 },
    specialEffects: ["발사음 감소"],
  },

  pax_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5535],
      [80, 0.4709],
      [100, 0.4709],
    ],
    statOverrides: {  },
  },

  pax_dumdum: {
    label: "덤덤탄(출혈)",
    category: "medium",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_medium_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.553],
      [80, 0.47],
      [100, 0.47],
    ],
    statOverrides: { dropRange: 60, muzzleVelocity: 300 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  pax_fmj: {
    label: "전피갑탄(FMJ)",
    category: "medium",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_medium_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5535],
      [80, 0.4924],
      [100, 0.4924],
    ],
    statOverrides: { dropRange: 60, verticalRecoil: 12, muzzleVelocity: 300 },
    specialEffects: ["40m부터 데미지 감소 시작"],
  },

  pax_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5464],
      [80, 0.4732],
      [100, 0.4732],
    ],
    statOverrides: { damage: 104, dropRange: 70, verticalRecoil: 12, muzzleVelocity: 405, ammoExtra: 8 },
  },

  pax_incendiary: {
    label: "소이탄",
    category: "medium",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_medium_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.553],
      [80, 0.47],
      [100, 0.47],
    ],
    statOverrides: {  },
    specialEffects: ["30m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 30,
  },

  pax_poison: {
    label: "중독탄",
    category: "medium",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_medium_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5545],
      [80, 0.4727],
      [100, 0.4727],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  scottfield_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular_tight.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5535],
      [80, 0.4709],
      [100, 0.4709],
    ],
    statOverrides: {  },
  },

  scottfield_dumdum: {
    label: "덤덤탄(출혈)",
    category: "medium",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_medium_bleed.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.553],
      [80, 0.47],
      [100, 0.47],
    ],
    statOverrides: { dropRange: 60, muzzleVelocity: 250 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  scottfield_fmj: {
    label: "전피갑탄(FMJ)",
    category: "medium",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_medium_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5535],
      [80, 0.4924],
      [100, 0.4924],
    ],
    statOverrides: { dropRange: 60, verticalRecoil: 12, muzzleVelocity: 250 },
    specialEffects: ["40m부터 데미지 감소 시작"],
  },

  scottfield_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5464],
      [80, 0.4732],
      [100, 0.4732],
    ],
    statOverrides: { damage: 101, dropRange: 75, verticalRecoil: 12, muzzleVelocity: 355, ammoExtra: 8 },
  },

  scottfield_incendiary: {
    label: "소이탄",
    category: "medium",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_medium_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.553],
      [80, 0.47],
      [100, 0.47],
    ],
    statOverrides: {  },
    specialEffects: ["30m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 30,
  },


  // ── Mako 1895 / Martini-Henry / Sparks / Haymaker / Uppercut / Krag / Lebel 1886 / Mosin-Nagant / Berthier 1892 / Mosin Obrez 전용 탄약 ──
  mako1895_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6169],
      [100, 0.6095],
    ],
    statOverrides: {  },
  },

  mako1895_explosive: {
    label: "폭발탄",
    category: "long",
    effect: "explosive",
    image: "images/ui/ammo_effects/ammo_long_explosive.png",
    icon: "💥",
    description: "폭발탄 - 광범위 폭발 데미지. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.7363],
      [90, 0.5891],
      [100, 0.574],
    ],
    statOverrides: { damage: 127, dropRange: 85, muzzleVelocity: 332 },
  },

  mako1895_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6169],
    ],
    statOverrides: { dropRange: 95, verticalRecoil: 14, muzzleVelocity: 305 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  martinihenry_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6169],
      [100, 0.6095],
    ],
    statOverrides: {  },
  },

  martinihenry_explosive: {
    label: "폭발탄",
    category: "long",
    effect: "explosive",
    image: "images/ui/ammo_effects/ammo_long_explosive.png",
    icon: "💥",
    description: "폭발탄 - 광범위 폭발 데미지. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.7363],
      [90, 0.5891],
      [100, 0.574],
    ],
    statOverrides: { damage: 138, dropRange: 95, muzzleVelocity: 300 },
  },

  martinihenry_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6169],
    ],
    statOverrides: { dropRange: 110, verticalRecoil: 16, muzzleVelocity: 320 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  martinihenry_high_velocity: {
    label: "고속탄",
    category: "long",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_long_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 35,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6176],
      [100, 0.6103],
    ],
    statOverrides: { damage: 136, dropRange: 140, verticalRecoil: 16, muzzleVelocity: 500, ammoExtra: 7 },
  },

  martinihenry_incendiary: {
    label: "소이탄",
    category: "long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 35,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6164],
      [100, 0.6096],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  sparks_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6169],
      [100, 0.6095],
    ],
    statOverrides: {  },
  },

  sparks_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6169],
    ],
    statOverrides: { dropRange: 125, verticalRecoil: 13, muzzleVelocity: 370 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  sparks_incendiary: {
    label: "소이탄",
    category: "long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 35,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6164],
      [100, 0.6096],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  sparks_poison: {
    label: "중독탄",
    category: "long",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_long_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 강한 독 효과. 관통 불가.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6174],
      [100, 0.6107],
    ],
    statOverrides: {  },
    specialEffects: ["강한(intense) 중독 효과 발생"],
  },

  sparks_subsonic: {
    label: "아음속탄",
    category: "long",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_long_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 10,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6174],
      [100, 0.6107],
    ],
    statOverrides: { dropRange: 115, muzzleVelocity: 309, ammoExtra: 9 },
    specialEffects: ["발사음 감소"],
  },

  // ⚠ Sparks Pistol 전용 탄약 (위키 실측치 기준, 사용자 확인) - 본체와 낙하범위/탄속 기준점이 달라 별도 필요.
  //    기본 Long 낙하곡선은 롱탄 권총군 공용 곡선(haymaker_long/uppercut_long와 동일) 재사용.
  sparkspistol_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5808],
      [90, 0.4679],
      [100, 0.4679],
    ],
    statOverrides: {  },
  },

  sparkspistol_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6169],
    ],
    statOverrides: { dropRange: 85, verticalRecoil: 27, muzzleVelocity: 362 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  sparkspistol_subsonic: {
    label: "아음속탄",
    category: "long",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_long_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 10,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6174],
      [100, 0.6107],
    ],
    statOverrides: { dropRange: 75, muzzleVelocity: 281, ammoExtra: 8 },
    specialEffects: ["발사음 감소"],
  },

  // ⚠ Sparks Pistol Silencer 전용 탄약 (위키 실측치 기준, 사용자 확인)
  sparkspistolsilencer_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5808],
      [90, 0.4679],
      [100, 0.4679],
    ],
    statOverrides: {  },
  },

  sparkspistolsilencer_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6169],
    ],
    statOverrides: { dropRange: 80, verticalRecoil: 28, muzzleVelocity: 308 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  sparkspistolsilencer_subsonic: {
    label: "아음속탄",
    category: "long",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_long_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 10,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6174],
      [100, 0.6107],
    ],
    statOverrides: { dropRange: 75, muzzleVelocity: 258, ammoExtra: 8 },
    specialEffects: ["발사음 감소"],
  },

  haymaker_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5808],
      [90, 0.4679],
      [100, 0.4679],
    ],
    statOverrides: {  },
  },

  haymaker_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [80, 0.5453],
      [90, 0.4605],
      [100, 0.4605],
    ],
    statOverrides: { dropRange: 50, verticalRecoil: 25, muzzleVelocity: 375 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  haymaker_poison: {
    label: "중독탄",
    category: "long",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_long_poison.png",
    icon: "🟢",
    description: "중독탄 - 명중 시 강한 독 효과. 관통 불가.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5902],
      [90, 0.4754],
      [100, 0.4754],
    ],
    statOverrides: {  },
    specialEffects: ["강한(intense) 중독 효과 발생"],
  },

  uppercut_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5808],
      [90, 0.4679],
      [100, 0.4679],
    ],
    statOverrides: {  },
  },

  uppercut_explosive: {
    label: "폭발탄",
    category: "long",
    effect: "explosive",
    image: "images/ui/ammo_effects/ammo_long_explosive.png",
    icon: "💥",
    description: "폭발탄 - 광범위 폭발 데미지. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [50, 0.7255],
      [90, 0.4608],
      [100, 0.4412],
    ],
    statOverrides: { damage: 102, dropRange: 45, muzzleVelocity: 330 },
  },

  uppercut_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [80, 0.5453],
      [90, 0.4605],
      [100, 0.4605],
    ],
    statOverrides: { dropRange: 60, verticalRecoil: 25, muzzleVelocity: 360 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  uppercut_incendiary: {
    label: "소이탄",
    category: "long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 70,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5714],
      [90, 0.4603],
      [100, 0.4603],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  // ⚠ Uppercut Precision/Deadeye 전용 FMJ (위키 실측치, 사용자 확인) - 본체와 반동 기준점이 달라 별도 필요
  uppercut_precision_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [80, 0.5453],
      [90, 0.4605],
      [100, 0.4605],
    ],
    statOverrides: { dropRange: 55, verticalRecoil: 13, muzzleVelocity: 360 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  uppercut_deadeye_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [80, 0.5453],
      [90, 0.4605],
      [100, 0.4605],
    ],
    statOverrides: { dropRange: 55, verticalRecoil: 16, muzzleVelocity: 360 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  // ── 1890 Cavalry 전용 탄약 ──
  // ⚠ 1890 Cavalry는 낙하곡선 소스 데이터가 없어서, 사용자 확인 하에
  //    공용 롱탄(long) 낙하곡선 값을 그대로 재사용함 (다른 스탯은 override 없음, 데미지 139는 무기 자체 스탯 사용).
  cavalry_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular_tight.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6169],
      [100, 0.6095],
    ],
    statOverrides: {  },
  },

  // ⚠ 1890 Cavalry 전용 탄약 — Hunt: Showdown 1896 Wiki 실제 "Ammo Types" 표 기준으로 검증 완료.
  //    (낙하곡선 자체 수치는 여전히 소스 데이터 없어 공용 롱탄/Martini Henry 값 재사용, statOverrides는 위키 실측치로 교체)
  cavalry_fmj: {
    label: "전피갑탄(FMJ)",
    category: "long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6169],
    ],
    statOverrides: { dropRange: 100, verticalRecoil: 10, muzzleVelocity: 300 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  cavalry_high_velocity: {
    label: "고속탄",
    category: "long",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_long_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 반동 증가, 데미지 감소.",
    cost: 30,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6176],
      [100, 0.6103],
    ],
    // ammoExtra: 위키엔 "9 → 6 (1슬롯 기준)"으로 표기, 무기 전체 예비탄(18=9×2슬롯) 기준으로 환산해 12로 변환.
    statOverrides: { damage: 132, dropRange: 130, verticalRecoil: 11, muzzleVelocity: 480, ammoExtra: 12 },
  },

  krag_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular_tight.png",
    icon: "🟫",
    description: "Special Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6190],
      [100, 0.6032],
    ],
    statOverrides: {  },
  },

  krag_fmj: {
    label: "전피갑탄(FMJ)",
    category: "special_long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_special_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6190],
    ],
    statOverrides: { dropRange: 125, verticalRecoil: 6, muzzleVelocity: 458 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  krag_incendiary: {
    label: "소이탄",
    category: "special_long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_special_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 70,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6190],
      [100, 0.6032],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  krag_subsonic: {
    label: "아음속탄",
    category: "special_long",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_special_long_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 20,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6190],
      [100, 0.6032],
    ],
    statOverrides: { dropRange: 110, muzzleVelocity: 336, ammoExtra: 12 },
    specialEffects: ["발사음 감소"],
  },

  // ⚠ Krag Silencer 전용 탄약 (위키 실측치, 사용자 확인) - 본체와 데미지/탄속 기준점이 달라 별도 필요
  krag_silencer_fmj: {
    label: "전피갑탄(FMJ)",
    category: "special_long",
    effect: "full_metal",
    image: "images/ui/ammo_effects/ammo_special_long_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 60,
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6190],
    ],
    statOverrides: { dropRange: 120, verticalRecoil: 6, muzzleVelocity: 414 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  krag_silencer_subsonic: {
    label: "아음속탄",
    category: "special_long",
    effect: "subsonic",
    image: "images/ui/ammo_effects/ammo_special_long_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 탄속 감소, 낙하거리 감소, 예비 탄약 수 변동, 발사음 감소.",
    cost: 20,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6190],
      [100, 0.6032],
    ],
    statOverrides: { dropRange: 105, muzzleVelocity: 304, ammoExtra: 12 },
    specialEffects: ["발사음 감소"],
  },

  lebel1886_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular_tight.png",
    icon: "🟫",
    description: "Special Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6212],
      [100, 0.6061],
    ],
    statOverrides: {  },
  },

  lebel1886_incendiary: {
    label: "소이탄",
    category: "special_long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_special_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 70,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6212],
      [100, 0.6061],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  lebel1886_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6195],
      [100, 0.6018],
    ],
    statOverrides: { damage: 113, dropRange: 165, verticalRecoil: 13, muzzleVelocity: 850, ammoExtra: 3 },
  },

  mosinnagant_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular_tight.png",
    icon: "🟫",
    description: "Special Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6176],
      [100, 0.6103],
    ],
    statOverrides: {  },
  },

  mosinnagant_incendiary: {
    label: "소이탄",
    category: "special_long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_special_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 70,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6176],
      [100, 0.6103],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  mosinnagant_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6154],
      [100, 0.6068],
    ],
    statOverrides: { damage: 117, dropRange: 160, verticalRecoil: 15, muzzleVelocity: 820, ammoExtra: 7 },
  },

  // ⚠ Mosin-Nagant Avtomat 전용 스피처탄 (위키 실측치, 사용자 확인) - 자동사격 개조라 반동 기준점이 다르고 예비탄이 0이라 별도 필요
  mosinnagant_avtomat_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6154],
      [100, 0.6068],
    ],
    statOverrides: { damage: 117, dropRange: 160, verticalRecoil: 9, muzzleVelocity: 820 },
  },

  berthier1892_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular_tight.png",
    icon: "🟫",
    description: "Special Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6484],
      [100, 0.6328],
    ],
    statOverrides: {  },
  },

  berthier1892_incendiary: {
    label: "소이탄",
    category: "special_long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_special_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 35,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6484],
      [100, 0.6328],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  berthier1892_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6422],
      [100, 0.6239],
    ],
    statOverrides: { damage: 109, dropRange: 140, verticalRecoil: 16, muzzleVelocity: 780, ammoExtra: 5 },
  },

  mosinobrez_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular_tight.png",
    icon: "🟫",
    description: "Special Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6190],
      [100, 0.6032],
    ],
    statOverrides: {  },
  },

  mosinobrez_incendiary: {
    label: "소이탄",
    category: "special_long",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_special_long_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 70,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6190],
      [100, 0.6032],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  mosinobrez_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6226],
      [100, 0.6132],
    ],
    statOverrides: { damage: 106, dropRange: 120, verticalRecoil: 21, muzzleVelocity: 710, ammoExtra: 5 },
  },

  // ⚠ Mosin Obrez 파생형별 전용 스피처탄 (위키 실측치, 사용자 확인) - 파생형마다 반동/낙하범위 기준점이 달라 별도 필요
  mosinobrez_mace_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6226],
      [100, 0.6132],
    ],
    statOverrides: { damage: 106, dropRange: 125, verticalRecoil: 23, muzzleVelocity: 710, ammoExtra: 5 },
  },

  mosinobrez_extended_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6226],
      [100, 0.6132],
    ],
    statOverrides: { damage: 106, dropRange: 125, verticalRecoil: 24, muzzleVelocity: 710, ammoExtra: 5 },
  },

  // Match와 Sharpeye는 데미지/낙하범위/탄속/반동/예비탄 델타가 완전히 동일해서 공유
  mosinobrez_match_spitzer: {
    label: "스피처탄",
    category: "special_long",
    effect: "spitzer",
    image: "images/ui/ammo_effects/ammo_special_long_spitzer.png",
    icon: "🏹",
    description: "스피처탄 - 탄속 증가, 관통력 증가, 데미지 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6226],
      [100, 0.6132],
    ],
    statOverrides: { damage: 110, dropRange: 130, verticalRecoil: 18, muzzleVelocity: 730, ammoExtra: 7 },
  },


  // ── Auto-5 / Homestead 78 / Rival 78 / Romero 77 / Slate / Specter 1882 / Terminus (샷건, 낙하곡선 없음) ──
  auto5_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 11, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  // ⚠ Auto-4 Shorty(Auto-5 파생형) 전용 샷건쉘 — 위키 실측 데미지(154) 그대로 사용.
  auto5_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 135, spread: 25 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  auto5_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 147, spread: 100, ammoExtra: 12 },
  },

  auto5_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 179, spread: 95, ammoExtra: 5 },
  },

  // ⚠ Auto-4 Shorty 전용 탄약 (Auto-5의 파생형, 위키 실측치 기준)
  auto4shorty_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 8, unstableEnd: 10, noneFrom: 11 },
    statOverrides: {  },
  },

  auto4shorty_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    statOverrides: { damage: 113, spread: 35 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  auto4shorty_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    statOverrides: { damage: 107, spread: 125, ammoExtra: 7 },
  },

  auto4shorty_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소. (위키 표기는 167이나, 다른 2칸 샷건들과 동일하게 실제로는 157 적용)",
    cost: 130,
    statOverrides: { damage: 157, spread: 160, ammoExtra: 3 },
  },

  homestead78_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 12, unstableEnd: 14, noneFrom: 15 },
    statOverrides: {  },
  },

  homestead78_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 149, spread: 55, muzzleVelocity: 125 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  homestead78_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 162, spread: 5 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  homestead78_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 174, spread: 75, ammoExtra: 18 },
  },

  homestead78_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 195, spread: 70, ammoExtra: 8 },
  },  rival78_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 10, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  // ⚠ Rival 78 Shorty 파생형 전용 샷건쉘 — 위키 실측 데미지(158) 그대로 사용.
  rival78_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 113, spread: 80, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  rival78_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 126, spread: 30 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  rival78_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 138, spread: 100, ammoExtra: 18 },
  },

  rival78_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 165, spread: 95, ammoExtra: 8 },
  },

  // ⚠ Rival 78 Mace 전용 특수탄 4종 (위키 실측치, 사용자 확인) - 본체와 데미지/탄속 기준점이 달라 별도 필요
  rival78mace_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    statOverrides: { damage: 89, spread: 160, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  rival78mace_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    statOverrides: { damage: 103, spread: 35 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  rival78mace_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    statOverrides: { damage: 62, spread: 125, ammoExtra: 6 },
  },

  rival78mace_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    statOverrides: { damage: 157, spread: 150, ammoExtra: 3 },
  },

  // ⚠ Rival 78 Shorty 전용 탄약 (위키 실측치 기준. 가격/예비탄은 Update 2.8.1로 위키 페이지가 아직 안 바뀐 부분을 패치노트로 보정: 가격 125→145, 기본탄 예비 6→4)
  rival78shorty_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 9, unstableEnd: 11, noneFrom: 12 },
    statOverrides: {  },
  },

  rival78shorty_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    statOverrides: { damage: 89, spread: 160, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  rival78shorty_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    statOverrides: { damage: 103, spread: 35 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  rival78shorty_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    // ⚠ 예비탄 6: Update 2.8.1 패치노트 기준 최신값(위키 페이지는 구버전 9로 표기돼 있어 패치노트로 보정)
    statOverrides: { damage: 62, spread: 125, ammoExtra: 6 },
  },

  rival78shorty_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // ⚠ 예비탄 3: Update 2.8.1 패치노트 기준 최신값(위키 페이지는 구버전 4로 표기돼 있어 패치노트로 보정)
    statOverrides: { damage: 157, spread: 105, ammoExtra: 3 },
  },

  romero77_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 12, unstableEnd: 13, noneFrom: 14 },
    statOverrides: {  },
  },

  // ⚠ Romero 77 Shorty 파생형 전용 샷건쉘 — 위키 실측 데미지(214) 그대로 사용.
  romero77_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 10,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 144, spread: 50, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  romero77_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 5,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 192, spread: 75, ammoExtra: 4 },
  },

  romero77_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 65,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 179, spread: 65, ammoExtra: 4 },
  },

  romero77_starshell: {
    label: "신호탄",
    category: "shotgun",
    effect: "flare",
    image: "images/ui/ammo_effect_icons/flare_shelltight.png",
    icon: "🌟",
    description: "신호탄 - 조명탄 발사, 명중한 대상에 강한 화상 효과.",
    cost: 5,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 3, spread: 50, verticalRecoil: 3, muzzleVelocity: 75, ammoExtra: 4 },
    specialEffects: ["강한(intense) 화상 효과 발생"],
  },

  // ⚠ Romero 77 Talon 전용 — DragonBreath/Slug/Starshell은 본체와 델타 동일해서 공유, 페니샷만 예비탄이 달라 별도.
  romero77talon_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 5,
    statOverrides: { damage: 192, spread: 75, ammoExtra: 20 },
  },

  // ⚠ Romero 77 Hatchet — Shorty와 완전히 동일한 총(근접무기 유무만 차이)이라 romero77shorty_* 탄약을 그대로 재사용

  // ⚠ Romero 77 Alamo 전용 — DragonBreath는 본체와 델타 동일해서 공유, 나머지는 예비탄 총량 표기 방식이 달라(2슬롯 아님) 별도.
  romero77alamo_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 5,
    statOverrides: { damage: 188, spread: 75, ammoExtra: 18 },
  },

  romero77alamo_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 65,
    statOverrides: { damage: 179, spread: 65, ammoExtra: 8 },
  },

  romero77alamo_starshell: {
    label: "신호탄",
    category: "shotgun",
    effect: "flare",
    image: "images/ui/ammo_effect_icons/flare_shelltight.png",
    icon: "🌟",
    description: "신호탄 - 조명탄 발사, 명중한 대상에 강한 화상 효과.",
    cost: 5,
    statOverrides: { damage: 3, spread: 50, verticalRecoil: 3, muzzleVelocity: 75, ammoExtra: 8 },
    specialEffects: ["강한(intense) 화상 효과 발생"],
  },

  // ⚠ Romero 77 Shorty 전용 탄약 (위키 실측치 기준)
  romero77shorty_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 12, unstableEnd: 13, noneFrom: 14 },
    statOverrides: {  },
  },

  romero77shorty_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 10,
    statOverrides: { damage: 115, spread: 120, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  romero77shorty_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 5,
    statOverrides: { damage: 97, spread: 100, ammoExtra: 6 },
  },

  romero77shorty_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 65,
    statOverrides: { damage: 157, spread: 125, ammoExtra: 2 },
  },

  romero77shorty_starshell: {
    label: "신호탄",
    category: "shotgun",
    effect: "flare",
    image: "images/ui/ammo_effect_icons/flare_shelltight.png",
    icon: "🌟",
    description: "신호탄 - 조명탄 발사, 명중한 대상에 강한 화상 효과.",
    cost: 5,
    statOverrides: { damage: 2, spread: 50, verticalRecoil: 5, muzzleVelocity: 75, ammoExtra: 2 },
    specialEffects: ["강한(intense) 화상 효과 발생"],
  },

  slate_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 11, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  slate_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 182, spread: 80, ammoExtra: 18 },
  },

  slate_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 165, spread: 80, ammoExtra: 8 },
  },

  specter1882_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 12, unstableEnd: 13, noneFrom: 14 },
    statOverrides: {  },
  },

  // ⚠ Specter 1882 Shorty 파생형 전용 샷건쉘 — 위키 실측 데미지(178) 그대로 사용.
  specter1882_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 141, spread: 60, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  specter1882_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 138 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  specter1882_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 193, spread: 75, ammoExtra: 18 },
  },

  specter1882_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 179, spread: 75, ammoExtra: 8 },
  },

  // ⚠ Specter 1882 Bayonet 전용 탄약 (위키 실측치 기준, 사용자 확인) - 본체와 데미지 기준점이 달라 별도 탄약 필요
  specter1882bayonet_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    statOverrides: { damage: 133, spread: 75, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  specter1882bayonet_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    statOverrides: { damage: 142, spread: 25 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  specter1882bayonet_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    statOverrides: { damage: 155, spread: 95, ammoExtra: 18 },
  },

  specter1882bayonet_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    statOverrides: { damage: 165, spread: 90, ammoExtra: 8 },
  },

  // ⚠ Specter 1882 Shorty 전용 탄약 (위키 실측치 기준)
  specter1882shorty_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 10, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  specter1882shorty_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    statOverrides: { damage: 92, spread: 145, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  specter1882shorty_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    statOverrides: { damage: 123, spread: 30 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  specter1882shorty_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    statOverrides: { damage: 81, spread: 120, ammoExtra: 6 },
  },

  specter1882shorty_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    statOverrides: { damage: 157, spread: 120, ammoExtra: 3 },
  },

  terminus_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 10, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  terminus_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 118, spread: 85, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  terminus_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 127, spread: 30 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  terminus_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 183, spread: 80, ammoExtra: 18 },
  },

  terminus_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 165, spread: 75, ammoExtra: 8 },
  },

  // ⚠ Terminus Shorty 전용 탄약 (위키 실측치 기준)
  terminusshorty_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 9, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  terminusshorty_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 20,
    statOverrides: { damage: 77, spread: 150, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  terminusshorty_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 40,
    statOverrides: { damage: 114, spread: 35 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  terminusshorty_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 10,
    statOverrides: { damage: 75, spread: 115, ammoExtra: 6 },
  },

  terminusshorty_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    statOverrides: { damage: 157, spread: 125, ammoExtra: 3 },
  },



  // ── Drilling / LeMat / Haymaker 하부 총열 샷건 특수탄 (위키 오버라이드 값 기준) ──
  drilling_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette_shelltight.png",
    icon: "➶",
    description: "플리셰트 - 다수의 작은 다트형 투사체 발사. 명중 시 출혈 효과.",
    cost: 20,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 132, spread: 21.2 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  drilling_pennyshot: {
    label: "페니샷",
    category: "shotgun",
    effect: "pennyshot",
    image: "images/ui/ammo_effect_icons/pennyshot_shelltight.png",
    icon: "🪙",
    description: "페니샷 - 산탄 대신 동전형 탄자 발사. 근거리 고데미지, 원거리 부정확.",
    cost: 5,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 190, spread: 75, ammoExtra: 8 },
  },

  drilling_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 65,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 179, spread: 65, ammoExtra: 3 },
  },

  lemat_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 10,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 40, spread: 150, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  lemat_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 65,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 157, spread: 115, ammoExtra: 2 },
  },

  lemat_starshell: {
    label: "신호탄",
    category: "shotgun",
    effect: "flare",
    image: "images/ui/ammo_effect_icons/flare_shelltight.png",
    icon: "🌟",
    description: "신호탄 - 조명탄 발사, 명중한 대상에 강한 화상 효과.",
    cost: 5,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 1, spread: 50, verticalRecoil: 5, muzzleVelocity: 75 },
    specialEffects: ["강한(intense) 화상 효과 발생"],
  },

  haymaker_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell_shelltight.png",
    icon: "🔥",
    description: "드래곤브레스 - 화염 분사, 명중한 대상을 발화시킴.",
    cost: 10,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 45, spread: 150, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },

  haymaker_slug: {
    label: "슬러그",
    category: "shotgun",
    effect: "slug",
    image: "images/ui/ammo_effect_icons/slug_shelltight.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 65,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 159, spread: 115, ammoExtra: 2 },
  },

  haymaker_starshell: {
    label: "신호탄",
    category: "shotgun",
    effect: "flare",
    image: "images/ui/ammo_effect_icons/flare_shelltight.png",
    icon: "🌟",
    description: "신호탄 - 조명탄 발사, 명중한 대상에 강한 화상 효과.",
    cost: 5,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 3, spread: 50, verticalRecoil: 5, muzzleVelocity: 75 },
    specialEffects: ["강한(intense) 화상 효과 발생"],
  },


  // ── Drilling / LeMat / Haymaker 하부 총열 기본 샷건쉘 ──
  lemat_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 하부 총열 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 9, unstableEnd: 11, noneFrom: 12 },
    statOverrides: {  },
  },

  haymaker_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 하부 총열 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 9, unstableEnd: 11, noneFrom: 12 },
    statOverrides: {  },
  },

  drilling_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 하부 총열 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    // ✅ [확인됨] Drilling(콤보건)은 하부 샷건탄 데미지가 위키에 원래 명시 안 되는 게 정상 - damage 220 / spread 20은 다른 샷건 대비 추정치로 유지
    ohkRange: { guaranteed: 12, unstableEnd: 14, noneFrom: 15 },
    statOverrides: { damage: 220, spread: 20 },
  },

  // ⚠ Drilling Shorty/Hatchet 공용 샷건쉘 — 두 파생형은 근접무기(도끼) 유무만 다를 뿐
  //    총 자체(하부 총열 포함)는 완전히 같은 무기라 탄약도 공유.
  drilling_shorty_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells_shelltight_scaled.png",
    icon: "🔫",
    description: "Shells - 하부 총열 기본 샷건탄(벅샷).",
    cost: 0,
    ohkRange: { guaranteed: 12, unstableEnd: 13, noneFrom: 14 },
    statOverrides: { damage: 214, spread: 25 },
  },

  // ─────────────────────────────────────────────────────────────
  // 아래는 아직 이 탄약을 쓰는 무기가 ITEMS에 없는 "참고용" 데이터입니다.
  // 사용자가 공식 최신 그래프를 보고 직접 불러준 낙하곡선(20/50/100m 등 구간점)이며,
  // 해당 무기가 추가되면 그 무기의 ammoTypes 배열에 이 id를 넣어서 바로 쓰면 됩니다.
  // (지금은 어떤 무기의 ammoTypes에도 없어서 화면에는 표시되지 않습니다)
  // ─────────────────────────────────────────────────────────────
  compact_pistol: {
    label: "소형권총탄",
    category: "compact",
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5438],
      [60, 0.4695],
      [100, 0.4695],
    ],
    statOverrides: { damage: 104 },
    cost: null, // 아직 확인 안 됨
  },

  compact_pistol_fmj: {
    label: "소형권총전피탄",
    category: "compact",
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5473],
      [70, 0.4974],
      [100, 0.4974],
    ],
    statOverrides: { damage: 104 },
    cost: null, // 아직 확인 안 됨
  },

  compact_silencer: {
    label: "소형소음기탄",
    category: "compact",
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6179],
      [100, 0.5012],
    ],
    statOverrides: { damage: 104 },
    cost: null, // 아직 확인 안 됨
  },

  compact_silencer_fmj: {
    label: "소형소음기전피탄",
    category: "compact",
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.4808],
      [70, 0.4423],
      [100, 0.4423],
    ],
    statOverrides: { damage: 104 },
    cost: null, // 아직 확인 안 됨
  },

  medium: {
    label: "중형탄",
    category: "medium",
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6336],
      [100, 0.5772],
    ],
    statOverrides: { damage: 145 },
    cost: null, // 아직 확인 안 됨
  },

  medium_explosive: {
    label: "중형폭발탄",
    category: "medium",
    // 부위 배율은 예외 없이 기존 공식 그대로 적용(사용자 확인)
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [100, 0.476],
    ],
    statOverrides: { damage: 125 },
    cost: null, // 아직 확인 안 됨
  },

  medium_fmj: {
    label: "중형전피탄",
    category: "medium",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.64],
      [100, 0.6101],
    ],
    statOverrides: { damage: 123 },
    cost: null, // 아직 확인 안 됨
  },

  medium_silencer: {
    label: "중형소음기탄",
    category: "medium",
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6393],
      [100, 0.5788],
    ],
    statOverrides: { damage: 123 },
    cost: null, // 아직 확인 안 됨
  },

  medium_silencer_fmj: {
    label: "중형소음기전피탄",
    category: "medium",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.4797],
      [86, 0.4472],
      [100, 0.4472],
    ],
    statOverrides: { damage: 123 },
    cost: null, // 아직 확인 안 됨
  },

  medium_pistol: {
    label: "중형권총탄",
    category: "medium",
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5535],
      [80, 0.4709],
      [100, 0.4709],
    ],
    statOverrides: { damage: 110 },
    cost: null, // 아직 확인 안 됨
  },

  medium_pistol_fmj: {
    label: "중형권총전피탄",
    category: "medium",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5535],
      [80, 0.4924],
      [100, 0.4924],
    ],
    statOverrides: { damage: 110 },
    cost: null, // 아직 확인 안 됨
  },

  long: {
    label: "롱탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6169],
      [100, 0.6095],
    ],
    statOverrides: { damage: 128 },
    cost: null, // 아직 확인 안 됨
  },

  long_explosive: {
    label: "롱폭발탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.7363],
      [90, 0.5891],
      [100, 0.574],
    ],
    statOverrides: { damage: 127 },
    cost: null, // 아직 확인 안 됨
  },

  long_fmj: {
    label: "롱전피탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [100, 0.6169],
    ],
    statOverrides: { damage: 128 },
    cost: null, // 아직 확인 안 됨
  },

  long_spitzer: {
    label: "롱스피처탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6147],
      [100, 0.6055],
    ],
    statOverrides: { damage: 109 },
    cost: null, // 아직 확인 안 됨
  },

  long_poison: {
    label: "롱독탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6174],
      [100, 0.6107],
    ],
    statOverrides: { damage: 149 },
    cost: null, // 아직 확인 안 됨
  },

  long_pistol_explosive: {
    label: "롱권총폭발탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [50, 0.7255],
      [90, 0.4608],
      [100, 0.4412],
    ],
    statOverrides: { damage: 102 },
    cost: null, // 아직 확인 안 됨
  },

  long_pistol_fmj: {
    label: "롱권총전피탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [80, 0.5453],
      [90, 0.4605],
      [100, 0.4605],
    ],
    statOverrides: { damage: 156 },
    cost: null, // 아직 확인 안 됨
  },

  long_pistol_silencer: {
    label: "롱권총소음기탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.4737],
      [90, 0.4135],
      [100, 0.4135],
    ],
    statOverrides: { damage: 133 },
    cost: null, // 아직 확인 안 됨
  },

  long_pistol_silencer_fmj: {
    label: "롱권총소음기전피탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [80, 0.4737],
      [90, 0.4361],
      [100, 0.4361],
    ],
    statOverrides: { damage: 133 },
    cost: null, // 아직 확인 안 됨
  },

  long_silencer: {
    label: "롱소음기탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6174],
      [100, 0.6107],
    ],
    statOverrides: { damage: 133 },
    cost: null, // 아직 확인 안 됨
  },

  long_silencer_fmj: {
    label: "롱소음기전피탄",
    category: "long",
    falloff: [
      [0, 1.00],
      [50, 1.00],
      [80, 0.4962],
      [90, 0.4586],
      [100, 0.4586],
    ],
    statOverrides: { damage: 133 },
    cost: null, // 아직 확인 안 됨
  },

  dolch: {
    label: "돌치(Dolch)탄",
    category: "special",
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5464],
      [80, 0.4742],
      [100, 0.4742],
    ],
    statOverrides: { damage: 97 },
    cost: null, // 아직 확인 안 됨
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ── 특수탄(Special) 화기 전용 탄약 — 전부 무기 고유 곡선(공용 풀 없음), 위키 실측치+사용자 확인
  // ═══════════════════════════════════════════════════════════════════════

  // Nitro Express
  nitroexpress_special: {
    label: "Special",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_nitro_regular_tight.png",
    icon: "🟫",
    description: "기본탄.",
    cost: 0,
    statOverrides: {  },
  },
  nitroexpress_explosive: {
    label: "폭발탄",
    category: "special",
    effect: "explosive",
    image: "images/ui/ammo_effects/ammo_nitro_explosive.png",
    icon: "💥",
    description: "폭발탄 - 광범위 폭발 데미지. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    statOverrides: { damage: 163, dropRange: 20, muzzleVelocity: 410 },
  },
  nitroexpress_shredder: {
    label: "슈레더탄",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_nitro_fragmentation.png",
    icon: "🩸",
    description: "슈레더탄 - 명중 시 강한 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    statOverrides: { dropRange: 40, muzzleVelocity: 495 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  // Crossbow / Crossbow Deadeye 공용 (Deadeye는 흔들림만 다르고 탄약 델타는 완전히 동일)
  crossbow_bolt: {
    label: "Bolt",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_crossbow_regular_tight.png",
    icon: "🟫",
    description: "기본 볼트.",
    cost: 0,
    statOverrides: {  },
  },
  crossbow_explosive_bolt: {
    label: "폭발 볼트",
    category: "special",
    effect: "explosive",
    image: "images/ui/ammo_effects/ammo_crossbow_explosive_bolt.png",
    icon: "💥",
    description: "폭발 볼트 - 광범위 폭발 데미지. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    statOverrides: { damage: 220, dropRange: 10, spread: 37.5, muzzleVelocity: 60, ammoExtra: 8 },
  },
  crossbow_shot_bolt: {
    label: "샷 볼트",
    category: "special",
    effect: "shot_bolt",
    image: "images/ui/ammo_effects/ammo_crossbow_shot_bolt.png",
    icon: "🔫",
    description: "샷 볼트 - 명중 시 산탄으로 확산.",
    cost: 40,
    statOverrides: { damage: 454, dropRange: 15, muzzleVelocity: 100, ammoExtra: 12 },
  },
  crossbow_steel_bolt: {
    label: "강철 볼트",
    category: "special",
    image: "images/ui/ammo_effects/ammo_crossbow_iron_bolt.png",
    icon: "🔩",
    description: "강철 볼트 - 낙하범위·탄속 증가, 반동 증가. 회수 후 재사용 가능.",
    cost: 40,
    statOverrides: { dropRange: 35, verticalRecoil: 8, muzzleVelocity: 225, ammoExtra: 14 },
    specialEffects: ["회수 후 재사용 가능"],
  },

  // Shredder (연사형, 전용 볼트 하나만 사용 — 위키에 별도 특수탄 목록 없음)
  shredder_bolt: {
    label: "Bolt",
    category: "special",
    isBase: true,
    // ✅ [확인됨] 탄약 아이콘 불필요 (사용자 확인 - 탄종 1개뿐이라 Ammo Types 섹션 자체가 안 보임)
    image: "",
    icon: "🏹",
    description: "기본 볼트.",
    cost: 0,
    statOverrides: {  },
  },

  // Bomb Launcher
  bomblauncher_charge: {
    label: "기본 발사체",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_bomb_lance_regular_harpoon_tight.png",
    icon: "🟫",
    description: "기본 발사체.",
    cost: 0,
    statOverrides: {  },
  },
  bomblauncher_dragonbreath: {
    label: "드래곤브레스 충전물",
    category: "special",
    effect: "dragonbreath",
    image: "images/ui/ammo_effects/ammo_bomb_lance_dragonbreath.png",
    icon: "🔥",
    description: "드래곤브레스 충전물 - 화염 피해. 명중 시 발화.",
    cost: 10,
    statOverrides: { damage: 58, spread: 32.5, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },
  bomblauncher_harpoon: {
    label: "작살",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_bomb_lance_harpoon.png",
    icon: "🩸",
    description: "작살 - 명중 시 강한 출혈. 회수 후 재사용 가능.",
    cost: 5,
    statOverrides: { damage: 260, spread: 9, muzzleVelocity: 80, ammoExtra: 12 },
    specialEffects: ["강한 출혈 효과 발생", "회수 후 재사용 가능"],
  },
  bomblauncher_steelball: {
    label: "강철탄",
    category: "special",
    effect: "ball_shot",
    image: "images/ui/ammo_effects/ammo_bomb_lance_ball_shot.png",
    icon: "🔩",
    description: "강철탄 - 탄속 대폭 증가, 분산도 증가.",
    cost: 5,
    statOverrides: { damage: 239, spread: 62.5, muzzleVelocity: 450, ammoExtra: 8 },
  },
  bomblauncher_waxedfrag: {
    label: "왁스 파편탄",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_bomb_lance_waterproof_explosive.png",
    icon: "🩸",
    description: "왁스 파편탄 - 착탄+폭발 데미지, 강한 출혈. (표기 데미지는 착탄25+최대폭발126의 합산치)",
    cost: 50,
    statOverrides: { damage: 174, ammoExtra: 8 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  // Bomb Lance (동일 탄약군, 왁스파편탄만 데미지 수치 다름)
  bomblance_charge: {
    label: "기본 발사체",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_bomb_lance_regular_harpoon_tight.png",
    icon: "🟫",
    description: "기본 발사체.",
    cost: 0,
    statOverrides: {  },
  },
  bomblance_dragonbreath: {
    label: "드래곤브레스 충전물",
    category: "special",
    effect: "dragonbreath",
    image: "images/ui/ammo_effects/ammo_bomb_lance_dragonbreath.png",
    icon: "🔥",
    description: "드래곤브레스 충전물 - 화염 피해. 명중 시 발화.",
    cost: 10,
    statOverrides: { damage: 58, spread: 32.5, muzzleVelocity: 100 },
    specialEffects: ["중급 화상 효과 발생"],
  },
  bomblance_harpoon: {
    label: "작살",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_bomb_lance_harpoon.png",
    icon: "🩸",
    description: "작살 - 명중 시 강한 출혈. 회수 후 재사용 가능.",
    cost: 5,
    statOverrides: { damage: 260, spread: 9, muzzleVelocity: 80, ammoExtra: 12 },
    specialEffects: ["강한 출혈 효과 발생", "회수 후 재사용 가능"],
  },
  bomblance_steelball: {
    label: "강철탄",
    category: "special",
    effect: "ball_shot",
    image: "images/ui/ammo_effects/ammo_bomb_lance_ball_shot.png",
    icon: "🔩",
    description: "강철탄 - 탄속 대폭 증가, 분산도 증가.",
    cost: 5,
    statOverrides: { damage: 239, spread: 62.5, muzzleVelocity: 450, ammoExtra: 8 },
  },
  bomblance_waxedfrag: {
    label: "왁스 파편탄",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_bomb_lance_waterproof_explosive.png",
    icon: "🩸",
    description: "왁스 파편탄 - 강한 출혈 효과.",
    cost: 50,
    statOverrides: { damage: 126, ammoExtra: 8 },
    specialEffects: ["강한 출혈 효과 발생"],
  },

  // Hunting Bow
  huntingbow_arrow: {
    label: "Arrow",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_bow_regular_tight.png",
    icon: "🟫",
    description: "기본 화살.",
    cost: 0,
    statOverrides: {  },
  },
  huntingbow_concertina: {
    label: "철조망 화살",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_bow_wire.png",
    icon: "🩸",
    description: "철조망 화살 - 착탄 지점에 철조망 생성, 중급 출혈.",
    cost: 30,
    statOverrides: { damage: 152, dropRange: 10, spread: 40, muzzleVelocity: 80, ammoExtra: 10 },
    specialEffects: ["중급 출혈 효과 발생", "착탄 지점에 철조망 생성"],
  },
  huntingbow_frag: {
    label: "파편 화살",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_bow_fragmentation.png",
    icon: "🩸",
    description: "파편 화살 - 2초 후 폭발, 중급 출혈. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    statOverrides: { damage: 134, dropRange: 10, muzzleVelocity: 80, ammoExtra: 10 },
    specialEffects: ["중급 출혈 효과 발생", "2초 후 폭발"],
  },
  huntingbow_poison: {
    label: "중독 화살",
    category: "special",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_bow_poison.png",
    icon: "🟢",
    description: "중독 화살 - 강한 중독 효과. 회수 후 재사용 가능.",
    cost: 25,
    statOverrides: { spread: 30, ammoExtra: 10 },
    specialEffects: ["강한 중독 효과 발생", "회수 후 재사용 가능"],
  },

  // Chu Ko Nu
  chukonu_bolt: {
    label: "Bolt",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_chu_ko_nu_regular_tight.png",
    icon: "🟫",
    description: "기본 볼트.",
    cost: 0,
    statOverrides: {  },
  },
  chukonu_explosive: {
    label: "폭발 볼트",
    category: "special",
    effect: "explosive",
    image: "images/ui/ammo_effects/ammo_chu_ko_nu_explosive.png",
    icon: "💥",
    description: "폭발 볼트 - 짧은 시간 후 폭발, 약한 출혈. 발사속도 감소. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    // ✅ 장전수(Loaded) 10→5, 예비탄(Extra) 10→5 둘 다 반영
    statOverrides: { damage: 99, rateOfFire: 25, spread: 17.5, muzzleVelocity: 80, ammoLoaded: "5", ammoExtra: 5 },
    specialEffects: ["약한 출혈 효과 발생", "짧은 시간 후 폭발"],
  },
  chukonu_incendiary: {
    label: "소이 볼트",
    category: "special",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_chu_ko_nu_incendiary.png",
    icon: "🔥",
    description: "소이 볼트 - 명중 시 중급 화상 효과.",
    cost: 25,
    statOverrides: {  },
    specialEffects: ["중급 화상 효과 발생"],
  },

  // Dolch 96
  dolch96_special: {
    label: "Special",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_dolch_regular_tight.png",
    icon: "🟫",
    description: "기본탄.",
    cost: 0,
    statOverrides: {  },
  },
  dolch96_dumdum: {
    label: "덤덤탄(출혈)",
    category: "special",
    effect: "bleed",
    image: "images/ui/ammo_effects/ammo_dolch_dumdum.png",
    icon: "🩸",
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용).",
    cost: null,
    scarce: true,
    statOverrides: { dropRange: 65, muzzleVelocity: 390 },
    specialEffects: ["중급 출혈 효과 발생"],
  },

  // Hand Crossbow
  handcrossbow_bolt: {
    label: "Bolt",
    category: "special",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_hand_crossbow_regular_tight.png",
    icon: "🟫",
    description: "기본 볼트.",
    cost: 0,
    statOverrides: {  },
  },
  handcrossbow_chaos: {
    label: "카오스 볼트",
    category: "special",
    effect: "chaos",
    image: "images/ui/ammo_effects/ammo_hand_crossbow_confusion.png",
    icon: "❓",
    description: "카오스 볼트 - 착탄 지점에서 무작위 총성 발생.",
    cost: 10,
    statOverrides: { damage: 65, muzzleVelocity: 50, ammoExtra: 10 },
    specialEffects: ["착탄 지점에서 무작위 총성 발생"],
  },
  handcrossbow_choke: {
    label: "초크 볼트",
    category: "special",
    effect: "choke",
    image: "images/ui/ammo_effects/ammo_hand_crossbow_suffocation.png",
    icon: "☁️",
    description: "초크 볼트 - 착탄 지점에 소형 초크 구름 생성.",
    cost: 10,
    statOverrides: { damage: 1, ammoExtra: 10 },
    specialEffects: ["착탄 지점에 소형 초크 구름 생성"],
  },
  handcrossbow_dragon: {
    label: "드래곤 볼트",
    category: "special",
    effect: "dragonbreath",
    image: "images/ui/ammo_effects/ammo_hand_crossbow_dragonbreath.png",
    icon: "🔥",
    description: "드래곤 볼트 - 중급 화상 효과, 착탄 지점에 소형 화염지대 생성. 초크 구름 접촉 시 즉시 소멸.",
    cost: 40,
    statOverrides: { damage: 11, ammoExtra: 4 },
    specialEffects: ["중급 화상 효과 발생", "착탄 지점에 소형 화염지대 생성"],
  },
  handcrossbow_poison: {
    label: "중독 볼트",
    category: "special",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_hand_crossbow_poison.png",
    icon: "🟢",
    description: "중독 볼트 - 약한 중독 효과, 착탄 지점에 소형 중독 구름 생성.",
    cost: 25,
    statOverrides: { damage: 110 },
    specialEffects: ["약한 중독 효과 발생", "착탄 지점에 소형 중독 구름 생성"],
  },

  // Flame Rifle (전용 연료, 특수탄 없음) — 전용 아이콘 소스 없어서 빈 값(이모지 폴백)
  flamerifle_oil: {
    label: "Oil",
    category: "special",
    isBase: true,
    // ✅ [확인됨] 탄약 아이콘 불필요 (사용자 확인 - 탄종 1개뿐이라 Ammo Types 섹션 자체가 안 보임)
    image: "",
    icon: "🔥",
    description: "화염방사기 연료.",
    cost: 0,
    statOverrides: {  },
  },
};

// -------------------------------------------------------------------------
// 4. ITEMS
// -------------------------------------------------------------------------
const ITEMS = [

  // ── 무기 ─────────────────────────────────────────────────────────────
  {
    id: "weapon_frontier_73c",
    category: "weapon",
    name: "Frontier 73C",
    image: "images/weapons/frontier_73c.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "compact",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "high_velocity", "incendiary", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "compact",
      "compact_fmj",
      "compact_high_velocity",
      "compact_incendiary",
      "compact_poison",
      "compact_subsonic",
    ],
    defaultAmmo: "compact",

    // 기본 정보
    price: 41,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "7+1",
      extra: 21,
    },

    // 기본 스탯
    stats: {
      damage: 110,
      dropRange: 140,
      rateOfFire: 29,
      cycleTime: 1.2,
      spread: 17.5,
      sway: 77,
      verticalRecoil: 5,
      reloadSpeed: 10.1,
      muzzleVelocity: 400,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "frontier73c_silencer",
        name: "Frontier 73C Silencer",
        image: "images/weapons/variants/frontier73c_silencer.png",
        description: "",
        price: 55,
        stats: {
          damage: 104,
          dropRange: 120,
          spread: 25,
          muzzleVelocity: 340,
        },
      },
      {
        id: "frontier73c_marksman",
        name: "Frontier 73C Marksman",
        image: "images/weapons/variants/frontier73c_marksman.png",
        description: "",
        price: 45,
        stats: {
          cycleTime: 1.3,
          spread: 25,
          sway: 69,
        },
      },
    ],
  },

  {
    id: "weapon_infantry_73l",
    category: "weapon",
    name: "Infantry 73L",
    image: "images/weapons/infantry_73l.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "compact",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "high_velocity", "incendiary", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "infantry73l_compact",
      "infantry73l_fmj",
      "infantry73l_high_velocity",
      "infantry73l_incendiary",
      "infantry73l_poison",
      "infantry73l_subsonic",
    ],
    defaultAmmo: "infantry73l_compact",

    // 기본 정보
    price: 78,
    updateAdded: "Update 2.0",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "17+1",
      extra: 20,
    },

    // 기본 스탯
    stats: {
      damage: 110,
      dropRange: 145,
      rateOfFire: 35,
      cycleTime: 1.2,
      spread: 17.5,
      sway: 77,
      verticalRecoil: 3,
      reloadSpeed: 17.9,
      muzzleVelocity: 400,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 모무기와 다른 값만 표기)
    variants: [
      {
        id: "infantry73l_sniper",
        name: "Infantry 73L Sniper",
        image: "images/weapons/variants/infantry73l_sniper.png",
        description: "",
        price: 90,
        stats: {
          sway: 69,
        },
      },
      {
        id: "infantry73l_bayonet",
        name: "Infantry 73L Bayonet",
        image: "images/weapons/variants/infantry73l_bayonet.png",
        description: "",
        price: 88,
        stats: {
          meleeHeavy: 168,
        },
      },
    ],
  },

  {
    id: "weapon_marathon",
    category: "weapon",
    name: "Marathon",
    image: "images/weapons/marathon.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "compact",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "high_velocity", "incendiary", "poison"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id) — 아음속탄 없음
    ammoTypes: [
      "marathon_compact",
      "marathon_fmj",
      "marathon_high_velocity",
      "marathon_incendiary",
      "marathon_poison",
    ],
    defaultAmmo: "marathon_compact",

    // 기본 정보
    price: 68,
    updateAdded: "Update 1.16",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "15+1",
      extra: 24,
    },

    // 기본 스탯
    stats: {
      damage: 113,
      dropRange: 140,
      rateOfFire: 31,
      cycleTime: 1,
      spread: 15,
      sway: 77,
      verticalRecoil: 7,
      reloadSpeed: 19.2,
      muzzleVelocity: 430,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "marathon_swift",
        name: "Marathon Swift",
        image: "images/weapons/variants/marathon_swift.png",
        description: "",
        price: 95,
        stats: {
          rateOfFire: 45,
          reloadSpeed: 10,
        },
      },
    ],
  },

  {
    id: "weapon_ranger_73",
    category: "weapon",
    name: "Ranger 73",
    image: "images/weapons/ranger_73.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "compact",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "high_velocity", "incendiary", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "ranger73_compact",
      "ranger73_fmj",
      "ranger73_high_velocity",
      "ranger73_incendiary",
      "ranger73_poison",
      "ranger73_subsonic",
    ],
    defaultAmmo: "ranger73_compact",

    // 기본 정보
    price: 75,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "15+1",
      extra: 20,
    },

    // 기본 스탯
    stats: {
      damage: 110,
      dropRange: 140,
      rateOfFire: 31,
      cycleTime: 1.2,
      spread: 17.5,
      sway: 77,
      verticalRecoil: 4,
      reloadSpeed: 16.4,
      muzzleVelocity: 400,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 3종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "ranger73_swift",
        name: "Ranger 73 Swift",
        image: "images/weapons/variants/ranger73_swift.png",
        description: "",
        price: 128,
        stats: {
          rateOfFire: 41,
          reloadSpeed: 8.4,
        },
      },
      {
        id: "ranger73_talon",
        name: "Ranger 73 Talon",
        image: "images/weapons/variants/ranger73_talon.png",
        description: "",
        price: 85,
        stats: {
          meleeHeavy: 330,
          staminaConsumption: 33,
        },
      },
      {
        id: "ranger73_aperture",
        name: "Ranger 73 Aperture",
        image: "images/weapons/variants/ranger73_aperture.png",
        description: "",
        price: 79,
        stats: {
          sway: 69,
        },
      },
    ],
  },

  {
    id: "weapon_vandal_73c",
    category: "weapon",
    name: "Vandal 73C",
    image: "images/weapons/vandal_73c.png",

    // 검색 필터용
    slotSize: 2,
    ammoCategory: "compact",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "high_velocity", "incendiary", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "vandal73c_compact",
      "vandal73c_fmj",
      "vandal73c_high_velocity",
      "vandal73c_incendiary",
      "vandal73c_poison",
      "vandal73c_subsonic",
    ],
    defaultAmmo: "vandal73c_compact",

    // 기본 정보
    price: 35,
    updateAdded: "Update 1.4.3",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6+1",
      extra: 18,
    },

    // 기본 스탯
    stats: {
      damage: 107,
      dropRange: 120,
      rateOfFire: 28,
      cycleTime: 1.2,
      spread: 25,
      sway: 100,
      verticalRecoil: 8,
      reloadSpeed: 9.4,
      muzzleVelocity: 370,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "vandal73c_bullseye",
        name: "Vandal 73C Bullseye",
        image: "images/weapons/variants/vandal73c_bullseye.png",
        description: "",
        price: 37,
        stats: {
          spread: 35,
          sway: 93,
        },
      },
      {
        id: "vandal73c_striker",
        name: "Vandal 73C Striker",
        image: "images/weapons/variants/vandal73c_striker.png",
        description: "",
        price: 45,
        stats: {
          cycleTime: 1.3,
          meleeLight: 52,
          meleeHeavy: 105,
          staminaConsumption: 21,
        },
      },
    ],
  },

  {
    id: "weapon_bornheim_no3",
    category: "weapon",
    name: "Bornheim No. 3",
    image: "images/weapons/bornheim_no3.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["high_velocity", "incendiary", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "bornheim_compact",
      "bornheim_high_velocity",
      "bornheim_incendiary",
      "bornheim_subsonic",
    ],
    defaultAmmo: "bornheim_compact",

    // 기본 정보
    price: 146,
    updateAdded: "Update Early Access 5.0",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "5+1",
      extra: 15,
    },

    // 기본 스탯
    stats: {
      damage: 74,
      dropRange: 80,
      rateOfFire: 65,
      cycleTime: 0.2,
      spread: 25,
      sway: 128,
      verticalRecoil: 6,
      reloadSpeed: 7.4,
      muzzleVelocity: 380,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 3종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "bornheim_match",
        name: "Bornheim No. 3 Match",
        image: "images/weapons/variants/bornheim_match.png",
        description: "",
        weaponClass: "rifle", // 카빈/개조형은 소총 판정으로 override
        slotSize: 2,
        ammoTypes: ["bornheim_match_compact", "bornheim_high_velocity", "bornheim_incendiary", "bornheim_subsonic"],
        defaultAmmo: "bornheim_match_compact",
        price: 180,
        stats: {
          damage: 80,
          dropRange: 85,
          spread: 22.5,
          sway: 87,
          verticalRecoil: 3,
          reloadSpeed: 7.6,
          muzzleVelocity: 400,
        },
      },
      {
        id: "bornheim_silencer",
        name: "Bornheim No. 3 Silencer",
        image: "images/weapons/variants/bornheim_silencer.png",
        description: "",
        price: 174,
        stats: {
          damage: 70,
          dropRange: 70,
          muzzleVelocity: 323,
        },
      },
      {
        id: "bornheim_extended",
        name: "Bornheim No. 3 Extended",
        image: "images/weapons/variants/bornheim_extended.png",
        description: "",
        price: 203,
        chamber: {
          loaded: "8+1",
        },
        stats: {
          rateOfFire: 44,
          reloadSpeed: 9.6,
        },
      },
    ],
  },

  {
    id: "weapon_conversion",
    category: "weapon",
    name: "Conversion",
    image: "images/weapons/conversion.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["bleed", "full_metal"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "conversion_compact",
      "conversion_dumdum",
      "conversion_fmj",
    ],
    defaultAmmo: "conversion_compact",

    // 기본 정보
    price: 55,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6",
      extra: 18,
    },

    // 기본 스탯
    stats: {
      damage: 104,
      dropRange: 75,
      rateOfFire: 21,
      cycleTime: 1.4,
      spread: 30,
      sway: 128,
      verticalRecoil: 4.5,
      reloadSpeed: 11.2,
      muzzleVelocity: 300,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "conversion_chain_pistol",
        name: "Conversion Chain Pistol",
        image: "images/weapons/variants/conversion_chain_pistol.png",
        description: "",
        price: 84,
        chamber: {
          loaded: "17",
        },
        stats: {
          rateOfFire: 24,
          spread: 45,
          verticalRecoil: 3.5,
          reloadSpeed: 28.7,
        },
      },
    ],
  },

  {
    id: "weapon_lemat",
    category: "weapon",
    name: "LeMat",
    image: "images/weapons/lemat.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
    weaponClass: "handgun", // handgun/rifle/shotgun
    secondaryAmmoCategories: ["shotgun"], // 하부 총열 샷건 보유 (르맷)
    ammoEffects: ["full_metal", "incendiary", "slug", "flare", "dragonbreath"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "lemat_compact",
      "lemat_fmj",
      "lemat_incendiary",
      "lemat_shells",
      "lemat_dragonbreath",
      "lemat_slug",
      "lemat_starshell",
    ],
    defaultAmmo: "lemat_compact",

    // 기본 정보
    price: 83,
    updateAdded: "Update Early Access 6.0",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "9",
      extra: 18,
    },

    // 기본 스탯
    stats: {
      damage: 97,
      dropRange: 75,
      rateOfFire: 25,
      cycleTime: 1.3,
      spread: 40,
      sway: 128,
      verticalRecoil: 6,
      reloadSpeed: 15.8,
      muzzleVelocity: 375,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 본체와 다른 값만 표기, 권총 총열 기준)
    variants: [
      {
        id: "lemat_carbine",
        name: "LeMat Carbine",
        image: "images/weapons/variants/lemat_carbine.png",
        description: "",
        weaponClass: "rifle", // 카빈/개조형은 소총 판정으로 override
        slotSize: 3,
        ammoTypes: ["lemat_carbine_compact", "lemat_fmj", "lemat_incendiary", "lemat_shells", "lemat_dragonbreath", "lemat_slug", "lemat_starshell"],
        defaultAmmo: "lemat_carbine_compact",
        price: 115,
        stats: {
          damage: 107,
          dropRange: 130,
          rateOfFire: 21,
          cycleTime: 1.2,
          spread: 35,
          sway: 77,
          verticalRecoil: 2.5,
          reloadSpeed: 18.7,
          muzzleVelocity: 460,
        },
      },
      {
        id: "lemat_carbine_marksman",
        name: "LeMat Carbine Marksman",
        image: "images/weapons/variants/lemat_carbine_marksman.png",
        description: "",
        weaponClass: "rifle", // 카빈/개조형은 소총 판정으로 override
        slotSize: 3,
        ammoTypes: ["lemat_carbine_compact", "lemat_fmj", "lemat_incendiary", "lemat_shells", "lemat_dragonbreath", "lemat_slug", "lemat_starshell"],
        defaultAmmo: "lemat_carbine_compact",
        price: 127,
        stats: {
          damage: 107,
          dropRange: 130,
          rateOfFire: 21,
          cycleTime: 1.2,
          spread: 55,
          sway: 69,
          verticalRecoil: 2.5,
          reloadSpeed: 18.7,
          muzzleVelocity: 460,
        },
      },
    ],
  },

  {
    id: "weapon_nagant_m1895",
    category: "weapon",
    name: "Nagant M1895",
    image: "images/weapons/nagant_m1895.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["bleed", "high_velocity", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "nagant_compact",
      "nagant_dumdum",
      "nagant_high_velocity",
      "nagant_poison",
      "nagant_subsonic",
    ],
    defaultAmmo: "nagant_compact",

    // 기본 정보
    price: 24,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "7",
      extra: 21,
    },

    // 기본 스탯
    stats: {
      damage: 91,
      dropRange: 70,
      rateOfFire: 21,
      cycleTime: 1.5,
      spread: 40,
      sway: 128,
      verticalRecoil: 4,
      reloadSpeed: 12.5,
      muzzleVelocity: 330,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 3종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "nagant_precision",
        name: "Nagant M1895 Precision",
        image: "images/weapons/variants/nagant_precision.png",
        description: "",
        slotSize: 2,
        price: 29,
        chamber: {
          extra: 28,
        },
        stats: {
          cycleTime: 1,
          spread: 27.5,
          sway: 87,
          verticalRecoil: 1.5,
          reloadSpeed: 13.4,
        },
      },
      {
        id: "nagant_silencer",
        name: "Nagant M1895 Silencer",
        image: "images/weapons/variants/nagant_silencer.png",
        description: "",
        price: 27,
        stats: {
          damage: 85,
          dropRange: 60,
          muzzleVelocity: 280,
        },
      },
      {
        id: "nagant_deadeye",
        name: "Nagant M1895 Deadeye",
        image: "images/weapons/variants/nagant_deadeye.png",
        description: "",
        slotSize: 2,
        price: 30,
        chamber: {
          extra: 28,
        },
        stats: {
          cycleTime: 1.2,
          spread: 35,
          sway: 87,
          verticalRecoil: 1.5,
          reloadSpeed: 13.4,
        },
      },
    ],
  },

  {
    id: "weapon_new_army",
    category: "weapon",
    name: "New Army",
    image: "images/weapons/new_army.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["bleed", "full_metal"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "newarmy_compact",
      "newarmy_dumdum",
      "newarmy_fmj",
    ],
    defaultAmmo: "newarmy_compact",

    // 기본 정보
    price: 90,
    updateAdded: "Update 1.8",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 97,
      dropRange: 75,
      rateOfFire: 30,
      cycleTime: 0.5,
      spread: 47.5,
      sway: 128,
      verticalRecoil: 5,
      reloadSpeed: 9.5,
      muzzleVelocity: 230,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "newarmy_swift",
        name: "New Army Swift",
        image: "images/weapons/variants/newarmy_swift.png",
        description: "",
        price: 108,
        stats: {
          rateOfFire: 40,
          reloadSpeed: 5.6,
        },
      },
    ],
  },

  {
    id: "weapon_officer",
    category: "weapon",
    name: "Officer",
    image: "images/weapons/officer.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["bleed", "high_velocity", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "officer_compact",
      "officer_dumdum",
      "officer_high_velocity",
      "officer_poison",
      "officer_subsonic",
    ],
    defaultAmmo: "officer_compact",

    // 기본 정보
    price: 96,
    updateAdded: "Update Early Access 2.2",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "7",
      extra: 14,
    },

    // 기본 스탯
    stats: {
      damage: 91,
      dropRange: 70,
      rateOfFire: 28,
      cycleTime: 0.5,
      spread: 50,
      sway: 128,
      verticalRecoil: 5,
      reloadSpeed: 12.8,
      muzzleVelocity: 330,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 3종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "officer_brawler",
        name: "Officer Brawler",
        image: "images/weapons/variants/officer_brawler.png",
        description: "",
        price: 106,
        stats: {
          meleeLight: 31,
          meleeHeavy: 72,
          staminaConsumption: 10,
        },
      },
      {
        id: "officer_carbine",
        name: "Officer Carbine",
        image: "images/weapons/variants/officer_carbine.png",
        description: "",
        weaponClass: "rifle", // 카빈/개조형은 소총 판정으로 override
        slotSize: 3,
        ammoTypes: ["officer_carbine_compact", "officer_dumdum", "officer_high_velocity", "officer_poison", "officer_subsonic"],
        defaultAmmo: "officer_carbine_compact",
        price: 183,
        stats: {
          damage: 104,
          dropRange: 90,
          spread: 25,
          sway: 77,
          verticalRecoil: 4,
          reloadSpeed: 13.4,
          muzzleVelocity: 360,
        },
      },
      {
        id: "officer_carbine_deadeye",
        name: "Officer Carbine Deadeye",
        image: "images/weapons/variants/officer_carbine_deadeye.png",
        description: "",
        weaponClass: "rifle", // 카빈/개조형은 소총 판정으로 override
        slotSize: 3,
        ammoTypes: ["officer_carbine_compact", "officer_dumdum", "officer_high_velocity", "officer_poison", "officer_subsonic"],
        defaultAmmo: "officer_carbine_compact",
        price: 192,
        stats: {
          damage: 104,
          dropRange: 90,
          spread: 40,
          sway: 69,
          verticalRecoil: 4,
          reloadSpeed: 13.4,
          muzzleVelocity: 360,
        },
      },
    ],
  },

  {
    id: "weapon_centennial",
    category: "weapon",
    name: "Centennial",
    image: "images/weapons/centennial.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["bleed", "full_metal", "high_velocity", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "centennial_medium",
      "centennial_dumdum",
      "centennial_fmj",
      "centennial_high_velocity",
      "centennial_poison",
      "centennial_subsonic",
    ],
    defaultAmmo: "centennial_medium",

    // 기본 정보
    price: 157,
    updateAdded: "Update 1.5",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "9+1",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 123,
      dropRange: 140,
      rateOfFire: 23,
      cycleTime: 1.6,
      spread: 25,
      sway: 77,
      verticalRecoil: 11,
      reloadSpeed: 15.5,
      muzzleVelocity: 600,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 5종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "centennial_sniper",
        name: "Centennial Sniper",
        image: "images/weapons/variants/centennial_sniper.png",
        description: "",
        price: 181,
        stats: {
          spread: 37.5,
          sway: 69,
          reloadSpeed: 15.4,
        },
      },
      {
        id: "centennial_shorty",
        name: "Centennial Shorty",
        image: "images/weapons/variants/centennial_shorty.png",
        description: "",
        price: 103,
        slotSize: 2,
        chamber: {
          loaded: "5+1",
          extra: 9,
        },
        stats: {
          damage: 120,
          dropRange: 110,
          rateOfFire: 24,
          spread: 42.5,
          sway: 100,
          verticalRecoil: 15,
          reloadSpeed: 10.9,
          muzzleVelocity: 540,
          meleeLight: 13,
          meleeHeavy: 31,
        },
      },
      {
        id: "centennial_shorty_silencer",
        name: "Centennial Shorty Silencer",
        image: "images/weapons/variants/centennial_shorty_silencer.png",
        // ✅ [확인됨] 예비 탄약 9발 — 사용자 확인. 가격은 패치노트(Update 2.2.0.35)에서 확정된 118을 사용(위키 캐시엔 구가격 137로 표기돼 있었음).
        description: "",
        price: 118,
        slotSize: 2,
        chamber: {
          loaded: "5+1",
          extra: 9,
        },
        stats: {
          damage: 120,
          dropRange: 100,
          rateOfFire: 24,
          spread: 42.5,
          sway: 100,
          verticalRecoil: 15,
          reloadSpeed: 10.9,
          muzzleVelocity: 459,
          meleeLight: 13,
          meleeHeavy: 31,
        },
      },
      {
        id: "centennial_trauma",
        name: "Centennial Trauma",
        image: "images/weapons/variants/centennial_trauma.png",
        description: "",
        price: 167,
        stats: {
          verticalRecoil: 12.5,
          meleeHeavy: 216,
          staminaConsumption: 40,
        },
      },
      {
        id: "centennial_pointman",
        name: "Centennial Pointman",
        image: "images/weapons/variants/centennial_pointman.png",
        description: "",
        price: 114,
        slotSize: 2,
        chamber: {
          loaded: "5+1",
        },
        stats: {
          damage: 120,
          dropRange: 110,
          rateOfFire: 24,
          spread: 55,
          sway: 93,
          verticalRecoil: 15,
          reloadSpeed: 10.9,
          muzzleVelocity: 540,
          meleeLight: 13,
          meleeHeavy: 31,
        },
      },
    ],
  },

  {
    id: "weapon_wildland",
    category: "weapon",
    name: "Wildland",
    image: "images/weapons/wildland.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
    weaponClass: "rifle", // handgun/rifle/shotgun
    // Centennial과 동일한 탄종 라인업 (영상 리뷰에서 "모든 탄종·기능 유지" 확인됨)
    ammoEffects: ["bleed", "full_metal", "high_velocity", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "wildland_medium",
      "wildland_dumdum",
      "wildland_fmj",
      "wildland_high_velocity",
      "wildland_poison",
      "wildland_subsonic",
    ],
    defaultAmmo: "wildland_medium",

    // 기본 정보
    price: null,
    scarce: true, // Scarce (상점 구매 불가) - Bileweaver's Nest 확률 상자로만 획득 (Homestead 78과 50/50 확률)
    updateAdded: "Update 2.5",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "15+1",
      extra: 16,
    },

    // 기본 스탯 (Hunt: Showdown 1896 Wiki 기준)
    stats: {
      damage: 126,
      dropRange: 150,
      rateOfFire: 31,
      cycleTime: 1.6,
      spread: 22.5,
      sway: 77,
      verticalRecoil: 11,
      reloadSpeed: 9,
      muzzleVelocity: 650,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    variants: [],
  },

  {
    id: "weapon_drilling",
    category: "weapon",
    name: "Drilling",
    image: "images/weapons/drilling.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
    weaponClass: "rifle", // handgun/rifle/shotgun
    secondaryAmmoCategories: ["shotgun"], // 하부 총열 샷건(플리셰트/페니샷/슬러그) 보유
    ammoEffects: ["bleed", "full_metal", "high_velocity", "slug", "pennyshot", "flechette"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "drilling_medium",
      "drilling_dumdum",
      "drilling_fmj",
      "drilling_high_velocity",
      "drilling_shells",
      "drilling_flechette",
      "drilling_pennyshot",
      "drilling_slug",
    ],
    defaultAmmo: "drilling_medium",

    // 기본 정보
    price: 510,
    updateAdded: "Update 1.13",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "2/1",
      extra: 20,
    },

    // 기본 스탯
    stats: {
      damage: 120,
      dropRange: 145,
      rateOfFire: 20,
      cycleTime: 0.6,
      spread: 42.5,
      sway: 77,
      verticalRecoil: 12,
      reloadSpeed: 5.3,
      muzzleVelocity: 530,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 본체와 다른 값만 표기. 라이플 총열 기준, 샷건 총열 별도 수치는 위키에도 일부 불명)
    variants: [
      {
        id: "drilling_hatchet",
        name: "Drilling Hatchet",
        image: "images/weapons/variants/drilling_hatchet.png",
        description: "",
        price: 340,
        slotSize: 2,
        chamber: {
          extra: 16,
        },
        // ⚠ Hatchet와 Shorty는 도끼(근접무기) 부착 유무만 다른 동일한 총이라 하부 총열 탄약도 공유
        ammoTypes: [
          "drilling_medium",
          "drilling_dumdum",
          "drilling_fmj",
          "drilling_high_velocity",
          "drilling_shorty_shells",
          "drilling_flechette",
          "drilling_pennyshot",
          "drilling_slug",
        ],
        defaultAmmo: "drilling_medium",
        stats: {
          damage: 118,
          dropRange: 120,
          rateOfFire: 18,
          spread: 62.5,
          sway: 100,
          verticalRecoil: 16,
          reloadSpeed: 5.6,
          muzzleVelocity: 424,
          meleeLight: 90,
          meleeHeavy: 150,
        },
      },
      {
        id: "drilling_shorty",
        name: "Drilling Shorty",
        image: "images/weapons/variants/drilling_shorty.png",
        description: "",
        price: 330,
        slotSize: 2,
        chamber: {
          extra: 16,
        },
        // ⚠ 샷건쉘(하부 총열)만 전용 탄약으로 교체 - 나머지(라이플 총열 탄종)는 본체와 공유
        ammoTypes: [
          "drilling_medium",
          "drilling_dumdum",
          "drilling_fmj",
          "drilling_high_velocity",
          "drilling_shorty_shells",
          "drilling_flechette",
          "drilling_pennyshot",
          "drilling_slug",
        ],
        defaultAmmo: "drilling_medium",
        stats: {
          damage: 118,
          dropRange: 120,
          spread: 62.5,
          sway: 100,
          verticalRecoil: 16,
          reloadSpeed: 4.8,
          muzzleVelocity: 424,
          meleeLight: 13,
          meleeHeavy: 31,
          staminaConsumption: 20,
        },
      },
    ],
  },

  {
    id: "weapon_maynard_sniper",
    category: "weapon",
    name: "Maynard Sniper",
    image: "images/weapons/maynard_sniper.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
    weaponClass: "rifle", // handgun/rifle/shotgun
    dualAmmoSlot: true, // 단발식이라 탄종 2개를 동시에 넣고 교체 가능(사용자 확인)
    ammoEffects: ["bleed", "high_velocity", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "maynard_medium",
      "maynard_dumdum",
      "maynard_high_velocity",
      "maynard_subsonic",
    ],
    defaultAmmo: "maynard_medium",

    // 기본 정보
    price: 139,
    updateAdded: "Update 2.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "1",
      extra: 26,
    },

    // 기본 스탯
    stats: {
      damage: 144,
      dropRange: 160,
      rateOfFire: 11,
      cycleTime: 5.8,
      spread: 25,
      sway: 69,
      verticalRecoil: 8,
      reloadSpeed: 5,
      muzzleVelocity: 560,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "maynard_silencer",
        name: "Maynard Sniper Silencer",
        image: "images/weapons/variants/maynard_silencer.png",
        description: "",
        weaponClass: "rifle",
        price: 159,
        slotSize: 5,
        stats: {
          damage: 136,
          dropRange: 150,
          muzzleVelocity: 476,
        },
      },
    ],
  },

  {
    id: "weapon_springfield_1866",
    category: "weapon",
    name: "Springfield 1866",
    image: "images/weapons/springfield_1866.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
    weaponClass: "rifle", // handgun/rifle/shotgun
    dualAmmoSlot: true, // 단발식이라 탄종 2개를 동시에 넣고 교체 가능(사용자 확인)
    ammoEffects: ["bleed", "explosive", "high_velocity", "poison"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "springfield1866_medium",
      "springfield1866_dumdum",
      "springfield1866_explosive",
      "springfield1866_high_velocity",
      "springfield1866_poison",
    ],
    defaultAmmo: "springfield1866_medium",

    // 기본 정보
    price: 38,
    updateAdded: "Update 1.1.3",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "1",
      extra: 24,
    },

    // 기본 스탯
    stats: {
      damage: 139,
      dropRange: 160,
      rateOfFire: 19,
      cycleTime: 3.3,
      spread: 20,
      sway: 77,
      verticalRecoil: 6,
      reloadSpeed: 3,
      muzzleVelocity: 490,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 5종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "springfield1866_bayonet",
        name: "Springfield 1866 Bayonet",
        image: "images/weapons/variants/springfield1866_bayonet.png",
        description: "",
        weaponClass: "rifle",
        price: 48,
        stats: {
          meleeHeavy: 168,
        },
      },
      {
        id: "springfield1866_bullseye",
        name: "Springfield 1866 Bullseye",
        image: "images/weapons/variants/springfield1866_bullseye.png",
        description: "",
        weaponClass: "rifle",
        price: 35,
        slotSize: 2,
        chamber: {
          extra: 20,
        },
        stats: {
          damage: 135,
          dropRange: 120,
          spread: 55,
          sway: 93,
          verticalRecoil: 12,
          muzzleVelocity: 440,
          meleeLight: 13,
          meleeHeavy: 31,
        },
      },
      {
        id: "springfield1866_marksman",
        name: "Springfield 1866 Marksman",
        image: "images/weapons/variants/springfield1866_marksman.png",
        description: "",
        weaponClass: "rifle",
        price: 42,
        stats: {
          spread: 37.5,
          sway: 69,
        },
      },
      {
        id: "springfield1866_shorty",
        name: "Springfield 1866 Shorty",
        image: "images/weapons/variants/springfield1866_shorty.png",
        description: "",
        weaponClass: "rifle",
        price: 33,
        slotSize: 2,
        chamber: {
          extra: 20,
        },
        stats: {
          damage: 130,
          dropRange: 120,
          spread: 40,
          sway: 100,
          verticalRecoil: 12,
          muzzleVelocity: 440,
          meleeLight: 13,
          meleeHeavy: 31,
        },
      },
      {
        id: "springfield1866_striker",
        name: "Springfield 1866 Striker",
        image: "images/weapons/variants/springfield1866_striker.png",
        description: "",
        weaponClass: "rifle",
        price: 43,
        slotSize: 2,
        chamber: {
          extra: 20,
        },
        stats: {
          damage: 135,
          dropRange: 120,
          spread: 40,
          sway: 100,
          verticalRecoil: 12,
          muzzleVelocity: 440,
          meleeLight: 52,
          meleeHeavy: 105,
          staminaConsumption: 21,
        },
      },
    ],
  },

  {
    id: "weapon_1865_carbine",
    category: "weapon",
    name: "1865 Carbine",
    image: "images/weapons/carbine_1865.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "medium",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "carbine1865_medium",
      "carbine1865_fmj",
      "carbine1865_subsonic",
    ],
    defaultAmmo: "carbine1865_medium",

    // 기본 정보
    price: 70,
    updateAdded: "Update 2.0",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "7+1",
      extra: 21,
    },

    // 기본 스탯
    stats: {
      damage: 145,
      dropRange: 115,
      rateOfFire: 22,
      cycleTime: 1.8,
      spread: 23,
      sway: 77,
      verticalRecoil: 4,
      reloadSpeed: 8.5,
      muzzleVelocity: 340,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "carbine1865_aperture",
        name: "1865 Carbine Aperture",
        image: "images/weapons/variants/carbine1865_aperture.png",
        description: "",
        weaponClass: "rifle",
        price: 74,
        stats: {
          dropRange: 120,
        },
      },
      {
        id: "carbine1865_silencer",
        name: "1865 Carbine Silencer",
        image: "images/weapons/variants/carbine1865_silencer.png",
        description: "",
        weaponClass: "rifle",
        price: 80,
        stats: {
          damage: 137,
          dropRange: 105,
          muzzleVelocity: 289,
        },
      },
    ],
  },

  {
    id: "weapon_vetterli_71",
    category: "weapon",
    name: "Vetterli 71",
    image: "images/weapons/vetterli_71.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "medium",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "high_velocity", "incendiary", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "vetterli71_medium",
      "vetterli71_fmj",
      "vetterli71_high_velocity",
      "vetterli71_incendiary",
      "vetterli71_subsonic",
    ],
    defaultAmmo: "vetterli71_medium",

    // 기본 정보
    price: 105,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6+1",
      extra: 16,
    },

    // 기본 스탯
    stats: {
      damage: 130,
      dropRange: 125,
      rateOfFire: 24,
      cycleTime: 1.4,
      spread: 22.5,
      sway: 77,
      verticalRecoil: 5,
      reloadSpeed: 12.1,
      muzzleVelocity: 410,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 5종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "vetterli71_bayonet",
        name: "Vetterli 71 Bayonet",
        image: "images/weapons/variants/vetterli71_bayonet.png",
        description: "",
        weaponClass: "rifle",
        price: 115,
        stats: {
          meleeHeavy: 168,
        },
      },
      {
        id: "vetterli71_cyclone",
        name: "Vetterli 71 Cyclone",
        image: "images/weapons/variants/vetterli71_cyclone.png",
        description: "",
        weaponClass: "rifle",
        price: 280,
        chamber: {
          loaded: "3+1",
        },
        stats: {
          damage: 120,
          dropRange: 100,
          rateOfFire: 27,
          cycleTime: 0.6,
          spread: 47.5,
          verticalRecoil: 7,
          reloadSpeed: 8.9,
          muzzleVelocity: 370,
        },
      },
      {
        id: "vetterli71_deadeye",
        name: "Vetterli 71 Deadeye",
        image: "images/weapons/variants/vetterli71_deadeye.png",
        description: "",
        weaponClass: "rifle",
        price: 110,
        stats: {
          spread: 32.5,
          sway: 69,
        },
      },
      {
        id: "vetterli71_marksman",
        name: "Vetterli 71 Marksman",
        image: "images/weapons/variants/vetterli71_marksman.png",
        description: "",
        weaponClass: "rifle",
        price: 116,
        stats: {
          spread: 42.5,
          sway: 69,
        },
      },
      {
        id: "vetterli71_silencer",
        name: "Vetterli 71 Silencer",
        image: "images/weapons/variants/vetterli71_silencer.png",
        description: "",
        weaponClass: "rifle",
        price: 150,
        stats: {
          damage: 123,
          dropRange: 115,
          muzzleVelocity: 348,
        },
      },
    ],
  },

  {
    id: "weapon_pax",
    category: "weapon",
    name: "Pax",
    image: "images/weapons/pax.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "medium",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["bleed", "full_metal", "high_velocity", "incendiary", "poison"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "pax_medium",
      "pax_dumdum",
      "pax_fmj",
      "pax_high_velocity",
      "pax_incendiary",
      "pax_poison",
    ],
    defaultAmmo: "pax_medium",

    // 기본 정보
    price: 80,
    updateAdded: "Update Early Access 4.2",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 110,
      dropRange: 65,
      rateOfFire: 22,
      cycleTime: 1.4,
      spread: 32.5,
      sway: 128,
      verticalRecoil: 10,
      reloadSpeed: 11.2,
      muzzleVelocity: 330,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "pax_claw",
        name: "Pax Claw",
        image: "images/weapons/variants/pax_claw.png",
        description: "",
        weaponClass: "handgun",
        price: 90,
        stats: {
          meleeLight: 52,
          meleeHeavy: 105,
        },
      },
      {
        id: "pax_trueshot",
        name: "Pax Trueshot",
        image: "images/weapons/variants/pax_trueshot.png",
        description: "",
        weaponClass: "handgun",
        price: 141,
        stats: {
          damage: 114,
          dropRange: 80,
          rateOfFire: 18,
          cycleTime: 1.6,
          spread: 27.5,
          verticalRecoil: 16,
          muzzleVelocity: 410,
          staminaConsumption: 20,
        },
      },
    ],
  },

  {
    id: "weapon_scottfield",
    category: "weapon",
    name: "Scottfield",
    image: "images/weapons/scottfield.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "medium",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["bleed", "full_metal", "high_velocity", "incendiary"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "scottfield_medium",
      "scottfield_dumdum",
      "scottfield_fmj",
      "scottfield_high_velocity",
      "scottfield_incendiary",
    ],
    defaultAmmo: "scottfield_medium",

    // 기본 정보
    price: 77,
    updateAdded: "Update 1.6.2",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 107,
      dropRange: 65,
      rateOfFire: 24,
      cycleTime: 1.5,
      spread: 28.1,
      sway: 128,
      verticalRecoil: 9,
      reloadSpeed: 9,
      muzzleVelocity: 280,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 4종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "scottfield_brawler",
        name: "Scottfield Brawler",
        image: "images/weapons/variants/scottfield_brawler.png",
        description: "",
        weaponClass: "handgun",
        price: 87,
        stats: {
          dropRange: 60,
          spread: 36,
          verticalRecoil: 12,
          meleeLight: 31,
          meleeHeavy: 72,
          staminaConsumption: 10,
        },
      },
      {
        id: "scottfield_precision",
        name: "Scottfield Precision",
        image: "images/weapons/variants/scottfield_precision.png",
        description: "",
        weaponClass: "handgun",
        price: 85,
        slotSize: 2,
        chamber: {
          extra: 18,
        },
        stats: {
          rateOfFire: 27,
          cycleTime: 1,
          sway: 87,
          verticalRecoil: 3,
        },
      },
      {
        id: "scottfield_spitfire",
        name: "Scottfield Spitfire",
        image: "images/weapons/variants/scottfield_spitfire.png",
        description: "",
        weaponClass: "handgun",
        price: 108,
        stats: {
          dropRange: 60,
          rateOfFire: 30,
          cycleTime: 0.8,
          spread: 36,
          verticalRecoil: 12,
          staminaConsumption: 20,
        },
      },
      {
        id: "scottfield_swift",
        name: "Scottfield Swift",
        image: "images/weapons/variants/scottfield_swift.png",
        description: "",
        weaponClass: "handgun",
        price: 95,
        stats: {
          rateOfFire: 30,
          reloadSpeed: 4.3,
          staminaConsumption: 20,
        },
      },
    ],
  },

  {
    id: "weapon_mako_1895",
    category: "weapon",
    name: "Mako 1895",
    image: "images/weapons/mako_1895.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "long",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["explosive", "full_metal"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "mako1895_long",
      "mako1895_explosive",
      "mako1895_fmj",
    ],
    defaultAmmo: "mako1895_long",

    // 기본 정보
    price: 360,
    updateAdded: "Update 1.16",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6+1",
      extra: 10,
    },

    // 기본 스탯
    stats: {
      damage: 128,
      dropRange: 115,
      rateOfFire: 24,
      cycleTime: 1.3,
      spread: 27.5,
      sway: 77,
      verticalRecoil: 11,
      reloadSpeed: 11,
      muzzleVelocity: 440,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 2종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "mako1895_aperture",
        name: "Mako 1895 Aperture",
        image: "images/weapons/variants/mako1895_aperture.png",
        description: "",
        price: 378,
        stats: {
          sway: 69,
          verticalRecoil: 15,
        },
      },
      {
        id: "mako1895_claw",
        name: "Mako 1895 Claw",
        image: "images/weapons/variants/mako1895_claw.png",
        description: "",
        price: 370,
        stats: {
          meleeLight: 120,
        },
      },
    ],
  },

  {
    id: "weapon_martini_henry",
    category: "weapon",
    name: "Martini-Henry",
    image: "images/weapons/martini_henry.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "long",
    weaponClass: "rifle", // handgun/rifle/shotgun
    dualAmmoSlot: true, // 단발/볼트액션이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    ammoEffects: ["explosive", "full_metal", "high_velocity", "incendiary"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "martinihenry_long",
      "martinihenry_explosive",
      "martinihenry_fmj",
      "martinihenry_high_velocity",
      "martinihenry_incendiary",
    ],
    defaultAmmo: "martinihenry_long",

    // 기본 정보
    price: 122,
    updateAdded: "Update 1.1.3",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "1",
      extra: 20,
    },

    // 기본 스탯
    stats: {
      damage: 143,
      dropRange: 125,
      rateOfFire: 18,
      cycleTime: 3.5,
      spread: 40,
      sway: 77,
      verticalRecoil: 12,
      reloadSpeed: 2.7,
      muzzleVelocity: 400,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 4종 - 본체와 다른 값만 표기)
    variants: [
      {
        id: "martinihenry_deadeye",
        name: "Martini-Henry Deadeye",
        image: "images/weapons/variants/martinihenry_deadeye.png",
        description: "",
        price: 128,
        stats: {
          spread: 50,
          sway: 69,
        },
      },
      {
        id: "martinihenry_ironside",
        name: "Martini-Henry Ironside",
        image: "images/weapons/variants/martinihenry_ironside.png",
        description: "",
        price: 159,
        chamber: {
          loaded: "5+1",
          extra: 15,
        },
        stats: {
          cycleTime: 1.8,
          reloadSpeed: 14.7,
        },
      },
      {
        id: "martinihenry_marksman",
        name: "Martini-Henry Marksman",
        image: "images/weapons/variants/martinihenry_marksman.png",
        description: "",
        price: 134,
        stats: {
          spread: 60,
          sway: 69,
        },
      },
      {
        id: "martinihenry_riposte",
        name: "Martini-Henry Riposte",
        image: "images/weapons/variants/martinihenry_riposte.png",
        // ✅ [확인됨] 가격 132 — 사용자 확인
        description: "",
        price: 132,
        stats: {
          meleeHeavy: 168,
        },
      },
    ],
  },

  {
    id: "weapon_sparks",
    category: "weapon",
    name: "Sparks",
    image: "images/weapons/sparks.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "long",
    weaponClass: "rifle", // handgun/rifle/shotgun
    dualAmmoSlot: true, // 단발/볼트액션이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    ammoEffects: ["full_metal", "incendiary", "poison", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "sparks_long",
      "sparks_fmj",
      "sparks_incendiary",
      "sparks_poison",
      "sparks_subsonic",
    ],
    defaultAmmo: "sparks_long",

    // 기본 정보
    price: 130,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "1",
      extra: 16,
    },

    // 기본 스탯
    stats: {
      damage: 149,
      dropRange: 145,
      rateOfFire: 13,
      cycleTime: 4.9,
      spread: 30,
      sway: 77,
      verticalRecoil: 10,
      reloadSpeed: 4,
      muzzleVelocity: 533,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 4종 - 사용자 확인 완료)
    variants: [
      {
        id: "sparks_silencer",
        name: "Sparks Silencer",
        image: "images/weapons/variants/sparks_silencer.png",
        description: "",
        price: 149,
        stats: {
          damage: 133,
          dropRange: 110,
          spread: 47.5,
          sway: 87,
          muzzleVelocity: 453,
        },
      },
      {
        id: "sparks_pistol_silencer",
        name: "Sparks Pistol Silencer",
        image: "images/weapons/variants/sparks_pistol_silencer.png",
        description: "",
        weaponClass: "handgun", // 절단형 권총이라 소총군이 아닌 권총군으로 override
        price: 178,
        slotSize: 1,
        chamber: {
          extra: 14,
        },
        // ⚠ 본체(Sparks)와 낙하범위/탄속 기준점이 달라 전용 탄약 필요
        ammoTypes: [
          "sparkspistolsilencer_long",
          "sparkspistolsilencer_fmj",
          "sparks_incendiary",
          "sparks_poison",
          "sparkspistolsilencer_subsonic",
        ],
        defaultAmmo: "sparkspistolsilencer_long",
        stats: {
          damage: 133,
          dropRange: 85,
          rateOfFire: 15,
          cycleTime: 4.2,
          spread: 42.5,
          sway: 128,
          verticalRecoil: 25,
          reloadSpeed: 3.4,
          muzzleVelocity: 385,
          meleeLight: 13,
          meleeHeavy: 31,
          staminaConsumption: 20,
        },
      },
      {
        id: "sparks_pistol",
        name: "Sparks Pistol",
        image: "images/weapons/variants/sparks_pistol.png",
        description: "",
        weaponClass: "handgun", // 절단형 권총이라 소총군이 아닌 권총군으로 override
        price: 155,
        slotSize: 1,
        chamber: {
          extra: 14,
        },
        // ⚠ 본체(Sparks)와 낙하범위/탄속 기준점이 달라 전용 탄약 필요 (데미지는 본체와 동일해서 override 없음)
        ammoTypes: [
          "sparkspistol_long",
          "sparkspistol_fmj",
          "sparks_incendiary",
          "sparks_poison",
          "sparkspistol_subsonic",
        ],
        defaultAmmo: "sparkspistol_long",
        stats: {
          dropRange: 95,
          rateOfFire: 15,
          cycleTime: 4.2,
          spread: 42.5,
          sway: 128,
          verticalRecoil: 25,
          reloadSpeed: 3.4,
          muzzleVelocity: 453,
          meleeLight: 13,
          meleeHeavy: 31,
          staminaConsumption: 20,
        },
      },
      {
        id: "sparks_sniper",
        name: "Sparks Sniper",
        image: "images/weapons/variants/sparks_sniper.png",
        // ⚠ 낙하범위/탄속 등 본체와 동일해서 탄약도 본체(sparks_long 등) 그대로 공유
        description: "",
        price: 150,
        stats: {
          spread: 55,
          sway: 69,
        },
      },
    ],
  },

  {
    id: "weapon_haymaker",
    category: "weapon",
    name: "Haymaker",
    image: "images/weapons/haymaker.png",

    // 검색 필터용
    slotSize: 2,
    ammoCategory: "long",
    weaponClass: "handgun", // handgun/rifle/shotgun
    secondaryAmmoCategories: ["shotgun"], // 하부 총열 샷건 보유 (헤이메이커)
    ammoEffects: ["full_metal", "poison", "slug", "flare", "dragonbreath"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "haymaker_long",
      "haymaker_fmj",
      "haymaker_poison",
      "haymaker_shells",
      "haymaker_dragonbreath",
      "haymaker_slug",
      "haymaker_starshell",
    ],
    defaultAmmo: "haymaker_long",

    // 기본 정보
    price: 279,
    updateAdded: "Update 1.13",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "9/1",
      extra: 9,
    },

    // 기본 스탯
    stats: {
      damage: 122,
      dropRange: 65,
      rateOfFire: 18,
      cycleTime: 1.3,
      spread: 40,
      sway: 100,
      verticalRecoil: 23,
      reloadSpeed: 18.2,
      muzzleVelocity: 530,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    variants: [],
  },

  {
    id: "weapon_uppercut",
    category: "weapon",
    name: "Uppercut",
    image: "images/weapons/uppercut.png",

    // 검색 필터용
    slotSize: 2,
    ammoCategory: "long",
    weaponClass: "handgun", // handgun/rifle/shotgun
    ammoEffects: ["explosive", "full_metal", "incendiary"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "uppercut_long",
      "uppercut_explosive",
      "uppercut_fmj",
      "uppercut_incendiary",
    ],
    defaultAmmo: "uppercut_long",

    // 기본 정보
    price: 310,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 126,
      dropRange: 65,
      rateOfFire: 18,
      cycleTime: 1.6,
      spread: 40,
      sway: 128,
      verticalRecoil: 23,
      reloadSpeed: 16,
      muzzleVelocity: 410,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 사용자 확인, 2종)
    variants: [
      {
        id: "uppercut_precision",
        name: "Uppercut Precision",
        image: "images/weapons/variants/uppercut_precision.png",
        description: "",
        price: 321,
        slotSize: 3,
        chamber: {
          extra: 18,
        },
        ammoTypes: [
          "uppercut_long",
          "uppercut_explosive",
          "uppercut_precision_fmj",
          "uppercut_incendiary",
        ],
        defaultAmmo: "uppercut_long",
        stats: {
          cycleTime: 1.4,
          spread: 35,
          sway: 87,
          verticalRecoil: 11,
          reloadSpeed: 18.3,
          meleeLight: 27,
          meleeHeavy: 54,
          staminaConsumption: 25,
        },
      },
      {
        id: "uppercut_deadeye",
        name: "Uppercut Deadeye",
        image: "images/weapons/variants/uppercut_deadeye.png",
        description: "",
        price: 337,
        slotSize: 3,
        chamber: {
          extra: 18,
        },
        ammoTypes: [
          "uppercut_long",
          "uppercut_explosive",
          "uppercut_deadeye_fmj",
          "uppercut_incendiary",
        ],
        defaultAmmo: "uppercut_long",
        stats: {
          cycleTime: 1.4,
          sway: 87,
          verticalRecoil: 14,
          reloadSpeed: 18.3,
          meleeLight: 27,
          meleeHeavy: 54,
          staminaConsumption: 25,
        },
      },
    ],
  },

  {
    id: "weapon_1890_cavalry",
    category: "weapon",
    name: "1890 Cavalry",
    image: "images/weapons/cavalry_1890.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "long",
    weaponClass: "rifle", // handgun/rifle/shotgun
    dualAmmoSlot: true, // 단발/볼트액션이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    // 패치노트(Update 2.8)에서 확인된 탄종: FMJ, High Velocity
    ammoEffects: ["full_metal", "high_velocity"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "cavalry_long",
      "cavalry_fmj",
      "cavalry_high_velocity",
    ],
    defaultAmmo: "cavalry_long",

    // 기본 정보
    price: 56,
    updateAdded: "Update 2.8",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "1",
      extra: 18,
    },

    // 기본 스탯 (Hunt: Showdown 1896 Wiki 기준)
    stats: {
      damage: 139,
      dropRange: 120,
      rateOfFire: 18,
      cycleTime: 3.2,
      spread: 32.5,
      sway: 77,
      verticalRecoil: 7,
      reloadSpeed: 3.5,
      muzzleVelocity: 380,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    variants: [],
  },

  {
    id: "weapon_krag",
    category: "weapon",
    name: "Krag",
    image: "images/weapons/krag.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "special",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["full_metal", "incendiary", "subsonic"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "krag_special_long",
      "krag_fmj",
      "krag_incendiary",
      "krag_subsonic",
    ],
    defaultAmmo: "krag_special_long",

    // 기본 정보
    price: 450,
    updateAdded: "Update 1.11",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "5+1",
      extra: 10,
    },

    // 기본 스탯
    stats: {
      damage: 126,
      dropRange: 140,
      rateOfFire: 23,
      cycleTime: 1.4,
      spread: 30,
      sway: 77,
      verticalRecoil: 3,
      reloadSpeed: 11.1,
      muzzleVelocity: 610,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 사용자 확인, 3종)
    variants: [
      {
        id: "krag_bayonet",
        name: "Krag Bayonet",
        image: "images/weapons/variants/krag_bayonet.png",
        description: "",
        price: 460,
        stats: {
          meleeHeavy: 168,
        },
      },
      {
        id: "krag_sniper",
        name: "Krag Sniper",
        image: "images/weapons/variants/krag_sniper.png",
        description: "",
        price: 517,
        stats: {
          spread: 60,
          sway: 69,
        },
      },
      {
        id: "krag_silencer",
        name: "Krag Silencer",
        image: "images/weapons/variants/krag_silencer.png",
        description: "",
        price: 517,
        ammoTypes: [
          "krag_special_long",
          "krag_silencer_fmj",
          "krag_incendiary",
          "krag_silencer_subsonic",
        ],
        defaultAmmo: "krag_special_long",
        stats: {
          damage: 113,
          dropRange: 130,
          muzzleVelocity: 518,
        },
      },
    ],
  },

  {
    id: "weapon_lebel_1886",
    category: "weapon",
    name: "Lebel 1886",
    image: "images/weapons/lebel_1886.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "special",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["incendiary", "spitzer"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "lebel1886_special_long",
      "lebel1886_incendiary",
      "lebel1886_spitzer",
    ],
    defaultAmmo: "lebel1886_special_long",

    // 기본 정보
    price: 397,
    updateAdded: "Update Early Access 6.0",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "10",
      extra: 5,
    },

    // 기본 스탯
    // ✅ [확인됨] dropRange 140 — 기존 120은 잘못된 값이었음, 파생형 3종 위키 데이터로 정정
    stats: {
      damage: 132,
      dropRange: 140,
      rateOfFire: 20,
      cycleTime: 1.8,
      spread: 30,
      sway: 77,
      verticalRecoil: 9,
      reloadSpeed: 18.7,
      muzzleVelocity: 630,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 사용자 확인, 3종)
    variants: [
      {
        id: "lebel1886_aperture",
        name: "Lebel 1886 Aperture",
        image: "images/weapons/variants/lebel1886_aperture.png",
        description: "",
        price: 417,
        stats: {
          sway: 69,
        },
      },
      {
        id: "lebel1886_talon",
        name: "Lebel 1886 Talon",
        image: "images/weapons/variants/lebel1886_talon.png",
        description: "",
        price: 407,
        stats: {
          verticalRecoil: 11,
        },
      },
      {
        id: "lebel1886_marksman",
        name: "Lebel 1886 Marksman",
        image: "images/weapons/variants/lebel1886_marksman.png",
        description: "",
        price: 437,
        stats: {
          spread: 50,
          sway: 69,
        },
      },
    ],
  },

  {
    id: "weapon_mosin_nagant",
    category: "weapon",
    name: "Mosin-Nagant",
    image: "images/weapons/mosin_nagant.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "special",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["incendiary", "spitzer"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "mosinnagant_special_long",
      "mosinnagant_incendiary",
      "mosinnagant_spitzer",
    ],
    defaultAmmo: "mosinnagant_special_long",

    // 기본 정보
    price: 620,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "5",
      extra: 10,
    },

    // 기본 스탯
    stats: {
      damage: 136,
      dropRange: 135,
      rateOfFire: 26,
      cycleTime: 1.9,
      spread: 35,
      sway: 77,
      verticalRecoil: 10,
      reloadSpeed: 3.7,
      muzzleVelocity: 615,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 사용자 확인, 3종)
    variants: [
      {
        id: "mosinnagant_bayonet",
        name: "Mosin-Nagant Bayonet",
        image: "images/weapons/variants/mosinnagant_bayonet.png",
        description: "",
        price: 630,
        stats: {
          meleeHeavy: 168,
        },
      },
      {
        id: "mosinnagant_sniper",
        name: "Mosin-Nagant Sniper",
        image: "images/weapons/variants/mosinnagant_sniper.png",
        description: "",
        price: 713,
        stats: {
          rateOfFire: 24,
          spread: 70,
          sway: 69,
          reloadSpeed: 5.3,
        },
      },
      {
        id: "mosinnagant_avtomat",
        name: "Mosin-Nagant Avtomat",
        image: "images/weapons/variants/mosinnagant_avtomat.png",
        description: "",
        price: 1250,
        slotSize: 5,
        chamber: {
          loaded: "15",
          extra: 0,
        },
        ammoTypes: [
          "mosinnagant_special_long",
          "mosinnagant_incendiary",
          "mosinnagant_avtomat_spitzer",
        ],
        defaultAmmo: "mosinnagant_special_long",
        stats: {
          rateOfFire: 75,
          cycleTime: 0.1,
          spread: 100,
          sway: 133,
          verticalRecoil: 8,
          reloadSpeed: 11.4,
        },
      },
    ],
  },

  {
    id: "weapon_berthier_1892",
    category: "weapon",
    name: "Berthier 1892",
    image: "images/weapons/berthier_1892.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "special",
    weaponClass: "rifle", // handgun/rifle/shotgun
    dualAmmoSlot: true, // 단발/볼트액션이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    ammoEffects: ["incendiary", "spitzer"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "berthier1892_special_long",
      "berthier1892_incendiary",
      "berthier1892_spitzer",
    ],
    defaultAmmo: "berthier1892_special_long",

    // 기본 정보
    price: 380,
    updateAdded: "Update 1.7",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "3",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 128,
      dropRange: 120,
      rateOfFire: 27,
      cycleTime: 1.7,
      spread: 42.5,
      sway: 77,
      verticalRecoil: 12,
      reloadSpeed: 2.7,
      muzzleVelocity: 590,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 사용자 확인, 3종)
    variants: [
      {
        id: "berthier1892_riposte",
        name: "Berthier 1892 Riposte",
        image: "images/weapons/variants/berthier1892_riposte.png",
        description: "",
        price: 390,
        stats: {
          meleeLight: 82,
          meleeHeavy: 168,
        },
      },
      {
        id: "berthier1892_deadeye",
        name: "Berthier 1892 Deadeye",
        image: "images/weapons/variants/berthier1892_deadeye.png",
        description: "",
        price: 397,
        stats: {
          spread: 52.5,
          sway: 69,
        },
      },
      {
        id: "berthier1892_marksman",
        name: "Berthier 1892 Marksman",
        image: "images/weapons/variants/berthier1892_marksman.png",
        description: "",
        price: 413,
        stats: {
          spread: 62.5,
          sway: 69,
        },
      },
    ],
  },

  {
    id: "weapon_mosin_obrez",
    category: "weapon",
    name: "Mosin Obrez",
    image: "images/weapons/mosin_obrez.png",

    // 검색 필터용
    slotSize: 2,
    ammoCategory: "special",
    weaponClass: "rifle", // handgun/rifle/shotgun
    ammoEffects: ["incendiary", "spitzer"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "mosinobrez_special_long",
      "mosinobrez_incendiary",
      "mosinobrez_spitzer",
    ],
    defaultAmmo: "mosinobrez_special_long",

    // 기본 정보
    price: 290,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "5",
      extra: 7,
    },

    // 기본 스탯
    stats: {
      damage: 126,
      dropRange: 100,
      rateOfFire: 26,
      cycleTime: 1.9,
      spread: 55,
      sway: 100,
      verticalRecoil: 16,
      reloadSpeed: 3.7,
      muzzleVelocity: 520,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 사용자 확인, 4종)
    variants: [
      {
        id: "mosinobrez_mace",
        name: "Mosin Obrez Mace",
        image: "images/weapons/variants/mosinobrez_mace.png",
        description: "",
        price: 300,
        ammoTypes: [
          "mosinobrez_special_long",
          "mosinobrez_incendiary",
          "mosinobrez_mace_spitzer",
        ],
        defaultAmmo: "mosinobrez_special_long",
        stats: {
          verticalRecoil: 19,
          meleeLight: 54,
          meleeHeavy: 90,
          staminaConsumption: 10,
        },
      },
      {
        id: "mosinobrez_extended",
        name: "Mosin Obrez Extended",
        image: "images/weapons/variants/mosinobrez_extended.png",
        description: "",
        price: 350,
        chamber: {
          loaded: "15",
        },
        ammoTypes: [
          "mosinobrez_special_long",
          "mosinobrez_incendiary",
          "mosinobrez_extended_spitzer",
        ],
        defaultAmmo: "mosinobrez_special_long",
        stats: {
          rateOfFire: 29,
          verticalRecoil: 19,
          reloadSpeed: 8,
        },
      },
      {
        id: "mosinobrez_match",
        name: "Mosin Obrez Match",
        image: "images/weapons/variants/mosinobrez_match.png",
        description: "",
        price: 345,
        slotSize: 3,
        chamber: {
          extra: 10,
        },
        ammoTypes: [
          "mosinobrez_special_long",
          "mosinobrez_incendiary",
          "mosinobrez_match_spitzer",
        ],
        defaultAmmo: "mosinobrez_special_long",
        stats: {
          damage: 130,
          dropRange: 105,
          spread: 47.5,
          sway: 77,
          verticalRecoil: 14,
          muzzleVelocity: 540,
        },
      },
      {
        id: "mosinobrez_sharpeye",
        name: "Mosin Obrez Sharpeye",
        image: "images/weapons/variants/mosinobrez_sharpeye.png",
        description: "",
        price: 362,
        slotSize: 3,
        chamber: {
          extra: 10,
        },
        // Match와 데미지/낙하범위/탄속/반동 델타가 완전히 동일해서 탄약 공유
        ammoTypes: [
          "mosinobrez_special_long",
          "mosinobrez_incendiary",
          "mosinobrez_match_spitzer",
        ],
        defaultAmmo: "mosinobrez_special_long",
        stats: {
          damage: 130,
          dropRange: 105,
          spread: 57.5,
          sway: 87,
          verticalRecoil: 14,
          muzzleVelocity: 540,
        },
      },
    ],
  },

  {
    id: "weapon_auto5",
    category: "weapon",
    name: "Auto-5",
    image: "images/weapons/auto5.png",

    // 검색 필터용
    slotSize: 5,
    ammoCategory: "shotgun",
    weaponClass: "shotgun", // handgun/rifle/shotgun
    ammoEffects: ["flechette", "pennyshot", "slug"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "auto5_shells",
      "auto5_flechette",
      "auto5_pennyshot",
      "auto5_slug",
    ],
    defaultAmmo: "auto5_shells",

    // 기본 정보
    price: 600,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "4+1",
      extra: 8,
    },

    // 기본 스탯
    stats: {
      damage: 194,
      dropRange: 30,
      rateOfFire: 24,
      cycleTime: 0.6,
      spread: 35,
      sway: 133,
      verticalRecoil: 20,
      reloadSpeed: 10.7,
      muzzleVelocity: 425,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종 - Update 2.1.1에서 Auto-5의 파생형으로 편입됨)
    variants: [
      {
        id: "auto4_shorty",
        name: "Auto-4 Shorty",
        image: "images/weapons/variants/auto4_shorty.png",
        description: "",
        price: 300,
        slotSize: 3,
        chamber: {
          loaded: "3+1",
          extra: 4,
        },
        ammoTypes: [
          "auto4shorty_shells",
          "auto4shorty_flechette",
          "auto4shorty_pennyshot",
          "auto4shorty_slug",
        ],
        defaultAmmo: "auto4shorty_shells",
        stats: {
          damage: 154,
          dropRange: 20,
          spread: 64,
          sway: 147,
          verticalRecoil: 25,
          reloadSpeed: 9.7,
          muzzleVelocity: 350,
          meleeLight: 13,
          meleeHeavy: 31,
          staminaConsumption: 20,
        },
      },
    ],
  },

  {
    id: "weapon_homestead78",
    category: "weapon",
    name: "Homestead 78",
    image: "images/weapons/homestead78.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
    weaponClass: "shotgun", // handgun/rifle/shotgun
    ammoEffects: ["dragonbreath", "flechette", "pennyshot", "slug"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "homestead78_shells",
      "homestead78_dragonbreath",
      "homestead78_flechette",
      "homestead78_pennyshot",
      "homestead78_slug",
    ],
    defaultAmmo: "homestead78_shells",

    // 기본 정보
    price: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    updateAdded: "Update 2.5",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "2",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 220,
      dropRange: 30,
      rateOfFire: 24,
      cycleTime: 0.3,
      spread: 20,
      sway: 77,
      verticalRecoil: 20,
      reloadSpeed: 4.7,
      muzzleVelocity: 450,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // ✅ [확인됨] 파생형 없음 (사용자 확인)
    variants: [],
  },

  {
    id: "weapon_rival78",
    category: "weapon",
    name: "Rival 78",
    image: "images/weapons/rival78.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
    weaponClass: "shotgun", // handgun/rifle/shotgun
    ammoEffects: ["dragonbreath", "flechette", "pennyshot", "slug"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "rival78_shells",
      "rival78_dragonbreath",
      "rival78_flechette",
      "rival78_pennyshot",
      "rival78_slug",
    ],
    defaultAmmo: "rival78_shells",

    // 기본 정보
    price: 170,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "2",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 184,
      dropRange: 25,
      rateOfFire: 24,
      cycleTime: 0.3,
      spread: 45,
      sway: 77,
      verticalRecoil: 20,
      reloadSpeed: 4.7,
      muzzleVelocity: 425,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종 - 가격/예비탄은 Update 2.8.1 패치노트로 보정)
    variants: [
      {
        id: "rival78_shorty",
        name: "Rival 78 Shorty",
        image: "images/weapons/variants/rival78_shorty.png",
        description: "",
        price: 145,
        slotSize: 2,
        chamber: {
          extra: 4,
        },
        ammoTypes: [
          "rival78shorty_shells",
          "rival78shorty_dragonbreath",
          "rival78shorty_flechette",
          "rival78shorty_pennyshot",
          "rival78shorty_slug",
        ],
        defaultAmmo: "rival78shorty_shells",
        stats: {
          damage: 158,
          dropRange: 20,
          spread: 55,
          sway: 133,
          verticalRecoil: 30,
          muzzleVelocity: 350,
          meleeLight: 13,
          meleeHeavy: 31,
          staminaConsumption: 20,
        },
      },
      {
        id: "rival78_trauma",
        name: "Rival 78 Trauma",
        image: "images/weapons/variants/rival78_trauma.png",
        description: "",
        price: 180,
        stats: {
          verticalRecoil: 22,
          meleeHeavy: 216,
          staminaConsumption: 40,
        },
      },
      {
        id: "rival78_mace",
        name: "Rival 78 Mace",
        image: "images/weapons/variants/rival78_mace.png",
        description: "",
        price: 155,
        slotSize: 2,
        chamber: {
          extra: 4,
        },
        // Shorty와 데미지/낙하범위/탄속이 완전히 동일해서 기본 샷건쉘은 공유
        ammoTypes: [
          "rival78shorty_shells",
          "rival78mace_dragonbreath",
          "rival78mace_flechette",
          "rival78mace_pennyshot",
          "rival78mace_slug",
        ],
        defaultAmmo: "rival78shorty_shells",
        stats: {
          damage: 158,
          dropRange: 20,
          spread: 55,
          sway: 133,
          verticalRecoil: 34,
          muzzleVelocity: 350,
          meleeLight: 54,
          meleeHeavy: 90,
          staminaConsumption: 10,
        },
      },
    ],
  },

  {
    id: "weapon_romero77",
    category: "weapon",
    name: "Romero 77",
    image: "images/weapons/romero77.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
    weaponClass: "shotgun", // handgun/rifle/shotgun
    dualAmmoSlot: true, // 단발/볼트액션이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    ammoEffects: ["dragonbreath", "pennyshot", "slug", "flare"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "romero77_shells",
      "romero77_dragonbreath",
      "romero77_pennyshot",
      "romero77_slug",
      "romero77_starshell",
    ],
    defaultAmmo: "romero77_shells",

    // 기본 정보
    price: 66,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "1",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 220,
      dropRange: 30,
      rateOfFire: 16,
      cycleTime: 4,
      spread: 20,
      sway: 77,
      verticalRecoil: 20,
      reloadSpeed: 3.4,
      muzzleVelocity: 450,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종)
    variants: [
      {
        id: "romero77_shorty",
        name: "Romero 77 Shorty",
        image: "images/weapons/variants/romero77_shorty.png",
        description: "",
        price: 46,
        slotSize: 2,
        chamber: {
          loaded: "1",
          extra: 4,
        },
        ammoTypes: [
          "romero77shorty_shells",
          "romero77shorty_dragonbreath",
          "romero77shorty_pennyshot",
          "romero77shorty_slug",
          "romero77shorty_starshell",
        ],
        defaultAmmo: "romero77shorty_shells",
        stats: {
          damage: 214,
          dropRange: 20,
          rateOfFire: 16,
          cycleTime: 3.8,
          spread: 25,
          sway: 100,
          verticalRecoil: 30,
          reloadSpeed: 3.2,
          muzzleVelocity: 375,
          meleeLight: 13,
          meleeHeavy: 31,
          staminaConsumption: 20,
        },
      },
      {
        id: "romero77_talon",
        name: "Romero 77 Talon",
        image: "images/weapons/variants/romero77_talon.png",
        description: "",
        price: 76,
        chamber: {
          extra: 12,
        },
        // DragonBreath/Slug/Starshell은 본체와 델타 동일해서 공유, 페니샷만 전용
        ammoTypes: [
          "romero77_shells",
          "romero77_dragonbreath",
          "romero77talon_pennyshot",
          "romero77_slug",
          "romero77_starshell",
        ],
        defaultAmmo: "romero77_shells",
        stats: {
          verticalRecoil: 25,
          muzzleVelocity: 425,
          meleeHeavy: 330,
          staminaConsumption: 33,
        },
      },
      {
        id: "romero77_hatchet",
        name: "Romero 77 Hatchet",
        image: "images/weapons/variants/romero77_hatchet.png",
        // Shorty와 완전히 동일한 총(근접무기 유무만 차이)이라 탄약 전부 공유
        description: "",
        price: 56,
        slotSize: 2,
        chamber: {
          loaded: "1",
          extra: 4,
        },
        ammoTypes: [
          "romero77shorty_shells",
          "romero77shorty_dragonbreath",
          "romero77shorty_pennyshot",
          "romero77shorty_slug",
          "romero77shorty_starshell",
        ],
        defaultAmmo: "romero77shorty_shells",
        stats: {
          damage: 214,
          dropRange: 20,
          rateOfFire: 16,
          cycleTime: 4,
          spread: 25,
          sway: 100,
          verticalRecoil: 30,
          reloadSpeed: 3.7,
          muzzleVelocity: 375,
          meleeLight: 90,
          meleeHeavy: 150,
        },
      },
      {
        id: "romero77_alamo",
        name: "Romero 77 Alamo",
        image: "images/weapons/variants/romero77_alamo.png",
        description: "",
        price: 98,
        // 본체(Romero 77)는 dualAmmoSlot:true(2탄종 동시 장전)이지만, Alamo는 그 기믹이
        // 없는 파생형이라 명시적으로 false 오버라이드(사용자 확인) — 안 그러면 스프레드
        // 병합 시 본체 값을 그대로 물려받아 잘못 이중탄약으로 표시됨.
        dualAmmoSlot: false,
        chamber: {
          loaded: "4+1",
        },
        // DragonBreath는 본체와 델타 동일해서 공유, 나머지는 예비탄 총량이 달라 전용
        ammoTypes: [
          "romero77_shells",
          "romero77_dragonbreath",
          "romero77alamo_pennyshot",
          "romero77alamo_slug",
          "romero77alamo_starshell",
        ],
        defaultAmmo: "romero77_shells",
        stats: {
          rateOfFire: 13,
          cycleTime: 2.8,
          reloadSpeed: 14,
        },
      },
    ],
  },

  {
    id: "weapon_slate",
    category: "weapon",
    name: "Slate",
    image: "images/weapons/slate.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
    weaponClass: "shotgun", // handgun/rifle/shotgun
    ammoEffects: ["pennyshot", "slug"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "slate_shells",
      "slate_pennyshot",
      "slate_slug",
    ],
    defaultAmmo: "slate_shells",

    // 기본 정보
    price: 313,
    updateAdded: "Update 1.8",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "5+1",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 207,
      dropRange: 25,
      rateOfFire: 23,
      cycleTime: 1,
      spread: 30,
      sway: 77,
      verticalRecoil: 26,
      reloadSpeed: 9.6,
      muzzleVelocity: 425,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 사용자 확인, 1종)
    variants: [
      {
        id: "slate_riposte",
        name: "Slate Riposte",
        image: "images/weapons/variants/slate_riposte.png",
        description: "",
        price: 323,
        stats: {
          meleeLight: 82,
          meleeHeavy: 168,
        },
      },
    ],
  },

  {
    id: "weapon_specter1882",
    category: "weapon",
    name: "Specter 1882",
    image: "images/weapons/specter1882.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
    weaponClass: "shotgun", // handgun/rifle/shotgun
    ammoEffects: ["dragonbreath", "flechette", "pennyshot", "slug"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "specter1882_shells",
      "specter1882_dragonbreath",
      "specter1882_flechette",
      "specter1882_pennyshot",
      "specter1882_slug",
    ],
    defaultAmmo: "specter1882_shells",

    // 기본 정보
    price: 188,
    updateAdded: "Update Early Access 0.1",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "4+1",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 213,
      dropRange: 30,
      rateOfFire: 20,
      cycleTime: 1,
      spread: 25,
      sway: 77,
      verticalRecoil: 20,
      reloadSpeed: 14.8,
      muzzleVelocity: 425,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종)
    variants: [
      {
        id: "specter1882_shorty",
        name: "Specter 1882 Shorty",
        image: "images/weapons/variants/specter1882_shorty.png",
        description: "",
        price: 164,
        slotSize: 2,
        chamber: {
          loaded: "3+1",
          extra: 4,
        },
        ammoTypes: [
          "specter1882shorty_shells",
          "specter1882shorty_dragonbreath",
          "specter1882shorty_flechette",
          "specter1882shorty_pennyshot",
          "specter1882shorty_slug",
        ],
        defaultAmmo: "specter1882shorty_shells",
        stats: {
          damage: 178,
          dropRange: 20,
          rateOfFire: 19,
          cycleTime: 1.2,
          spread: 45,
          sway: 87,
          verticalRecoil: 25,
          reloadSpeed: 11.1,
          muzzleVelocity: 350,
          meleeLight: 13,
          meleeHeavy: 31,
          staminaConsumption: 20,
        },
      },
      {
        id: "specter1882_bayonet",
        name: "Specter 1882 Bayonet",
        image: "images/weapons/variants/specter1882_bayonet.png",
        description: "",
        price: 198,
        ammoTypes: [
          "specter1882_shells",
          "specter1882bayonet_dragonbreath",
          "specter1882bayonet_flechette",
          "specter1882bayonet_pennyshot",
          "specter1882bayonet_slug",
        ],
        defaultAmmo: "specter1882_shells",
        stats: {
          damage: 204,
          dropRange: 25,
          spread: 35,
          muzzleVelocity: 400,
          meleeHeavy: 168,
        },
      },
    ],
  },

  {
    id: "weapon_terminus",
    category: "weapon",
    name: "Terminus",
    image: "images/weapons/terminus.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
    weaponClass: "shotgun", // handgun/rifle/shotgun
    ammoEffects: ["dragonbreath", "flechette", "pennyshot", "slug"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "terminus_shells",
      "terminus_dragonbreath",
      "terminus_flechette",
      "terminus_pennyshot",
      "terminus_slug",
    ],
    defaultAmmo: "terminus_shells",

    // 기본 정보
    price: 168,
    updateAdded: "Update 1.5",

    // 탄창 (기본탄 기준)
    chamber: {
      loaded: "6+1",
      extra: 12,
    },

    // 기본 스탯
    stats: {
      damage: 186,
      dropRange: 25,
      rateOfFire: 21,
      cycleTime: 1.6,
      spread: 40,
      sway: 77,
      verticalRecoil: 22,
      reloadSpeed: 12.2,
      muzzleVelocity: 425,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치 기준, 1종)
    variants: [
      {
        id: "terminus_shorty",
        name: "Terminus Shorty",
        image: "images/weapons/variants/terminus_shorty.png",
        description: "",
        price: 148,
        slotSize: 2,
        chamber: {
          loaded: "5+1",
          extra: 4,
        },
        ammoTypes: [
          "terminusshorty_shells",
          "terminusshorty_dragonbreath",
          "terminusshorty_flechette",
          "terminusshorty_pennyshot",
          "terminusshorty_slug",
        ],
        defaultAmmo: "terminusshorty_shells",
        stats: {
          damage: 168,
          dropRange: 20,
          rateOfFire: 19,
          spread: 50,
          sway: 133,
          verticalRecoil: 27,
          reloadSpeed: 10.6,
          muzzleVelocity: 350,
          meleeLight: 13,
          meleeHeavy: 31,
        },
      },
    ],
  },

  // ── 특수탄(Special) / 오일 화기 — 위키 실측치, 사용자 확인 ─────────────
  {
    id: "weapon_nitro_express",
    category: "weapon",
    name: "Nitro Express",
    image: "images/weapons/nitro_express.png",

    slotSize: 5,
    ammoCategory: "special",
    weaponClass: "rifle",
    ammoEffects: ["explosive", "bleed"],

    ammoTypes: ["nitroexpress_special", "nitroexpress_explosive", "nitroexpress_shredder"],
    defaultAmmo: "nitroexpress_special",

    price: 1015,
    updateAdded: "Update Early Access 0.1",

    chamber: { loaded: "2", extra: 6 },

    stats: {
      damage: 364,
      dropRange: 45,
      rateOfFire: 21,
      cycleTime: 0.7,
      spread: 62.5,
      sway: 77,
      verticalRecoil: 40,
      reloadSpeed: 4.8,
      muzzleVelocity: 550,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_crossbow",
    category: "weapon",
    name: "Crossbow",
    image: "images/weapons/crossbow.png",

    slotSize: 4,
    ammoCategory: "special",
    weaponClass: "rifle",
    dualAmmoSlot: true, // 단발식이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    ammoEffects: ["explosive", "shot_bolt"],

    ammoTypes: ["crossbow_bolt", "crossbow_explosive_bolt", "crossbow_shot_bolt", "crossbow_steel_bolt"],
    defaultAmmo: "crossbow_bolt",

    price: 50,
    updateAdded: "Update Early Access 2.1",

    chamber: { loaded: "1", extra: 18 },

    stats: {
      damage: 246,
      dropRange: 20,
      rateOfFire: 13,
      cycleTime: 4.8,
      spread: 30,
      sway: 77,
      verticalRecoil: 4,
      reloadSpeed: 5.3,
      muzzleVelocity: 150,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치, 사용자 확인, 1종 - 탄약 델타는 본체와 동일해서 공유)
    variants: [
      {
        id: "crossbow_deadeye",
        name: "Crossbow Deadeye",
        image: "images/weapons/variants/crossbow_deadeye.png",
        description: "",
        price: 53,
        stats: {
          sway: 69,
        },
      },
    ],
  },

  {
    id: "weapon_shredder",
    category: "weapon",
    name: "Shredder",
    image: "images/weapons/shredder.png",

    slotSize: 4,
    ammoCategory: "special",
    weaponClass: "rifle",
    ammoEffects: [],

    ammoTypes: ["shredder_bolt"],
    defaultAmmo: "shredder_bolt",

    price: null,
    scarce: true, // Scarce (상점 구매 불가, 월드에서만 획득)
    updateAdded: "Update 2.2",

    chamber: { loaded: "6", extra: 6 },

    stats: {
      damage: 300,
      dropRange: 50,
      rateOfFire: 48,
      cycleTime: 0.35,
      spread: 25,
      sway: 77,
      verticalRecoil: 2,
      reloadSpeed: 4.5,
      muzzleVelocity: 115,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_bomb_launcher",
    category: "weapon",
    name: "Bomb Launcher",
    image: "images/weapons/bomb_launcher.png",

    slotSize: 2,
    ammoCategory: "special",
    weaponClass: "handgun",
    dualAmmoSlot: true, // 단발식이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    ammoEffects: ["dragonbreath", "bleed", "ball_shot"],

    ammoTypes: ["bomblauncher_charge", "bomblauncher_dragonbreath", "bomblauncher_harpoon", "bomblauncher_steelball", "bomblauncher_waxedfrag"],
    defaultAmmo: "bomblauncher_charge",

    price: 110,
    updateAdded: "Update 2.1",

    chamber: { loaded: "1", extra: 6 },

    // ⚠ 위키에 Sway/Vertical Recoil 수치가 명시돼 있지 않음(단발 곡사 발사 방식이라 해당 없는 듯)
    stats: {
      damage: 150,
      dropRange: 5,
      rateOfFire: 13,
      cycleTime: 5.3,
      spread: 25,
      reloadSpeed: 5.1,
      muzzleVelocity: 60,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 25,
    },

    description: "",

    // 파생형 (위키 실측치, 사용자 확인, 1종 - Bomb Lance는 Bomb Launcher의 파생형)
    variants: [
      {
        id: "bomb_lance",
        name: "Bomb Lance",
        image: "images/weapons/bomb_lance.png",
        description: "",
        weaponClass: "rifle",
        price: 199,
        slotSize: 3,
        // ⚠ 위키에 Sway 수치 없음. staminaConsumption은 "Heavy Stamina Consumption"(50)을 사용 - 위키에 별도로 명시된 "Stamina Consumption"(11, 일반 근접)은 현재 스키마에 대응 필드가 없어 미반영
        ammoTypes: ["bomblance_charge", "bomblance_dragonbreath", "bomblance_harpoon", "bomblance_steelball", "bomblance_waxedfrag"],
        defaultAmmo: "bomblance_charge",
        stats: {
          rateOfFire: 9,
          cycleTime: 7.3,
          spread: 37.5,
          reloadSpeed: 6.9,
          meleeLight: 180,
          meleeHeavy: 360,
          staminaConsumption: 50,
        },
      },
    ],
  },

  {
    id: "weapon_hunting_bow",
    category: "weapon",
    name: "Hunting Bow",
    image: "images/weapons/hunting_bow.png",

    slotSize: 3,
    ammoCategory: "special",
    weaponClass: "rifle",
    dualAmmoSlot: true, // 단발식이라 탄종 2개를 동시에 넣고 교체 가능(사용자 확인)
    ammoEffects: ["bleed", "poison"],

    ammoTypes: ["huntingbow_arrow", "huntingbow_concertina", "huntingbow_frag", "huntingbow_poison"],
    defaultAmmo: "huntingbow_arrow",

    price: 57,
    updateAdded: "Update 1.6.1",

    chamber: { loaded: "1", extra: 16 },

    stats: {
      damage: 250,
      dropRange: 30,
      rateOfFire: 51,
      cycleTime: 1.3,
      spread: 12.5,
      sway: 82,
      verticalRecoil: 1,
      reloadSpeed: 0.6,
      muzzleVelocity: 150,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_chu_ko_nu",
    category: "weapon",
    name: "Chu Ko Nu",
    image: "images/weapons/chu_ko_nu.png",

    slotSize: 2,
    ammoCategory: "special",
    weaponClass: "rifle",
    ammoEffects: ["explosive", "incendiary"],

    ammoTypes: ["chukonu_bolt", "chukonu_explosive", "chukonu_incendiary"],
    defaultAmmo: "chukonu_bolt",

    price: 75,
    updateAdded: "Update 2.2",

    chamber: { loaded: "10", extra: 10 },

    stats: {
      damage: 150,
      dropRange: 15,
      rateOfFire: 40,
      cycleTime: 0.7,
      spread: 10,
      sway: 100,
      verticalRecoil: 2,
      reloadSpeed: 8.5,
      muzzleVelocity: 125,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_dolch_96",
    category: "weapon",
    name: "Dolch 96",
    image: "images/weapons/dolch_96.png",

    slotSize: 2,
    ammoCategory: "special",
    weaponClass: "handgun",
    ammoEffects: ["bleed"],

    ammoTypes: ["dolch96_special", "dolch96_dumdum"],
    defaultAmmo: "dolch96_special",

    price: 690,
    updateAdded: "Update Early Access 0.1",

    chamber: { loaded: "10", extra: 10 },

    stats: {
      damage: 97,
      dropRange: 70,
      rateOfFire: 64,
      cycleTime: 0.4,
      spread: 35,
      sway: 128,
      verticalRecoil: 14,
      reloadSpeed: 6,
      muzzleVelocity: 440,
      meleeLight: 13,
      meleeHeavy: 31,
      staminaConsumption: 20,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_flame_rifle",
    category: "weapon",
    name: "Flame Rifle",
    image: "images/weapons/flame_rifle.png",

    slotSize: 2,
    ammoCategory: "special",
    weaponClass: "rifle",
    ammoEffects: [],

    ammoTypes: ["flamerifle_oil"],
    defaultAmmo: "flamerifle_oil",

    price: null,
    scarce: true,
    updateAdded: "Update 2.6",

    // ⚠ 위키에 예비 탄약(Extra) 항목 자체가 없음 - 연료 탱크 방식이라 재장전 개념이 다른 것으로 추정
    chamber: { loaded: "60", extra: 0 },

    stats: {
      damage: 25,
      dropRange: 5,
      rateOfFire: 75,
      cycleTime: 0.1,
      spread: 37.5,
      sway: 77,
      verticalRecoil: 0.1,
      reloadSpeed: 4.5,
      muzzleVelocity: 40,
      meleeLight: 27,
      meleeHeavy: 54,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_hand_crossbow",
    category: "weapon",
    name: "Hand Crossbow",
    image: "images/weapons/hand_crossbow.png",

    slotSize: 1,
    ammoCategory: "special",
    weaponClass: "handgun",
    dualAmmoSlot: true, // 단발식이라 탄종 2개를 동시에 넣고 교체 가능(위키 확인)
    ammoEffects: ["dragonbreath", "poison", "chaos", "choke"],

    ammoTypes: ["handcrossbow_bolt", "handcrossbow_chaos", "handcrossbow_choke", "handcrossbow_dragon", "handcrossbow_poison"],
    defaultAmmo: "handcrossbow_bolt",

    price: 30,
    updateAdded: "Update Early Access 2.1",

    chamber: { loaded: "1", extra: 16 },

    stats: {
      damage: 210,
      dropRange: 15,
      rateOfFire: 14,
      cycleTime: 4.5,
      spread: 25,
      sway: 82,
      verticalRecoil: 1.2,
      reloadSpeed: 4.3,
      muzzleVelocity: 100,
      meleeLight: 13,
      meleeHeavy: 27,
      staminaConsumption: 10,
    },

    description: "",
    variants: [],
  },

  // ── 근접무기(Melee) — 원거리 탄약 없음, 위키 실측치+사용자 확인 ───────
  {
    id: "weapon_combat_axe",
    category: "weapon",
    name: "Combat Axe",
    image: "images/weapons/combat_axe.png",

    slotSize: 2,
    ammoCategory: "melee",
    weaponClass: "melee",
    ammoEffects: [],
    ammoTypes: [],
    defaultAmmo: null,

    price: 40,
    updateAdded: "Update Early Access 2.1",

    chamber: { loaded: "-", extra: 0 },

    // ⚠ Stamina Consumption은 위키의 "Heavy Stamina Consumption" 값 사용 (다른 무기들의 staminaConsumption 필드와 동일 관례)
    stats: {
      meleeLight: 200,
      meleeHeavy: 495,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_katana",
    category: "weapon",
    name: "Katana",
    image: "images/weapons/katana.png",

    slotSize: 2,
    ammoCategory: "melee",
    weaponClass: "melee",
    ammoEffects: [],
    ammoTypes: [],
    defaultAmmo: null,

    price: 115,
    updateAdded: "Update 1.15",

    chamber: { loaded: "-", extra: 0 },

    stats: {
      meleeLight: 165,
      meleeHeavy: 280,
      staminaConsumption: 35,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_railroad_hammer",
    category: "weapon",
    name: "Railroad Hammer",
    image: "images/weapons/railroad_hammer.png",

    slotSize: 2,
    ammoCategory: "melee",
    weaponClass: "melee",
    ammoEffects: [],
    ammoTypes: [],
    defaultAmmo: null,

    price: 45,
    updateAdded: "Update 1.13",

    chamber: { loaded: "-", extra: 0 },

    stats: {
      meleeLight: 170,
      meleeHeavy: 520,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_baseball_bat",
    category: "weapon",
    name: "Baseball Bat",
    image: "images/weapons/baseball_bat.png",

    slotSize: 1,
    ammoCategory: "melee",
    weaponClass: "melee",
    ammoEffects: [],
    ammoTypes: [],
    defaultAmmo: null,

    price: 40,
    updateAdded: "Update 1.14",

    chamber: { loaded: "-", extra: 0 },

    stats: {
      meleeLight: 90,
      meleeHeavy: 200,
      staminaConsumption: 10,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_cavalry_saber",
    category: "weapon",
    name: "Cavalry Saber",
    image: "images/weapons/cavalry_saber.png",

    slotSize: 1,
    ammoCategory: "melee",
    weaponClass: "melee",
    ammoEffects: [],
    ammoTypes: [],
    defaultAmmo: null,

    price: 50,
    updateAdded: "Update Early Access 0.1",

    chamber: { loaded: "-", extra: 0 },

    stats: {
      meleeLight: 150,
      meleeHeavy: 252,
      staminaConsumption: 25,
    },

    description: "",
    variants: [],
  },

  {
    id: "weapon_machete",
    category: "weapon",
    name: "Machete",
    image: "images/weapons/machete.png",

    slotSize: 1,
    ammoCategory: "melee",
    weaponClass: "melee",
    ammoEffects: [],
    ammoTypes: [],
    defaultAmmo: null,

    price: 30,
    updateAdded: "Update Early Access 0.1",

    chamber: { loaded: "-", extra: 0 },

    stats: {
      meleeLight: 175,
      meleeHeavy: 220,
      staminaConsumption: 20,
    },

    description: "",
    variants: [],
  },

  // ── 도구(Tools) ──────────────────────────────────────────────────────
  // 스키마는 파일 맨 끝 "빠른 참조: 도구 객체 스키마" 주석 참고.
  // 분류(toolClass) 8종 / 태그(toolTags) 11종은 TOOL_FILTERS 정의 참고.
  // ✅ [확인됨] 위키 실측치 + 사용자 재확인(2026-07-15) — 전 항목.
  // 도구/소모품은 무기와 달리 "자세히 보기"(마네킹/그래프) 화면이 필요 없음
  // (사용자 확인) — 카드 클릭 시 뜨는 요약 패널(renderGenericDetailHTML)만 사용.
  // 태그가 없는 항목(Derringer Pennyshot/Quad Derringer/Spyglass)은 위키
  // 자체에 해당 태그 카테고리가 없는 것으로 확인됨(추측 아님).

  // ── 교란 ──
  {
    id: "tool_blank_fire_decoys",
    category: "tool",
    name: "Blank Fire Decoys",
    image: "images/tools/blank_fire_decoys.png",
    toolClass: "distraction",
    toolTags: ["throwable", "noise"],
    price: 45,
    updateAdded: "Update Early Access 2.2",
    unlockRank: 52,
    uses: 6,
    stats: { damage: 20, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "총성을 흉내 내는 디코이. 착탄 지점에서 총소리를 내 적을 위협·교란한다.",
  },
  {
    id: "tool_decoys",
    category: "tool",
    name: "Decoys",
    image: "images/tools/decoys.png",
    toolClass: "distraction",
    toolTags: ["throwable", "noise"],
    price: 6,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    uses: 12,
    stats: { damage: 20, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "고철과 유리 조각이 든 주머니. 던지면 소음을 내 적의 시선을 돌린다.",
  },
  {
    id: "tool_decoy_fuses",
    category: "tool",
    name: "Decoy Fuses",
    image: "images/tools/decoy_fuses.png",
    toolClass: "distraction",
    toolTags: ["throwable", "noise"],
    price: 30,
    updateAdded: "Update 1.3",
    unlockRank: 52,
    uses: 5,
    stats: { damage: 40, throwRange: 22, fuseTimer: 6, meleeLight: 13, meleeHeavy: 27 },
    description: "점화하면 폭발음을 내는 퓨즈. 닫힌 문/창문 셔터를 부수는 데도 쓸 수 있다.",
  },

  // ── 치유 ──
  {
    id: "tool_first_aid_kit",
    category: "tool",
    name: "First Aid Kit",
    image: "images/tools/first_aid_kit.png",
    toolClass: "healing",
    toolTags: ["healing"],
    price: 30,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    uses: 3,
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "붕대 키트. 체력 50을 회복하고 출혈을 멈춘다(치유 특성 적용 시 100 회복). 3회 사용 가능.",
  },

  // ── 불/광원 ──
  {
    id: "tool_flare_pistol",
    category: "tool",
    name: "Flare Pistol",
    image: "images/tools/flare_pistol.png",
    toolClass: "fire_light",
    toolTags: ["fire", "light", "vision"],
    price: 36,
    updateAdded: "Update Early Access 2.0",
    unlockRank: 23,
    // ⚠ 위키 표기상 무기와 동일한 스탯 체계 사용 (Weapon Stats)
    chamber: { loaded: 1, extra: 1 }, // Starshell 탄약
    stats: {
      damage: 26, dropRange: 10, rateOfFire: 12, spread: 52.8, sway: 113,
      verticalRecoil: 5, reloadSpeed: 4.4, muzzleVelocity: 75, effectDuration: 60,
      meleeLight: 13, meleeHeavy: 27,
    },
    description: "조명탄을 쏘는 권총형 도구. 인화성 물질에 불을 붙일 수 있다.",
  },
  {
    id: "tool_fusees",
    category: "tool",
    name: "Fusees",
    image: "images/tools/fusees.png",
    toolClass: "fire_light",
    toolTags: ["throwable", "fire", "light", "vision"],
    price: 10,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    uses: 5,
    stats: { damage: 11, effectDuration: 300, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "손에 쥐고 던지는 신호탄. 어두운 곳을 밝히고 인화성 물질에 불을 붙인다.",
  },

  // ── 근접무기 ──
  {
    id: "tool_dusters",
    category: "tool",
    name: "Dusters",
    image: "images/tools/dusters.png",
    toolClass: "melee",
    toolTags: ["melee"],
    price: 30,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    stats: { meleeLight: 31, meleeHeavy: 72, staminaConsumption: 5, staminaConsumptionHeavy: 10 },
    description: "손에 끼우는 황동 너클. 둔기 계열 근접 피해를 입힌다.",
  },
  {
    id: "tool_heavy_knife",
    category: "tool",
    name: "Heavy Knife",
    image: "images/tools/heavy_knife.png",
    toolClass: "melee",
    toolTags: ["rending", "melee"],
    price: 20,
    updateAdded: "Update 1.2",
    unlockRank: 5,
    stats: { meleeLight: 72, meleeHeavy: 120, staminaConsumption: 9, staminaConsumptionHeavy: 25 },
    description: "근접전에 특화된 대형 나이프. 기본 나이프보다 강한 열상 피해를 입힌다.",
  },
  {
    id: "tool_knife",
    category: "tool",
    name: "Knife",
    image: "images/tools/knife.png",
    toolClass: "melee",
    toolTags: ["rending", "melee"],
    price: 40,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    stats: { meleeLight: 52, meleeHeavy: 105, staminaConsumption: 20, staminaConsumptionHeavy: 25 },
    description: "다목적으로 쓰이는 기본형 나이프.",
  },
  {
    id: "tool_knuckle_knife",
    category: "tool",
    name: "Knuckle Knife",
    image: "images/tools/knuckle_knife.png",
    toolClass: "melee",
    toolTags: ["melee"],
    price: 50,
    updateAdded: "Update 1.2",
    unlockRank: 25,
    stats: { meleeLight: 58, meleeHeavy: 92, staminaConsumption: 8, staminaConsumptionHeavy: 21 },
    description: "너클과 나이프를 결합한 근접무기. 약공격은 둔기, 강공격은 관통 피해를 입힌다.",
  },

  // ── 투척무기 ──
  {
    id: "tool_throwing_axes",
    category: "tool",
    name: "Throwing Axes",
    image: "images/tools/throwing_axes.png",
    toolClass: "throwable_melee",
    toolTags: ["throwable", "rending"],
    price: 50,
    updateAdded: "Update 1.6.1",
    unlockRank: 8,
    uses: 3,
    stats: {
      damage: 162, dropRange: 5, spread: 15, muzzleVelocity: 30, throwRange: 85,
      meleeLight: 75, meleeHeavy: 142,
      staminaConsumption: 40, staminaConsumptionHeavy: 55, staminaConsumptionThrow: 20,
    },
    description: "던지고 회수할 수 있는 손도끼. 근접무기로도 사용할 수 있다.",
  },
  {
    id: "tool_throwing_knives",
    category: "tool",
    name: "Throwing Knives",
    image: "images/tools/throwing_knives.png",
    toolClass: "throwable_melee",
    toolTags: ["throwable", "rending"],
    price: 30,
    updateAdded: "Update Early Access 2.1",
    unlockRank: 2,
    uses: 8,
    stats: {
      damage: 150, dropRange: 5, spread: 15, muzzleVelocity: 30, throwRange: 115,
      meleeLight: 30, meleeHeavy: 59,
      staminaConsumption: 10, staminaConsumptionHeavy: 25, staminaConsumptionThrow: 15,
    },
    description: "조용히 던질 수 있는 나이프. 던진 뒤 회수해서 재사용할 수 있다.",
  },
  {
    id: "tool_throwing_spear",
    category: "tool",
    name: "Throwing Spear",
    image: "images/tools/throwing_spear.png",
    toolClass: "throwable_melee",
    toolTags: ["throwable", "rending"],
    price: 80,
    updateAdded: "Update 1.16.2",
    unlockRank: 33,
    uses: 1,
    stats: {
      damage: 200, dropRange: 10, spread: 5, muzzleVelocity: 40, throwRange: 160,
      meleeLight: 70, meleeHeavy: 147,
      staminaConsumption: 34, staminaConsumptionHeavy: 55, staminaConsumptionThrow: 34,
    },
    description: "양손으로 다루는 창. 던지거나 근접무기로 사용할 수 있다.",
  },

  // ── 포켓피스톨 (무기와 동일한 스탯 체계 사용) ──
  {
    id: "tool_derringer_pennyshot",
    category: "tool",
    name: "Derringer Pennyshot",
    image: "images/tools/derringer_pennyshot.png",
    toolClass: "pocket_pistol",
    toolTags: [], // ✅ [확인됨] 위키 자체에 해당 태그 카테고리 없음
    price: 63,
    updateAdded: "Update 1.14",
    unlockRank: 17,
    chamber: { loaded: 2, extra: 2 }, // Penny Shot 탄약
    stats: {
      damage: 21, dropRange: 10, rateOfFire: 12, cycleTime: 0.6, spread: 140, sway: 113,
      verticalRecoil: 35, reloadSpeed: 8.1, muzzleVelocity: 250, meleeLight: 13, meleeHeavy: 27,
    },
    description: "페니샷 탄 2발을 장전하는 소형 권총. 비상용으로 적합하다.",
  },
  {
    id: "tool_quad_derringer",
    category: "tool",
    name: "Quad Derringer",
    image: "images/tools/quad_derringer.png",
    toolClass: "pocket_pistol",
    toolTags: [],
    price: 30,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    chamber: { loaded: 4, extra: 16 }, // Derringer 탄약
    stats: {
      damage: 74, dropRange: 35, rateOfFire: 40, cycleTime: 0.4, spread: 40, sway: 113,
      verticalRecoil: 4, reloadSpeed: 3.6, muzzleVelocity: 130, meleeLight: 13, meleeHeavy: 27,
    },
    description: "네 발을 연속 발사할 수 있는 소형 권총. 예비탄 16발을 휴대한다.",
  },

  // ── 함정 ──
  {
    id: "tool_alert_trip_mines",
    category: "tool",
    name: "Alert Trip Mines",
    image: "images/tools/alert_trip_mines.png",
    toolClass: "trap",
    toolTags: ["placeable", "noise", "fire", "light"],
    price: 30,
    updateAdded: "Update Early Access 6.0",
    unlockRank: 29,
    uses: 2,
    stats: { damage: 25, meleeLight: 13, meleeHeavy: 27 },
    description: "설치형 인계철선 트랩. 걸리면 폭죽과 조명탄이 터져 위치를 알린다.",
  },
  {
    id: "tool_concertina_trip_mines",
    category: "tool",
    name: "Concertina Trip Mines",
    image: "images/tools/concertina_trip_mines.png",
    toolClass: "trap",
    toolTags: ["placeable", "rending"],
    price: 90,
    updateAdded: "Update Early Access 6.0",
    unlockRank: 29,
    uses: 2,
    stats: { damage: 32, effectRadius: 2, meleeLight: 13, meleeHeavy: 27 },
    description: "설치형 인계철선 트랩. 걸리면 철조망 다발이 펼쳐져 문/창문을 막는다.",
  },
  {
    id: "tool_poison_trip_mines",
    category: "tool",
    name: "Poison Trip Mines",
    image: "images/tools/poison_trip_mines.png",
    toolClass: "trap",
    toolTags: ["placeable", "poison"],
    price: 30,
    updateAdded: "Update 1.4",
    unlockRank: 29,
    uses: 2,
    stats: { damagePerTick: 5, effectRadius: 1, effectDuration: 20, meleeLight: 13, meleeHeavy: 27 },
    description: "설치형 인계철선 트랩. 걸리면 중독 구름이 퍼진다.",
  },
  {
    id: "tool_bear_traps",
    category: "tool",
    name: "Bear Traps",
    image: "images/tools/bear_traps.png",
    toolClass: "trap",
    toolTags: ["placeable", "rending"],
    price: 70,
    updateAdded: "Update 2.0",
    unlockRank: 35,
    uses: 2,
    stats: { damage: 62, effectRadius: 0.5, meleeLight: 31, meleeHeavy: 67 },
    description: "발판을 밟으면 물리는 곰덫. 큰 소리와 함께 출혈성 피해를 입힌다.",
  },

  // ── 기타 ──
  {
    id: "tool_choke_bombs",
    category: "tool",
    name: "Choke Bombs",
    image: "images/tools/choke_bombs.png",
    toolClass: "other",
    toolTags: ["throwable"],
    price: 25,
    updateAdded: "Update 1.1",
    unlockRank: 1,
    uses: 2,
    stats: { damage: 1, effectRadius: 3, effectDuration: 60, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "던지면 4초 후 터져 질식 구름을 만든다. 화염을 꺼뜨리고 새 발화도 막는다.",
  },
  {
    id: "tool_spyglass",
    category: "tool",
    name: "Spyglass",
    image: "images/tools/spyglass.png",
    toolClass: "other",
    toolTags: [], // ✅ [확인됨] 위키 자체에 해당 태그 카테고리 없음
    price: 8,
    updateAdded: "Update Early Access 1.0",
    unlockRank: 1,
    stats: { sway: 69, meleeLight: 13, meleeHeavy: 27 },
    description: "먼 곳을 볼 수 있는 망원경. 핑 마커 사용 중 조준하면 목표까지의 거리도 표시된다.",
  },

  // ── 소모품(Consumables) ────────────────────────────────────────────
  // 스키마는 파일 맨 끝 "빠른 참조: 소모품 객체 스키마" 주석 참고.
  // 분류(consumableClass) 9종 / 태그(consumableTags) 10종은 CONSUMABLE_FILTERS 정의 참고.
  // ✅ [확인됨] 위키 실측치 + 사용자 재확인(2026-07-15) — 전 항목.
  // 태그는 위키 각 항목의 Categories 푸터를 개별 확인함(추측 아님). 타로 카드(14종)와
  // 이벤트 전용 소모품(Wormseed Shot류, Reliquary류, Proof Vapours류, 총 10종)은 조사 결과
  // ⚠ 전부 특정 이벤트 기간에만 판매되고 이벤트 종료 후 환불/제거되는 한시적 아이템으로 확인됨
  // (Silver Reliquary는 Update 1.5.1에서 실제로 게임에서 제거됨 — 위키 자체 기록).
  // 도구(Tool)의 "Removed Tools"(Multitool/Electric Lamp)를 데이터에서 제외한 것과 동일한
  // 기준으로 이번에도 제외함 — "현재 상시 획득 가능한" 항목만 반영한다는 원칙 유지.

  // ── 재보급 ──
  {
    id: "consumable_ammo_box",
    category: "consumable",
    name: "Ammo Box",
    image: "images/consumables/ammo_box.png",
    consumableClass: "resupply",
    consumableTags: ["placeable"],
    price: 65,
    updateAdded: "Update Early Access 6.0",
    unlockRank: 1,
    stats: { meleeLight: 31, meleeHeavy: 90 },
    description: "탄약 상자의 2배수를 채워준다.",
  },
  {
    id: "consumable_tool_box",
    category: "consumable",
    name: "Tool Box",
    image: "images/consumables/tool_box.png",
    consumableClass: "resupply",
    consumableTags: ["placeable"],
    price: 70,
    updateAdded: "Update 1.13",
    unlockRank: 55,
    stats: { meleeLight: 31, meleeHeavy: 90 },
    description: "소모한 도구 중 랜덤하게 1개를 채워준다.",
  },

  // ── 불/광원 ──
  {
    id: "consumable_fire_bomb",
    category: "consumable",
    name: "Fire Bomb",
    image: "images/consumables/fire_bomb.png",
    consumableClass: "fire_light",
    consumableTags: ["throwable", "fire"],
    price: 30,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    stats: { damage: 11, effectRadius: 3, effectDuration: 120, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "던지면 터지는 유리병 화염병. 넓은 범위에 불붙은 액체를 흩뿌린다.",
  },
  {
    id: "consumable_hellfire_bomb",
    category: "consumable",
    name: "Hellfire Bomb",
    image: "images/consumables/hellfire_bomb.png",
    consumableClass: "fire_light",
    consumableTags: ["throwable", "fire"],
    price: 70,
    updateAdded: "Update Early Access 2.2",
    unlockRank: 43,
    stats: { damage: 49, effectRadius: 6, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "파이어 봄의 강화형. 착탄 시 더 크고 집중된 화염 폭발을 일으킨다.",
  },
  {
    id: "consumable_liquid_fire_bomb",
    category: "consumable",
    name: "Liquid Fire Bomb",
    image: "images/consumables/liquid_fire_bomb.png",
    consumableClass: "fire_light",
    consumableTags: ["throwable", "fire"],
    price: 35,
    updateAdded: "Update Early Access 2.3",
    unlockRank: 43,
    stats: { damage: 11, effectRadius: 3, effectDuration: 120, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "물 위에서도 타는 화염병. 내부 쇠구슬 덕분에 착탄 시 확실하게 깨진다.",
  },

  // ── 폭발 ──
  {
    id: "consumable_dynamite_stick",
    category: "consumable",
    name: "Dynamite Stick",
    image: "images/consumables/dynamite_stick.png",
    consumableClass: "explosive",
    consumableTags: ["throwable", "explosive"],
    price: 18,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 1,
    stats: { damage: 750, effectRadius: 8, fuseTimer: 4, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "다이너마이트 한 개비. 던져서 점화 후 몇 초 뒤 폭발한다.",
  },
  {
    id: "consumable_dynamite_bundle",
    category: "consumable",
    name: "Dynamite Bundle",
    image: "images/consumables/dynamite_bundle.png",
    consumableClass: "explosive",
    consumableTags: ["throwable", "explosive"],
    price: 75,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 15,
    stats: { damage: 1500, effectRadius: 10, fuseTimer: 4, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "다이너마이트 여러 개를 묶은 다발. 단일 다이너마이트보다 훨씬 강력하다.",
  },
  {
    id: "consumable_waxed_dynamite_stick",
    category: "consumable",
    name: "Waxed Dynamite Stick",
    image: "images/consumables/waxed_dynamite_stick.png",
    consumableClass: "explosive",
    consumableTags: ["throwable", "explosive"],
    price: 24,
    updateAdded: "Update Early Access 2.3",
    unlockRank: 19,
    stats: { damage: 750, effectRadius: 8, fuseTimer: 4, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "밀랍으로 코팅된 다이너마이트. 물속이나 초크 구름 안에서도 기폭된다.",
  },
  {
    id: "consumable_big_dynamite_bundle",
    category: "consumable",
    name: "Big Dynamite Bundle",
    image: "images/consumables/big_dynamite_bundle.png",
    consumableClass: "explosive",
    consumableTags: ["throwable", "explosive"],
    price: 110,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 58,
    stats: { damage: 3000, effectRadius: 11, fuseTimer: 4, throwRange: 15, meleeLight: 13, meleeHeavy: 27 },
    description: "다이너마이트 일곱 개비를 묶은 대형 다발. 정말로 크게 부술 때 쓴다.",
  },
  {
    id: "consumable_sticky_bomb",
    category: "consumable",
    name: "Sticky Bomb",
    image: "images/consumables/sticky_bomb.png",
    consumableClass: "explosive",
    consumableTags: ["throwable", "rending"],
    price: 64,
    updateAdded: "Update Early Access 2.2",
    unlockRank: 1,
    stats: { damage: 800, effectRadius: 8, fuseTimer: 8, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "물체나 적에게 달라붙는 다이너마이트. 8초 뒤 폭발한다.",
  },
  {
    id: "consumable_frag_bomb",
    category: "consumable",
    name: "Frag Bomb",
    image: "images/consumables/frag_bomb.png",
    consumableClass: "explosive",
    consumableTags: ["throwable", "rending"],
    price: 103,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 41,
    stats: { damage: 250, effectRadius: 11, fuseTimer: 4, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "넓은 범위에 파편을 흩뿌리는 폭탄. 문이나 철조망을 부술 만큼 강하지는 않다.",
  },
  {
    id: "consumable_dark_dynamite_satchel",
    category: "consumable",
    name: "Dark Dynamite Satchel",
    image: "images/consumables/dark_dynamite_satchel.png",
    consumableClass: "explosive",
    consumableTags: ["placeable", "explosive"],
    price: 100,
    updateAdded: "Update 2.1",
    unlockRank: 46,
    stats: { damage: 3000, effectRadius: 11, fuseTimer: 1, meleeLight: 13, meleeHeavy: 27 },
    description: "벽이나 바닥에 설치하고 다크사이트로 원격 기폭하는 다이너마이트 뭉치.",
  },

  // ── 독 ──
  {
    id: "consumable_hive_bomb",
    category: "consumable",
    name: "Hive Bomb",
    image: "images/consumables/hive_bomb.png",
    consumableClass: "poison",
    consumableTags: ["throwable", "poison", "vision"],
    price: 40,
    updateAdded: "Update Early Access 2.0",
    unlockRank: 48,
    stats: { damagePerTick: 4, effectDuration: 30, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "터지면 독을 가진 말벌 떼가 나와 주변을 공격한다. 몬스터에게는 효과가 없다.",
  },
  {
    id: "consumable_poison_bomb",
    category: "consumable",
    name: "Poison Bomb",
    image: "images/consumables/poison_bomb.png",
    consumableClass: "poison",
    consumableTags: ["throwable", "poison"],
    price: 25,
    updateAdded: "Update Early Access 1.0",
    unlockRank: 39,
    stats: { damagePerTick: 6, effectRadius: 3, effectDuration: 510, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "착탄 시 오래 지속되는 중독 구름을 만드는 폭탄.",
  },

  // ── 교란 ──
  {
    id: "consumable_chaos_bomb",
    category: "consumable",
    name: "Chaos Bomb",
    image: "images/consumables/chaos_bomb.png",
    consumableClass: "distraction",
    consumableTags: ["throwable", "noise"],
    price: 15,
    updateAdded: "Update Early Access 2.2",
    unlockRank: 31,
    stats: { damage: 13, fuseTimer: 8, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "여러 총성을 흉내 내는 폭죽 뭉치. 약 30초간 적을 교란한다.",
  },

  // ── 지속효과 ──
  {
    id: "consumable_antidote_shot",
    category: "consumable",
    name: "Antidote Shot",
    image: "images/consumables/antidote_shot.png",
    consumableClass: "over_time",
    consumableTags: ["healing"],
    price: 55,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 21,
    stats: { effectDuration: 600, meleeLight: 13, meleeHeavy: 27 },
    description: "일정 시간 동안 중독 효과에 면역이 되는 주사.",
  },
  {
    id: "consumable_antidote_shot_weak",
    category: "consumable",
    name: "Antidote Shot (Weak)",
    image: "images/consumables/antidote_shot_weak.png",
    consumableClass: "over_time",
    consumableTags: ["healing"],
    price: 30,
    updateAdded: "Update 1.0",
    unlockRank: 1,
    stats: { effectDuration: 300, meleeLight: 13, meleeHeavy: 27 },
    description: "Antidote Shot의 하위 버전. 면역 지속 시간이 더 짧다.",
  },
  {
    id: "consumable_regeneration_shot",
    category: "consumable",
    name: "Regeneration Shot",
    image: "images/consumables/regeneration_shot.png",
    consumableClass: "over_time",
    consumableTags: ["healing"],
    price: 105,
    updateAdded: "Update 1.6.2",
    unlockRank: 13,
    stats: { effectDuration: 420, meleeLight: 13, meleeHeavy: 27 },
    description: "일정 시간 동안 소진된 체력 칸을 서서히 재생시키는 주사.",
  },
  {
    id: "consumable_regeneration_shot_weak",
    category: "consumable",
    name: "Regeneration Shot (Weak)",
    image: "images/consumables/regeneration_shot_weak.png",
    consumableClass: "over_time",
    consumableTags: ["healing"],
    price: 40,
    updateAdded: "Update 1.6.2",
    unlockRank: 1,
    stats: { effectDuration: 240, meleeLight: 13, meleeHeavy: 27 },
    description: "Regeneration Shot의 하위 버전. 지속 시간이 더 짧다.",
  },
  {
    id: "consumable_stamina_shot",
    category: "consumable",
    name: "Stamina Shot",
    image: "images/consumables/stamina_shot.png",
    consumableClass: "over_time",
    consumableTags: ["healing"],
    price: 100,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 10,
    stats: { effectDuration: 420, meleeLight: 13, meleeHeavy: 27 },
    description: "일정 시간 동안 기력을 회복시키고 소모를 막아주는 주사.",
  },
  {
    id: "consumable_stamina_shot_weak",
    category: "consumable",
    name: "Stamina Shot (Weak)",
    image: "images/consumables/stamina_shot_weak.png",
    consumableClass: "over_time",
    consumableTags: ["healing"],
    price: 60,
    updateAdded: "Update 1.0",
    unlockRank: 1,
    stats: { effectDuration: 240, meleeLight: 13, meleeHeavy: 27 },
    description: "Stamina Shot의 하위 버전. 지속 시간이 더 짧다.",
  },

  // ── 치유 ──
  {
    id: "consumable_medical_pack",
    category: "consumable",
    name: "Medical Pack",
    image: "images/consumables/medical_pack.png",
    consumableClass: "healing",
    consumableTags: ["healing", "placeable"],
    price: 35,
    updateAdded: "Update 1.13",
    unlockRank: 1,
    stats: { meleeLight: 13, meleeHeavy: 31 },
    description: "",
  },
  {
    id: "consumable_vitality_shot",
    category: "consumable",
    name: "Vitality Shot",
    image: "images/consumables/vitality_shot.png",
    consumableClass: "healing",
    consumableTags: ["healing"],
    price: 85,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 7,
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "체력을 즉시 150(전체) 회복시키는 주사.",
  },
  {
    id: "consumable_vitality_shot_weak",
    category: "consumable",
    name: "Vitality Shot (Weak)",
    image: "images/consumables/vitality_shot_weak.png",
    consumableClass: "healing",
    consumableTags: ["healing"],
    price: 20,
    updateAdded: "Update Early Access 2.1",
    unlockRank: 1,
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "체력을 즉시 75회복시키는 주사.",
  },
  {
    id: "consumable_recovery_shot",
    category: "consumable",
    name: "Recovery Shot",
    image: "images/consumables/recovery_shot.png",
    consumableClass: "healing",
    consumableTags: ["healing"],
    price: 140,
    updateAdded: "Update 2.2",
    unlockRank: 1,
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "다운 등으로 영구히 사라진 체력 칸을 1개 복구해주는 주사.",
  },

  // ── 딱정벌레 ──
  {
    id: "consumable_stalker_beetle",
    category: "consumable",
    name: "Stalker Beetle",
    image: "images/consumables/stalker_beetle.png",
    consumableClass: "beetle",
    consumableTags: ["throwable", "rending", "noise", "poison"],
    price: 45,
    updateAdded: "Update 1.10",
    unlockRank: 27,
    stats: { damage: 50, effectRadius: 5, throwRange: 15, controlRange: 150, meleeLight: 13, meleeHeavy: 27 },
    description: "날려서 정찰용으로 조종하는 딱정벌레. 최후의 수단으로 자폭할 수 있다.",
  },
  {
    id: "consumable_choke_beetle",
    category: "consumable",
    name: "Choke Beetle",
    image: "images/consumables/choke_beetle.png",
    consumableClass: "beetle",
    consumableTags: ["throwable", "noise"],
    price: 22,
    updateAdded: "Update 1.13",
    unlockRank: 27,
    stats: { damage: 1, effectRadius: 3, effectDuration: 60, throwRange: 15, controlRange: 150, meleeLight: 13, meleeHeavy: 27 },
    description: "정찰용 딱정벌레. 죽거나 명령을 받으면 질식 구름을 터뜨린다.",
  },
  {
    id: "consumable_fire_beetle",
    category: "consumable",
    name: "Fire Beetle",
    image: "images/consumables/fire_beetle.png",
    consumableClass: "beetle",
    consumableTags: ["throwable", "noise", "fire"],
    price: 57,
    updateAdded: "Update 1.14",
    unlockRank: 27,
    stats: { damage: 25, effectRadius: 2, throwRange: 15, controlRange: 150, meleeLight: 13, meleeHeavy: 27 },
    description: "정찰용 딱정벌레. 죽거나 명령을 받으면 불이 붙어 주변을 태운다.",
  },

  // ── 기타 ──
  {
    id: "consumable_concertina_bomb",
    category: "consumable",
    name: "Concertina Bomb",
    image: "images/consumables/concertina_bomb.png",
    consumableClass: "other",
    consumableTags: ["throwable", "rending"],
    price: 38,
    updateAdded: "Update Early Access 0.1",
    unlockRank: 37,
    stats: { damage: 158, effectRadius: 7, throwRange: 15, meleeLight: 52, meleeHeavy: 112 },
    description: "던지면 넓은 범위에 철조망을 펼쳐 통로를 막는 폭탄.",
  },
  {
    id: "consumable_flash_bomb",
    category: "consumable",
    name: "Flash Bomb",
    image: "images/consumables/flash_bomb.png",
    consumableClass: "other",
    consumableTags: ["throwable", "light", "vision"],
    price: 25,
    updateAdded: "Update Early Access 1.0",
    unlockRank: 50,
    stats: { damage: 1, effectRadius: 8, throwRange: 22, meleeLight: 13, meleeHeavy: 27 },
    description: "터지면 강한 섬광으로 주변 시야를 일시적으로 마비시키는 폭탄.",
  },

  // ── 타로 카드 (Update 2.5 "Web of the Empress" 이벤트에서 최초 도입, 전부 Scarce) ──
  // ✅ [확인됨] 위키 실측치 + 사용자 재확인(2026-07-15). 위키 자체 카테고리 푸터에 태그(투척/설치 등)가
  // 없어 consumableTags는 전부 빈 배열로 둠(추측 아님 — 물리적 투척/설치 아이템이 아닌 순수 효과 카드).
  {
    id: "consumable_tarot_the_chariot",
    category: "consumable",
    name: "The Chariot",
    image: "images/consumables/tarot/the_chariot.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "바운티 헌트에서 팀별 개방/봉쇄 추출구를 서로 뒤바꾸고 숨겨진 추출구를 팀에 공개한다. 체력 칸 1개를 소모하며, 재사용까지 5분 쿨다운이 있고 미션 종료 5분 전에는 사용할 수 없다.",
  },
  {
    id: "consumable_tarot_the_devil",
    category: "consumable",
    name: "The Devil",
    image: "images/consumables/tarot/the_devil.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "다운되기 전까지 무기의 흔들림과 분산도를 줄여준다(샷건 제외). 다운되면 체력 칸을 하나 더 잃는다.",
  },
  {
    id: "consumable_tarot_the_empress",
    category: "consumable",
    name: "The Empress",
    image: "images/consumables/tarot/the_empress.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "Catalyst 특성, Necromancer 특성, 그리고 무작위 소모/희귀 특성 하나를 순서대로 부여한다(헌터의 특성 한도 내에서만).",
  },
  {
    id: "consumable_tarot_the_fool",
    category: "consumable",
    name: "The Fool",
    image: "images/consumables/tarot/the_fool.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "이번 미션에서 마지막으로 사용한 타로 카드를 하나 더 복사해서 얻는다.",
  },
  {
    id: "consumable_tarot_the_garden",
    category: "consumable",
    name: "The Garden",
    image: "images/consumables/tarot/the_garden.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "자신과 팀원의 체력을 완전히 회복시키고 출혈·화상·중독 상태를 모두 제거한다.",
  },
  {
    id: "consumable_tarot_the_hanged_man",
    category: "consumable",
    name: "The Hanged Man",
    image: "images/consumables/tarot/the_hanged_man.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { effectDuration: 15, meleeLight: 13, meleeHeavy: 27 },
    description: "가장 가까운 적 헌터를 일정 시간 동안 관전할 수 있다. 이후 관전당한 헌터에게 경고음이 들린다.",
  },
  {
    id: "consumable_tarot_the_high_priestess",
    category: "consumable",
    name: "The High Priestess",
    image: "images/consumables/tarot/the_high_priestess.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.7",
    stats: { effectDuration: 30, meleeLight: 13, meleeHeavy: 27 },
    description: "30초 동안 가장 가까운 적 헌터가 있는 방향을 알려준다.",
  },
  {
    id: "consumable_tarot_the_judgement",
    category: "consumable",
    name: "The Judgement",
    image: "images/consumables/tarot/the_judgement.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "현재 걸려 있는 모든 버프의 지속 시간을 두 배로 늘리지만, 대신 체력을 1까지 떨어뜨린다.",
  },
  {
    id: "consumable_tarot_the_magician",
    category: "consumable",
    name: "The Magician",
    image: "images/consumables/tarot/the_magician.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "자신의 위치에 다크사이트 디코이를 설치하고 사거리 내 단서를 붉게 표시한다. 사용 시 심각한 출혈이 발생한다.",
  },
  {
    id: "consumable_tarot_the_moon",
    category: "consumable",
    name: "The Moon",
    image: "images/consumables/tarot/the_moon.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "다크 사이트 부스트를 2초 부여한다.",
  },
  {
    id: "consumable_tarot_the_pathfinder",
    category: "consumable",
    name: "The Pathfinder",
    image: "images/consumables/tarot/the_pathfinder.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.7",
    stats: { effectDuration: 30, meleeLight: 13, meleeHeavy: 27 },
    description: "맵에서 다른 헌터들이 이미 발견한 모든 단서를 잠시 동안 표시해준다.",
  },
  {
    id: "consumable_tarot_the_sun",
    category: "consumable",
    name: "The Sun",
    image: "images/consumables/tarot/the_sun.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { effectDuration: 90, meleeLight: 13, meleeHeavy: 27 },
    description: "90초 동안 강화된 재생 버프를 부여한다.",
  },
  {
    id: "consumable_tarot_the_tower",
    category: "consumable",
    name: "The Tower",
    image: "images/consumables/tarot/the_tower.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "반경 65m 내의 몬스터와 야생 표적을 처치하고 보스 표적에게 피해를 준다. 대신 자신의 헌터가 불이 붙는다.",
  },
  {
    id: "consumable_tarot_the_world",
    category: "consumable",
    name: "The World",
    image: "images/consumables/tarot/the_world.png",
    consumableClass: "tarot",
    consumableTags: [],
    scarce: true,
    updateAdded: "Update 2.5",
    stats: { meleeLight: 13, meleeHeavy: 27 },
    description: "모든 보스 표적의 위치를 드러내고, 표적당 단서 1개 분량의 보상과 효과(이벤트 포인트, 바운티, Conduit 버프, 바운티 토큰 소지 시 다크사이트 부스트 등)를 준다.",
  },

  // ── 특성(Traits) ────────────────────────────────────────────────────
  // 스키마는 파일 맨 끝 "빠른 참조: 특성 객체 스키마" 주석 참고.
  // 분류(traitClass) 4종 / 태그(traitTags) 4종은 TRAIT_FILTERS 정의 참고.
  // 출처: huntshowdown.wiki.gg/wiki/Traits/각 특성명 ✅ [확인됨] (Assailant/Levering은
  // 사용자 제공 캡처에 설명이 누락되어 위키 원문 직접 확인 후 재작성함)
  // updateAdded는 이 배치에서 확정 정보가 없어 전부 생략함(코드에서 실사용되지 않는 참고용
  // 필드라 생략해도 동작에 영향 없음) — 추후 확인되면 채울 것.

  // -- 공격(Offensive) --------------------------------------------------
  {
    id: "trait_assailant",
    category: "trait",
    name: "Assailant",
    image: "images/traits/trait_assailant.png",
    detailImage: "images/traits/trait_assailant_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 1,
    stats: {},
    description: "투척용 나이프(Throwing Knives)와 투척 도끼(Throwing Axes)의 근접 공격 피해를 증가시킨다. 던지는 공격의 피해량에는 영향이 없고 근접 공격 판정에만 적용되며, 공격 모션도 바뀐다. 투척 창(Throwing Spear)에는 적용되지 않는다.",
    variants: [],
  },
  {
    id: "trait_berserker",
    category: "trait",
    name: "Berserker",
    image: "images/traits/trait_berserker.png",
    detailImage: "images/traits/trait_berserker_detail.png",
    traitClass: "attack",
    traitTags: ["scarce"],
    price: null,
    stats: {},
    description: "모든 근접 공격이 두 배의 피해를 입힌다.",
    variants: [],
  },
  {
    id: "trait_bolt_thrower",
    category: "trait",
    name: "Bolt Thrower",
    image: "images/traits/trait_bolt_thrower.png",
    detailImage: "images/traits/trait_bolt_thrower_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 3,
    stats: {},
    description: "크로스보우(Crossbow), 봄 런처(Bomb Launcher), 봄 랜스(Bomb Lance)의 재장전 시간을 단축시킨다.",
    variants: [],
  },
  {
    id: "trait_fanning",
    category: "trait",
    name: "Fanning",
    image: "images/traits/trait_fanning.png",
    detailImage: "images/traits/trait_fanning_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 8,
    stats: {},
    description: "한손 또는 양손 싱글액션 리볼버 사용 시 발사 속도가 빨라진다.",
    variants: [],
  },
  {
    id: "trait_fast_fingers",
    category: "trait",
    name: "Fast Fingers",
    image: "images/traits/trait_fast_fingers.png",
    detailImage: "images/traits/trait_fast_fingers_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 4,
    stats: {},
    description: "탄환을 미리 손에 쥐고 있어 단발 소총 및 그 소총형(비권총) 파생형의 재장전 속도가 빨라진다.",
    variants: [],
  },
  {
    id: "trait_hundred_hands",
    category: "trait",
    name: "Hundred Hands",
    image: "images/traits/trait_hundred_hands.png",
    detailImage: "images/traits/trait_hundred_hands_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 3,
    stats: {},
    description: "헌팅 보우(Hunting Bow)의 피해량을 늘리고, 완전히 당긴 상태에서 흔들림을 줄인다. 화살을 근접 공격에도 사용할 수 있게 해준다.",
    variants: [],
  },
  {
    id: "trait_iron_eye",
    category: "trait",
    name: "Iron Eye",
    image: "images/traits/trait_iron_eye.png",
    detailImage: "images/traits/trait_iron_eye_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 3,
    stats: {},
    description: "볼트액션, 레버액션, 펌프액션 무기로 사격한 뒤에도 아이언사이트(조준) 시야를 유지한다.",
    variants: [],
  },
  {
    id: "trait_levering",
    category: "trait",
    name: "Levering",
    image: "images/traits/trait_levering.png",
    detailImage: "images/traits/trait_levering_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 7,
    stats: {},
    description: "레버액션 무기를 조준하지 않은 상태(힙파이어, 1단계 조준)에서 발사 속도가 빨라진다.",
    variants: [],
  },
  {
    id: "trait_martialist",
    category: "trait",
    name: "Martialist",
    image: "images/traits/trait_martialist.png",
    detailImage: "images/traits/trait_martialist_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 2,
    stats: {},
    description: "카타나(Katana)를 검집에 넣을 수 있게 해주며, 이 상태에서 발도(발검) 공격으로 추가 피해를 주는 선제 공격을 사용할 수 있다.",
    variants: [],
  },
  {
    id: "trait_pitcher",
    category: "trait",
    name: "Pitcher",
    image: "images/traits/trait_pitcher.png",
    detailImage: "images/traits/trait_pitcher_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 4,
    stats: {},
    description: "조준 보조선(에임 헬퍼)이 적용되는 모든 아이템의 던지는 사거리를 늘린다.",
    variants: [],
  },
  {
    id: "trait_scopesmith",
    category: "trait",
    name: "Scopesmith",
    image: "images/traits/trait_scopesmith.png",
    detailImage: "images/traits/trait_scopesmith_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 2,
    stats: {},
    description: "스코프가 달린 무기로 사격한 뒤에도 스코프 시야를 유지한다.",
    variants: [],
  },
  {
    id: "trait_steady_aim",
    category: "trait",
    name: "Steady Aim",
    image: "images/traits/trait_steady_aim.png",
    detailImage: "images/traits/trait_steady_aim_detail.png",
    traitClass: "attack",
    traitTags: [],
    price: 2,
    stats: {},
    description: "스코프나 애퍼처 조준기로 조준 중일 때 무기 흔들림이 점차 줄어든다.",
    variants: [],
  },

  // -- 방어(Defensive) ----------------------------------------------------
  {
    id: "trait_adrenaline",
    category: "trait",
    name: "Adrenaline",
    image: "images/traits/trait_adrenaline.png",
    detailImage: "images/traits/trait_adrenaline_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 1,
    stats: {},
    description: "위급 체력 상태에 진입하면 소량의 기력을 즉시 회복한다.",
    variants: [],
  },
  {
    id: "trait_bloodless",
    category: "trait",
    name: "Bloodless",
    image: "images/traits/trait_bloodless.png",
    detailImage: "images/traits/trait_bloodless_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 3,
    stats: {},
    description: "출혈이 경미한 단계에서 중간이나 심각한 단계로 악화되지 않는다.",
    variants: [],
  },
  {
    id: "trait_bulwark",
    category: "trait",
    name: "Bulwark",
    image: "images/traits/trait_bulwark.png",
    detailImage: "images/traits/trait_bulwark_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 2,
    stats: {},
    description: "폭발 피해를 50% 감소시킨다. 플래시 밤(Flash Bomb)에 의해 완전히 실명하는 지속시간도 크게 줄여준다.",
    variants: [],
  },
  {
    id: "trait_dauntless",
    category: "trait",
    name: "Dauntless",
    image: "images/traits/trait_dauntless.png",
    detailImage: "images/traits/trait_dauntless_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 1,
    stats: {},
    description: "투척된 폭발물과 상호작용하여 뇌관을 해제할 수 있다.",
    variants: [],
  },
  {
    id: "trait_doctor",
    category: "trait",
    name: "Doctor",
    image: "images/traits/trait_doctor.png",
    detailImage: "images/traits/trait_doctor_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 9,
    stats: {},
    description: "구급상자(First Aid Kit)로 회복하는 체력량을 두 배로 늘린다.",
    variants: [],
  },
  {
    id: "trait_hornskin",
    category: "trait",
    name: "Hornskin",
    image: "images/traits/trait_hornskin.png",
    detailImage: "images/traits/trait_hornskin_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 3,
    stats: {},
    description: "둔기(타격) 피해를 25% 감소시킨다.",
    variants: [],
  },
  {
    id: "trait_mithridatist",
    category: "trait",
    name: "Mithridatist",
    image: "images/traits/trait_mithridatist.png",
    detailImage: "images/traits/trait_mithridatist_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 3,
    stats: {},
    description: "중독 상태에서 회복하는 데 걸리는 시간을 대폭 줄인다.",
    variants: [],
  },
  {
    id: "trait_physician",
    category: "trait",
    name: "Physician",
    image: "images/traits/trait_physician.png",
    detailImage: "images/traits/trait_physician_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 5,
    stats: {},
    description: "붕대를 감는 데 걸리는 시간을 줄인다.",
    variants: [],
  },
  {
    id: "trait_salveskin",
    category: "trait",
    name: "Salveskin",
    image: "images/traits/trait_salveskin.png",
    detailImage: "images/traits/trait_salveskin_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 2,
    stats: {},
    description: "생존해 있는 동안 화염 피해를 줄이고, 화상 진행 속도와 화상 단계 악화를 멈춘다.",
    variants: [],
  },
  {
    id: "trait_vigor",
    category: "trait",
    name: "Vigor",
    image: "images/traits/trait_vigor.png",
    detailImage: "images/traits/trait_vigor_detail.png",
    traitClass: "defense",
    traitTags: [],
    price: 3,
    stats: {},
    description: "다크사이트 사용 중 체력과 기력 회복 속도를 두 배로 늘린다.",
    variants: [],
  },

  // -- 이동(Movement) ------------------------------------------------------
  {
    id: "trait_gator_legs",
    category: "trait",
    name: "Gator Legs",
    image: "images/traits/trait_gator_legs.png",
    detailImage: "images/traits/trait_gator_legs_detail.png",
    traitClass: "movement",
    traitTags: [],
    price: 3,
    stats: {},
    description: "깊은 물 속에서 걷기·전력질주 속도가 빨라지고, 물속에서 웅크린 상태로 이동할 때 나는 소음도 줄어든다.",
    variants: [],
  },
  {
    id: "trait_greyhound",
    category: "trait",
    name: "Greyhound",
    image: "images/traits/trait_greyhound.png",
    detailImage: "images/traits/trait_greyhound_detail.png",
    traitClass: "movement",
    traitTags: [],
    price: 2,
    stats: {},
    description: "전력질주를 최고 속도로 더 오래 유지할 수 있다.",
    variants: [],
  },
  {
    id: "trait_kiteskin",
    category: "trait",
    name: "Kiteskin",
    image: "images/traits/trait_kiteskin.png",
    detailImage: "images/traits/trait_kiteskin_detail.png",
    traitClass: "movement",
    traitTags: ["catalyst"],
    price: 1,
    stats: {},
    description: "낙하 피해를 대폭 줄인다. (촉매제: Catalyst 특성을 함께 보유하면 낙하로는 사망하지 않는다.)",
    variants: [],
  },
  {
    id: "trait_lightfoot",
    category: "trait",
    name: "Lightfoot",
    image: "images/traits/trait_lightfoot.png",
    detailImage: "images/traits/trait_lightfoot_detail.png",
    traitClass: "movement",
    traitTags: [],
    price: 5,
    stats: {},
    description: "장애물을 넘거나 낙하하거나 사다리를 오를 때 소리가 나지 않는다. 소음 트랩을 지날 때 나는 발소리도 줄여준다.",
    variants: [],
  },
  {
    id: "trait_shadow_leap",
    category: "trait",
    name: "Shadow Leap",
    image: "images/traits/trait_shadow_leap.png",
    detailImage: "images/traits/trait_shadow_leap_detail.png",
    traitClass: "movement",
    traitTags: ["scarce"],
    price: null,
    stats: {},
    description: "다크사이트 사용 중 사거리(50m) 내의 몬스터를 지목해 그 위치로 순간 이동한 뒤 즉시 처치한다. 표적(Target)에는 사용할 수 없다.",
    variants: [],
  },
  {
    id: "trait_surefoot",
    category: "trait",
    name: "Surefoot",
    image: "images/traits/trait_surefoot.png",
    detailImage: "images/traits/trait_surefoot_detail.png",
    traitClass: "movement",
    traitTags: [],
    price: 6,
    stats: {},
    description: "기폭 준비된 투척물, 구급상자, 소모품 주사기류를 든 채로 전력질주할 수 있다.",
    variants: [],
  },

  // -- 보조(Supportive) -----------------------------------------------
  {
    id: "trait_ambidextrous",
    category: "trait",
    name: "Ambidextrous",
    image: "images/traits/trait_ambidextrous.png",
    detailImage: "images/traits/trait_ambidextrous_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 3,
    stats: {},
    description: "짝을 맞춘 무기(매칭 페어)의 재장전 속도를 높이고, 반자동 권총 세트에는 커스텀 클립 재장전을 가능하게 한다.",
    variants: [],
  },
  {
    id: "trait_beastface",
    category: "trait",
    name: "Beastface",
    image: "images/traits/trait_beastface.png",
    detailImage: "images/traits/trait_beastface_detail.png",
    traitClass: "support",
    traitTags: ["catalyst"],
    price: 4,
    stats: {},
    description: "야생 동물이 반응하는 거리를 줄인다(헬하운드 같은 몬스터에는 적용되지 않음). (촉매제: Catalyst 특성을 함께 보유하면 야생 동물에게 전혀 들키지 않고, 나뭇가지를 밟아도 소리가 나지 않는다.)",
    variants: [],
  },
  {
    id: "trait_blade_seer",
    category: "trait",
    name: "Blade Seer",
    image: "images/traits/trait_blade_seer.png",
    detailImage: "images/traits/trait_blade_seer_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 1,
    stats: {},
    description: "다크사이트 사용 중 볼트, 화살, 하푼, 투척 도끼, 투척 나이프가 강조되어 보이는 거리를 75m로 늘린다. 딱정벌레(Beetle) 시야에도 동일하게 적용된다.",
    variants: [],
  },
  {
    id: "trait_blast_sense",
    category: "trait",
    name: "Blast Sense",
    image: "images/traits/trait_blast_sense.png",
    detailImage: "images/traits/trait_blast_sense_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 2,
    stats: {},
    description: "다크사이트 사용 중 총성이나 폭발 같은 큰 소리가 강조되어 표시된다(200m). 소음기 장착 무기에 저속탄(Subsonic Ammo)을 사용하면 감지되지 않는다.",
    variants: [],
  },
  {
    id: "trait_bulletgrubber",
    category: "trait",
    name: "Bulletgrubber",
    image: "images/traits/trait_bulletgrubber.png",
    detailImage: "images/traits/trait_bulletgrubber_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 4,
    stats: {},
    description: "부분 재장전 시 발사하지 않은 탄환을 회수한다.",
    variants: [],
  },
  {
    id: "trait_catalyst",
    category: "trait",
    name: "Catalyst",
    image: "images/traits/trait_catalyst.png",
    detailImage: "images/traits/trait_catalyst_detail.png",
    traitClass: "support",
    traitTags: ["scarce"],
    price: null,
    stats: {},
    description: "Beastface, Kiteskin, Vigilant, Pain Sense, Frontiersman 특성의 촉매제(조건부) 효과를 활성화한다. 각 특성을 함께 장착하면: Beastface(야생동물에게 전혀 들키지 않고 나뭇가지 소리도 나지 않음) / Kiteskin(낙하로는 사망하지 않음) / Vigilant(다크사이트 강조 범위 2배) / Pain Sense(기력이 없는 헌터도 표시) / Frontiersman(솔로 플레이 시 도구를 2회 더 사용 가능) 효과가 각각 추가로 발동한다.",
    variants: [],
  },
  {
    id: "trait_conduit",
    category: "trait",
    name: "Conduit",
    image: "images/traits/trait_conduit.png",
    detailImage: "images/traits/trait_conduit_detail.png",
    traitClass: "support",
    traitTags: ["solo"],
    price: 5,
    stats: {},
    description: "같은 팀원이 단서를 줍거나 균열(Rift)을 닫으면 체력과 기력을 회복한다. (1인: 솔로 플레이 시 단서 조사 효과가 두 배가 된다.)",
    variants: [],
  },
  {
    // ⚠ Burn+Scarce 특성. 위키에 "Stack Limit 1"(중첩 최대 1개) 표기가 있으나 스키마에
    // 해당 필드가 없어 설명 문단에 문구로만 반영함 — 추후 stackLimit 필드가 필요해지면 추가할 것.
    id: "trait_death_cheat",
    category: "trait",
    name: "Death Cheat",
    image: "images/traits/trait_death_cheat.png",
    detailImage: "images/traits/trait_death_cheat_detail.png",
    traitClass: "support",
    traitTags: ["burn", "scarce"],
    price: null,
    stats: {},
    description: "탈출에 실패해도 헌터를 잃지 않는다. 다만 장비와 잃어버린 체력 조각(Health Chunks)은 그대로 사라진다. (중첩 불가, 최대 1개만 보유 가능)",
    variants: [],
  },
  {
    id: "trait_decoy_supply",
    category: "trait",
    name: "Decoy Supply",
    image: "images/traits/trait_decoy_supply.png",
    detailImage: "images/traits/trait_decoy_supply_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 1,
    stats: {},
    description: "탄약 상자(Ammo Crate)에서 모든 종류의 디코이류 도구를 보충받을 수 있다.",
    variants: [],
  },
  {
    id: "trait_determination",
    category: "trait",
    name: "Determination",
    image: "images/traits/trait_determination.png",
    detailImage: "images/traits/trait_determination_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 1,
    stats: {},
    description: "기력 회복이 더 빨리 시작된다.",
    variants: [],
  },
  {
    id: "trait_frontiersman",
    category: "trait",
    name: "Frontiersman",
    image: "images/traits/trait_frontiersman.png",
    detailImage: "images/traits/trait_frontiersman_detail.png",
    traitClass: "support",
    traitTags: ["solo", "catalyst"],
    price: 6,
    stats: {},
    description: "도구를 1회 더 사용할 수 있게 한다. (1인+촉매제: 솔로 플레이 중 Catalyst 특성을 함께 보유하면 도구를 2회 더 사용할 수 있다.)",
    variants: [],
  },
  {
    id: "trait_ghoul",
    category: "trait",
    name: "Ghoul",
    image: "images/traits/trait_ghoul.png",
    detailImage: "images/traits/trait_ghoul_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 3,
    stats: {},
    description: "몬스터를 처치하면 소량의 체력을 회복한다.",
    variants: [],
  },
  {
    id: "trait_magpie",
    category: "trait",
    name: "Magpie",
    image: "images/traits/trait_magpie.png",
    detailImage: "images/traits/trait_magpie_detail.png",
    traitClass: "support",
    traitTags: ["solo"],
    price: 1,
    stats: {},
    description: "바운티 토큰을 주우면 해독, 기력 회복, 재생 효과를 짧게 각각 부여받는다. (1인: 솔로 플레이 시 다크사이트 부스트 용량과 모든 부스트 획득량이 두 배가 된다.)",
    variants: [],
  },
  {
    // ⚠ Burn 특성. 위키에 "Stack Limit 1"(중첩 최대 1개) 표기가 있으나 스키마에 해당
    // 필드가 없어 설명 문단에 문구로만 반영함(Death Cheat와 동일한 처리).
    id: "trait_necromancer",
    category: "trait",
    name: "Necromancer",
    image: "images/traits/trait_necromancer.png",
    detailImage: "images/traits/trait_necromancer_detail.png",
    traitClass: "support",
    traitTags: ["burn", "solo"],
    price: 4,
    stats: {},
    description: "다크사이트 사용 중 멀리 쓰러진 팀원을 부활시킬 수 있다(25m). (1인: 솔로 플레이 시 자신의 쓰러진 헌터를 직접 부활시킬 수 있으며, 부활하면 체력이 완전히 회복된다.) (중첩 불가, 최대 1개만 보유 가능)",
    variants: [],
  },
  {
    id: "trait_packmule",
    category: "trait",
    name: "Packmule",
    image: "images/traits/trait_packmule.png",
    detailImage: "images/traits/trait_packmule_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 4,
    stats: {},
    description: "헌터를 루팅하거나 도구 상자(Tool Box)를 열 때 아이템을 하나 더 받는다.",
    variants: [],
  },
  {
    id: "trait_pain_sense",
    category: "trait",
    name: "Pain Sense",
    image: "images/traits/trait_pain_sense.png",
    detailImage: "images/traits/trait_pain_sense_detail.png",
    traitClass: "support",
    traitTags: ["catalyst"],
    price: 3,
    stats: {},
    description: "다크사이트 사용 중 근처의 출혈·중독·화상 상태인 헌터를 볼 수 있다(150m). 딱정벌레(Beetle) 시야에도 적용된다. (촉매제: Catalyst 특성을 함께 보유하면 기력이 없는 헌터도 포함해서 표시한다.)",
    variants: [],
  },
  {
    id: "trait_poacher",
    category: "trait",
    name: "Poacher",
    image: "images/traits/trait_poacher.png",
    detailImage: "images/traits/trait_poacher_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 1,
    stats: {},
    description: "덫(Trap)류를 설치하거나 해제할 때 소리가 나지 않는다.",
    variants: [],
  },
  {
    id: "trait_poltergeist",
    category: "trait",
    name: "Poltergeist",
    image: "images/traits/trait_poltergeist.png",
    detailImage: "images/traits/trait_poltergeist_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 2,
    stats: {},
    description: "다크사이트 사용 중 월드 오브젝트와 동물을 원격으로 조작·상호작용·자극할 수 있다(50m). 딱정벌레 시야에도 동일하게 적용된다.",
    variants: [],
  },
  {
    id: "trait_quartermaster",
    category: "trait",
    name: "Quartermaster",
    image: "images/traits/trait_quartermaster.png",
    detailImage: "images/traits/trait_quartermaster_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 8,
    stats: {},
    description: "무기 용량(Weapon Capacity)이 1칸 늘어난다.",
    variants: [],
  },
  {
    id: "trait_rampage",
    category: "trait",
    name: "Rampage",
    image: "images/traits/trait_rampage.png",
    detailImage: "images/traits/trait_rampage_detail.png",
    traitClass: "support",
    traitTags: ["burn", "scarce"],
    price: null,
    stats: {},
    description: "체력 조각(Health Chunk)이 하나라도 비어있는 상태에서 적 헌터를 처치하면 체력이 회복된다.",
    variants: [],
  },
  {
    // Burn+Scarce 특성. Scarce는 상점 판매 없이 필드 드랍으로만 획득(사용자 확인 완료)하므로
    // Cost/Unlock Rank 없이 price:null 처리.
    id: "trait_relentless",
    category: "trait",
    name: "Relentless",
    image: "images/traits/trait_relentless.png",
    detailImage: "images/traits/trait_relentless_detail.png",
    traitClass: "support",
    traitTags: ["burn", "scarce"],
    price: null,
    stats: {},
    description: "다운(Downed)되어도 체력 조각(Health Chunk)을 잃지 않는다.",
    variants: [],
  },
  {
    // Burn+Scarce 특성. Scarce는 필드 드랍 전용이라 price:null 처리.
    id: "trait_remedy",
    category: "trait",
    name: "Remedy",
    image: "images/traits/trait_remedy.png",
    detailImage: "images/traits/trait_remedy_detail.png",
    traitClass: "support",
    traitTags: ["burn", "scarce"],
    price: null,
    stats: {},
    description: "다크사이트(Dark Sight) 사용 중 사거리 내(25m) 특성 지주(Trait Spur)와 상호작용하면 팀 전체에게 회복 효과가 발동된다. 딱정벌레(Beetle) 시야에도 동일하게 적용된다.",
    variants: [],
  },
  {
    id: "trait_resilience",
    category: "trait",
    name: "Resilience",
    image: "images/traits/trait_resilience.png",
    detailImage: "images/traits/trait_resilience_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 3,
    stats: {},
    description: "부활(Revive)할 때 체력이 최대치까지 회복된 상태로 부활한다.",
    variants: [],
  },
  {
    id: "trait_serpent",
    category: "trait",
    name: "Serpent",
    image: "images/traits/trait_serpent.png",
    detailImage: "images/traits/trait_serpent_detail.png",
    traitClass: "support",
    traitTags: ["solo"],
    price: 4,
    stats: {},
    description: "다크사이트 사용 중 사거리 내(25m)의 단서(Clue), 균열(Rift), 추방 가능한 타겟(Target), 버려진 바운티 토큰과 상호작용할 수 있다. 딱정벌레 시야에도 적용되나 바운티 토큰 상호작용은 예외. (1인: 솔로 플레이 시 상호작용 사거리가 50m로 늘어난다.)",
    variants: [],
  },
  {
    // Scarce 특성. 필드 드랍 전용이라 price:null 처리.
    id: "trait_shadow",
    category: "trait",
    name: "Shadow",
    image: "images/traits/trait_shadow.png",
    detailImage: "images/traits/trait_shadow_detail.png",
    traitClass: "support",
    traitTags: ["scarce"],
    price: null,
    stats: {},
    description: "몬스터(Monster)가 당신을 보지 못하고 공격하지 않는다. 다만 소리는 여전히 들을 수 있다.",
    variants: [],
  },
  {
    id: "trait_silent_killer",
    category: "trait",
    name: "Silent Killer",
    image: "images/traits/trait_silent_killer.png",
    detailImage: "images/traits/trait_silent_killer_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 3,
    stats: {},
    description: "근접 공격 시 발생하는 소음을 줄인다.",
    variants: [],
  },
  {
    id: "trait_vigilant",
    category: "trait",
    name: "Vigilant",
    image: "images/traits/trait_vigilant.png",
    detailImage: "images/traits/trait_vigilant_detail.png",
    traitClass: "support",
    traitTags: ["catalyst"],
    price: 1,
    stats: {},
    description: "다크사이트 사용 중 사거리 내(25m)의 덫(Trap)과 활성화된 딱정벌레가 강조 표시된다. 딱정벌레 시야에도 적용된다. (촉매제: Catalyst 특성을 함께 보유하면 다크사이트에서 강조 표시 사거리가 두 배가 된다.)",
    variants: [],
  },
  {
    id: "trait_vulture",
    category: "trait",
    name: "Vulture",
    image: "images/traits/trait_vulture.png",
    detailImage: "images/traits/trait_vulture_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 2,
    stats: {},
    description: "헌터를 루팅(Looting)하면 항상 금전(헌트 달러) 보상을 받는다.",
    variants: [],
  },
  {
    id: "trait_whispersmith",
    category: "trait",
    name: "Whispersmith",
    image: "images/traits/trait_whispersmith.png",
    detailImage: "images/traits/trait_whispersmith_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 1,
    stats: {},
    description: "장비를 선택할 때 발생하는 소음을 줄인다.",
    variants: [],
  },
  {
    id: "trait_witness",
    category: "trait",
    name: "Witness",
    image: "images/traits/trait_witness.png",
    detailImage: "images/traits/trait_witness_detail.png",
    traitClass: "support",
    traitTags: [],
    price: 4,
    stats: {},
    description: "다크사이트 사용 중 죽은 헌터와 몬스터가 보인다. 딱정벌레 시야에도 동일하게 적용된다.",
    variants: [],
  },
];

/* =========================================================================
   ── 빠른 참조: 무기 객체 스키마 ──

   {
     id: "weapon_고유아이디",
     category: "weapon",
     name: "표시 이름",
     image: "images/weapons/파일명.png" (없으면 "")

     // 필터용
     slotSize: 1~5,
     ammoCategory: "compact" | "medium" | "long" | "shotgun" | "special",
     ammoEffects: ["full_metal", "high_velocity", ...],

     // 사용 가능한 탄약 (AMMO_TYPES의 id 배열)
     ammoTypes: ["compact", "compact_fmj", ...],
     defaultAmmo: "compact",

     // 무기 상점 정보
     price: 41,
     updateAdded: "Update Early Access 0.1",

     // 탄창
     chamber: { loaded: "7+1", extra: 21 },

     // 14개 스탯 (이미지 표기 기준)
     stats: {
       damage:             // Damage
       dropRange:          // Drop Range
       rateOfFire:         // Rate of Fire
       cycleTime:          // Cycle Time
       spread:             // Spread
       sway:               // Sway
       verticalRecoil:     // Vertical Recoil
       reloadSpeed:        // Reload Speed
       muzzleVelocity:     // Muzzle Velocity
       meleeLight:         // Melee Damage
       meleeHeavy:         // Heavy Melee Damage
       staminaConsumption: // Stamina Consumption
       // 필요하면 추가 필드도 자유롭게
     },

     // 파생형 (게임 내에서 같은 무기 계열의 변형들 — 단축형/소음기/조준경/장총신 등)
     // 각 파생형 객체는 모무기의 필드를 "덮어쓰기"하는 방식.
     // 명시하지 않은 필드는 모무기의 값을 그대로 따라갑니다.
     variants: [
       {
         id: "고유 id",
         name: "표시 이름",
         image: "이미지 경로 (없으면 \"\")",
         description: "이 파생형의 설명",

         // 아래는 "모무기와 다른 부분만" 적으면 됩니다.
         price: 56,                            // 다르면 적기, 같으면 생략
         slotSize: 2,                          // 다르면 적기
         chamber: { loaded: "7+1", extra: 18 }, // 다르면 적기
         ammoTypes: [...],                     // 다르면 적기 (예: 소음기 변형은 고속탄 빠짐)
         ammoEffects: [...],                   // 필터용, 다르면 적기

         // stats는 모무기 stats에 "덮어쓰기"로 합쳐집니다.
         // 같은 값은 적을 필요 없음. 다른 것만 적기.
         stats: {
           damage: 105,
           muzzleVelocity: 360,
           // ... 다른 부분만
         },
       },
       // ... 더 많은 파생형
     ],
   }
========================================================================= */

/* =========================================================================
   ── 빠른 참조: 도구(Tool) 객체 스키마 ──

   출처: huntshowdown.wiki.gg/wiki/Tools "Tool Statistics" 섹션 ✅ [확인됨]
   (스탯 종류는 무기와 달리 아이템마다 쓰는 스탯이 다름 — 해당 없는 스탯은 그냥 생략)

   {
     id: "tool_고유아이디",
     category: "tool",
     name: "표시 이름",
     image: "images/tools/파일명.png" (없으면 "")

     // 필터용
     toolClass: "distraction" | "healing" | "fire_light" | "melee"
              | "throwable_melee" | "pocket_pistol" | "trap" | "other",
     toolTags: ["throwable", "placeable", "rending", "healing", "noise",
                "explosive", "fire", "poison", "vision", "light", "melee"],
                // 해당하는 것만 배열로 (여러 개 가능, ammoEffects와 동일한 방식)

     // 기본 정보
     price: 0,
     updateAdded: "Update Early Access 0.1",
     unlockRank: 1,     // 위키의 "Unlock: Bloodline Rank N"
     uses: null,        // 소모/설치형만: 장착 시 휴대하는 개수(위키의 "Quantity"). 근접무기류는 생략.
     scarce: false,     // 희귀 아이템(상점 구매 불가) 여부 — 필요할 때만 추가

     // 도구 스탯 — 위키 "Tool Statistics" 정의 기준, 해당 아이템에 있는 필드만 채우기
     stats: {
       damage:                    // Damage — 전체 효과가 적중했을 때 데미지
       damagePerTick:             // Damage per Tick — 효과 지속 중 틱당 데미지
       dropRange:                 // Drop Range — 조준점 대비 머리 높이(20cm)만큼 떨어지는 거리(m)
       effectDuration:            // Effect Duration — 효과 지속 시간(초)
       effectRadius:              // Effect Radius — 효과 반경(m)
       fuseTimer:                 // Fuse Timer — 기폭까지 걸리는 시간(초)
       muzzleVelocity:            // Muzzle Velocity — 투사체 속도(m/s)
       spread:                    // Spread — 조준 상태 분산도
       throwRange:                // Throw Range — 던질 수 있는 최대 거리(m)
       meleeLight:                // Melee Damage(약공격)
       meleeHeavy:                // Heavy Melee Damage(강공격)
       staminaConsumption:        // Stamina Consumption — 약공격 소모 기력(100 기준)
       staminaConsumptionHeavy:   // Heavy Stamina Consumption — 강공격 소모 기력
       staminaConsumptionThrow:   // Throw Stamina Consumption — 투척 시 소모 기력(투척무기류만)
       // Flare Pistol/Derringer Pennyshot/Quad Derringer처럼 위키가 "무기 스탯 체계를
       // 쓴다"고 명시한 예외 항목은 대신 무기 stats 스키마(rateOfFire/cycleTime/sway/
       // verticalRecoil/reloadSpeed 등)를 그대로 사용하고, ammoTypes 대신 아래
       // chamber 필드로 장전/예비 수를 표기.
     },

     // Flare Pistol/Derringer Pennyshot/Quad Derringer 등 자체 탄약을 쓰는 도구만 사용
     chamber: { loaded: 1, extra: 1 },

     description: "",

     // 카드 클릭 시 뜨는 요약 패널(renderGenericDetailHTML)에 그대로 표시되는
     // key-value 목록. stats에 있는 값도 사람이 읽기 좋은 라벨로 다시 적어준다
     // (도구는 무기처럼 전용 렌더러가 없어서 이 meta가 사실상 유일한 스탯 표시 수단).

     // 파생형이 있는 도구는 무기와 동일한 variants 배열 방식 사용(현재 확인된 파생형 없음).
     variants: [],
   }
========================================================================= */

/* =========================================================================
   ── 빠른 참조: 소모품(Consumable) 객체 스키마 ──

   출처: huntshowdown.wiki.gg/wiki/Consumables "Consumable Statistics" 섹션 ✅ [확인됨]
   도구(Tool)와 거의 동일한 구조 — 다른 점만 아래에 적음.

   {
     id: "consumable_고유아이디",
     category: "consumable",
     name: "표시 이름",
     image: "images/consumables/파일명.png" (없으면 "")

     // 필터용
     consumableClass: "resupply" | "fire_light" | "explosive" | "poison" | "distraction"
                     | "over_time" | "healing" | "beetle" | "other",
     consumableTags: ["throwable", "placeable", "rending", "healing", "noise",
                      "explosive", "fire", "poison", "vision", "light"],
                      // "melee" 태그는 소모품에 없음(위키 확인)

     price: 0,
     updateAdded: "Update Early Access 0.1",
     unlockRank: 1,
     scarce: false,     // Tarot Card처럼 상점 구매 불가(월드/이벤트 획득 전용)면 true

     // ⚠ 소모품은 1회용이라 도구의 uses(수량)/chamber 개념이 보통 없음.
     // (한 슬롯에 여러 개를 따로 장착하는 것은 가능하지만, 아이템 자체는 항상 1회용)

     stats: {
       damage:                  // Damage
       damagePerTick:           // Damage per Tick
       effectDuration:          // Effect Duration
       effectRadius:            // Effect Radius
       fuseTimer:               // Fuse Timer
       throwRange:              // Throw Range
       controlRange:            // Control Range — Stalker Beetle류 조종 가능 거리(m)
       meleeLight:              // Melee Damage
       meleeHeavy:              // Heavy Melee Damage
       staminaConsumption:      // Stamina Consumption
       // dropRange/muzzleVelocity 등은 위키에 언급 없음 — 필요해지면 그때 추가.
     },

     description: "",

     // 카드 클릭 시 뜨는 요약 패널은 renderConsumableDetailHTML이 전담 —
     // 도구와 마찬가지로 "자세히 보기"(마네킹/그래프) 전용 화면은 없음.
     variants: [],
   }
========================================================================= */

/* =========================================================================
   ── 빠른 참조: 특성(Trait) 객체 스키마 ──

   출처: huntshowdown.wiki.gg/wiki/Traits ✅ [확인됨]
   무기/도구/소모품과 달리 특성은 "탄약"이나 "던지기/설치" 같은 물리적 스탯이 없고,
   대부분 텍스트로 된 패시브 효과라서 stats 객체 구조가 다름(숫자가 있는 경우만 채움).

   {
     id: "trait_고유아이디",
     category: "trait",
     name: "표시 이름",
     image: "images/traits/파일명.png" (없으면 ""),        // 작은 아이콘 — 그리드 카드/피커 리스트/로드아웃 칸에 사용
     detailImage: "images/traits/파일명_detail.png" (없으면 생략), // 큰 삽화 — 카드 클릭 시 상세 패널에서만 사용

     // 필터용
     traitClass: "attack" | "defense" | "movement" | "support",   // 위키 Category, 1개만
     traitTags: ["burn", "scarce", "solo", "catalyst"],           // 위키 Type, 0개 이상 중복 가능

     price: 0,          // Upgrade Point 비용(Hunt Dollars 아님) — 없으면 null
     updateAdded: "Update Early Access 0.1",

     stats: {},         // 특성 대부분은 숫자 스탯이 없음 — 있는 경우만 개별적으로 채움
                          // (예: 지속시간·범위·수치가 명시된 특성 한정. 도구/소모품처럼
                          //  범용 TOOL_STAT_DEFS를 그대로 재사용해도 무방함)

     description: "",   // 효과 설명(위키 원문 그대로 옮기지 말고 풀어서 재작성)

     variants: [],       // 파생형 없음 — 항상 빈 배열
   }
========================================================================= */
