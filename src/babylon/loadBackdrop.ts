import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export type BackdropLoadResult = {
  root: BABYLON.TransformNode;
  material: BABYLON.PBRMaterial;
};

export async function loadBackdrop(scene: BABYLON.Scene): Promise<BackdropLoadResult> {
  const result = await BABYLON.SceneLoader.ImportMeshAsync("", "/", "Backdrop.glb", scene);
  const backdropRoot = new BABYLON.TransformNode("Backdrop", scene);
  const backdropMaterial = new BABYLON.PBRMaterial("Backdrop_Matte_Grey", scene);
  const importedNodes = [...result.transformNodes, ...result.meshes] as BABYLON.Node[];
  const importedNodeSet = new Set(importedNodes);

  backdropMaterial.albedoColor = new BABYLON.Color3(0.35, 0.31, 0.27);
  backdropMaterial.roughness = 0.92;
  backdropMaterial.metallic = 0;
  backdropMaterial.specularIntensity = 0.18;
  backdropMaterial.environmentIntensity = 0.18;
  backdropMaterial.backFaceCulling = false;

  importedNodes
    .filter(node => !node.parent || !importedNodeSet.has(node.parent))
    .forEach(node => {
      node.parent = backdropRoot;
    });

  result.meshes.forEach(mesh => {
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.receiveShadows = true;
    mesh.material = backdropMaterial;
  });

  console.log("[Backdrop] imported meshes:", result.meshes.length);
  console.log("[Backdrop] imported transformNodes:", result.transformNodes.length);

  return {
    root: backdropRoot,
    material: backdropMaterial,
  };
}
