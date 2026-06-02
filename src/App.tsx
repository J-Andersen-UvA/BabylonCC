import { useEffect, useRef, useState } from "react";

import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";

import "./index.css";
import type { AnimationController } from "./babylon/animationController";
import { AnimationLoader, type AvatarOrientationPreset } from "./components/AnimationLoader";
import { AnimationPlaybar } from "./components/AnimationPlaybar";
import { BackdropColorPanel } from "./components/BackdropColorPanel";
import { MorphTargetPanel } from "./components/MorphTargetPanel";
import { createScene, focusCameraOnAvatar, focusCameraOnAvatarBone } from "./babylon/createScene";
import { loadBackdrop } from "./babylon/loadBackdrop";
import { loadAvatar } from "./babylon/loadAvatar";
import { createAnimationController } from "./babylon/animationController";
import { setupLighting } from "./babylon/lighting";
import { PLAYER_CONTROLS_CONFIG } from "./config/playerControlsConfig";
import { RENDER_CONFIG } from "./config/renderConfig";

const DEFAULT_AVATAR_ORIENTATION: AvatarOrientationPreset = "xMinus90Y180";

function vector3FromConfig(value: { x: number; y: number; z: number }) {
  return new BABYLON.Vector3(value.x, value.y, value.z);
}

function studioLightFromConfig(light: {
  position: { x: number; y: number; z: number };
  intensity: number;
  color: string;
  angle: number;
  exponent: number;
}) {
  return {
    position: vector3FromConfig(light.position),
    intensity: light.intensity,
    color: BABYLON.Color3.FromHexString(light.color),
    angle: light.angle,
    exponent: light.exponent,
  };
}

declare global {
  interface Window {
    BABYLON: any;
    avatarRoot: any;
    focusAvatarCamera?: () => void;
  }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const animationControllerRef = useRef<any>(null);
  const lightingRigRef = useRef<ReturnType<typeof setupLighting> | null>(null);
  const trackedHandRef = useRef<"left" | "right" | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [avatarRoot, setAvatarRoot] = useState<BABYLON.TransformNode | null>(null);
  const [backdropMaterial, setBackdropMaterial] = useState<BABYLON.PBRMaterial | null>(null);
  const [animationController, setAnimationController] = useState<AnimationController | null>(null);

  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const skeletalScale = params.get("scale-skeletal-anim");

    return {
      skeletalScale: skeletalScale ? parseFloat(skeletalScale) : 1.0,
    };
  };

  const urlParams = getUrlParams();

  const orientationToEuler = (preset: AvatarOrientationPreset) => {
    switch (preset) {
      case "unrealToBabylon":
      case "xMinus90Y180":
        return new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);
      case "xMinus90":
        return new BABYLON.Vector3(-Math.PI / 2, 0, 0);
      case "x90":
        return new BABYLON.Vector3(Math.PI / 2, 0, 0);
      case "y90":
        return new BABYLON.Vector3(0, Math.PI / 2, 0);
      case "yMinus90":
        return new BABYLON.Vector3(0, -Math.PI / 2, 0);
      case "y180":
        return new BABYLON.Vector3(0, Math.PI, 0);
      case "z180":
        return new BABYLON.Vector3(0, 0, Math.PI);
      case "none":
      default:
        return new BABYLON.Vector3(0, 0, 0);
    }
  };

  const applyAvatarOrientation = (preset: AvatarOrientationPreset) => {
    if (!avatarRoot) return;

    const euler = orientationToEuler(preset);
    avatarRoot.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(euler);
    console.log("[Avatar] orientation preset:", preset, euler.toString());
  };

  const handleOrientationChange = (preset: AvatarOrientationPreset) => {
    applyAvatarOrientation(preset);
  };

  const handleSkeletalLoad = async (
    file: File,
    options: { orientationPreset: AvatarOrientationPreset }
  ) => {
    const controller = animationControllerRef.current;
    if (!controller) {
      console.error("[AnimLoader] Animation controller not ready");
      return;
    }

    await controller.loadSkeletal(file, {
      scaleMultiplier: urlParams.skeletalScale,
      orientationPreset: options.orientationPreset,
    });
  };

  const handleBlendshapeLoad = async (file: File) => {
    const controller = animationControllerRef.current;
    if (!controller) {
      console.error("[AnimLoader] Animation controller not ready");
      return;
    }

    return await controller.loadBlendshape(file);
  };

  const handlePlayAll = () => {
    const controller = animationControllerRef.current;
    if (!controller || !avatarRoot) return;

    applyAvatarOrientation(DEFAULT_AVATAR_ORIENTATION);

    controller.playAll();
  };

  const handleFocusHand = (side: "left" | "right") => {
    const scene = sceneRef.current;
    if (!scene || !avatarRoot) return false;

    const handConfig = PLAYER_CONTROLS_CONFIG.handTracking;
    const focused = focusCameraOnAvatarBone(
      scene,
      avatarRoot,
      side === "left" ? handConfig.leftBoneNames : handConfig.rightBoneNames,
      {
        radius: handConfig.focusRadius,
        targetOffset: handConfig.targetOffset,
      }
    );
    trackedHandRef.current = focused ? side : null;

    return focused;
  };

  const handleResetCameraFocus = () => {
    const scene = sceneRef.current;
    if (!scene || !avatarRoot) return;

    trackedHandRef.current = null;
    focusCameraOnAvatar(scene, avatarRoot);
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    let disposed = false;

    const canvas = canvasRef.current;
    const { engine, scene, dispose: disposeScene } = createScene(canvas);
    sceneRef.current = scene;
    const studioThreePoint = RENDER_CONFIG.lighting.studioThreePoint;

    window.BABYLON = BABYLON;

    lightingRigRef.current = setupLighting(scene, {
      environmentUrl: RENDER_CONFIG.lighting.environmentUrl,
      exposure: RENDER_CONFIG.imageProcessing.exposure,
      contrast: RENDER_CONFIG.imageProcessing.contrast,
      toneMappingEnabled: RENDER_CONFIG.imageProcessing.toneMappingEnabled,
      iblIntensity: RENDER_CONFIG.lighting.iblIntensity,
      sunIntensity: RENDER_CONFIG.lighting.sunIntensity,
      sunDirection: vector3FromConfig(RENDER_CONFIG.lighting.sunDirection),
      useHemiFill: RENDER_CONFIG.lighting.hemiFillEnabled,
      hemiIntensity: RENDER_CONFIG.lighting.hemiIntensity,
      hemiGroundColor: BABYLON.Color3.FromHexString(RENDER_CONFIG.lighting.hemiGroundColor),
      hemiDiffuseColor: BABYLON.Color3.FromHexString(RENDER_CONFIG.lighting.hemiDiffuseColor),
      hemiSpecularColor: BABYLON.Color3.FromHexString(RENDER_CONFIG.lighting.hemiSpecularColor),
      shadowMapSize: RENDER_CONFIG.shadows.mapSize,
      usePercentageCloserFiltering: RENDER_CONFIG.shadows.usePercentageCloserFiltering,
      studioShadowMapSize: RENDER_CONFIG.shadows.studio.mapSize,
      useStudioShadows: RENDER_CONFIG.shadows.studio.enabled,
      useGroundProjection: RENDER_CONFIG.environmentBackground.useGroundProjection,
      groundProjectionSize: RENDER_CONFIG.environmentBackground.groundProjectionSize,
      groundProjectionRadius: RENDER_CONFIG.environmentBackground.groundProjectionRadius,
      groundProjectionHeight: RENDER_CONFIG.environmentBackground.groundProjectionHeight,
      studioThreePoint: {
        enabled: studioThreePoint.enabled,
        target: vector3FromConfig(studioThreePoint.target),
        key: studioLightFromConfig(studioThreePoint.key),
        fill: studioLightFromConfig(studioThreePoint.fill),
        rim: studioLightFromConfig(studioThreePoint.rim),
        shadows: {
          key: RENDER_CONFIG.shadows.studio.key,
          fill: RENDER_CONFIG.shadows.studio.fill,
          rim: RENDER_CONFIG.shadows.studio.rim,
        },
      },
    });

    lightingRigRef.current.environmentTexture?.onLoadObservable.addOnce(() => {
      console.log("[Lighting] environment ready");
    });

    const boot = async () => {
      if (disposed) return;

      const backdrop = await loadBackdrop(scene);
      if (disposed) return;
      setBackdropMaterial(backdrop.material);

      const avatarRoot = await loadAvatar(scene);
      if (disposed) return;
      avatarRoot.getChildMeshes(false).forEach(mesh => {
        if (mesh.isEnabled()) {
          lightingRigRef.current?.addShadowCaster(mesh);
        }
      });

      window.avatarRoot = avatarRoot;
      // avatarRoot.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(
      //   orientationToEuler(DEFAULT_AVATAR_ORIENTATION)
      // );

      setAvatarRoot(avatarRoot);
      focusCameraOnAvatar(scene, avatarRoot);
      window.focusAvatarCamera = () => focusCameraOnAvatar(scene, avatarRoot);

      const handFocusObserver = scene.onBeforeRenderObservable.add(() => {
        const side = trackedHandRef.current;
        if (!side) return;

        const handConfig = PLAYER_CONTROLS_CONFIG.handTracking;
        focusCameraOnAvatarBone(
          scene,
          avatarRoot,
          side === "left" ? handConfig.leftBoneNames : handConfig.rightBoneNames,
          {
            targetOffset: handConfig.targetOffset,
            preserveOrbit: true,
            silent: true,
          }
        );
      });

      const controller = await createAnimationController(scene, avatarRoot, {
        autoStart: true,
        speedRatio: 1.0,
        jumpKey: "j",
      });
      animationControllerRef.current = controller;
      setAnimationController(controller);

      setIsReady(true);
      engine.runRenderLoop(() => scene.render());

      return () => {
        scene.onBeforeRenderObservable.remove(handFocusObserver);
      };
    };

    let cleanupHandlers: null | (() => void) = null;

    boot().then(cleanup => {
      cleanupHandlers = typeof cleanup === "function" ? cleanup : null;
    });

    return () => {
      disposed = true;

      try {
        cleanupHandlers?.();
      } catch {}

      try {
        lightingRigRef.current?.dispose?.();
      } catch {}

      lightingRigRef.current = null;

      disposeScene();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} />
      {isReady && (
        <>
          <AnimationLoader
            onSkeletalLoad={handleSkeletalLoad}
            onBlendshapeLoad={handleBlendshapeLoad}
            onOrientationChange={handleOrientationChange}
            onPlayAll={handlePlayAll}
          />
          <BackdropColorPanel material={backdropMaterial} />
          <AnimationPlaybar
            controller={animationController}
            onBeforePlay={() => applyAvatarOrientation(DEFAULT_AVATAR_ORIENTATION)}
            onFocusHand={handleFocusHand}
            onResetFocus={handleResetCameraFocus}
          />
          <MorphTargetPanel
            avatarRoot={avatarRoot}
            meshNames={[
              "cc_base_body_primitive0",
              "cc_base_body_primitive1",
              "cc_base_body_primitive2",
              "cc_base_body_primitive3",
              "cc_base_body_primitive4",
              "cc_base_body_primitive5",
              "male_brow_2_primitive0",
              "male_brow_2_primitive1",
            ]}
          />
        </>
      )}
    </>
  );
}

export default App;
