import { useEffect, useRef, useState } from "react";

import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";

import "./index.css";
import { AnimationLoader } from "./components/AnimationLoader";
import { createScene } from "./babylon/createScene";
import { loadAvatar } from "./babylon/loadAvatar";

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
  const morphHandlerRef = useRef<any>(null);
  const animDropHandlerRef = useRef<any>(null);
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
    // Use the animDrop.js handler for skeletal animations
    if (!animDropHandlerRef.current || !animDropHandlerRef.current.loadFile) {
      console.error("[AnimLoader] animDrop handler not ready");
      return;
    }

    console.log("[AnimLoader] Loading skeletal animation:", file.name);
    console.log("[AnimLoader] Skeletal scale multiplier:", urlParams.skeletalScale);
    animDropHandlerRef.current.loadFile(file, { scaleMultiplier: urlParams.skeletalScale });
  };

  const handleBlendshapeLoad = (file: File) => {
    const handler = morphHandlerRef.current;
    if (!handler || !handler.loadFile) return;

    console.log("[AnimLoader] Loading blendshape animation:", file.name);
    handler.loadFile(file);
  };
  const handlePlayAll = () => {
    console.log("[AnimLoader] Playing all animations");
    
    // Play skeletal animations
    if (animDropHandlerRef.current && animDropHandlerRef.current.play) {
      animDropHandlerRef.current.play();
    }
    
    // Play morph animations
    if (morphHandlerRef.current && morphHandlerRef.current.play) {
      morphHandlerRef.current.play();
    }
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
      // Load your legacy helper scripts (attach functions to window.*)
      await import("./helpers/retargetBlendshapes.js");
      await import("./helpers/animDrop.js");
      await import("./helpers/jumpToAvatar.js");
      await import("./helpers/jsonAnim.js");

      if (disposed) return;

      // Load avatar GLB (served from /public)
      const avatarRoot = await loadAvatar(scene);

      if (disposed) return;

      window.avatarRoot = avatarRoot;
          
      // Hook your features exactly like the HTML
      const animDropHandler = window.setupAnimDrop?.(scene, window.avatarRoot, { autoStart: true, speedRatio: 1.0 });
          animDropHandlerRef.current = animDropHandler;
          
      window.setupJumpToAvatar?.(scene, window.avatarRoot, { key: "j" });
          
      // Store the morph handler for programmatic access
      const morphHandler = window.setupJsonMorphDrop?.(scene, window.avatarRoot, {
        loop: true,
        mappingUrl: "/CCARKitMapping.csv",
      });
      morphHandlerRef.current = morphHandler;

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
