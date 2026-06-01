declare module "@mediapipe/tasks-vision" {
  export type FaceLandmarkerResult = any;
  export type FaceLandmarkerOptions = any;

  export const FilesetResolver: {
    forVisionTasks: (wasmBaseUrl: string) => Promise<any>;
  };

  export class FaceLandmarker {
    static createFromOptions(vision: any, options: FaceLandmarkerOptions): Promise<FaceLandmarker>;
    detectForVideo(video: HTMLVideoElement, nowMs: number): FaceLandmarkerResult;
    close(): void;
  }
}
