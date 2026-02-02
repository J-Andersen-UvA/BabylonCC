// animDrop.js
// Usage: setupAnimDrop(scene, avatarRoot, { autoStart: true })

(function () {
  function makeDropUI() {
    const el = document.createElement("div");
    el.id = "dropzone";
    el.textContent = "Drop animation .glb/.gltf here";
    Object.assign(el.style, {
      position: "fixed",
      left: "12px",
      top: "12px",
      zIndex: 9999,
      padding: "10px 12px",
      borderRadius: "10px",
      background: "rgba(0,0,0,0.45)",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      userSelect: "none",
      border: "1px solid rgba(255,255,255,0.25)",
      backdropFilter: "blur(6px)",
    });
    document.body.appendChild(el);
    return el;
  }

  function buildAvatarMaps(avatarRoot) {
    const nodeMap = new Map();
    const boneMap = new Map(); // "SkeletonName/BoneName" -> bone

    const stack = [avatarRoot];
    while (stack.length) {
      const n = stack.pop();
      if (!n) continue;
      if (n.name) nodeMap.set(n.name, n);
      if (n.getChildren) stack.push(...n.getChildren());
    }

    const scene = avatarRoot.getScene();
    const avatarMeshes = avatarRoot.getChildMeshes ? avatarRoot.getChildMeshes(false) : [];
    const skels = new Set();
    avatarMeshes.forEach(m => m.skeleton && skels.add(m.skeleton));

    skels.forEach(s => {
      s.bones.forEach(b => {
        if (!b.name) return;
        const key = `${s.name}/${b.name}`;
        boneMap.set(key, b);
        boneMap.set(b.name, b); // also allow plain bone name match
      });
    });

    const morphMap = (window.buildAvatarMorphMap ? window.buildAvatarMorphMap(avatarRoot) : new Map());
    return { scene, nodeMap, boneMap, morphMap };
  }

  function retargetAnimationGroup(srcGroup, maps, opts) {
    const dst = new BABYLON.AnimationGroup(srcGroup.name + "_retarget", maps.scene);

    for (const ta of srcGroup.targetedAnimations) {
      const anim = ta.animation;
      const tgt = ta.target;

      let newTarget = null;
      let morphMatched = 0, morphUnmatched = 0;

      // Bone target
      if (tgt && typeof tgt.getClassName === "function" && tgt.getClassName() === "Bone") {
        // try "SkeletonName/BoneName" then BoneName
        const key1 = tgt._skeleton ? `${tgt._skeleton.name}/${tgt.name}` : null;
        newTarget = (key1 && maps.boneMap.get(key1)) || maps.boneMap.get(tgt.name) || null;
      }
      // MorphTarget target (blendshapes)
      else if (tgt && typeof tgt.getClassName === "function" && tgt.getClassName() === "MorphTarget") {
        const targets = window.findRetargetMorphTargets ? window.findRetargetMorphTargets(maps, tgt) : [];
        if (!targets.length) { morphUnmatched++; continue; }
        morphMatched += targets.length;
        for (const t of targets) dst.addTargetedAnimation(anim, t);
        continue;
      }
      else if (tgt && tgt.name) {
        // Node target
        newTarget = maps.nodeMap.get(tgt.name) || null;
      }

      if (newTarget) dst.addTargetedAnimation(anim, newTarget);
      console.log(`[RetargetMorph] matched=${morphMatched} unmatched=${morphUnmatched}`);
    }
    
    // Copy group-level settings
    dst.loopAnimation = true;
    if (opts && typeof opts.speedRatio === "number") dst.speedRatio = opts.speedRatio;

    return dst;
  }

  async function loadDroppedFile(scene, file) {
    // Babylon can load File objects via "file:" rootUrl
    return BABYLON.SceneLoader.LoadAssetContainerAsync("file:", file, scene);
  }

  function stopAndDispose(groups) {
    if (!groups) return;
    for (const g of groups) {
      try { g.stop(); } catch (_) {}
      try { g.dispose(); } catch (_) {}
    }
  }

  function debugAvatarMorphs(avatarRoot, maps) {
    const meshes = avatarRoot.getChildMeshes ? avatarRoot.getChildMeshes(false) : [];
    let totalTargets = 0;
    const byMesh = [];

    for (const m of meshes) {
      const mtm = m.morphTargetManager;
      if (!mtm || !mtm.numTargets) continue;
      totalTargets += mtm.numTargets;
      byMesh.push({
        mesh: m.name,
        targets: mtm.numTargets,
        names: Array.from({ length: mtm.numTargets }, (_, i) => mtm.getTarget(i)?.name)
      });
    }

    console.log("[Avatar] morph meshes:", byMesh.length, "total morph targets:", totalTargets);
    byMesh.slice(0, 10).forEach(x => console.log("[Avatar] mesh:", x.mesh, "targets:", x.targets, x.names?.slice(0, 20)));
    console.log("[Avatar] morphMap sample keys:", Array.from(maps.morphMap.keys()).slice(0, 30));
  }

  window.setupAnimDrop = function setupAnimDrop(scene, avatarRoot, opts = {}) {
    if (!scene || !avatarRoot) throw new Error("setupAnimDrop(scene, avatarRoot) requires both arguments.");

    const ui = makeDropUI();
    const maps = buildAvatarMaps(avatarRoot);
    console.log("[Avatar] morphMap keys (sample):", Array.from(maps.morphMap.keys()).slice(0, 80));
    console.log("[Avatar] morphMap key count:", maps.morphMap.size);
    debugAvatarMorphs(avatarRoot, maps);
    let currentGroups = [];

    function setUI(text) { ui.textContent = text; }

    async function handleFile(file) {
      console.log("[Drop] file=", file);
      if (!file) return;
      const name = (file.name || "").toLowerCase();
      if (!name.endsWith(".glb") && !name.endsWith(".gltf")) {
        setUI("Drop a .glb or .gltf file");
        return;
      }

      setUI("Loading animations...");
      let container;
      try {
        container = await loadDroppedFile(scene, file);
      } catch (e) {
        console.error(e);
        setUI("Load failed (see console)");
        return;
      }

      const srcGroups = container.animationGroups || [];
      if (!srcGroups.length) {
        container.dispose();
        setUI("No animations found in file");
        return;
      }

      // DEBUG: summarize targets inside the dropped animation groups
      for (const g of srcGroups) {
        let bone = 0, morph = 0, node = 0, other = 0;
        for (const ta of g.targetedAnimations) {
          const t = ta.target;
          const cls = t?.getClassName?.();
          if (cls === "Bone") bone++;
          else if (cls === "MorphTarget") morph++;
          else if (t?.name) node++;
          else other++;
        }
        console.log(`[Drop] group="${g.name}" targetedAnimations=${g.targetedAnimations.length} bone=${bone} morph=${morph} node=${node} other=${other}`);
      }

      const sample = srcGroups[0].targetedAnimations
        .filter(ta => ta.target?.getClassName?.() === "MorphTarget")
        .slice(0, 30)
        .map(ta => ta.target.name);
      console.log("[Drop] morph target sample:", sample);


      stopAndDispose(currentGroups);
      currentGroups = [];

      for (const g of srcGroups) {
        const rg = retargetAnimationGroup(g, maps, opts);
        currentGroups.push(rg);
      }

      // DEBUG: sample a few targets from the first retargeted group
      const first = currentGroups[0];
      if (first) {
        console.log(`[Retarget] firstGroup="${first.name}" targetedAnimations=${first.targetedAnimations.length}`);
        first.targetedAnimations.slice(0, 30).forEach(ta => {
          const t = ta.target;
          console.log("[Retarget] targetClass=", t?.getClassName?.(), "targetName=", t?.name, "prop=", ta.animation?.targetProperty);
        });
      }

      container.dispose(); // we only needed its animations

      if (opts.autoStart !== false) {
        currentGroups.forEach(g => g.play(true));
      }

      setUI(`Loaded ${currentGroups.length} anim group(s). (Drop another to replace)`);
    }

    // Drag/drop events
    window.addEventListener("dragover", (e) => { e.preventDefault(); setUI("Release to load animation"); });
    window.addEventListener("dragleave", (e) => { e.preventDefault(); setUI("Drop animation .glb/.gltf here"); });
    window.addEventListener("drop", async (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      await handleFile(file);
    });

    // Optional: expose controls
    return {
      play: (idx = 0) => currentGroups[idx]?.play(true),
      stop: () => currentGroups.forEach(g => g.stop()),
      list: () => currentGroups.map(g => g.name),
    };
  };
})();
