// src/mediapipe/mediaPipeValueProvider.ts
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type FaceLandmarkerOptions,
} from "@mediapipe/tasks-vision";

export type MediaPipeKey =
  | string
  | `blendshape.${string}`
  | `blendshapeCategory.${string}`
  | `landmark.${number}.x`
  | `landmark.${number}.y`
  | `landmark.${number}.z`
  | `landmark.${number}.visibility`
  | `landmark.${number}.presence`;

export type MediaPipeValues = Record<string, number | null>;

export interface MediaPipeValueProviderOptions {
  wasmBaseUrl?: string;
  modelUrl?: string;
  numFaces?: number;
  runningMode?: "VIDEO";
  minFaceDetectionConfidence?: number;
  minFacePresenceConfidence?: number;
  minTrackingConfidence?: number;

  /**
   * Exponential smoothing for blendshape values.
   * 0 = off, 0.5 = moderate, 0.85 = strong
   */
  blendshapeSmoothing?: number;

  /**
   * When true, both "mouthSmileLeft" and "blendshape.mouthSmileLeft"
   * are accepted and will resolve to the same value.
   */
  allowBareBlendshapeKeys?: boolean;
}

export interface MediaPipeValueProvider {
  init: () => Promise<void>;
  start: (video: HTMLVideoElement) => Promise<void>;
  stop: () => void;
  dispose: () => void;

  getValue: (key: MediaPipeKey) => number | null;
  getValues: (keys: MediaPipeKey[]) => MediaPipeValues;

  getLastResult: () => FaceLandmarkerResult | null;
  setEnabled: (enabled: boolean) => void;
}

type InternalStore = {
  blendshapesByNameLower: Map<string, number>;
  landmarksByIndex: Array<{
    x: number;
    y: number;
    z: number;
    visibility?: number;
    presence?: number;
  }>;
};

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function normalizeBlendshapeKey(key: string, allowBareBlendshapeKeys: boolean) {
  const raw = key.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower.startsWith("blendshape.")) return raw.slice("blendshape.".length).trim().toLowerCase();
  if (lower.startsWith("blendshapecategory.")) return raw.slice("blendshapecategory.".length).trim().toLowerCase();

  if (allowBareBlendshapeKeys) return raw.toLowerCase();
  return null;
}

function parseLandmarkKey(key: string) {
  const m = /^landmark\.(\d+)\.(x|y|z|visibility|presence)$/i.exec(key.trim());
  if (!m) return null;
  return { index: Number(m[1]), field: m[2].toLowerCase() as "x" | "y" | "z" | "visibility" | "presence" };
}

export function createMediaPipeValueProvider(options: MediaPipeValueProviderOptions = {}): MediaPipeValueProvider {
  const wasmBaseUrl =
    options.wasmBaseUrl ??
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

  const modelUrl =
    options.modelUrl ??
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

  const numFaces = options.numFaces ?? 1;
  const minFaceDetectionConfidence = options.minFaceDetectionConfidence ?? 0.5;
  const minFacePresenceConfidence = options.minFacePresenceConfidence ?? 0.5;
  const minTrackingConfidence = options.minTrackingConfidence ?? 0.5;

  const blendshapeSmoothing = clamp01(options.blendshapeSmoothing ?? 0);
  const allowBareBlendshapeKeys = options.allowBareBlendshapeKeys ?? true;

  let faceLandmarker: FaceLandmarker | null = null;
  let lastResult: FaceLandmarkerResult | null = null;

  let videoEl: HTMLVideoElement | null = null;
  let rafId: number | null = null;
  let enabled = true;

  const store: InternalStore = {
    blendshapesByNameLower: new Map(),
    landmarksByIndex: [],
  };

  async function init() {
    if (faceLandmarker) return;

    const vision = await FilesetResolver.forVisionTasks(wasmBaseUrl);

    const faceLandmarkerOptions: FaceLandmarkerOptions = {
      baseOptions: { modelAssetPath: modelUrl },
      runningMode: "VIDEO",
      numFaces,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence,
      minFacePresenceConfidence,
      minTrackingConfidence,
    };

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, faceLandmarkerOptions);
  }

  function ingestResult(result: FaceLandmarkerResult) {
    lastResult = result;

    store.landmarksByIndex = [];
    const firstFaceLandmarks = result.faceLandmarks?.[0];
    if (firstFaceLandmarks?.length) {
      store.landmarksByIndex = firstFaceLandmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
        presence: lm.presence,
      }));
    }

    const nextBlend = new Map<string, number>();
    const firstBlend = result.faceBlendshapes?.[0]?.categories;
    if (firstBlend?.length) {
      for (const c of firstBlend) {
        if (!c?.categoryName) continue;
        const nameLower = c.categoryName.toLowerCase();
        const score = typeof c.score === "number" ? c.score : 0;
        nextBlend.set(nameLower, score);
      }
    }

    if (blendshapeSmoothing > 0) {
      const alpha = blendshapeSmoothing;
      const allKeys = new Set<string>([
        ...store.blendshapesByNameLower.keys(),
        ...nextBlend.keys(),
      ]);

      for (const k of allKeys) {
        const prev = store.blendshapesByNameLower.get(k) ?? 0;
        const next = nextBlend.get(k) ?? 0;
        store.blendshapesByNameLower.set(k, prev * alpha + next * (1 - alpha));
      }
      return;
    }

    store.blendshapesByNameLower = nextBlend;
  }

  function tick() {
    if (!enabled || !faceLandmarker || !videoEl) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const v = videoEl;

    if (v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const nowMs = performance.now();
    const result = faceLandmarker.detectForVideo(v, nowMs);
    ingestResult(result);

    rafId = requestAnimationFrame(tick);
  }

  async function start(video: HTMLVideoElement) {
    await init();

    videoEl = video;

    if (rafId == null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function dispose() {
    stop();
    videoEl = null;
    lastResult = null;
    store.blendshapesByNameLower.clear();
    store.landmarksByIndex = [];

    try {
      faceLandmarker?.close();
    } catch {}
    faceLandmarker = null;
  }

  function getValue(key: MediaPipeKey): number | null {
    const keyStr = String(key);

    const landmark = parseLandmarkKey(keyStr);
    if (landmark) {
      const lm = store.landmarksByIndex[landmark.index];
      if (!lm) return null;
      const v = (lm as any)[landmark.field];
      return typeof v === "number" ? v : null;
    }

    const blendshapeNameLower = normalizeBlendshapeKey(keyStr, allowBareBlendshapeKeys);
    if (blendshapeNameLower) {
      return store.blendshapesByNameLower.get(blendshapeNameLower) ?? null;
    }

    return null;
  }

  function getValues(keys: MediaPipeKey[]): MediaPipeValues {
    const out: MediaPipeValues = {};
    for (const k of keys) out[String(k)] = getValue(k);
    return out;
  }

  function getLastResult() {
    return lastResult;
  }

  function setEnabled(nextEnabled: boolean) {
    enabled = nextEnabled;
  }

  return {
    init,
    start,
    stop,
    dispose,
    getValue,
    getValues,
    getLastResult,
    setEnabled,
  };
}