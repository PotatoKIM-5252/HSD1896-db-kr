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
        { x: 8.0, y: 15.7 }, { x: 18.5, y: 8.6 }, { x: 31.1, y: 4.2 }, { x: 42.1, y: 6.2 },
        { x: 48.8, y: 11.7 }, { x: 54.5, y: 4.8 }, { x: 70.2, y: 5.7 }, { x: 82.9, y: 6.9 },
        { x: 90.2, y: 9.1 }, { x: 89.9, y: 14.5 }, { x: 89.5, y: 27.4 }, { x: 90.7, y: 45.6 },
        { x: 89.0, y: 63.1 }, { x: 92.2, y: 77.9 }, { x: 6.3, y: 30.3 }, { x: 7.8, y: 41.7 },
        { x: 6.6, y: 53.9 }, { x: 6.6, y: 68.9 }, { x: 15.0, y: 90.9 }, { x: 24.4, y: 94.9 },
        { x: 43.4, y: 93.9 }, { x: 65.3, y: 93.7 }, { x: 80.4, y: 91.7 },
      ],
      extraction: [
        { x: 13.0, y: 7.3 }, { x: 27.7, y: 4.2 }, { x: 51.6, y: 5.4 }, { x: 69.9, y: 5.4 },
        { x: 94.1, y: 7.3 }, { x: 4.9, y: 33.7 }, { x: 94.6, y: 26.2 }, { x: 10.5, y: 49.2 },
        { x: 52.9, y: 58.3 }, { x: 90.9, y: 55.4 }, { x: 4.3, y: 70.8 }, { x: 7.4, y: 84.4 },
        { x: 45.9, y: 96.3 }, { x: 79.4, y: 78.8 },
      ],
      boss: [
        { x: 37.4, y: 4.1 }, { x: 72.0, y: 21.3 }, { x: 90.1, y: 24.3 }, { x: 67.4, y: 47.2 },
        { x: 76.7, y: 56.3 }, { x: 81.2, y: 67.0 }, { x: 70.6, y: 68.4 }, { x: 36.8, y: 64.1 },
        { x: 20.7, y: 66.8 }, { x: 8.7, y: 68.8 }, { x: 8.4, y: 85.9 }, { x: 38.3, y: 77.0 },
        { x: 72.6, y: 87.9 }, { x: 86.8, y: 84.5 },
      ],
      watchtower: [
        { x: 17.0, y: 60.8 }, { x: 35.6, y: 56.1 }, { x: 58.0, y: 55.4 },
      ],
      armory: [
        { x: 76.5, y: 50.2 },
      ],
    },
  },
];
