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
      { slotKey: "primary", label: "주무기", max: 1 },
      { slotKey: "secondary", label: "보조무기", max: 1 },
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
    label: "탄종",
    options: [
      { value: "compact", label: "소형탄", image: "images/ui/ammo_compact.webp" },
      { value: "medium",  label: "중형탄", image: "images/ui/ammo_medium.webp" },
      { value: "long",    label: "롱탄",   image: "images/ui/ammo_long.webp" },
      { value: "shotgun", label: "샷건탄", image: "images/ui/ammo_shotgun.webp" },
      { value: "special", label: "특수탄", image: "images/ui/ammo_special.webp" },
    ],
  },
  ammoEffect: {
    label: "탄약 효과",
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
      { value: "ball_shot",     label: "철환탄",       image: "images/ui/ammo_effect_icons/ball_shot.png" },
      { value: "chaos",         label: "혼돈탄",       image: "images/ui/ammo_effect_icons/chaos.png" },
      { value: "choke",         label: "질식탄",       image: "images/ui/ammo_effect_icons/choke.png" },
      // 철조망(Concertina Arrows)도 별도 항목 없음 — "Causes bleeding on Hunters"라 출혈탄과 동일 효과.
      // 해당 탄약을 쓰는 무기가 추가되면 ammoEffects에 "bleed"를 태그할 것.
      { value: "shot_bolt",     label: "샷볼트",       image: "images/ui/ammo_effect_icons/shot_bolt.png" },
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
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
      [0,  1.00],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6058],
      [100, 0.50],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
      [0,  1.00],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6058],
      [100, 0.50],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.50],
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
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0,  1.00],
      [20, 1.00],
      [50, 0.6195],
      [100, 0.5044],
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
      [0,  1.00],
      [30, 1.00],
      [60, 0.6195],
      [100, 0.5221],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6168],
      [100, 0.5047],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6195],
      [100, 0.5044],
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
      [0,  1.00],
      [20, 1.00],
      [50, 0.6195],
      [100, 0.5044],
    ],
    statOverrides: {},
    specialEffects: ["중급 중독 효과 발생"],
  },


  // ── Ranger 73 / Vandal 73C / Bornheim No.3 / Conversion / LeMat / Nagant M1895 / New Army / Officer 전용 탄약 ──
  ranger73_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6182],
      [100, 0.5000],
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
      [50, 0.6058],
      [100, 0.5000],
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
      [100, 0.5000],
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
      [100, 0.5000],
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
      [50, 0.6182],
      [100, 0.5000],
    ],
    statOverrides: { dropRange: 110, muzzleVelocity: 263, ammoExtra: 24 },
    specialEffects: ["발사음 감소"],
  },

  vandal73c_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.6168],
      [100, 0.5047],
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
      [60, 0.6168],
      [100, 0.5327],
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
      [60, 0.5842],
      [100, 0.4950],
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
      [50, 0.6168],
      [100, 0.5047],
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
      [50, 0.6168],
      [100, 0.5047],
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
      [50, 0.6168],
      [100, 0.5047],
    ],
    statOverrides: { dropRange: 95, muzzleVelocity: 252, ammoExtra: 34 },
    specialEffects: ["발사음 감소"],
  },  bornheim_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5405],
      [60, 0.4730],
      [100, 0.4730],
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
      [50, 0.5571],
      [60, 0.4714],
      [100, 0.4714],
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
      [50, 0.5405],
      [60, 0.4730],
      [100, 0.4730],
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
      [50, 0.5405],
      [60, 0.4730],
      [100, 0.4730],
    ],
    statOverrides: { dropRange: 60, muzzleVelocity: 256, ammoExtra: 18 },
    specialEffects: ["발사음 감소"],
  },

  conversion_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5481],
      [60, 0.4712],
      [100, 0.4712],
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
      [50, 0.5481],
      [60, 0.4712],
      [100, 0.4712],
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
      [60, 0.5481],
      [70, 0.5000],
      [100, 0.5000],
    ],
    statOverrides: { dropRange: 70, verticalRecoil: 6.5, muzzleVelocity: 270 },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  lemat_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5464],
      [60, 0.4742],
      [100, 0.4742],
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
      [60, 0.5464],
      [70, 0.4948],
      [100, 0.4948],
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
      [50, 0.5464],
      [60, 0.4742],
      [100, 0.4742],
    ],
    statOverrides: {  },
    specialEffects: ["20m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 20,
  },  nagant_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
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
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
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
      [50, 0.5517],
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
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
    ],
    statOverrides: { dropRange: 55, muzzleVelocity: 238, ammoExtra: 14 },
    specialEffects: ["발사음 감소"],
  },

  newarmy_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5464],
      [60, 0.4742],
      [100, 0.4742],
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
      [50, 0.5464],
      [60, 0.4742],
      [100, 0.4742],
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
      [60, 0.5464],
      [70, 0.4948],
      [100, 0.4948],
    ],
    statOverrides: { dropRange: 70, verticalRecoil: 7, muzzleVelocity: 200 },
    specialEffects: ["30m부터 데미지 감소 시작"],
  },

  officer_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소 시작. 관통력 낮음.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [20, 1.00],
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
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
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
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
      [50, 0.5517],
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
      [50, 0.5385],
      [60, 0.4615],
      [100, 0.4615],
    ],
    statOverrides: { dropRange: 55, muzzleVelocity: 238, ammoExtra: 16 },
    specialEffects: ["발사음 감소"],
  },


  // ── Centennial 전용 탄약 (Medium 탄종 첫 실사용 무기) ──
  centennial_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6423],
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
      [80, 0.6423],
      [100, 0.5772],
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
      [90, 0.6423],
      [100, 0.6098],
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
      [80, 0.6379],
      [100, 0.5776],
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
      [80, 0.6423],
      [100, 0.5772],
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
      [80, 0.6423],
      [100, 0.5772],
    ],
    statOverrides: { dropRange: 105, muzzleVelocity: 333, ammoExtra: 14 },
    specialEffects: ["발사음 감소"],
  },


  // ── Drilling / Maynard Sniper / Springfield 1866 / 1865 Carbine / Vetterli 71 / Pax / Scottfield 전용 탄약 ──
  drilling_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6333],
      [100, 0.5833],
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
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6333],
      [100, 0.5833],
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
      [90, 0.6333],
      [100, 0.6167],
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
      [80, 0.6316],
      [100, 0.5789],
    ],
    statOverrides: { damage: 114, dropRange: 165, verticalRecoil: 16, muzzleVelocity: 655, ammoExtra: 13 },
  },

  maynard_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6389],
      [100, 0.5833],
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
      [80, 0.6389],
      [100, 0.5833],
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
      [80, 0.6423],
      [100, 0.5839],
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
      [80, 0.6389],
      [100, 0.5833],
    ],
    statOverrides: { dropRange: 130, muzzleVelocity: 319, ammoExtra: 15 },
    specialEffects: ["발사음 감소"],
  },

  springfield1866_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6043],
      [100, 0.5612],
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
      [80, 0.6043],
      [100, 0.5612],
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
      [100, 0.4720],
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
      [80, 0.6061],
      [100, 0.5606],
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
      [80, 0.6043],
      [100, 0.5612],
    ],
    statOverrides: {  },
    specialEffects: ["중급 중독 효과 발생"],
  },

  carbine1865_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6345],
      [100, 0.5793],
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
      [90, 0.6414],
      [100, 0.6069],
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
      [80, 0.6345],
      [100, 0.5793],
    ],
    statOverrides: { dropRange: 95, muzzleVelocity: 242, ammoExtra: 25 },
    specialEffects: ["발사음 감소"],
  },  vetterli71_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [80, 0.6385],
      [100, 0.5769],
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
      [90, 0.6385],
      [100, 0.6077],
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
      [80, 0.6423],
      [100, 0.5772],
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
      [80, 0.6385],
      [100, 0.5769],
    ],
    statOverrides: { dropRange: 100, muzzleVelocity: 266, ammoExtra: 24 },
    specialEffects: ["발사음 감소"],
  },

  pax_medium: {
    label: "Medium",
    category: "medium",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5545],
      [80, 0.4727],
      [100, 0.4727],
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
      [60, 0.5545],
      [80, 0.4727],
      [100, 0.4727],
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
      [70, 0.5545],
      [80, 0.4909],
      [100, 0.4909],
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
      [60, 0.5481],
      [80, 0.4712],
      [100, 0.4712],
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
      [60, 0.5545],
      [80, 0.4727],
      [100, 0.4727],
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
    image: "images/ui/ammo_effects/ammo_medium_regular.png",
    icon: "🟫",
    description: "Medium - 30m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [30, 1.00],
      [60, 0.5514],
      [80, 0.4673],
      [100, 0.4673],
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
      [60, 0.5514],
      [80, 0.4673],
      [100, 0.4673],
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
      [70, 0.5514],
      [80, 0.4953],
      [100, 0.4953],
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
      [60, 0.5446],
      [80, 0.4752],
      [100, 0.4752],
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
      [60, 0.5514],
      [80, 0.4673],
      [100, 0.4673],
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
    image: "images/ui/ammo_effects/ammo_long_regular.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6172],
      [100, 0.6094],
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
      [70, 0.7480],
      [90, 0.5984],
      [100, 0.5827],
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
      [100, 0.6172],
    ],
    statOverrides: { dropRange: 95, verticalRecoil: 14, muzzleVelocity: 305 },
    specialEffects: ["50m부터 데미지 감소 시작"],
  },

  martinihenry_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6154],
      [100, 0.6084],
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
      [70, 0.7246],
      [90, 0.5797],
      [100, 0.5652],
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
      [100, 0.6154],
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
      [90, 0.6154],
      [100, 0.6084],
    ],
    statOverrides: {  },
    specialEffects: ["40m 이내 명중 시 즉시 발화", "중급 화상 효과 발생"],
    effectMaxRange: 40,
  },

  sparks_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [90, 0.6174],
      [100, 0.6107],
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
      [100, 0.6174],
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
      [90, 0.6174],
      [100, 0.6107],
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
  },  haymaker_long: {
    label: "Long",
    category: "long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_long_regular.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5902],
      [90, 0.4754],
      [100, 0.4754],
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
      [80, 0.5902],
      [90, 0.5000],
      [100, 0.5000],
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
    image: "images/ui/ammo_effects/ammo_long_regular.png",
    icon: "🟫",
    description: "Long - 40m부터 데미지 감소 시작.",
    cost: 0,
    falloff: [
      [0, 1.00],
      [40, 1.00],
      [70, 0.5714],
      [90, 0.4603],
      [100, 0.4603],
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
      [80, 0.5714],
      [90, 0.4841],
      [100, 0.4841],
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
  },  krag_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular.png",
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

  lebel1886_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular.png",
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
    image: "images/ui/ammo_effects/ammo_special_long_regular.png",
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

  berthier1892_special_long: {
    label: "Special Long",
    category: "special_long",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_special_long_regular.png",
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
    image: "images/ui/ammo_effects/ammo_special_long_regular.png",
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


  // ── Auto-5 / Homestead 78 / Rival 78 / Romero 77 / Slate / Specter 1882 / Terminus (샷건, 낙하곡선 없음) ──
  auto5_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 11, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  auto5_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 179, spread: 95, ammoExtra: 5 },
  },

  homestead78_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells.png",
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
    image: "images/ui/ammo_effect_icons/dragonbreath_shell.png",
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
    image: "images/ui/ammo_effect_icons/flechette.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 195, spread: 70, ammoExtra: 8 },
  },  rival78_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 10, unstableEnd: 12, noneFrom: 13 },
    statOverrides: {  },
  },

  rival78_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell.png",
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
    image: "images/ui/ammo_effect_icons/flechette.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 165, spread: 95, ammoExtra: 8 },
  },

  romero77_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 12, unstableEnd: 13, noneFrom: 14 },
    statOverrides: {  },
  },

  romero77_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
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
    image: "images/ui/ammo_effect_icons/flare.png",
    icon: "🌟",
    description: "신호탄 - 조명탄 발사, 명중한 대상에 강한 화상 효과.",
    cost: 5,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 3, spread: 50, verticalRecoil: 3, muzzleVelocity: 75, ammoExtra: 4 },
    specialEffects: ["강한(intense) 화상 효과 발생"],
  },  slate_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 165, spread: 80, ammoExtra: 8 },
  },

  specter1882_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells.png",
    icon: "🔫",
    description: "Shells - 기본 샷건탄(벅샷).",
    cost: 0,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    // 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    ohkRange: { guaranteed: 12, unstableEnd: 13, noneFrom: 14 },
    statOverrides: {  },
  },

  specter1882_dragonbreath: {
    label: "드래곤브레스",
    category: "shotgun",
    effect: "dragonbreath",
    image: "images/ui/ammo_effect_icons/dragonbreath_shell.png",
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
    image: "images/ui/ammo_effect_icons/flechette.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 179, spread: 75, ammoExtra: 8 },
  },

  terminus_shells: {
    label: "Shells",
    category: "shotgun",
    image: "images/ui/ammo_effects/ammo_shotgun_shells.png",
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
    image: "images/ui/ammo_effect_icons/dragonbreath_shell.png",
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
    image: "images/ui/ammo_effect_icons/flechette.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
    icon: "●",
    description: "슬러그 - 단일 탄자. 사거리·관통력 증가, 예비탄 감소.",
    cost: 130,
    // 샷건은 펠릿 분산 방식이라 거리별 감쇠 곡선(falloff) 데이터가 없음 — 그래프 미표시
    statOverrides: { damage: 165, spread: 75, ammoExtra: 8 },
  },



  // ── Drilling / LeMat / Haymaker 하부 총열 샷건 특수탄 (위키 오버라이드 값 기준) ──
  drilling_flechette: {
    label: "플리셰트",
    category: "shotgun",
    effect: "flechette",
    image: "images/ui/ammo_effect_icons/flechette.png",
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
    image: "images/ui/ammo_effect_icons/pennyshot.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
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
    image: "images/ui/ammo_effect_icons/dragonbreath_shell.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
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
    image: "images/ui/ammo_effect_icons/flare.png",
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
    image: "images/ui/ammo_effect_icons/dragonbreath_shell.png",
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
    image: "images/ui/ammo_effect_icons/slug.png",
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
    image: "images/ui/ammo_effect_icons/flare.png",
    icon: "🌟",
    description: "신호탄 - 조명탄 발사, 명중한 대상에 강한 화상 효과.",
    cost: 5,
    // 샷건류(하부 총열) 특수탄 — 위키에 명시된 오버라이드 값 기준, 기본 벅샷 자체 데미지는 추정치라 falloff 없음
    statOverrides: { damage: 3, spread: 50, verticalRecoil: 5, muzzleVelocity: 75 },
    specialEffects: ["강한(intense) 화상 효과 발생"],
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
      [50, 0.5481],
      [60, 0.4712],
      [100, 0.4712],
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
      [60, 0.5481],
      [70, 0.5],
      [100, 0.5],
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
      [50, 0.4808],
      [60, 0.4327],
      [100, 0.4327],
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
      [80, 0.6345],
      [100, 0.5793],
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
      [100, 0.48],
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
      [90, 0.6423],
      [100, 0.6098],
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
      [60, 0.4959],
      [80, 0.4309],
      [100, 0.4309],
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
      [60, 0.5545],
      [80, 0.4727],
      [100, 0.4727],
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
      [70, 0.5545],
      [80, 0.4909],
      [100, 0.4909],
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
      [90, 0.6172],
      [100, 0.6094],
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
      [90, 0.5984],
      [100, 0.5827],
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
      [100, 0.6172],
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
      [80, 0.4744],
      [90, 0.3974],
      [100, 0.3974],
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
      [70, 0.4962],
      [90, 0.4361],
      [100, 0.4361],
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

    // 파생형 (variants) — 같은 무기 계열의 변형들 (단축형/소음기/조준경/장총신 등)
    // 각 파생형은 모무기의 필드를 일부 덮어쓰는 형식입니다.
    // 입력하지 않은 필드는 모무기의 값을 그대로 따라갑니다.
    // 작성 방법은 파일 맨 아래 "빠른 참조" 섹션의 예시를 참고하세요.
    variants: [],
  },

  {
    id: "weapon_infantry_73l",
    category: "weapon",
    name: "Infantry 73L",
    image: "images/weapons/infantry_73l.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_marathon",
    category: "weapon",
    name: "Marathon",
    image: "images/weapons/marathon.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_ranger_73",
    category: "weapon",
    name: "Ranger 73",
    image: "images/weapons/ranger_73.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_vandal_73c",
    category: "weapon",
    name: "Vandal 73C",
    image: "images/weapons/vandal_73c.png",

    // 검색 필터용
    slotSize: 2,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_bornheim_no3",
    category: "weapon",
    name: "Bornheim No. 3",
    image: "images/weapons/bornheim_no3.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_conversion",
    category: "weapon",
    name: "Conversion",
    image: "images/weapons/conversion.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_lemat",
    category: "weapon",
    name: "LeMat",
    image: "images/weapons/lemat.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
    secondaryAmmoCategories: ["shotgun"], // 하부 총열 샷건 보유 (르맷)
    // 하부 총열 샷건의 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    shotgunOhkRange: { guaranteed: 9, unstableEnd: 11, noneFrom: 12 },
    ammoEffects: ["full_metal", "incendiary", "slug", "flare", "dragonbreath"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "lemat_compact",
      "lemat_fmj",
      "lemat_incendiary",
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

    variants: [],
  },

  {
    id: "weapon_nagant_m1895",
    category: "weapon",
    name: "Nagant M1895",
    image: "images/weapons/nagant_m1895.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_new_army",
    category: "weapon",
    name: "New Army",
    image: "images/weapons/new_army.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_officer",
    category: "weapon",
    name: "Officer",
    image: "images/weapons/officer.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "compact",
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

    variants: [],
  },

  {
    id: "weapon_centennial",
    category: "weapon",
    name: "Centennial",
    image: "images/weapons/centennial.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
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
    secondaryAmmoCategories: ["shotgun"], // 하부 총열 샷건(플리셰트/페니샷/슬러그) 보유
    ammoEffects: ["bleed", "full_metal", "high_velocity", "slug", "pennyshot", "flechette"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "drilling_medium",
      "drilling_dumdum",
      "drilling_fmj",
      "drilling_high_velocity",
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

    variants: [],
  },

  {
    id: "weapon_maynard_sniper",
    category: "weapon",
    name: "Maynard Sniper",
    image: "images/weapons/maynard_sniper.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
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

    variants: [],
  },

  {
    id: "weapon_springfield_1866",
    category: "weapon",
    name: "Springfield 1866",
    image: "images/weapons/springfield_1866.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "medium",
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

    variants: [],
  },

  {
    id: "weapon_1865_carbine",
    category: "weapon",
    name: "1865 Carbine",
    image: "images/weapons/carbine_1865.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "medium",
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

    variants: [],
  },

  {
    id: "weapon_vetterli_71",
    category: "weapon",
    name: "Vetterli 71",
    image: "images/weapons/vetterli_71.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "medium",
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

    variants: [],
  },

  {
    id: "weapon_pax",
    category: "weapon",
    name: "Pax",
    image: "images/weapons/pax.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "medium",
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

    variants: [],
  },

  {
    id: "weapon_scottfield",
    category: "weapon",
    name: "Scottfield",
    image: "images/weapons/scottfield.png",

    // 검색 필터용
    slotSize: 1,
    ammoCategory: "medium",
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

    variants: [],
  },

  {
    id: "weapon_mako_1895",
    category: "weapon",
    name: "Mako 1895",
    image: "images/weapons/mako_1895.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "long",
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

    variants: [],
  },

  {
    id: "weapon_martini_henry",
    category: "weapon",
    name: "Martini-Henry",
    image: "images/weapons/martini_henry.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "long",
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

    variants: [],
  },

  {
    id: "weapon_sparks",
    category: "weapon",
    name: "Sparks",
    image: "images/weapons/sparks.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "long",
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

    variants: [],
  },

  {
    id: "weapon_haymaker",
    category: "weapon",
    name: "Haymaker",
    image: "images/weapons/haymaker.png",

    // 검색 필터용
    slotSize: 2,
    ammoCategory: "long",
    secondaryAmmoCategories: ["shotgun"], // 하부 총열 샷건 보유 (헤이메이커)
    // 하부 총열 샷건의 가슴 정조준 기준 한방컷(OHK) 거리: 사용자 실측 데이터
    shotgunOhkRange: { guaranteed: 9, unstableEnd: 11, noneFrom: 12 },
    ammoEffects: ["full_metal", "poison", "slug", "flare", "dragonbreath"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "haymaker_long",
      "haymaker_fmj",
      "haymaker_poison",
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

    variants: [],
  },

  {
    id: "weapon_lebel_1886",
    category: "weapon",
    name: "Lebel 1886",
    image: "images/weapons/lebel_1886.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "special",
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
    stats: {
      damage: 132,
      dropRange: 120,
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

    variants: [],
  },

  {
    id: "weapon_mosin_nagant",
    category: "weapon",
    name: "Mosin-Nagant",
    image: "images/weapons/mosin_nagant.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "special",
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

    variants: [],
  },

  {
    id: "weapon_berthier_1892",
    category: "weapon",
    name: "Berthier 1892",
    image: "images/weapons/berthier_1892.png",

    // 검색 필터용
    slotSize: 3,
    ammoCategory: "special",
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

    variants: [],
  },

  {
    id: "weapon_mosin_obrez",
    category: "weapon",
    name: "Mosin Obrez",
    image: "images/weapons/mosin_obrez.png",

    // 검색 필터용
    slotSize: 2,
    ammoCategory: "special",
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

    variants: [],
  },

  {
    id: "weapon_auto5",
    category: "weapon",
    name: "Auto-5",
    image: "images/weapons/auto5.png",

    // 검색 필터용
    slotSize: 5,
    ammoCategory: "shotgun",
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

    variants: [],
  },

  {
    id: "weapon_homestead78",
    category: "weapon",
    name: "Homestead 78",
    image: "images/weapons/homestead78.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
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

    variants: [],
  },

  {
    id: "weapon_romero77",
    category: "weapon",
    name: "Romero 77",
    image: "images/weapons/romero77.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
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

    variants: [],
  },

  {
    id: "weapon_slate",
    category: "weapon",
    name: "Slate",
    image: "images/weapons/slate.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
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

    variants: [],
  },

  {
    id: "weapon_specter1882",
    category: "weapon",
    name: "Specter 1882",
    image: "images/weapons/specter1882.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
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

    variants: [],
  },

  {
    id: "weapon_terminus",
    category: "weapon",
    name: "Terminus",
    image: "images/weapons/terminus.png",

    // 검색 필터용
    slotSize: 4,
    ammoCategory: "shotgun",
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

    variants: [],
  },

  // ── 도구 / 소모품 / 특성은 차후 채울 예정 ─────────────────────────────
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
