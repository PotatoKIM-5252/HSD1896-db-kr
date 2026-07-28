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
  { key: "boss", label: "사냥탑", color: "#c25b4d", defaultOn: false },
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
    layers: {
      spawn: [
        { x: 5.3, y: 13.2 }, { x: 17.3, y: 6.2 }, { x: 30.7, y: 1.1 }, { x: 42.9, y: 3.6 },
        { x: 50.1, y: 9.5 }, { x: 56.8, y: 2.3 }, { x: 74.1, y: 3.2 }, { x: 87.6, y: 6.2 },
        { x: 95.9, y: 6 }, { x: 95.6, y: 12.3 }, { x: 95.3, y: 26.7 }, { x: 96.5, y: 45.8 },
        { x: 94.5, y: 65.1 }, { x: 98.5, y: 81.2 }, { x: 3.6, y: 29.4 }, { x: 5.3, y: 41.8 },
        { x: 4.2, y: 55.1 }, { x: 4.3, y: 72.1 }, { x: 13, y: 95.9 }, { x: 24.2, y: 99.3 },
        { x: 44.2, y: 98.6 }, { x: 68.5, y: 98.8 }, { x: 84.9, y: 97.2 },
      ],
      extraction: [
        { x: 11.3, y: 6.5 }, { x: 27.2, y: 3.1 }, { x: 50.9, y: 2.6 }, { x: 71.1, y: 3.9 },
        { x: 96.6, y: 5.9 }, { x: 4.6, y: 33.5 }, { x: 96.9, y: 25.3 }, { x: 8.9, y: 49.2 },
        { x: 53.2, y: 58 }, { x: 93.1, y: 55.4 }, { x: 2.3, y: 71.6 }, { x: 11.9, y: 96.7 },
        { x: 81.2, y: 92.9 }, { x: 91.5, y: 79.8 }, { x: 45.8, y: 97.8 }, { x: 5.1, y: 85 },
      ],
      boss: [
        { x: 38, y: 2.4 }, { x: 74.4, y: 21.3 }, { x: 93.7, y: 23 }, { x: 70, y: 47.1 },
        { x: 79.5, y: 60.5 }, { x: 84, y: 68.4 }, { x: 70.9, y: 69.7 }, { x: 39, y: 65.6 },
        { x: 19.9, y: 67.8 }, { x: 8.6, y: 70 }, { x: 7.7, y: 88.7 }, { x: 42.6, y: 79.4 },
        { x: 74.2, y: 90.3 }, { x: 90.4, y: 86.1 },
      ],
      watchtower: [
        { x: 15.7, y: 61.2 }, { x: 34.2, y: 56.1 }, { x: 59, y: 57.3 },
      ],
      armory: [
        { x: 76.5, y: 53.8 },
      ],
    },
  },
];
