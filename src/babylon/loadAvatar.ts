import * as BABYLON from "@babylonjs/core";
import { shouldExcludeMesh } from "../config/meshConfig";

export async function loadAvatar(scene: BABYLON.Scene): Promise<BABYLON.TransformNode> {
  return new Promise((resolve, reject) => {
    BABYLON.SceneLoader.Append(
      "/",
      "ChrissBlender.glb",
      scene,
      () => {
        const avatarRoot = scene.meshes[0];

        // Scale up the avatar if it was exported at 0.01 scale from Blender
        if (avatarRoot && avatarRoot.scaling) {
          const currentScale = avatarRoot.scaling.x;
          if (currentScale === 0.01) {
            avatarRoot.scaling = new BABYLON.Vector3(1, 1, 1);
            console.log("[Avatar] Scaled avatar from 0.01 to 1.0");
          }
        }

        // Configure meshes: exclude, set rendering properties, material setup
        scene.meshes.forEach((m: any) => {
          // Check if mesh should be excluded
          if (shouldExcludeMesh(m.name)) {
            m.setEnabled(false);
            console.log(`[MeshConfig] Excluded mesh: ${m.name}`);
            return;
          }

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

        resolve(avatarRoot);
      },
      undefined,
      (scene, message, exception) => {
        reject(new Error(`Failed to load avatar: ${message}`));
      }
    );
  });
}
