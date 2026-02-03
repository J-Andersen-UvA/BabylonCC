import { useEffect, useRef, useState } from "react";

import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";

import "./index.css";
import { AnimationLoader } from "./components/AnimationLoader";
import { createScene } from "./babylon/createScene";
import { loadAvatar } from "./babylon/loadAvatar";
import { createAnimationController } from "./babylon/animationController";

declare global {
  interface Window {
    BABYLON: typeof BABYLON;
    avatarRoot: any;

    setupAnimDrop?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
    setupJumpToAvatar?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
    setupJsonMorphDrop?: (scene: BABYLON.Scene, avatarRoot: any, opts?: any) => any;
  }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const animationControllerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Parse URL parameters for animation scaling
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const skeletalScale = params.get('scale-skeletal-anim');
    return {
      skeletalScale: skeletalScale ? parseFloat(skeletalScale) : 1.0,
    };
  };

  const urlParams = getUrlParams();

  const handleSkeletalLoad = (file: File) => {
    const controller = animationControllerRef.current;
    if (!controller) {
      console.error("[AnimLoader] Animation controller not ready");
      return;
    }

    controller.loadSkeletal(file, { scaleMultiplier: urlParams.skeletalScale });
  };

  const handleBlendshapeLoad = (file: File) => {
    const controller = animationControllerRef.current;
    if (!controller) return;

    controller.loadBlendshape(file);
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

    // Make BABYLON available to your legacy scripts (they reference global BABYLON)
    window.BABYLON = BABYLON;

    const boot = async () => {
      if (disposed) return;

      // Load avatar GLB (served from /public)
      const avatarRoot = await loadAvatar(scene);

      if (disposed) return;

      window.avatarRoot = avatarRoot;

      animationControllerRef.current = await createAnimationController(scene, avatarRoot, {
        mappingUrl: "/CCARKitMapping.csv",
        autoStart: true,
        speedRatio: 1.0,
        jumpKey: "j",
      });

      setIsReady(true);

      engine.runRenderLoop(() => scene.render());
    };

    let cleanupHandlers: null | (() => void) = null;

    boot().then((cleanup) => {
      cleanupHandlers = typeof cleanup === "function" ? cleanup : null;
    });

    return () => {
      disposed = true;
      try {
        cleanupHandlers?.();
      } catch {}

      disposeScene();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} />
      {isReady && (
        <AnimationLoader
          onSkeletalLoad={handleSkeletalLoad}
          onBlendshapeLoad={handleBlendshapeLoad}
          onPlayAll={handlePlayAll}
        />
      )}
    </>
  );
}

export default App;
