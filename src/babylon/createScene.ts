import * as BABYLON from "@babylonjs/core";
import { AVATAR_CAMERA_CONFIG } from "../config/cameraConfig";
import { RENDER_CONFIG } from "../config/renderConfig";

interface SceneSetupResult {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  dispose: () => void;
}

function cameraInit(scene: BABYLON.Scene): BABYLON.Camera | null {
  const cam = scene.activeCamera as BABYLON.ArcRotateCamera | null;
  if (cam) {
    cam.minZ = 0.001;
    cam.lowerRadiusLimit = 0.005;
  }
  return cam;
}

function vectorFromConfig(value: { x: number; y: number; z: number }): BABYLON.Vector3 {
  return new BABYLON.Vector3(value.x, value.y, value.z);
}

type CameraFocusTarget = {
  position: BABYLON.Vector3;
  source: string;
};

function findFocusTargetByNames(
  scene: BABYLON.Scene,
  avatarRoot: BABYLON.TransformNode,
  names: string[]
): CameraFocusTarget | null {
  const focusNames = names.map(name => name.toLowerCase());

  for (const skeleton of scene.skeletons) {
    for (const bone of skeleton.bones) {
      if (!focusNames.includes(bone.name.toLowerCase())) continue;

      const linkedNode = bone.getTransformNode?.();
      if (linkedNode) {
        return {
          position: linkedNode.getAbsolutePosition(),
          source: `bone:${bone.name}`,
        };
      }
    }
  }

  const descendants = avatarRoot.getDescendants(false);
  const focusNode = descendants.find(node => focusNames.includes(node.name.toLowerCase()));

  if (focusNode instanceof BABYLON.TransformNode) {
    return {
      position: focusNode.getAbsolutePosition(),
      source: `node:${focusNode.name}`,
    };
  }

  return null;
}

function findFocusTarget(scene: BABYLON.Scene, avatarRoot: BABYLON.TransformNode): CameraFocusTarget | null {
  return findFocusTargetByNames(scene, avatarRoot, AVATAR_CAMERA_CONFIG.focusBoneNames);
}

export function focusCameraOnAvatar(scene: BABYLON.Scene, avatarRoot: BABYLON.TransformNode) {
  const cam = scene.activeCamera as BABYLON.ArcRotateCamera | null;
  if (!cam) return;

  const focusTarget = findFocusTarget(scene, avatarRoot);
  const target = focusTarget?.position ?? vectorFromConfig(AVATAR_CAMERA_CONFIG.fallbackTarget);
  const offset = vectorFromConfig(AVATAR_CAMERA_CONFIG.targetOffset);
  const finalTarget = target.add(offset);

  cam.setTarget(finalTarget);
  cam.alpha = AVATAR_CAMERA_CONFIG.alpha;
  cam.beta = AVATAR_CAMERA_CONFIG.beta;
  cam.radius = AVATAR_CAMERA_CONFIG.radius;

  console.log("[Camera] focus config:", AVATAR_CAMERA_CONFIG);
  console.log(
    "[Camera] focused:",
    focusTarget?.source ?? "fallback",
    "target:",
    finalTarget.toString(),
    "alpha:",
    cam.alpha,
    "beta:",
    cam.beta,
    "radius:",
    cam.radius
  );

  if (!focusTarget) {
    console.log(
      "[Camera] available bone sample:",
      scene.skeletons.flatMap(skeleton => skeleton.bones.map(bone => bone.name)).slice(0, 50)
    );
  }
}

export function focusCameraOnAvatarBone(
  scene: BABYLON.Scene,
  avatarRoot: BABYLON.TransformNode,
  boneNames: string[],
  options: {
    radius?: number;
    targetOffset?: { x: number; y: number; z: number };
    preserveOrbit?: boolean;
    silent?: boolean;
  } = {}
) {
  const cam = scene.activeCamera as BABYLON.ArcRotateCamera | null;
  if (!cam) return false;

  const focusTarget = findFocusTargetByNames(scene, avatarRoot, boneNames);
  if (!focusTarget) {
    console.warn("[Camera] hand focus target not found:", boneNames);
    console.log(
      "[Camera] available bone sample:",
      scene.skeletons.flatMap(skeleton => skeleton.bones.map(bone => bone.name)).slice(0, 80)
    );
    return false;
  }

  const targetOffset = options.targetOffset
    ? vectorFromConfig(options.targetOffset)
    : BABYLON.Vector3.Zero();
  const finalTarget = focusTarget.position.add(targetOffset);
  const alpha = options.preserveOrbit ? cam.alpha : AVATAR_CAMERA_CONFIG.alpha;
  const beta = options.preserveOrbit ? cam.beta : AVATAR_CAMERA_CONFIG.beta;
  const radius = options.radius ?? cam.radius;

  cam.setTarget(finalTarget);
  cam.alpha = alpha;
  cam.beta = beta;
  cam.radius = radius;

  if (!options.silent) {
    console.log("[Camera] hand focused:", focusTarget.source, finalTarget.toString());
  }
  return true;
}

function debugInit(scene: BABYLON.Scene): (e: KeyboardEvent) => void {
  // Inspector hidden by default (performance), toggle with 'i' key
  scene.debugLayer.hide();
  const onKeyDownInspector = (e: KeyboardEvent) => {
    if (e.key === "i" || e.key === "I") {
      if (scene.debugLayer.isVisible()) {
        scene.debugLayer.hide();
      } else {
        scene.debugLayer.show();
      }
    }
  };
  window.addEventListener("keydown", onKeyDownInspector);
  return onKeyDownInspector;
}

export function createScene(canvas: HTMLCanvasElement): SceneSetupResult {
  const engine = new BABYLON.Engine(canvas, true);
  engine.setHardwareScalingLevel(RENDER_CONFIG.hardwareScalingLevel);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString(RENDER_CONFIG.clearColor);
  
  // Default camera/light similar to createDefaultCameraOrLight(true,true,true)
  scene.createDefaultCameraOrLight(true, true, true);

  cameraInit(scene);

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);

  const onKeyDownInspector = debugInit(scene);

  // Dragover prevent (matches your HTML)
  const onDragOver = (e: DragEvent) => e.preventDefault();
  window.addEventListener("dragover", onDragOver);

  return {
    engine,
    scene,
    dispose: () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDownInspector);
      window.removeEventListener("dragover", onDragOver);
    },
  };
}
