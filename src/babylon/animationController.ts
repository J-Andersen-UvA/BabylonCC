import type * as BABYLON from "@babylonjs/core";

interface AnimationControllerOptions {
  autoStart?: boolean;
  speedRatio?: number;
  jumpKey?: string;
}

interface SkeletalLoadOptions {
  scaleMultiplier?: number;
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
    setupAnimDrop?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
    setupJumpToAvatar?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
    setupJsonMorphDrop?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
  }
}

export async function createAnimationController(
  scene: BABYLON.Scene,
  avatarRoot: any,
  options: AnimationControllerOptions
): Promise<AnimationController> {
  await import("../helpers/retargetBlendshapes.js");
  await import("../helpers/animDrop.js");
  await import("../helpers/jumpToAvatar.js");
  await import("../helpers/jsonAnim.js");

  const animDropHandler = window.setupAnimDrop?.(scene, avatarRoot, {
    autoStart: options.autoStart ?? true,
    speedRatio: options.speedRatio ?? 1.0,
  });

  window.setupJumpToAvatar?.(scene, avatarRoot, { key: options.jumpKey ?? "j" });

  const morphHandler = window.setupJsonMorphDrop?.(scene, avatarRoot, {
    loop: true,
  });
  let lastSkeletalDurationSeconds: number | undefined;

  return {
    loadSkeletal: async (file: File, loadOptions?: SkeletalLoadOptions) => {
      if (!animDropHandler?.loadFile) {
        console.error("[AnimLoader] animDrop handler not ready");
        return;
      }

      console.log("[AnimLoader] Loading skeletal animation:", file.name);
      if (loadOptions?.scaleMultiplier) {
        console.log("[AnimLoader] Skeletal scale multiplier:", loadOptions.scaleMultiplier);
      }

      const result: SkeletalLoadResult | undefined = await animDropHandler.loadFile(file, {
        scaleMultiplier: loadOptions?.scaleMultiplier ?? 1.0,
      });
      lastSkeletalDurationSeconds = result?.durationSeconds;
    },
    loadBlendshape: async (file: File) => {
      if (!morphHandler?.loadFile) return;

      console.log("[AnimLoader] Loading blendshape animation:", file.name);
      return await morphHandler.loadFile(file, {
        targetDurationSeconds: lastSkeletalDurationSeconds,
      });
    },
    playAll: () => {
      console.log("[AnimLoader] Playing all animations");

      if (animDropHandler?.play) {
        animDropHandler.play();
      }

      if (morphHandler?.play) {
        morphHandler.play();
      }
    },
  };
}
