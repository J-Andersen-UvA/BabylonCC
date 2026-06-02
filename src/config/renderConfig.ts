export const RENDER_CONFIG = {
  hardwareScalingLevel: 1,
  clearColor: "#1F242BFF",
  imageProcessing: {
    toneMappingEnabled: false,
    exposure: 1.0,
    contrast: 1.0,
  },
  lighting: {
    environmentUrl: "/environment.env",
    iblIntensity: 0.35,
    sunIntensity: 3.0,
    sunDirection: { x: -0.4, y: -1.0, z: -0.3 },
    hemiFillEnabled: true,
    hemiIntensity: 0.25,
    hemiGroundColor: "#262626",
    hemiDiffuseColor: "#FFFFFF",
    hemiSpecularColor: "#333333",
  },
  shadows: {
    mapSize: 2048,
    usePercentageCloserFiltering: true,
  },
  environmentBackground: {
    useGroundProjection: false,
    groundProjectionSize: 1000,
    groundProjectionRadius: 20,
    groundProjectionHeight: 1.5,
  },
};
