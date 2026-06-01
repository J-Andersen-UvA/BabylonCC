// jsonAnim.js
// Drag & drop morph animation JSON onto the page.
// Loads the CCFBXToGLB shapekey sidecar JSON format.
console.log("[jsonAnim] loaded");
console.log("[jsonAnim] VERSION 2026-06-01-shapekeys");

(async function () {
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

  function buildMorphMapAllMeshes(avatarRoot) {
    const map = new Map(); // lowercased name -> MorphTarget[]
    const meshes = new Set();

    if (avatarRoot) meshes.add(avatarRoot);
    if (avatarRoot.getChildMeshes) {
      avatarRoot.getChildMeshes(false).forEach(m => meshes.add(m));
    }
    if (avatarRoot.getScene) {
      avatarRoot.getScene().meshes.forEach(m => meshes.add(m));
    }

    for (const m of meshes) {
      const mtm = m.morphTargetManager;
      if (!mtm) continue;
      for (let i = 0; i < mtm.numTargets; i++) {
        addMorphTarget(map, mtm.getTarget(i));
      }
    }

    const scene = avatarRoot.getScene?.();
    if (scene?.morphTargetManagers) {
      for (const mtm of scene.morphTargetManagers) {
        if (!mtm) continue;
        for (let i = 0; i < mtm.numTargets; i++) {
          addMorphTarget(map, mtm.getTarget(i));
        }
      }
    }

    return map;
  }

  function curveNames(json) {
    if (Array.isArray(json.shapeKeys)) return json.shapeKeys.filter(Boolean);
    if (Array.isArray(json.animation) && json.animation[0]?.weights) {
      return Object.keys(json.animation[0].weights);
    }
    return [];
  }

  function getWeightValue(weights, name) {
    if (!weights) return undefined;
    if (weights[name] !== undefined) return weights[name];

    const wanted = compactMorphKey(name);
    const key = Object.keys(weights).find(k => compactMorphKey(k) === wanted);
    return key ? weights[key] : undefined;
  }

  function curvePairs(json, name) {
    if (Array.isArray(json.animation) && json.animation[0]?.weights) {
      return json.animation
        .map(frame => [frame.frame ?? frame.time, getWeightValue(frame.weights, name) ?? 0]);
    }
    return null;
  }

  function usesFrameNumbers(json) {
    return Array.isArray(json.animation) && json.animation[0]?.weights;
  }

  function stopAndDispose(group) {
    if (!group) return;
    try { group.stop(); } catch {}
    try { group.dispose(); } catch {}
  }

  function makeDropUI() {
    const el = document.createElement("div");
    el.textContent = "Drop morph anim JSON";
    Object.assign(el.style, {
      position: "fixed",
      left: "12px",
      top: "12px",
      zIndex: 9999,
      padding: "8px 10px",
      background: "rgba(0,0,0,0.45)",
      color: "#fff",
      fontSize: "12px",
      borderRadius: "8px",
      userSelect: "none",
    });
    document.body.appendChild(el);
    return el;
  }

  window.setupJsonMorphDrop = function setupJsonMorphDrop(scene, avatarRoot, opts = {}) {
    if (!scene || !avatarRoot) throw new Error("scene + avatarRoot required");

    // UI creation disabled - using React component instead
    const ui = opts.createUI !== false ? null : null; // makeDropUI();
    let currentGroup = null;

    async function handleFile(file, loadOpts = {}) {
      console.log("[jsonAnim] file dropped:", file?.name);
      if (!file || !file.name.toLowerCase().endsWith(".json")) {
        return { matched: 0, unmatchedCount: 0, targetedAnimations: 0 };
      }

      if (ui) ui.textContent = "Loading…";

      const json = JSON.parse(await file.text());
      stopAndDispose(currentGroup);

      if (!Array.isArray(json.animation) || !json.animation[0]?.weights) {
        console.error("[jsonAnim] Unsupported shapekey JSON format. Expected animation[] frames with weights objects.");
        return { matched: 0, unmatchedCount: 0, targetedAnimations: 0 };
      }

      const fps = Number.isFinite(json.fps) ? json.fps : 60;
      const forceFrameNumbers = usesFrameNumbers(json);
      const morphMap = buildMorphMapAllMeshes(avatarRoot);

      console.log("[jsonAnim] morphMap keys (sample):", [...morphMap.keys()].slice(0, 10));
      console.log("[jsonAnim] morphMap key count:", morphMap.size);

      const group = new BABYLON.AnimationGroup("jsonMorphs", scene);

      let matched = 0;
      const unmatched = [];

      for (const srcName of curveNames(json)) {
        const pairs = curvePairs(json, srcName);
        if (!pairs || pairs.length < 2) continue;

        const targets = morphMap.get(morphKey(srcName)) || morphMap.get(compactMorphKey(srcName)) || [];
        if (!targets.length) {
          if (unmatched.length < 10) console.log("[jsonAnim] no target for:", srcName);
          unmatched.push(srcName);
          continue;
        }

        const keys = pairs
          .map(([t, v]) => ({ t: Number(t), v: Number(v) }))
          .filter(k => Number.isFinite(k.t) && Number.isFinite(k.v))
          .sort((a, b) => a.t - b.t);

        if (keys.length < 2) continue;

        const maxT = keys[keys.length - 1].t;
        const timeIsSeconds = !forceFrameNumbers && maxT <= 300;
        const sourceFrames = keys.map(k => ({
          frame: timeIsSeconds ? (k.t * fps) : k.t,
          value: k.v,
        }));

        const firstFrame = sourceFrames[0].frame;
        const lastFrame = sourceFrames[sourceFrames.length - 1].frame;
        const sourceDurationFrames = Math.max(lastFrame - firstFrame, 0);
        const targetDurationSeconds = Number(loadOpts.targetDurationSeconds);
        const targetDurationFrames = Number.isFinite(targetDurationSeconds)
          ? targetDurationSeconds * fps
          : null;
        const stretch = targetDurationFrames && sourceDurationFrames > 0
          ? targetDurationFrames / sourceDurationFrames
          : 1;

        for (const mt of targets) {
          const anim = new BABYLON.Animation(
            "mt_" + srcName,
            "influence",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
          );

          anim.setKeys(
            sourceFrames.map(k => ({
              frame: firstFrame + ((k.frame - firstFrame) * stretch),
              value: k.value,
            }))
          );

          group.addTargetedAnimation(anim, mt);
          matched++;
        }
      }

      console.log("[jsonAnim] matched:", matched, "unmatched_count:", unmatched.length);
      console.log("[jsonAnim] unmatched sample:", unmatched.slice(0, 25));
      if (matched === 0) {
        console.log("[jsonAnim] source names sample:", curveNames(json).slice(0, 25));
        console.log("[jsonAnim] morphMap keys include eye blink r:", morphMap.has("eye_blink_r"), morphMap.has("eyeblinkr"));
        console.log("[jsonAnim] morphMap keys sample:", [...morphMap.keys()].slice(0, 80));
      }

      currentGroup = group;

      // Don't auto-play, let the UI control playback
      if (typeof opts.speedRatio === "number") group.speedRatio = opts.speedRatio;
      if (Number.isFinite(loadOpts.targetDurationSeconds)) {
        console.log("[jsonAnim] stretched to body duration seconds:", loadOpts.targetDurationSeconds);
      }

      if (ui) ui.textContent = "Morph anim loaded";
      console.log("[jsonAnim] targetedAnimations:", group.targetedAnimations.length);

      return {
        matched,
        unmatchedCount: unmatched.length,
        targetedAnimations: group.targetedAnimations.length,
      };
    }

    window.addEventListener("dragover", e => e.preventDefault(), { capture: true });
    window.addEventListener("drop", e => {
      e.preventDefault();
      handleFile(e.dataTransfer?.files?.[0]);
    }, { capture: true });

    return {
      stop: () => currentGroup?.stop(),
      play: () => {
        if (currentGroup) {
          currentGroup.start(opts.loop !== false, 1.0);
          return true;
        }
        console.warn("[jsonAnim] play requested before morph animation was loaded");
        return false;
      },
      dispose: () => stopAndDispose(currentGroup),
      loadFile: handleFile, // Expose for programmatic loading
    };
  };
})();
