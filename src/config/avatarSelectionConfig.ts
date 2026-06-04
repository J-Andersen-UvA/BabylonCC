export type AvatarSelectionConfig = {
  id: string;
  name: string;
  glbUrl: string;
  thumbnailUrl: string;
  idleAnimationPath?: string;
};

export const AVATAR_DEFAULT_STORAGE_KEY = "babyloncc.defaultAvatarId";

export const AVATAR_SELECTION_CONFIG: AvatarSelectionConfig[] = [
  {
    id: "palmer-polo",
    name: "Palmer Polo",
    glbUrl: "/PalmerPolo.glb",
    thumbnailUrl: "/thumbnails/Palmer.png",
    idleAnimationPath: "/files/anims/idle/palmer_Idle.glb",
  },
  {
    id: "digits",
    name: "Digits",
    glbUrl: "/Digits.glb",
    thumbnailUrl: "/thumbnails/Digits.png",
  },
];

export function getAvatarById(id: string | null) {
  if (!id) return null;
  return AVATAR_SELECTION_CONFIG.find(avatar => avatar.id === id) ?? null;
}
