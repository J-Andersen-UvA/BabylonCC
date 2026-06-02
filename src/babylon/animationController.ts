import type * as BABYLON from "@babylonjs/core";
import type { AvatarOrientationPreset } from "../components/AnimationLoader";

interface AnimationControllerOptions {
  autoStart?: boolean;
  speedRatio?: number;
  jumpKey?: string;
}

interface SkeletalLoadOptions {
  scaleMultiplier?: number;
  orientationPreset?: AvatarOrientationPreset;
}

interface SkeletalLoadResult {
  durationSeconds?: number;
}

export interface BlendshapeLoadResult {
  matched?: number;
  unmatchedCount?: number;
  targetedAnimations?: number;
}

export interface AnimationController {
  loadSkeletal: (file: File, options?: SkeletalLoadOptions) => Promise<void>;
  loadBlendshape: (file: File) => Promise<BlendshapeLoadResult | undefined>;
  playAll: () => void;
  pauseAll: () => void;
  togglePlayPause: () => boolean;
  setSpeedRatio: (speedRatio: number) => void;
  seekFrame: (frame: number) => void;
  getState: () => {
    isPlaying: boolean;
    currentFrame: number;
    from: number;
    to: number;
    speedRatio: number;
    hasAnimation: boolean;
  };
}

declare global {
  interface Window {
    setupJumpToAvatar?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
  }
}

export async function createAnimationController(
  scene: BABYLON.Scene,
  avatarRoot: any,
  options: AnimationControllerOptions
): Promise<AnimationController> {
  await import("./skeletalAnimLoader.ts");
  await import("../helpers/jumpToAvatar.js");
  await import("./morphAnimLoader.ts");

  const skeletalHandler = window.setupSkeletalAnimLoader?.(scene, avatarRoot, {
    autoStart: options.autoStart ?? true,
    speedRatio: options.speedRatio ?? 1.0,
  });

  window.setupJumpToAvatar?.(scene, avatarRoot, { key: options.jumpKey ?? "j" });

  const morphHandler = window.setupMorphAnimLoader?.(scene, avatarRoot, {
    loop: true,
    speedRatio: options.speedRatio ?? 1.0,
  });

  let lastSkeletalDurationSeconds: number | undefined;
  let currentSpeedRatio = options.speedRatio ?? 1.0;
  let lastFrame = 0;

  type FrameRange = { from: number; to: number };

  function isValidRange(range: FrameRange | null | undefined): range is FrameRange {
    return !!range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from;
  }

  function getFrameRange() {
    const skeletalRange = skeletalHandler?.getFrameRange?.();
    if (isValidRange(skeletalRange)) return skeletalRange;

    const morphRange = morphHandler?.getFrameRange?.();
    if (isValidRange(morphRange)) return morphRange;

    return { from: 0, to: 0 };
  }

  function frameToProgress(frame: number, range: FrameRange) {
    const length = range.to - range.from;
    if (!Number.isFinite(length) || length <= 0) return 0;
    return Math.max(0, Math.min(1, (frame - range.from) / length));
  }

  function progressToFrame(progress: number, range: FrameRange) {
    return range.from + (range.to - range.from) * Math.max(0, Math.min(1, progress));
  }

  function getCurrentFrame() {
    const frame = skeletalHandler?.getCurrentFrame?.() ?? morphHandler?.getCurrentFrame?.() ?? lastFrame;
    if (Number.isFinite(frame)) lastFrame = frame;
    return lastFrame;
  }

  function hasAnimation() {
    return isValidRange(skeletalHandler?.getFrameRange?.()) || isValidRange(morphHandler?.getFrameRange?.());
  }

  function isPlaying() {
    return !!skeletalHandler?.isPlaying?.() || !!morphHandler?.isPlaying?.();
  }

  return {
    loadSkeletal: async (file: File, loadOptions?: SkeletalLoadOptions) => {
      if (!skeletalHandler?.loadFile) {
        console.error("[AnimLoader] skeletal handler not ready");
        return;
      }

      console.log("[AnimLoader] Loading skeletal animation:", file.name);
      if (loadOptions?.scaleMultiplier) {
        console.log("[AnimLoader] Skeletal scale multiplier:", loadOptions.scaleMultiplier);
      }

      const result: SkeletalLoadResult | undefined = await skeletalHandler.loadFile(file, {
        scaleMultiplier: loadOptions?.scaleMultiplier ?? 1.0,
        orientationPreset: loadOptions?.orientationPreset,
      });
      lastSkeletalDurationSeconds = result?.durationSeconds;
    },

    loadBlendshape: async (file: File) => {
      if (!morphHandler?.loadFile) {
        console.error("[AnimLoader] morph handler not ready");
        return;
      }

      console.log("[AnimLoader] Loading blendshape animation:", file.name);
      return await morphHandler.loadFile(file, {
        targetDurationSeconds: lastSkeletalDurationSeconds,
      });
    },

    playAll: () => {
      console.log("[AnimLoader] Playing all animations");

      skeletalHandler?.play?.();
      morphHandler?.play?.();
    },

    pauseAll: () => {
      skeletalHandler?.pause?.();
      morphHandler?.pause?.();
    },

    togglePlayPause: () => {
      if (isPlaying()) {
        skeletalHandler?.pause?.();
        morphHandler?.pause?.();
        return false;
      }

      skeletalHandler?.play?.();
      morphHandler?.play?.();
      return true;
    },

    setSpeedRatio: (speedRatio: number) => {
      currentSpeedRatio = speedRatio;
      skeletalHandler?.setSpeedRatio?.(speedRatio);
      morphHandler?.setSpeedRatio?.(speedRatio);
    },

    seekFrame: (frame: number) => {
      lastFrame = frame;
      const masterRange = getFrameRange();
      const progress = frameToProgress(frame, masterRange);
      const skeletalRange = skeletalHandler?.getFrameRange?.();
      const morphRange = morphHandler?.getFrameRange?.();

      if (isValidRange(skeletalRange)) {
        skeletalHandler?.goToFrame?.(progressToFrame(progress, skeletalRange));
      }

      if (isValidRange(morphRange)) {
        morphHandler?.goToFrame?.(progressToFrame(progress, morphRange));
      }
    },

    getState: () => {
      const range = getFrameRange();
      return {
        isPlaying: isPlaying(),
        currentFrame: getCurrentFrame(),
        from: range.from,
        to: range.to,
        speedRatio: currentSpeedRatio,
        hasAnimation: hasAnimation(),
      };
    },
  };
}
