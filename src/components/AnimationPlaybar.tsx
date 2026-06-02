import { useEffect, useMemo, useState } from "react";
import type { AnimationController } from "../babylon/animationController";
import { PLAYER_CONTROLS_CONFIG } from "../config/playerControlsConfig";
import "./AnimationPlaybar.css";

type AnimationPlaybarProps = {
  controller: AnimationController | null;
  onBeforePlay?: () => void;
  onFocusHand?: (side: "left" | "right") => boolean;
  onResetFocus?: () => void;
};

type PlayerState = ReturnType<AnimationController["getState"]>;

function defaultState(): PlayerState {
  return {
    isPlaying: false,
    currentFrame: 0,
    from: 0,
    to: 0,
    speedRatio: PLAYER_CONTROLS_CONFIG.defaultSpeed,
    hasAnimation: false,
  };
}

export function AnimationPlaybar({ controller, onBeforePlay, onFocusHand, onResetFocus }: AnimationPlaybarProps) {
  const [state, setState] = useState<PlayerState>(defaultState);
  const [displayFrame, setDisplayFrame] = useState(0);
  const [trackedHand, setTrackedHand] = useState<"left" | "right" | null>(null);

  const speedLabel = useMemo(() => `${state.speedRatio}x`, [state.speedRatio]);
  const currentFrame = Math.round(displayFrame);
  const minFrame = Number.isFinite(state.from) ? state.from : 0;
  const maxFrame = Number.isFinite(state.to) && state.to > minFrame ? state.to : minFrame + 1;

  const refresh = () => {
    if (!controller) return;
    setState(controller.getState());
  };

  const togglePlayPause = () => {
    if (!controller || !state.hasAnimation) return;
    if (!state.isPlaying) onBeforePlay?.();
    controller.togglePlayPause();
    refresh();
  };

  const seek = (frame: number) => {
    if (!controller || !state.hasAnimation) return;
    controller.seekFrame(frame);
    setDisplayFrame(frame);
    refresh();
  };

  const cycleSpeed = (direction: 1 | -1) => {
    if (!controller) return;

    const speeds = PLAYER_CONTROLS_CONFIG.speedLevels;
    const currentIndex = speeds.findIndex(speed => speed === state.speedRatio);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + speeds.length) % speeds.length;

    controller.setSpeedRatio(speeds[nextIndex]);
    refresh();
  };

  const toggleHandFocus = (side: "left" | "right") => {
    if (trackedHand === side) {
      onResetFocus?.();
      setTrackedHand(null);
      return;
    }

    if (onFocusHand?.(side)) {
      setTrackedHand(side);
    }
  };

  useEffect(() => {
    refresh();
    if (!controller) return;

    const id = window.setInterval(refresh, PLAYER_CONTROLS_CONFIG.pollMs);
    return () => window.clearInterval(id);
  }, [controller]);

  useEffect(() => {
    if (!state.hasAnimation || !state.isPlaying) {
      setDisplayFrame(state.currentFrame);
      return;
    }

    let frameId = 0;
    const tick = () => {
      setDisplayFrame(current =>
        current + (state.currentFrame - current) * PLAYER_CONTROLS_CONFIG.frameLerp
      );
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [state.currentFrame, state.hasAnimation, state.isPlaying]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!PLAYER_CONTROLS_CONFIG.enabled) return;
      if (!controller) return;

      const tagName = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select") return;

      if (event.code === PLAYER_CONTROLS_CONFIG.shortcuts.playPause) {
        event.preventDefault();
        togglePlayPause();
      } else if (event.code === PLAYER_CONTROLS_CONFIG.shortcuts.speedNext) {
        event.preventDefault();
        cycleSpeed(1);
      } else if (event.code === PLAYER_CONTROLS_CONFIG.shortcuts.seekBack) {
        event.preventDefault();
        seek(state.currentFrame - PLAYER_CONTROLS_CONFIG.seekStepFrames);
      } else if (event.code === PLAYER_CONTROLS_CONFIG.shortcuts.seekForward) {
        event.preventDefault();
        seek(state.currentFrame + PLAYER_CONTROLS_CONFIG.seekStepFrames);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller, state]);

  if (!PLAYER_CONTROLS_CONFIG.enabled) return null;

  return (
    <div className="animation-playbar">
      <button
        type="button"
        className="animation-playbar-button"
        disabled={!state.hasAnimation}
        onClick={togglePlayPause}
      >
        {state.isPlaying ? "Pause" : "Play"}
      </button>
      <input
        className="animation-playbar-slider"
        type="range"
        min={minFrame}
        max={maxFrame}
        step={1}
        value={Math.max(minFrame, Math.min(maxFrame, displayFrame))}
        disabled={!state.hasAnimation}
        onChange={event => seek(Number(event.target.value))}
      />
      <div className="animation-playbar-frame">
        {state.hasAnimation ? `${currentFrame} / ${Math.round(maxFrame)}` : "No animation"}
      </div>
      <button
        type="button"
        className="animation-playbar-button"
        disabled={!state.hasAnimation}
        onClick={() => cycleSpeed(1)}
      >
        {speedLabel}
      </button>
      {PLAYER_CONTROLS_CONFIG.handTracking.enabled && (
        <div className="animation-playbar-hand-controls">
          <button
            type="button"
            className={`animation-playbar-icon-button ${trackedHand === "left" ? "active" : ""}`}
            onClick={() => toggleHandFocus("left")}
          >
            {PLAYER_CONTROLS_CONFIG.handTracking.labels.left}
          </button>
          <button
            type="button"
            className={`animation-playbar-icon-button ${trackedHand === "right" ? "active" : ""}`}
            onClick={() => toggleHandFocus("right")}
          >
            {PLAYER_CONTROLS_CONFIG.handTracking.labels.right}
          </button>
        </div>
      )}
    </div>
  );
}
