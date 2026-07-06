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
      { value: "fragmentation", label: "세열탄",       image: "images/ui/ammo_effect_icons/fragmentation.png" },
      { value: "ball_shot",     label: "철환탄",       image: "images/ui/ammo_effect_icons/ball_shot.png" },
      { value: "chaos",         label: "혼돈탄",       image: "images/ui/ammo_effect_icons/chaos.png" },
      { value: "choke",         label: "질식탄",       image: "images/ui/ammo_effect_icons/choke.png" },
      { value: "wire",          label: "철조망",       image: "images/ui/ammo_effect_icons/wire.png" },
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
  },

  compact_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
  },

  infantry73l_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
  },

  marathon_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
  },

  ranger73_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
  },

  vandal73c_high_velocity: {
    label: "고속탄",
    category: "compact",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
  },

  lemat_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    specialEffects: ["30m부터 데미지 감소(감쇠) 시작"],
  },

  officer_compact: {
    label: "Compact",
    category: "compact",
    isBase: true,
    image: "images/ui/ammo_effects/ammo_compact_regular.png",
    icon: "🟫",
    description: "Compact - 20m부터 데미지 감소(감쇠) 시작. 관통력 낮음.",
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
    description: "덤덤탄 - 명중 시 중급 출혈 효과. 상점 구매 불가(월드 획득 전용, 희귀도가 더 높음).",
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
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    description: "Medium - 30m부터 데미지 감소(감쇠) 시작.",
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
    specialEffects: ["40m부터 데미지 감소(감쇠) 시작"],
  },

  centennial_high_velocity: {
    label: "고속탄",
    category: "medium",
    effect: "high_velocity",
    image: "images/ui/ammo_effects/ammo_medium_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
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
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 낙하거리·탄속 감소 (데미지 감쇠 시작 거리는 기본탄과 동일).",
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
    ammoEffects: ["full_metal", "incendiary"],

    // 이 무기가 쓸 수 있는 탄약 (AMMO_TYPES 의 id)
    ammoTypes: [
      "lemat_compact",
      "lemat_fmj",
      "lemat_incendiary",
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
