/* =========================================================================
   data.js
   -------------------------------------------------------------------------
   ▣ 손대야 할 곳은 이 파일뿐입니다.

   ▣ 구조
     1) CATEGORIES        : 카테고리(무기/도구/소모품/특성)와 로드아웃 슬롯 정의
     2) WEAPON_FILTERS    : 무기 필터(칸수/탄종/탄약효과) 옵션
     3) AMMO_TYPES        : 탄약 객체 — 거리 곡선과 무기 스탯 보정값을 보관
     4) ITEMS             : 실제 아이템(무기/도구/소모품/특성) 데이터

   ▣ 그래프 계산 방식
     - 무기 객체에는 "기본 데미지(damage)" 와 "사용 가능한 탄약 id 목록(ammoTypes)" 만 적습니다.
     - 거리별 그래프는 탄약 객체의 falloff([거리, 배율]) 키포인트를 직선으로 이어 그립니다.
     - 탄약마다 무기 스탯을 덮어쓰는 statOverrides 를 적을 수 있어서, 탄약을 바꾸면
       데미지/탄속/반동/사거리/탄창 같은 값이 자동으로 갱신됩니다.
   ========================================================================= */

// -------------------------------------------------------------------------
// 1. CATEGORIES
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
    loadoutSlots: [{ slotKey: "tool", label: "도구", max: 2 }],
  },
  consumable: {
    label: "소모품",
    icon: "🧪",
    loadoutSlots: [{ slotKey: "consumable", label: "소모품", max: 4 }],
  },
  trait: {
    label: "특성",
    icon: "⭐",
    loadoutSlots: [{ slotKey: "trait", label: "특성", max: null }],
  },
};

// -------------------------------------------------------------------------
// 2. WEAPON_FILTERS
// -------------------------------------------------------------------------
const WEAPON_FILTERS = {
  slotSize: {
    label: "무기 칸수",
    options: [
      { value: 1, label: "1칸" },
      { value: 2, label: "2칸" },
      { value: 3, label: "3칸" },
      { value: 4, label: "4칸" },
      { value: 5, label: "5칸" },
    ],
  },
  ammoCategory: {
    label: "탄종",
    options: [
      { value: "compact", label: "소형탄" },
      { value: "medium",  label: "중형탄" },
      { value: "long",    label: "롱탄" },
      { value: "shotgun", label: "샷건탄" },
      { value: "special", label: "특수탄" },
    ],
  },
  ammoEffect: {
    label: "탄약 효과",
    options: [
      { value: "explosive",     label: "폭발탄" },
      { value: "bleed",         label: "출혈탄" },
      { value: "incendiary",    label: "소이탄" },
      { value: "poison",        label: "중독탄" },
      { value: "full_metal",    label: "전피갑탄(FMJ)" },
      { value: "subsonic",      label: "아음속탄" },
      { value: "high_velocity", label: "고속탄" },
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
//     specialEffects: ["Ignites Hunters in one shot up to 20m", "Causes Medium Burning"]
//   }
// -------------------------------------------------------------------------
const AMMO_TYPES = {

  // ── Compact 탄종 ──────────────────────────────────────────────────────
  compact: {
    label: "Compact",
    category: "compact",
    icon: "🟫",
    description: "Compact - Damage dropoff starts at 20m. Low penetration damage.",
    cost: 0,
    // ⚠️ 추정 곡선 (공식 그래프 이미지 기반 근사값) — 정확한 값 받으면 교체 예정
    falloff: [
      [0,   1.00],
      [20,  1.00],
      [80,  0.65],
      [200, 0.40],
      [300, 0.25],
    ],
    statOverrides: {},
  },

  compact_fmj: {
    label: "FMJ Ammo",
    category: "compact",
    effect: "full_metal",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
    // FMJ는 falloff 시작점이 30m로 밀림 (이미지: "Damage dropoff begins at 30m")
    falloff: [
      [0,   1.00],
      [30,  1.00],
      [100, 0.65],
      [220, 0.40],
      [300, 0.25],
    ],
    statOverrides: {
      dropRange: 125,
      verticalRecoil: 8,
      muzzleVelocity: 330,
    },
    specialEffects: ["Damage dropoff begins at 30m"],
  },

  compact_high_velocity: {
    label: "High Velocity Ammo",
    category: "compact",
    effect: "high_velocity",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
    cost: 60,
    // 데미지/사거리는 비슷, 탄속만 빨라짐 → falloff는 기본탄과 동일하게 유지
    falloff: [
      [0,   1.00],
      [20,  1.00],
      [80,  0.65],
      [200, 0.40],
      [300, 0.25],
    ],
    statOverrides: {
      damage: 104,            // 기본 110 → 104
      dropRange: 160,         // 기본 140 → 160
      verticalRecoil: 8,      // 기본 5 → 8
      muzzleVelocity: 500,    // 기본 400 → 500
      ammoExtra: 15,          // 예비탄 21 → 15
    },
  },

  compact_incendiary: {
    label: "Incendiary Ammo",
    category: "compact",
    effect: "incendiary",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    // 데미지 자체는 기본탄과 유사, 상태이상 효과가 핵심
    falloff: [
      [0,   1.00],
      [20,  1.00],
      [80,  0.65],
      [200, 0.40],
      [300, 0.25],
    ],
    statOverrides: {},
    specialEffects: ["Ignites Hunters in one shot up to 20m", "Causes Medium Burning"],
  },

  compact_poison: {
    label: "Poison Ammo",
    category: "compact",
    effect: "poison",
    icon: "🟢",
    description: "중독탄 - 명중 시 독 효과. 관통 불가.",
    cost: 50,
    falloff: [
      [0,   1.00],
      [20,  1.00],
      [80,  0.65],
      [200, 0.40],
      [300, 0.25],
    ],
    statOverrides: {},
    specialEffects: ["Causes Medium Poison"],
  },

  compact_subsonic: {
    label: "Subsonic Ammo",
    category: "compact",
    effect: "subsonic",
    icon: "🔇",
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 사거리/탄속 감소.",
    cost: 5,
    // 사거리 감소 → falloff 시작점이 더 빨라짐
    falloff: [
      [0,   1.00],
      [15,  1.00],
      [60,  0.60],
      [150, 0.35],
      [250, 0.20],
    ],
    statOverrides: {
      dropRange: 110,         // 기본 140 → 110
      muzzleVelocity: 263,    // 기본 400 → 263
      ammoExtra: 34,          // 예비탄 21 → 34
    },
    specialEffects: ["Reduced Sound"],
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
    image: "",   // 이미지 파일 올리면 "images/weapons/frontier_73c.png" 처럼 경로

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

    // 기본 스탯 (탄약이 바뀌면 statOverrides 로 일부가 덮어쓰여짐)
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
   }
========================================================================= */
