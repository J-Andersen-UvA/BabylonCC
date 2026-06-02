export const PLAYER_CONTROLS_CONFIG = {
  enabled: true,
  pollMs: 80,
  speedLevels: [1, 0.1, 0.3, 0.5],
  defaultSpeed: 1,
  shortcuts: {
    playPause: "Space",
    speedNext: "KeyS",
    seekBack: "ArrowLeft",
    seekForward: "ArrowRight",
  },
  seekStepFrames: 5,
};
