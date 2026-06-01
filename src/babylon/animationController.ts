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
  };
}
