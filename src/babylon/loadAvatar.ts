import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { shouldExcludeMesh } from "../config/meshConfig";

declare global {
  interface Window {
    buildAvatarMorphMap?: (avatarRoot: any) => Map<string, BABYLON.MorphTarget[]>;
  }
}

function collectRelevantMeshes(avatarRoot: any): BABYLON.AbstractMesh[] {
  const scene = avatarRoot?.getScene?.();
  if (!scene) return [];

  const sceneMeshes = scene.meshes.filter(mesh => !!mesh && mesh.name !== "__root__");
  return sceneMeshes;
}

function buildAvatarMorphMapImpl(avatarRoot: any) {
  const map = new Map<string, BABYLON.MorphTarget[]>();
  const meshes = collectRelevantMeshes(avatarRoot);

  console.log("[Avatar] scanning meshes for morph targets:", meshes.length);

  for (const mesh of meshes) {
    const mtm = mesh.morphTargetManager as BABYLON.MorphTargetManager | null;
    console.log("[Avatar] mesh:", mesh.name, "hasMTM:", !!mtm, "numTargets:", mtm?.numTargets ?? 0);

    if (!mtm || !mtm.numTargets) continue;

    for (let i = 0; i < mtm.numTargets; i++) {
      const target = mtm.getTarget(i);
      if (!target?.name) continue;

      const key = target.name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(target);
    }
  }

  console.log("[Avatar] buildAvatarMorphMap keys:", map.size);
  console.log("[Avatar] buildAvatarMorphMap sample:", Array.from(map.keys()).slice(0, 40));

  return map;
}

window.buildAvatarMorphMap = buildAvatarMorphMapImpl;

export async function loadAvatar(scene: BABYLON.Scene): Promise<BABYLON.TransformNode> {
  const result = await BABYLON.SceneLoader.ImportMeshAsync("", "/", "Palmer_optimized_ktx2.glb", scene);

  const avatarRoot =
    result.transformNodes[0] ||
    (result.meshes.find(m => !m.parent) as unknown as BABYLON.TransformNode) ||
    new BABYLON.TransformNode("avatarRoot", scene);

  if (!result.transformNodes.length) {
    result.meshes.forEach(m => {
      if (m !== avatarRoot && !m.parent) {
        m.parent = avatarRoot;
      }
    });
  }

  console.log("[Avatar] imported meshes:", result.meshes.length);
  console.log("[Avatar] imported transformNodes:", result.transformNodes.length);
  console.log("[Avatar] avatarRoot:", avatarRoot.name);

  if ((avatarRoot as any).scaling?.x === 0.01) {
    (avatarRoot as any).scaling.set(1, 1, 1);
    console.log("[Avatar] Scaled avatar from 0.01 to 1.0");
  }

  result.meshes.forEach(m => {
    if (shouldExcludeMesh(m.name)) {
      m.setEnabled(false);
      console.log(`[MeshConfig] Excluded mesh: ${m.name}`);
      return;
    }

    m.alwaysSelectAsActiveMesh = true;

    const mat = m.material as BABYLON.PBRMaterial | null;
    if (!mat) return;

    const n = `${m.name} ${mat.name}`.toLowerCase();

    if (n.includes("hair")) {
      mat.backFaceCulling = true;
      m.renderingGroupId = 0;
      mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    } else if (n.includes("beard") || n.includes("brow")) {
      mat.roughness = 0.6;
    } else if (n.includes("scalp")) {
      m.renderingGroupId = 0;
      m.alphaIndex = 0;
    } else if (n.includes("eyelash")) {
      mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    } else {
      mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
    }
  });

  const morphMap = buildAvatarMorphMapImpl(avatarRoot);
  console.log("[Avatar] final morph target count:", morphMap.size);

  return avatarRoot;
}