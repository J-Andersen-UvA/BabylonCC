export const PLAYER_CONTROLS_CONFIG = {
  enabled: true,
  pollMs: 80,
  frameLerp: 0.28,
  speedLevels: [1, 0.1, 0.3, 0.5],
  defaultSpeed: 1,
  shortcuts: {
    playPause: "Space",
    speedNext: "KeyS",
    seekBack: "ArrowLeft",
    seekForward: "ArrowRight",
  },
  seekStepFrames: 5,
  handTracking: {
    enabled: true,
    leftBoneNames: ["hand_l"],
    rightBoneNames: ["hand_r"],
    focusRadius: 1.35,
    targetOffset: { x: 0, y: 0, z: 0 },
    labels: {
      left: "L",
      right: "R",
    },
  },
};
