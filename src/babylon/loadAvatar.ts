import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import {
  AVATAR_MATERIAL_CONFIG,
  AVATAR_MATERIAL_RULES,
  shouldExcludeMesh,
} from "../config/meshConfig";
import type { AvatarSelectionConfig } from "../config/avatarSelectionConfig";

declare global {
  interface Window {
    buildAvatarMorphMap?: (avatarRoot: any) => Map<string, BABYLON.MorphTarget[]>;
  }
}

function morphKey(name: string) {
  return String(name || "").trim().toLowerCase();
}

function compactMorphKey(name: string) {
  return morphKey(name).replace(/[^a-z0-9]/g, "");
}

function collectRelevantMeshes(avatarRoot: any): BABYLON.AbstractMesh[] {
  const scene = avatarRoot?.getScene?.();
  if (!scene) return [];

  return scene.meshes.filter((mesh: BABYLON.AbstractMesh) => !!mesh && mesh.name !== "__root__");
}

function addMorphTarget(map: Map<string, BABYLON.MorphTarget[]>, target: BABYLON.MorphTarget | null) {
  if (!target?.name) return;

  const keys = [morphKey(target.name), compactMorphKey(target.name)].filter(Boolean);
  for (const key of keys) {
    if (!map.has(key)) map.set(key, []);
    const targets = map.get(key);
    if (targets && !targets.includes(target)) targets.push(target);
  }
}

function buildAvatarMorphMapImpl(avatarRoot: any) {
  const map = new Map<string, BABYLON.MorphTarget[]>();
  const meshes = collectRelevantMeshes(avatarRoot);

  console.log("[Avatar] scanning meshes for morph targets:", meshes.length);

  for (const mesh of meshes) {
    const mtm = mesh.morphTargetManager as BABYLON.MorphTargetManager | null;
    console.log("[Avatar] mesh:", mesh.name, "hasMTM:", !!mtm, "numTargets:", mtm?.numTargets ?? 0);

    if (!mtm || !mtm.numTargets) continue;

    for (let i = 0; i < mtm.numTargets; i += 1) {
      addMorphTarget(map, mtm.getTarget(i));
    }
  }

  console.log("[Avatar] buildAvatarMorphMap keys:", map.size);
  console.log("[Avatar] buildAvatarMorphMap sample:", Array.from(map.keys()).slice(0, 40));

  return map;
}

window.buildAvatarMorphMap = buildAvatarMorphMapImpl;

function splitPublicAssetUrl(url: string) {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  const slashIndex = normalizedUrl.lastIndexOf("/");

  return {
    rootUrl: normalizedUrl.slice(0, slashIndex + 1),
    sceneFilename: normalizedUrl.slice(slashIndex + 1),
  };
}

export async function loadAvatar(
  scene: BABYLON.Scene,
  avatar: AvatarSelectionConfig
): Promise<BABYLON.TransformNode> {
  const { rootUrl, sceneFilename } = splitPublicAssetUrl(avatar.glbUrl);
  const result = await BABYLON.SceneLoader.ImportMeshAsync("", rootUrl, sceneFilename, scene);

  const avatarRoot = new BABYLON.TransformNode("Avatar", scene);
  const importedNodes = [
    ...result.transformNodes,
    ...result.meshes,
  ] as BABYLON.Node[];
  const importedNodeSet = new Set(importedNodes);
  const importedTopLevelNodes = importedNodes.filter(node => {
    if (node === avatarRoot) return false;
    return !node.parent || !importedNodeSet.has(node.parent);
  });

  if (!importedTopLevelNodes.length) {
    result.meshes.forEach(mesh => {
      if (!mesh.parent) {
        mesh.parent = avatarRoot;
      }
    });
  } else {
    importedTopLevelNodes.forEach(node => {
      node.parent = avatarRoot;
    });
  }

  console.log("[Avatar] loaded:", avatar.name, avatar.glbUrl);
  console.log("[Avatar] imported meshes:", result.meshes.length);
  console.log("[Avatar] imported transformNodes:", result.transformNodes.length);
  console.log(
    "[Avatar] imported top-level nodes:",
    importedTopLevelNodes.map(node => node.name)
  );
  console.log("[Avatar] avatarRoot container:", avatarRoot.name);

  importedTopLevelNodes.forEach(node => {
    const transformNode = node as BABYLON.TransformNode;
    if (transformNode.scaling?.x === 0.01) {
      transformNode.scaling.set(1, 1, 1);
      console.log(`[Avatar] Scaled imported root ${node.name} from 0.01 to 1.0`);
    }
  });

  result.meshes.forEach(mesh => {
    if (shouldExcludeMesh(mesh.name)) {
      mesh.setEnabled(false);
      console.log(`[MeshConfig] Excluded mesh: ${mesh.name}`);
      return;
    }

    mesh.alwaysSelectAsActiveMesh = true;

    const mat = mesh.material as BABYLON.PBRMaterial | null;
    if (!mat) return;

    const name = `${mesh.name} ${mat.name}`.toLowerCase();
    const materialConfig = AVATAR_MATERIAL_CONFIG;

    mat.specularIntensity = materialConfig.specularIntensity;
    mat.environmentIntensity = materialConfig.environmentIntensity;
    mat.roughness = materialConfig.roughness;
    mat.metallic = materialConfig.metallic;

    const alphaBlendRule = AVATAR_MATERIAL_RULES.alphaBlendRules.find(rule =>
      rule.nameIncludes.some(token => name.includes(token))
    );
    const roughnessRule = AVATAR_MATERIAL_RULES.roughnessOverrides.find(rule =>
      rule.nameIncludes.some(token => name.includes(token))
    );

    if (alphaBlendRule) {
      if (typeof alphaBlendRule.backFaceCulling === "boolean") {
        mat.backFaceCulling = alphaBlendRule.backFaceCulling;
      }
      if (typeof alphaBlendRule.renderingGroupId === "number") {
        mesh.renderingGroupId = alphaBlendRule.renderingGroupId;
      }
      mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    } else if (roughnessRule) {
      mat.roughness = Math.max(mat.roughness, roughnessRule.minimumRoughness);
    } else if (AVATAR_MATERIAL_RULES.scalp.nameIncludes.some(token => name.includes(token))) {
      mesh.renderingGroupId = AVATAR_MATERIAL_RULES.scalp.renderingGroupId;
      mesh.alphaIndex = AVATAR_MATERIAL_RULES.scalp.alphaIndex;
    } else {
      if (AVATAR_MATERIAL_RULES.opaqueFallback) {
        mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_OPAQUE;
      }
    }
  });

  const morphMap = buildAvatarMorphMapImpl(avatarRoot);
  console.log("[Avatar] final morph target count:", morphMap.size);

  return avatarRoot;
}
