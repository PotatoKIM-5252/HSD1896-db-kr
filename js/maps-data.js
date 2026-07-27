// ===========================================================================
// 맵 정보 탭 데이터 — 인터랙티브 맵(베이스 지도 + 레이어 오버레이)
//
// MAP_LAYERS: 지도 위에 겹쳐 보여줄 오버레이 종류. defaultOn:true인 레이어만
//             탭을 처음 열었을 때 기본으로 켜져 있음(스폰/탈출구).
// MAPS: 지도별 데이터. 각 레이어 좌표는 지도 이미지 기준 0~100 사이의 %값
//       (x: 좌→우, y: 상→하). ⚠ 좌표 데이터는 아직 비어있음 — 정확한 위치는
//       사용자 확인 후 하나씩 채울 것.
// ===========================================================================

const MAP_LAYERS = [
  { key: "spawn", label: "스폰 포인트", color: "#7ba0c4", defaultOn: true },
  { key: "extraction", label: "탈출구", color: "#5c8a63", defaultOn: true },
  { key: "boss", label: "보스 위치", color: "#c25b4d", defaultOn: false },
  { key: "watchtower", label: "감시탑", color: "#d4c25e", defaultOn: false },
  { key: "armory", label: "무기고", color: "#b48ec4", defaultOn: false },
];

const MAPS = [
  {
    id: "desalle",
    name: "DeSalle",
    image: "images/maps/DeSalle_map.webp",
    layers: { spawn: [], extraction: [], boss: [], watchtower: [], armory: [] },
  },
  {
    id: "lawson_delta",
    name: "Lawson Delta",
    image: "images/maps/Lawson_Delta_map.webp",
    layers: { spawn: [], extraction: [], boss: [], watchtower: [], armory: [] },
  },
  {
    id: "mammon",
    name: "Mammon's Gulch",
    image: "images/maps/Mammon_map.webp",
    layers: { spawn: [], extraction: [], boss: [], watchtower: [], armory: [] },
  },
  {
    id: "bayou",
    name: "Stillwater Bayou",
    image: "images/maps/Bayou_map.webp",
    layers: { spawn: [], extraction: [], boss: [], watchtower: [], armory: [] },
  },
];
