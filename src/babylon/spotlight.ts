import {
  Scene,
  SpotLight,
  Vector3,
  Color3,
  ShadowGenerator,
  AbstractMesh,
  TransformNode,
} from "@babylonjs/core";

export function addAvatarSpotlight(
  scene: Scene,
  avatar: AbstractMesh,
  options?: {
    height?: number;
    forward?: number;
    angleDeg?: number;
    exponent?: number;
    intensity?: number;
    color?: Color3;
    castShadows?: boolean;
    shadowMapSize?: number;
    range?: number;
  }
) {
  const {
    height = 2.2,
    forward = 1.2,
    angleDeg = 40,
    exponent = 3,
    intensity = 2.2,
    color = new Color3(1, 1, 1),
    castShadows = false,
    shadowMapSize = 1024,
    range = 20,
  } = options ?? {};

  const degToRad = (d: number) => (d * Math.PI) / 180;

  // Rig follows the avatar
  const rig = new TransformNode("avatarLightRig", scene);
  rig.parent = avatar;
  rig.position = Vector3.Zero();

  // Light position in avatar-local space (above + slightly in front)
  const spot = new SpotLight(
    "avatarSpot",
    new Vector3(0, height, forward),
    new Vector3(0, -1, -0.25).normalize(),
    degToRad(angleDeg),
    exponent,
    scene
  );

  spot.parent = rig;
  spot.intensity = intensity;
  spot.diffuse = color;
  spot.specular = color;
  spot.range = range;

  // Optional: more natural falloff
  spot.falloffType = SpotLight.FALLOFF_GLTF;

  let shadowGen: ShadowGenerator | undefined;

  if (castShadows) {
    shadowGen = new ShadowGenerator(shadowMapSize, spot);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;
    shadowGen.setDarkness(0.3);

    shadowGen.addShadowCaster(avatar, true);
  }

  // Keep aiming at the avatar even if it animates/moves
  const obs = scene.onBeforeRenderObservable.add(() => {
    const targetWorld = avatar.getBoundingInfo().boundingBox.centerWorld;
    spot.setDirectionToTarget(targetWorld);
  });

  const dispose = () => {
    scene.onBeforeRenderObservable.remove(obs);
    shadowGen?.dispose();
    spot.dispose();
    rig.dispose();
  };

  return { spot, shadowGen, rig, dispose };
}
