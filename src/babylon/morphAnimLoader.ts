import * as BABYLON from "@babylonjs/core";

type MorphLoaderOptions = {
  loop?: boolean;
  speedRatio?: number;
};

type MorphLoadOptions = {
  targetDurationSeconds?: number;
};

type MorphLoadResult = {
  matched: number;
  unmatchedCount: number;
  targetedAnimations: number;
};

declare global {
  interface Window {
    setupMorphAnimLoader?: (
      scene: BABYLON.Scene,
      avatarRoot: any,
      opts?: MorphLoaderOptions
    ) => {
      stop: () => void;
      play: () => boolean;
      dispose: () => void;
      loadFile: (file: File, options?: MorphLoadOptions) => Promise<MorphLoadResult>;
    };
    buildAvatarMorphMap?: (avatarRoot: any) => Map<string, BABYLON.MorphTarget[]>;
  }
}

function morphKey(name: string) {
  return String(name || "").trim().toLowerCase();
}

function compactMorphKey(name: string) {
  return morphKey(name).replace(/[^a-z0-9]/g, "");
}

function buildMorphMapAllMeshes(avatarRoot: any) {
  if (window.buildAvatarMorphMap) {
    return window.buildAvatarMorphMap(avatarRoot);
  }

  return new Map<string, BABYLON.MorphTarget[]>();
}

function getShapeKeyNames(json: any) {
  if (Array.isArray(json.shapeKeys)) return json.shapeKeys.filter(Boolean);
  if (Array.isArray(json.animation) && json.animation[0]?.weights) {
    return Object.keys(json.animation[0].weights);
  }
  return [] as string[];
}

function getWeightValue(weights: Record<string, number> | undefined, name: string) {
  if (!weights) return undefined;
  if (weights[name] !== undefined) return weights[name];

  const wanted = compactMorphKey(name);
  const key = Object.keys(weights).find(candidate => compactMorphKey(candidate) === wanted);
  return key ? weights[key] : undefined;
}

function shapeKeyPairs(json: any, name: string): Array<[number, number]> | null {
  if (!Array.isArray(json.animation) || !json.animation[0]?.weights) return null;

  return json.animation.map((frame: any): [number, number] => [
    frame.frame ?? frame.time,
    getWeightValue(frame.weights, name) ?? 0,
  ]);
}

function stopAndDispose(group?: BABYLON.AnimationGroup | null) {
  if (!group) return;

  try {
    group.stop();
  } catch {}

  try {
    group.dispose();
  } catch {}
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function findMorphTargets(morphMap: Map<string, BABYLON.MorphTarget[]>, sourceName: string) {
  return morphMap.get(morphKey(sourceName)) || morphMap.get(compactMorphKey(sourceName)) || [];
}

export function setupMorphAnimLoader(
  scene: BABYLON.Scene,
  avatarRoot: any,
  opts: MorphLoaderOptions = {}
) {
  if (!scene || !avatarRoot) throw new Error("scene + avatarRoot required");

  let currentGroup: BABYLON.AnimationGroup | null = null;

  async function handleFile(file: File, loadOpts: MorphLoadOptions = {}): Promise<MorphLoadResult> {
    console.log("[morphAnim] file dropped:", file?.name);
    if (!file || !file.name.toLowerCase().endsWith(".json")) {
      return { matched: 0, unmatchedCount: 0, targetedAnimations: 0 };
    }

    const json = JSON.parse(await file.text());
    stopAndDispose(currentGroup);

    if (!Array.isArray(json.animation) || !json.animation[0]?.weights) {
      console.error("[morphAnim] Unsupported shapekey JSON format. Expected animation[] frames with weights objects.");
      return { matched: 0, unmatchedCount: 0, targetedAnimations: 0 };
    }

    const fps = Number.isFinite(json.fps) ? json.fps : 60;
    const morphMap = buildMorphMapAllMeshes(avatarRoot);

    console.log("[morphAnim] morphMap keys (sample):", [...morphMap.keys()].slice(0, 20));
    console.log("[morphAnim] morphMap key count:", morphMap.size);

    const group = new BABYLON.AnimationGroup("jsonMorphs", scene);

    let matched = 0;
    const unmatched: string[] = [];

    for (const srcName of getShapeKeyNames(json)) {
      const pairs = shapeKeyPairs(json, srcName);
      if (!pairs || pairs.length < 2) continue;

      const targets = findMorphTargets(morphMap, srcName);
      if (!targets.length) {
        if (unmatched.length < 10) console.log("[morphAnim] no target for:", srcName);
        unmatched.push(srcName);
        continue;
      }

      const keys = pairs
        .map(([t, v]: [number, number]) => ({ t: Number(t), v: Number(v) }))
        .filter((key: { t: number; v: number }) => Number.isFinite(key.t) && Number.isFinite(key.v))
        .sort((a: { t: number; v: number }, b: { t: number; v: number }) => a.t - b.t);

      if (keys.length < 2) continue;

      const maxAbs = Math.max(...keys.map((key: { t: number; v: number }) => Math.abs(key.v)));
      const needsNormalization = maxAbs > 1.0;
      const sourceFrames = keys.map((key: { t: number; v: number }) => ({
        frame: key.t,
        value: clamp01(needsNormalization ? key.v / 100.0 : key.v),
      }));

      const firstFrame = sourceFrames[0].frame;
      const lastFrame = sourceFrames[sourceFrames.length - 1].frame;
      const sourceDurationFrames = Math.max(lastFrame - firstFrame, 0);
      const targetDurationSeconds = Number(loadOpts.targetDurationSeconds);
      const targetDurationFrames = Number.isFinite(targetDurationSeconds)
        ? targetDurationSeconds * fps
        : null;
      const stretch = targetDurationFrames && sourceDurationFrames > 0
        ? targetDurationFrames / sourceDurationFrames
        : 1;

      for (const mt of targets) {
        const anim = new BABYLON.Animation(
          `mt_${srcName}_${mt.name}`,
          "influence",
          fps,
          BABYLON.Animation.ANIMATIONTYPE_FLOAT,
          BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );

        anim.setKeys(
          sourceFrames.map((key: { frame: number; value: number }) => ({
            frame: firstFrame + (key.frame - firstFrame) * stretch,
            value: key.value,
          }))
        );

        group.addTargetedAnimation(anim, mt);
        matched += 1;
      }
    }

    console.log("[morphAnim] matched:", matched, "unmatched_count:", unmatched.length);
    console.log("[morphAnim] unmatched sample:", unmatched.slice(0, 25));
    console.log("[morphAnim] targetedAnimations:", group.targetedAnimations.length);

    currentGroup = group;

    if (typeof opts.speedRatio === "number") {
      group.speedRatio = opts.speedRatio;
    }
    if (Number.isFinite(loadOpts.targetDurationSeconds)) {
      console.log("[morphAnim] stretched to body duration seconds:", loadOpts.targetDurationSeconds);
    }

    return {
      matched,
      unmatchedCount: unmatched.length,
      targetedAnimations: group.targetedAnimations.length,
    };
  }

  return {
    stop: () => currentGroup?.stop(),
    play: () => {
      if (currentGroup) {
        currentGroup.start(opts.loop !== false, opts.speedRatio ?? 1.0);
        return true;
      }

      console.warn("[morphAnim] play requested before morph animation was loaded");
      return false;
    },
    dispose: () => stopAndDispose(currentGroup),
    loadFile: handleFile,
  };
}

window.setupMorphAnimLoader = setupMorphAnimLoader;
