// Mesh configuration for avatar loading
// Meshes containing these strings in their names will be disabled/hidden

export const EXCLUDED_MESH_NAMES = [
  "cc_base_eyeocclusion",
  "cc_base_tear_ducts",
  "cc_base_tearline",
  "chin_curtain_sparse",
  "male_bushy",
  "mustache_horseshoe",
  "stubble_neck",
  "cc_base_eye_primitive1",
  "cc_base_eye_primitive3",
];

// export const AVATAR_MATERIAL_CONFIG = {
//   specularIntensity: 0,
//   environmentIntensity: 0.08,
//   roughness: 0.88,
//   metallic: 0,
// };

// More specular studio-test preset:
export const AVATAR_MATERIAL_CONFIG = {
  specularIntensity: 0.15,
  environmentIntensity: 0.25,
  roughness: 0.48,
  metallic: 0,
};

export const AVATAR_MATERIAL_RULES = {
  alphaBlendRules: [
    {
      nameIncludes: [
        "hair",
      ],
      backFaceCulling: true,
      renderingGroupId: 0,
    },
    {
      nameIncludes: [
        "eyelash",
      ],
    },
  ],
  opaqueFallback: true,
  roughnessOverrides: [
    {
      nameIncludes: [
        "ss_slash_neck_top",
      ],
      minimumRoughness: 0.64,
    },
    {
      nameIncludes: [
        "beard",
        "brow",
        "female_angled"
      ],
      minimumRoughness: 0.6,
    },
  ],
  scalp: {
    nameIncludes: [
      "scalp",
    ],
    renderingGroupId: 0,
    alphaIndex: 0,
  },
};

/**
 * Check if a mesh name matches any exclusion pattern
 */
export function shouldExcludeMesh(meshName: string): boolean {
  const lowerName = meshName.toLowerCase();
  return EXCLUDED_MESH_NAMES.some(excluded => 
    lowerName.includes(excluded.toLowerCase())
  );
}
