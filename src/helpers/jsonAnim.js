// jsonAnim.js
// Drag & drop morph animation JSON onto the page.
// Optional CSV mapping (ARKit -> Targets) is auto-loaded if present.
console.log("[jsonAnim] loaded");
console.log("[jsonAnim] VERSION 2026-02-02-4");

(async function () {
  async function tryLoadText(url) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      return await r.text();
    } catch {
      return null;
    }
  }

  function parseSimpleCsvMapping(text) {
    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("#"));

    const map = new Map();
    if (lines.length === 0) return map;

    const header = lines[0].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const idxARKit = header.findIndex(h => h.toLowerCase() === "arkit");
    const idxTargets = header.findIndex(h => h.toLowerCase() === "targets");
    const hasHeader = idxARKit !== -1 && idxTargets !== -1;

    const start = hasHeader ? 1 : 0;

    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 2) continue;

      let a, b;

      if (hasHeader) {
        a = cols[idxARKit];
        b = cols[idxTargets];
      } else {
        a = cols[0];
        b = cols[1];
      }

      if (!a || !b) continue;

      // case-insensitive key
      map.set(a.toLowerCase(), b);
    }

    return map;
  }

  function buildMorphMapAllMeshes(avatarRoot) {
    const map = new Map(); // lowercased name -> MorphTarget[]
    for (const m of avatarRoot.getChildMeshes(false)) {
      const mtm = m.morphTargetManager;
      if (!mtm) continue;
      for (let i = 0; i < mtm.numTargets; i++) {
        const t = mtm.getTarget(i);
        if (!t?.name) continue;
        const key = t.name.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(t);
      }
    }
    return map;
  }

  function curveNames(json) {
    if (json.curves) return Object.keys(json.curves);
    if (json.morphCurves) return Object.keys(json.morphCurves);
    if (Array.isArray(json.channels)) return json.channels.map(c => c?.name).filter(Boolean);
    return [];
  }

  function curvePairs(json, name) {
    if (json.curves?.[name]) return json.curves[name];
    if (json.morphCurves?.[name]) return json.morphCurves[name];
    if (Array.isArray(json.channels)) {
      const c = json.channels.find(x => x.name === name);
      if (!c?.keys) return null;
      return c.keys.map(k => [k.t ?? k.time, k.v ?? k.value]);
    }
    return null;
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

    const ui = makeDropUI();
    let currentGroup = null;
    let nameMap = null;

    (async () => {
      const url = opts.mappingUrl || "./CCARKitMapping.csv";
      const txt = await tryLoadText(url);
      if (!txt) {
        console.log("[jsonAnim] mapping not found:", url);
        return;
      }
      nameMap = parseSimpleCsvMapping(txt);
      console.log("[jsonAnim] mapping loaded:", url, "rows:", nameMap.size);
      console.log("[jsonAnim] mapping sample:", [...nameMap.entries()].slice(0, 10));
    })();

    async function handleFile(file) {
      console.log("[jsonAnim] file dropped:", file?.name);
      if (!file || !file.name.toLowerCase().endsWith(".json")) return;

      ui.textContent = "Loading…";

      const json = JSON.parse(await file.text());
      stopAndDispose(currentGroup);

      const fps = Number.isFinite(json.fps) ? json.fps : 60;
      const morphMap = buildMorphMapAllMeshes(avatarRoot);

      console.log("[jsonAnim] morphMap keys (sample):", [...morphMap.keys()].slice(0, 10));
      console.log("[jsonAnim] morphMap key count:", morphMap.size);

      const group = new BABYLON.AnimationGroup("jsonMorphs", scene);

      let matched = 0;
      const unmatched = [];

      for (const srcName of curveNames(json)) {
        const pairs = curvePairs(json, srcName);
        if (!pairs || pairs.length < 2) continue;

        const mappedName = (nameMap?.get(srcName.toLowerCase()) || srcName).toLowerCase();
        const targets = morphMap.get(mappedName);

        if (!targets || targets.length === 0) {
          if (unmatched.length < 10) console.log("[jsonAnim] no target for:", srcName, "->", mappedName);
          unmatched.push(srcName);
          continue;
        }

        const keys = pairs
          .map(([t, v]) => ({ t: Number(t), v: Number(v) }))
          .filter(k => Number.isFinite(k.t) && Number.isFinite(k.v))
          .sort((a, b) => a.t - b.t);

        if (keys.length < 2) continue;

        const maxT = keys[keys.length - 1].t;
        const timeIsSeconds = maxT <= 300;

        for (const mt of targets) {
          const anim = new BABYLON.Animation(
            "mt_" + srcName,
            "influence",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
          );

          anim.setKeys(
            keys.map(k => ({
              frame: timeIsSeconds ? (k.t * fps) : k.t,
              value: k.v,
            }))
          );

          group.addTargetedAnimation(anim, mt);
          matched++;
        }
      }

      console.log("[jsonAnim] matched:", matched, "unmatched_count:", unmatched.length);
      console.log("[jsonAnim] unmatched sample:", unmatched.slice(0, 25));

      currentGroup = group;

      group.start(opts.loop !== false, 1.0);
      if (typeof opts.speedRatio === "number") group.speedRatio = opts.speedRatio;

      ui.textContent = "Morph anim playing";
      console.log("[jsonAnim] targetedAnimations:", group.targetedAnimations.length);
    }

    window.addEventListener("dragover", e => e.preventDefault(), { capture: true });
    window.addEventListener("drop", e => {
      e.preventDefault();
      handleFile(e.dataTransfer?.files?.[0]);
    }, { capture: true });

    return {
      stop: () => currentGroup?.stop(),
      play: () => currentGroup?.play(),
      dispose: () => stopAndDispose(currentGroup),
    };
  };
})();
