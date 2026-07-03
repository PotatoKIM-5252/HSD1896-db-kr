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
      { value: "high_velocity", label: "고속탄",       image: "images/ui/ammo_effect_icons/high_velocity.png" },
      { value: "fragmentation", label: "세열탄",       image: "images/ui/ammo_effect_icons/fragmentation.png" },
      { value: "incendiary",    label: "소이탄",       image: "images/ui/ammo_effect_icons/incendiary.png" },
      { value: "spitzer",       label: "스피처",       image: "images/ui/ammo_effect_icons/spitzer.png" },
      { value: "slug",          label: "슬러그",       image: "images/ui/ammo_effect_icons/slug.png" },
      { value: "flare",         label: "신호탄",       image: "images/ui/ammo_effect_icons/flare.png" },
      { value: "subsonic",      label: "아음속탄",     image: "images/ui/ammo_effect_icons/subsonic.png" },
      { value: "full_metal",    label: "전피갑탄(FMJ)", image: "images/ui/ammo_effect_icons/full_metal.png" },
      { value: "poison",        label: "중독탄",       image: "images/ui/ammo_effect_icons/poison.png" },
      { value: "choke",         label: "질식탄",       image: "images/ui/ammo_effect_icons/choke.png" },
      { value: "wire",          label: "철조망",       image: "images/ui/ammo_effect_icons/wire.png" },
      { value: "ball_shot",     label: "철환탄",       image: "images/ui/ammo_effect_icons/ball_shot.png" },
      { value: "bleed",         label: "출혈탄",       image: "images/ui/ammo_effect_icons/bleed.png" },
      { value: "pennyshot",     label: "페니샷",       image: "images/ui/ammo_effect_icons/pennyshot.png" },
      { value: "explosive",     label: "폭발탄",       image: "images/ui/ammo_effect_icons/explosive.png" },
      { value: "flechette",     label: "플리셰트",     image: "images/ui/ammo_effect_icons/flechette.png" },
      { value: "chaos",         label: "혼돈탄",       image: "images/ui/ammo_effect_icons/chaos.png" },
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
//     specialEffects: ["Ignites Hunters in one shot up to 20m", "Causes Medium Burning"],
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
    description: "Compact - Damage dropoff starts at 20m. Low penetration damage.",
    cost: 0,
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
    image: "images/ui/ammo_effects/ammo_compact_full_metal.png",
    icon: "🟤",
    description: "Full Metal Jacket - 관통력 증가, 데미지 유지력 증가. 탄속 감소.",
    cost: 50,
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
    image: "images/ui/ammo_effects/ammo_compact_high_velocity.png",
    icon: "🟠",
    description: "고속탄 - 탄속 증가, 약간의 반동 증가. 장거리 교전에 유리.",
    cost: 60,
    falloff: [
      [0,   1.00],
      [20,  1.00],
      [80,  0.65],
      [200, 0.40],
      [300, 0.25],
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
    label: "Incendiary Ammo",
    category: "compact",
    effect: "incendiary",
    image: "images/ui/ammo_effects/ammo_compact_incendiary.png",
    icon: "🔥",
    description: "소이탄 - 명중 시 발화. 관통 불가, 흔적이 보임.",
    cost: 40,
    falloff: [
      [0,   1.00],
      [20,  1.00],
      [80,  0.65],
      [200, 0.40],
      [300, 0.25],
    ],
    statOverrides: {},
    specialEffects: ["Ignites Hunters in one shot up to 20m", "Causes Medium Burning"],
    effectMaxRange: 20,  // 20m 이내에서만 발화 효과 발동 (그 이상은 효과 미적용으로 가정)
  },

  compact_poison: {
    label: "Poison Ammo",
    category: "compact",
    effect: "poison",
    image: "images/ui/ammo_effects/ammo_compact_poison.png",
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
    image: "images/ui/ammo_effects/ammo_compact_subsonic.png",
    icon: "🔇",
    description: "아음속탄 - 음속보다 느리게 비행, 발사음 감소. 사거리/탄속 감소.",
    cost: 5,
    falloff: [
      [0,   1.00],
      [15,  1.00],
      [60,  0.60],
      [150, 0.35],
      [250, 0.20],
    ],
    statOverrides: {
      dropRange: 110,
      muzzleVelocity: 263,
      ammoExtra: 34,
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
