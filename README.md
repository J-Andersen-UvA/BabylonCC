# BabylonCC

Babylon preview app for Character Creator avatars with separate body and facial animation loading.

## Animation Workflow

Use the `CCFBXToGLB` converter pipeline to create two files from the source FBX:

- `*_anim.glb` for the skeletal/body animation
- `*_shapekeys.json` for facial morph animation

In the app:

1. Load the body `*_anim.glb`.
2. Load the matching `*_shapekeys.json`.
3. Press `Load` to play both together.

The body animation is treated as the master timeline. Facial shapekey animation is stretched to the body duration when loaded, and playbar scrubbing maps body and face by normalized progress rather than raw frame number. This keeps face/body sync correct even when the source frame ranges differ.

The shapekey JSON is the maintained facial-animation format. It should look like:

```json
{
  "fps": 24,
  "frameRange": [1, 118],
  "shapeKeys": ["Eye_Blink_L", "Eye_Blink_R"],
  "animation": [
    {
      "frame": 1,
      "time": 0.0417,
      "weights": {
        "Eye_Blink_R": 0.2
      }
    }
  ]
}
```

The JSON may be sparse: missing weights are treated as `0` during playback.

## Morph Debug Panel

The `Morph Targets` panel lists morphs from the first configured mesh and links matching morph names across the remaining meshes, including brow/body primitives.

## Playbar

The bottom playbar controls loaded body and face animation together:

- Play/pause
- Frame scrubbing
- Speed cycling
- Left/right hand camera focus
- Keyboard shortcuts

Settings live in `src/config/playerControlsConfig.ts`. The hand focus bone names default to `hand_l` and `hand_r`. When hand focus is active, the camera follows that bone during animation.

## Configuration

Most project-specific tuning is kept in `src/config`.

- `cameraConfig.ts`: default camera orbit and avatar focus bones.
- `meshConfig.ts`: avatar mesh exclusions and avatar material overrides.
- `playerControlsConfig.ts`: playbar options, speed levels, shortcuts, hand-focus bones, and slider smoothing.
- `renderConfig.ts`: render scale, clear color, image processing, environment lighting, shadows, and studio three-point lights.

Avatar material settings are intentionally in `meshConfig.ts`, not `renderConfig.ts`, because they are avatar-loading behavior. Use `AVATAR_MATERIAL_CONFIG` there to tune roughness, specular intensity, metallic, and environment reflection response.

## Lighting

The scene uses environment lighting plus an optional configurable studio three-point setup from `renderConfig.ts`:

- Key light
- Fill light
- Rim light

For sharper rendering, lower `hardwareScalingLevel` in `renderConfig.ts`. `1.0` is sharper; larger values render faster but softer.
