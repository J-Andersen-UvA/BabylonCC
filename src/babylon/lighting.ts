import {
  AbstractMesh,
  BackgroundMaterial,
  Color3,
  CubeTexture,
  DirectionalLight,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  SpotLight,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";

export type SetupLightingOptions = {
  environmentUrl?: string;
  useHemiFill?: boolean;
  shadowCasters?: AbstractMesh[];
  shadowReceivers?: AbstractMesh[];
  sunDirection?: Vector3;
  exposure?: number;
  iblIntensity?: number;
  sunIntensity?: number;
  useGroundProjection?: boolean;
  groundProjectionSize?: number;
  groundProjectionRadius?: number;
  groundProjectionHeight?: number;
  toneMappingEnabled?: boolean;
  contrast?: number;
  shadowMapSize?: number;
  usePercentageCloserFiltering?: boolean;
  hemiIntensity?: number;
  hemiGroundColor?: Color3;
  hemiDiffuseColor?: Color3;
  hemiSpecularColor?: Color3;
  studioThreePoint?: {
    enabled?: boolean;
    target: Vector3;
    key: StudioLightOptions;
    fill: StudioLightOptions;
    rim: StudioLightOptions;
  };
};

type StudioLightOptions = {
  position: Vector3;
  intensity: number;
  color: Color3;
  angle: number;
  exponent: number;
};

export type LightingRig = {
  sun: DirectionalLight;
  hemi?: HemisphericLight;
  shadowGenerator: ShadowGenerator;
  environmentTexture?: CubeTexture;
  skybox?: Mesh;
  backgroundMaterial?: BackgroundMaterial;
  addShadowCaster: (mesh: AbstractMesh) => void;
  setShadowReceiver: (mesh: AbstractMesh, receive: boolean) => void;
  dispose: () => void;
};

export function setupLighting(scene: Scene, opts: SetupLightingOptions = {}): LightingRig {
  const {
    environmentUrl = "https://playground.babylonjs.com/textures/environment.env",
    useHemiFill = true,
    shadowCasters = [],
    shadowReceivers = [],
    sunDirection = new Vector3(-0.4, -1.0, -0.3),
    exposure = 1.0,
    iblIntensity = 0.35,
    sunIntensity = 3.0,
    useGroundProjection = true,
    groundProjectionSize = 1000,
    groundProjectionRadius = 20,
    groundProjectionHeight = 1.5,
    toneMappingEnabled = false,
    contrast = 1.0,
    shadowMapSize = 2048,
    usePercentageCloserFiltering = true,
    hemiIntensity = 0.25,
    hemiGroundColor = new Color3(0.15, 0.15, 0.15),
    hemiDiffuseColor = new Color3(1, 1, 1),
    hemiSpecularColor = new Color3(0.2, 0.2, 0.2),
    studioThreePoint,
  } = opts;

  let environmentTexture: CubeTexture | undefined;
  let skybox: Mesh | null = null;
  let backgroundMaterial: BackgroundMaterial | null = null;

  scene.environmentIntensity = iblIntensity;

  scene.imageProcessingConfiguration.toneMappingEnabled = toneMappingEnabled;
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = exposure;
  scene.imageProcessingConfiguration.contrast = contrast;

  if (environmentUrl) {
    environmentTexture = CubeTexture.CreateFromPrefilteredData(environmentUrl, scene);

    environmentTexture.onLoadObservable.addOnce(() => {
      if (scene.isReady(false) === false) return;

      scene.environmentTexture = environmentTexture!;

      if (useGroundProjection) {
        skybox?.dispose();
        backgroundMaterial?.dispose();

        skybox = MeshBuilder.CreateBox("environmentSkybox", { size: groundProjectionSize }, scene);
        skybox.isPickable = false;
        skybox.infiniteDistance = true;

        backgroundMaterial = new BackgroundMaterial("environmentBackground", scene);
        backgroundMaterial.reflectionTexture = environmentTexture!;
        backgroundMaterial.enableGroundProjection = true;
        backgroundMaterial.projectedGroundRadius = groundProjectionRadius;
        backgroundMaterial.projectedGroundHeight = groundProjectionHeight;

        skybox.material = backgroundMaterial;
      }
    });
  }

  const sun = new DirectionalLight("sun", sunDirection.normalize(), scene);
  sun.intensity = sunIntensity;
  sun.position = new Vector3(50, 80, 50);
  sun.shadowMinZ = 0.1;
  sun.shadowMaxZ = 250;

  const shadowGenerator = new ShadowGenerator(shadowMapSize, sun);
  shadowGenerator.usePercentageCloserFiltering = usePercentageCloserFiltering;
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;

  for (const mesh of shadowCasters) {
    shadowGenerator.addShadowCaster(mesh);
  }

  for (const mesh of shadowReceivers) {
    (mesh as Mesh).receiveShadows = true;
  }

  let hemi: HemisphericLight | undefined;
  if (useHemiFill) {
    hemi = new HemisphericLight("hemiFill", new Vector3(0, 1, 0), scene);
    hemi.intensity = hemiIntensity;
    hemi.groundColor = hemiGroundColor;
    hemi.diffuse = hemiDiffuseColor;
    hemi.specular = hemiSpecularColor;
  }

  const studioLights: SpotLight[] = [];

  const createStudioLight = (name: string, lightOpts: StudioLightOptions, target: Vector3) => {
    const direction = target.subtract(lightOpts.position).normalize();
    const light = new SpotLight(
      name,
      lightOpts.position,
      direction,
      lightOpts.angle,
      lightOpts.exponent,
      scene
    );

    light.intensity = lightOpts.intensity;
    light.diffuse = lightOpts.color;
    light.specular = lightOpts.color;
    studioLights.push(light);
  };

  if (studioThreePoint && studioThreePoint.enabled !== false) {
    createStudioLight("studioKey", studioThreePoint.key, studioThreePoint.target);
    createStudioLight("studioFill", studioThreePoint.fill, studioThreePoint.target);
    createStudioLight("studioRim", studioThreePoint.rim, studioThreePoint.target);
  }

  const addShadowCaster = (mesh: AbstractMesh) => {
    shadowGenerator.addShadowCaster(mesh);
  };

  const setShadowReceiver = (mesh: AbstractMesh, receive: boolean) => {
    (mesh as Mesh).receiveShadows = receive;
  };

  const dispose = () => {
    shadowGenerator.dispose();
    hemi?.dispose();
    studioLights.forEach(light => light.dispose());
    sun.dispose();
    backgroundMaterial?.dispose();
    skybox?.dispose();
    environmentTexture?.dispose();
  };

  return {
    sun,
    hemi,
    shadowGenerator,
    environmentTexture,
    skybox: skybox ?? undefined,
    backgroundMaterial: backgroundMaterial ?? undefined,
    addShadowCaster,
    setShadowReceiver,
    dispose,
  };
}
