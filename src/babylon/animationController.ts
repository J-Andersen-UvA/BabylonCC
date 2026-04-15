import type * as BABYLON from "@babylonjs/core";

interface AnimationControllerOptions {
  mappingUrl: string;
  autoStart?: boolean;
  speedRatio?: number;
  jumpKey?: string;
  useNameMapping?: boolean;
}

interface SkeletalLoadOptions {
  scaleMultiplier?: number;
}

export interface AnimationController {
  loadSkeletal: (file: File, options?: SkeletalLoadOptions) => Promise<void>;
  loadBlendshape: (file: File) => Promise<void>;
  playAll: () => void;
}

declare global {
  interface Window {
    setupSkeletalAnimLoader?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
    setupJumpToAvatar?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
    setupMorphAnimLoader?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
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

  const animDropHandler = window.setupSkeletalAnimLoader?.(scene, avatarRoot, {
    autoStart: options.autoStart ?? true,
    speedRatio: options.speedRatio ?? 1.0,
  });

  window.setupJumpToAvatar?.(scene, avatarRoot, { key: options.jumpKey ?? "j" });

  const morphHandler = window.setupMorphAnimLoader?.(scene, avatarRoot, {
    loop: true,
    autoPlay: true,
    mappingUrl: options.mappingUrl,
    useNameMapping: options.useNameMapping,
    speedRatio: options.speedRatio ?? 1.0,
  });

  return {
    loadSkeletal: async (file: File, loadOptions?: SkeletalLoadOptions) => {
      if (!animDropHandler?.loadFile) {
        console.error("[AnimLoader] skeletal handler not ready");
        return;
      }

      console.log("[AnimLoader] Loading skeletal animation:", file.name);
      await animDropHandler.loadFile(file, {
        scaleMultiplier: loadOptions?.scaleMultiplier ?? 1.0,
      });
    },

    loadBlendshape: async (file: File) => {
      if (!morphHandler?.loadFile) {
        console.error("[AnimLoader] morph handler not ready");
        return;
      }

      console.log("[AnimLoader] Loading blendshape animation:", file.name);
      await morphHandler.loadFile(file);
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