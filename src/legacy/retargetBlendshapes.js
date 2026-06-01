// retargetBlendshapes.js
// Usage:
//   const clone = retargetAnimWithBlendshapes(avatarRoot, srcAnimGroup, "walk");
//   clone.play(true);

(function () {
  function morphKey(name) {
    return String(name || "").trim().toLowerCase();
  }

  function compactMorphKey(name) {
    return morphKey(name).replace(/[^a-z0-9]/g, "");
  }

  function addMorphTarget(map, target) {
    if (!target?.name) return;

    const keys = [morphKey(target.name), compactMorphKey(target.name)].filter(Boolean);
    for (const key of keys) {
      if (!map.has(key)) map.set(key, []);
      const targets = map.get(key);
      if (!targets.includes(target)) targets.push(target);
    }
  }

  function buildAvatarMorphMap(avatarRoot) {
    const meshes = new Set();

    if (avatarRoot) meshes.add(avatarRoot);
    if (avatarRoot.getChildMeshes) {
      avatarRoot.getChildMeshes(false).forEach(m => meshes.add(m));
    }
    if (avatarRoot.getScene) {
      avatarRoot.getScene().meshes.forEach(m => meshes.add(m));
    }

    const morphMap = new Map(); // lowercased name -> MorphTarget[]
    for (const m of meshes) {
      const mtm = m.morphTargetManager;
      if (!mtm || !mtm.numTargets) continue;
      for (let i = 0; i < mtm.numTargets; i++) {
        addMorphTarget(morphMap, mtm.getTarget(i));
      }
    }

    const scene = avatarRoot.getScene?.();
    if (scene?.morphTargetManagers) {
      for (const mtm of scene.morphTargetManagers) {
        if (!mtm || !mtm.numTargets) continue;
        for (let i = 0; i < mtm.numTargets; i++) {
          addMorphTarget(morphMap, mtm.getTarget(i));
        }
      }
    }
    return morphMap;
  }

  function collectAvatarMaps(avatarRoot) {
    const meshes = avatarRoot.getChildMeshes ? avatarRoot.getChildMeshes(false) : [];
    const skeleton = meshes.find(m => m.skeleton)?.skeleton || null;
    const morphMap = buildAvatarMorphMap(avatarRoot);

    return { skeleton, morphMap };
  }

  function findRetargetMorphTargets(maps, target) {
    if (!target?.name || !maps?.morphMap) return [];

    return maps.morphMap.get(morphKey(target.name)) || maps.morphMap.get(compactMorphKey(target.name)) || [];
  }

  function retargetAnimWithBlendshapes(avatarRoot, animGroup, cloneName = "anim") {
    const { skeleton, morphMap } = collectAvatarMaps(avatarRoot);

    return animGroup.clone(cloneName, (target) => {
      if (!target) return null;

      // 1) Bones: map to linked transform node (what Babylon animates for skinned rigs)
      if (skeleton && target.name) {
        const bone = skeleton.bones.find(b => b.name === target.name);
        if (bone && bone._linkedTransformNode) return bone._linkedTransformNode;
      }

      // 2) MorphTargets: clone() hands us MorphTarget targets for facial animations
      if (typeof target.getClassName === "function" && target.getClassName() === "MorphTarget") {
        const matches = morphMap.get(morphKey(target.name)) || morphMap.get(compactMorphKey(target.name));
        // If multiple meshes have same morph target name, pick first.
        // (If you truly need to drive all matches, see note below.)
        return matches && matches[0] ? matches[0] : null;
      }

      // 3) Fallback: try to match by node name under avatarRoot
      if (target.name && avatarRoot.getChildren) {
        const stack = [avatarRoot];
        while (stack.length) {
          const n = stack.pop();
          if (n && n.name === target.name) return n;
          if (n && n.getChildren) stack.push(...n.getChildren());
        }
      }

      return null;
    });
  }

  window.buildAvatarMorphMap = buildAvatarMorphMap;
  window.findRetargetMorphTargets = findRetargetMorphTargets;
  window.retargetAnimWithBlendshapes = retargetAnimWithBlendshapes;
})();
