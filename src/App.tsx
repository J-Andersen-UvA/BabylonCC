import { useEffect, useRef } from "react";

import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders";
import "@babylonjs/inspector";

import "./index.css";

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

  useEffect(() => {
    if (!canvasRef.current) return;

    let disposed = false;

    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    // Make BABYLON available to your legacy scripts (they reference global BABYLON)
    window.BABYLON = BABYLON;

    // Default camera/light similar to createDefaultCameraOrLight(true,true,true)
    scene.createDefaultCameraOrLight(true, true, true);

    // Match your camera settings
    const cam = scene.activeCamera as any;
    if (cam) {
      cam.alpha = Math.PI / 2;
      cam.beta = 1.2;
      cam.radius = 2.2;
      cam.minZ = 0.001;
      cam.lowerRadiusLimit = 0.005;
    }

    const boot = async () => {
      // Load your legacy helper scripts (attach functions to window.*)
      await import("./helpers/retargetBlendshapes.js");
      await import("./helpers/animDrop.js");
      await import("./helpers/jumpToAvatar.js");
      await import("./helpers/jsonAnim.js");

      if (disposed) return;

      // Load avatar GLB (served from /public)
      BABYLON.SceneLoader.Append(
        "/",
        "ChrissBlender.glb",
        scene,
        () => {
          if (disposed) return;

          window.avatarRoot = scene.meshes[0];

          scene.meshes.forEach((m: any) => {
            m.alwaysSelectAsActiveMesh = true;

            const mat: any = m.material;
            if (!mat) return;

            const n = (m.name + " " + mat.name).toLowerCase();

            if (n.includes("hair")) {
              mat.backFaceCulling = true;
              mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
              m.renderingGroupId = 0;

              if ("transparencyMode" in mat) {
                mat.transparencyMode = (BABYLON as any).PBRMaterial.PBRMATERIAL_ALPHABLEND;
              }
            } else if (n.includes("beard") || n.includes("brow")) {
              mat.roughness = 0.6;
            } else if (n.includes("scalp")) {
              m.renderingGroupId = 0;
              m.alphaIndex = 0;
            }
          });

          // Hook your features exactly like the HTML
          window.setupAnimDrop?.(scene, window.avatarRoot, { autoStart: true, speedRatio: 1.0 });
          window.setupJumpToAvatar?.(scene, window.avatarRoot, { key: "j" });
          window.setupJsonMorphDrop?.(scene, window.avatarRoot, {
            loop: true,
            mappingUrl: "/CCARKitMapping.csv",
          });
        }
      );

      engine.runRenderLoop(() => scene.render());

      const onResize = () => engine.resize();
      window.addEventListener("resize", onResize);

      // Inspector (like scene.debugLayer.show())
      scene.debugLayer.show();

      // Dragover prevent (matches your HTML)
      const onDragOver = (e: DragEvent) => e.preventDefault();
      window.addEventListener("dragover", onDragOver);

      return () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("dragover", onDragOver);
      };
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

      scene.dispose();
      engine.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} />;
}

export default App;
