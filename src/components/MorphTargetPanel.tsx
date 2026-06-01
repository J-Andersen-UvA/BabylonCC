import { useCallback, useMemo, useState } from "react";
import type * as BABYLON from "@babylonjs/core";
import "./MorphTargetPanel.css";

interface MorphTargetPanelProps {
  avatarRoot: BABYLON.TransformNode | null;
  meshName?: string;
  meshNames?: string[];
}

interface MorphControl {
  id: string;
  name: string;
  influence: number;
  targets: BABYLON.MorphTarget[];
}

const DEFAULT_MESH_NAMES = ["cc_base_body_primitive0", "cc_base_body_primitive1", "cc_base_body_primitive2", "cc_base_body_primitive3", "cc_base_body_primitive4", "cc_base_body_primitive5", "male_brow_2_primitive0", "male_brow_2_primitive1"];

function resolveMeshNames(meshName?: string, meshNames?: string[]) {
  if (meshNames?.length) return meshNames;
  if (meshName) return [meshName];

  return DEFAULT_MESH_NAMES;
}

function findMeshByName(
  avatarRoot: BABYLON.TransformNode | null,
  meshName: string
): BABYLON.AbstractMesh | null {
  if (!avatarRoot) return null;

  const normalizedMeshName = meshName.toLowerCase();
  const rootMesh = avatarRoot as BABYLON.AbstractMesh;
  if (rootMesh.name.toLowerCase() === normalizedMeshName && rootMesh.morphTargetManager) {
    return rootMesh;
  }

  const descendants = avatarRoot.getChildMeshes(false);
  const sceneMeshes = avatarRoot.getScene().meshes;

  return (
    descendants.find((mesh) => mesh.name.toLowerCase() === normalizedMeshName) ??
    sceneMeshes.find((mesh) => mesh.name.toLowerCase() === normalizedMeshName) ??
    null
  );
}

function collectMeshMorphTargets(mesh: BABYLON.AbstractMesh | null): BABYLON.MorphTarget[] {
  const manager = mesh?.morphTargetManager;
  if (!manager) return [];

  const targets: BABYLON.MorphTarget[] = [];

  for (let index = 0; index < manager.numTargets; index += 1) {
    targets.push(manager.getTarget(index));
  }

  return targets;
}

function collectMorphControls(meshes: BABYLON.AbstractMesh[]): MorphControl[] {
  const visibleMesh = meshes[0] ?? null;
  const visibleTargets = collectMeshMorphTargets(visibleMesh);
  const linkedTargetsByMesh = meshes.slice(1).map((mesh) => collectMeshMorphTargets(mesh));

  return visibleTargets.map((target, index) => {
    const targetName = target.name.toLowerCase();
    const linkedTargets = linkedTargetsByMesh
      .map((targets) => {
        const matchByName = targets.find((candidate) => candidate.name.toLowerCase() === targetName);
        return matchByName ?? targets[index] ?? null;
      })
      .filter((match): match is BABYLON.MorphTarget => !!match);

    return {
      id: `${visibleMesh?.uniqueId ?? "mesh"}-${index}-${target.name}`,
      name: target.name || `Morph ${index + 1}`,
      influence: target.influence,
      targets: [target, ...linkedTargets],
    };
  });
}

function resetAllMorphTargets(meshes: BABYLON.AbstractMesh[]) {
  meshes.forEach((mesh) => {
    collectMeshMorphTargets(mesh).forEach((target) => {
      target.influence = 0;
    });
  });
}

export function MorphTargetPanel({
  avatarRoot,
  meshName,
  meshNames,
}: MorphTargetPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const resolvedMeshNames = useMemo(
    () => resolveMeshNames(meshName, meshNames),
    [meshName, meshNames]
  );

  const meshes = useMemo(
    () =>
      resolvedMeshNames
        .map((name) => findMeshByName(avatarRoot, name))
        .filter((mesh): mesh is BABYLON.AbstractMesh => !!mesh),
    [avatarRoot, resolvedMeshNames]
  );

  const morphs = useMemo(() => {
    return collectMorphControls(meshes);
  }, [meshes, refreshKey]);

  const filteredMorphs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return morphs;

    return morphs.filter((morph) => morph.name.toLowerCase().includes(normalizedQuery));
  }, [morphs, query]);

  const setMorphInfluence = useCallback((morph: MorphControl, value: number) => {
    morph.targets.forEach((target) => {
      target.influence = value;
    });
    setRefreshKey((current) => current + 1);
  }, []);

  const resetMorphs = useCallback(() => {
    resetAllMorphTargets(meshes);
    setRefreshKey((current) => current + 1);
  }, [meshes]);

  const visibleMeshName = resolvedMeshNames[0] ?? "Morph mesh";
  const missingMeshCount = resolvedMeshNames.length - meshes.length;

  return (
    <>
      <button
        className="morph-panel-toggle"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "Close Morphs" : "Morph Targets"}
      </button>

      <div className={`morph-panel ${isOpen ? "" : "hidden"}`}>
        <div className="morph-panel-header">
          <div>
            <div className="morph-panel-title">Morph Targets</div>
            <div className="morph-panel-subtitle">
              {visibleMeshName}
              {meshes.length > 1 ? ` + ${meshes.length - 1} linked` : ""}
            </div>
          </div>
          <button
            className="morph-panel-reset"
            type="button"
            onClick={resetMorphs}
            disabled={!morphs.length}
          >
            Reset
          </button>
        </div>

        {!meshes.length && <div className="morph-panel-empty">Meshes not found.</div>}

        {!!meshes.length && !morphs.length && (
          <div className="morph-panel-empty">No morph targets found.</div>
        )}

        {!!missingMeshCount && !!meshes.length && (
          <div className="morph-panel-note">
            {missingMeshCount} linked mesh{missingMeshCount === 1 ? "" : "es"} not found.
          </div>
        )}

        {!!morphs.length && (
          <>
            <input
              className="morph-panel-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter morphs"
            />

            <div className="morph-panel-list">
              {filteredMorphs.map((morph) => (
                <label className="morph-row" key={morph.id}>
                  <span className="morph-row-name" title={morph.name}>
                    {morph.name}
                  </span>
                  <input
                    className="morph-row-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={morph.influence}
                    onChange={(event) => setMorphInfluence(morph, Number(event.target.value))}
                  />
                  <span className="morph-row-value">{morph.influence.toFixed(2)}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
