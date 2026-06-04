import * as BABYLON from "@babylonjs/core";

const RIGHT_ANGLE = Math.PI / 2;
const HEAD_BONE_NAMES = ["head", "cc_base_head", "cc_base_headnode"];

function projectToGround(vector: BABYLON.Vector3) {
  return new BABYLON.Vector3(vector.x, 0, vector.z);
}

function normalizeGround(vector: BABYLON.Vector3) {
  const grounded = projectToGround(vector);
  const length = grounded.length();
  if (length < 0.0001) return null;
  return grounded.scale(1 / length);
}

function signedYawBetween(from: BABYLON.Vector3, to: BABYLON.Vector3) {
  const crossY = from.x * to.z - from.z * to.x;
  const dot = BABYLON.Vector3.Dot(from, to);
  return Math.atan2(crossY, dot);
}

function findHeadPosition(scene: BABYLON.Scene) {
  const wantedNames = new Set(HEAD_BONE_NAMES.map(name => name.toLowerCase()));

  for (const skeleton of scene.skeletons) {
    for (const bone of skeleton.bones) {
      if (!wantedNames.has(bone.name.toLowerCase())) continue;

      const linkedNode = bone.getTransformNode?.();
      if (linkedNode) return linkedNode.getAbsolutePosition();
    }
  }

  return null;
}

function findEyeCenter(avatarRoot: BABYLON.TransformNode) {
  const eyeMeshes = avatarRoot
    .getChildMeshes(false)
    .filter(mesh => {
      const name = mesh.name.toLowerCase();
      return mesh.isEnabled() && name.includes("eye") && !name.includes("eyelash");
    });

  if (!eyeMeshes.length) return null;

  const center = BABYLON.Vector3.Zero();
  for (const mesh of eyeMeshes) {
    mesh.computeWorldMatrix(true);
    center.addInPlace(mesh.getBoundingInfo().boundingBox.centerWorld);
  }

  return center.scale(1 / eyeMeshes.length);
}

function inferAvatarForward(scene: BABYLON.Scene, avatarRoot: BABYLON.TransformNode) {
  const headPosition = findHeadPosition(scene);
  const eyeCenter = findEyeCenter(avatarRoot);

  if (headPosition && eyeCenter) {
    const eyesToHead = normalizeGround(headPosition.subtract(eyeCenter));
    if (eyesToHead) {
      return {
        forward: eyesToHead,
        source: "eyes-to-head",
      };
    }
  }

  avatarRoot.computeWorldMatrix(true);
  const matrix = avatarRoot.getWorldMatrix();
  const forward = normalizeGround(BABYLON.Vector3.TransformNormal(BABYLON.Vector3.Forward(), matrix));

  return forward
    ? {
        forward,
        source: "avatar-forward-axis",
      }
    : null;
}

export function snapAvatarToCameraInRightAngles(
  scene: BABYLON.Scene,
  avatarRoot: BABYLON.TransformNode
) {
  const camera = scene.activeCamera;
  if (!camera) return false;

  avatarRoot.computeWorldMatrix(true);

  const avatarPosition = avatarRoot.getAbsolutePosition();
  const directionToCamera = normalizeGround(camera.position.subtract(avatarPosition));
  const inferred = inferAvatarForward(scene, avatarRoot);

  if (!directionToCamera || !inferred) {
    console.warn("[Avatar] Could not infer orientation for camera-facing snap");
    return false;
  }

  const rawYaw = signedYawBetween(inferred.forward, directionToCamera);
  const snappedYaw = Math.round(rawYaw / RIGHT_ANGLE) * RIGHT_ANGLE;

  if (Math.abs(snappedYaw) < 0.0001) {
    console.log("[Avatar] camera-facing snap: already facing camera", inferred.source);
    return true;
  }

  avatarRoot.rotate(BABYLON.Axis.Y, snappedYaw, BABYLON.Space.WORLD);
  avatarRoot.computeWorldMatrix(true);

  console.log("[Avatar] camera-facing snap:", {
    source: inferred.source,
    rawDegrees: BABYLON.Tools.ToDegrees(rawYaw),
    snappedDegrees: BABYLON.Tools.ToDegrees(snappedYaw),
  });

  return true;
}
