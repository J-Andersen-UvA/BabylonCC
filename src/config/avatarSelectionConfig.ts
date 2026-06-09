export type AvatarSelectionConfig = {
  id: string;
  name: string;
  glbUrl: string;
  thumbnailUrl: string;
  idleAnimationPath?: string;
};

export const AVATAR_DEFAULT_STORAGE_KEY = "babyloncc.defaultAvatarId";

export const AVATAR_SELECTION_CONFIG: AvatarSelectionConfig[] = [
  // {
  //   id: "palmer-polo",
  //   name: "Palmer Polo",
  //   glbUrl: "/PalmerPolo.glb",
  //   thumbnailUrl: "/thumbnails/Palmer.png",
  //   idleAnimationPath: "/files/anims/idle/palmer_Idle.glb",
  // },
  {
    id: "palmer-polo-1024-uastc",
    name: "Palmer Polo 1024 UASTC",
    glbUrl: "/PalmerPolo1024uastc.glb",
    thumbnailUrl: "/thumbnails/Palmer.png",
    idleAnimationPath: "/files/anims/idle/palmer_Idle.glb",
  },
  {
    id: "mitt-1024-uastc",
    name: "Mitt 1024 UASTC",
    glbUrl: "/Mitt1024uastc.glb",
    thumbnailUrl: "/thumbnails/Mitt.png",
    idleAnimationPath: "/files/anims/idle/fem_Idle.glb",
  },
  // {
  //   id: "digits",
  //   name: "Digits",
  //   glbUrl: "/Digits.glb",
  //   thumbnailUrl: "/thumbnails/Digits.png",
  // },
  {
    id: "digits-1024-uastc",
    name: "Digits 1024 UASTC",
    glbUrl: "/Digits1024uastc.glb",
    thumbnailUrl: "/thumbnails/Digits.png",
    idleAnimationPath: "/files/anims/idle/fem_Idle.glb",
  }
];

export function getAvatarById(id: string | null) {
  if (!id) return null;
  return AVATAR_SELECTION_CONFIG.find(avatar => avatar.id === id) ?? null;
}
