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
