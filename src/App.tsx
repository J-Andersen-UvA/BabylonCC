import { useEffect, useRef, useState } from "react";

import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";

import "./index.css";
import { AnimationLoader, type AvatarOrientationPreset } from "./components/AnimationLoader";
import { MorphTargetPanel } from "./components/MorphTargetPanel";
import { createScene } from "./babylon/createScene";
import { loadAvatar } from "./babylon/loadAvatar";
import { createAnimationController } from "./babylon/animationController";
import { setupLighting } from "./babylon/lighting";

const DEFAULT_AVATAR_ORIENTATION: AvatarOrientationPreset = "xMinus90Y180";

declare global {
  interface Window {
    BABYLON: any;
    avatarRoot: any;
  }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const animationControllerRef = useRef<any>(null);
  const lightingRigRef = useRef<ReturnType<typeof setupLighting> | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [avatarRoot, setAvatarRoot] = useState<BABYLON.TransformNode | null>(null);

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

    applyAvatarOrientation(options.orientationPreset);
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
    if (!controller) return;

    controller.playAll();
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    let disposed = false;

    const canvas = canvasRef.current;
    const { engine, scene, dispose: disposeScene } = createScene(canvas);
    sceneRef.current = scene;

    window.BABYLON = BABYLON;

    lightingRigRef.current = setupLighting(scene, {
      environmentUrl: "/environment.env",
      iblIntensity: 0.35,
      useGroundProjection: true,
      groundProjectionRadius: 20,
      groundProjectionHeight: 1.5,
    });

    lightingRigRef.current.environmentTexture?.onLoadObservable.addOnce(() => {
      console.log("[Lighting] environment ready");
    });

    const boot = async () => {
      if (disposed) return;

      const avatarRoot = await loadAvatar(scene);
      if (disposed) return;

      window.avatarRoot = avatarRoot;
      avatarRoot.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(
        orientationToEuler(DEFAULT_AVATAR_ORIENTATION)
      );

      setAvatarRoot(avatarRoot);

      animationControllerRef.current = await createAnimationController(scene, avatarRoot, {
        autoStart: true,
        speedRatio: 1.0,
        jumpKey: "j",
      });

      setIsReady(true);
      engine.runRenderLoop(() => scene.render());
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
