import * as BABYLON from "@babylonjs/core";
import "./BackdropColorPanel.css";

const SWATCHES = ["#36383b", "#59524a", "#6b6964", "#7c817d", "#4c5a60", "#74665f"];

function color3ToHex(color: BABYLON.Color3) {
  return color.toHexString();
}

function hexToColor3(hex: string) {
  return BABYLON.Color3.FromHexString(hex);
}

type BackdropColorPanelProps = {
  material: BABYLON.PBRMaterial | null;
};

export function BackdropColorPanel({ material }: BackdropColorPanelProps) {
  if (!material) return null;

  const currentColor = color3ToHex(material.albedoColor);

  const setColor = (hex: string) => {
    material.albedoColor = hexToColor3(hex);
    console.log("[Backdrop] color:", hex);
  };

  return (
    <div className="backdrop-color-panel">
      <div className="backdrop-color-title">Backdrop</div>
      <label className="backdrop-color-row">
        <span>Color</span>
        <input
          type="color"
          value={currentColor}
          onChange={event => setColor(event.target.value)}
        />
      </label>
      <div className="backdrop-color-swatches">
        {SWATCHES.map(color => (
          <button
            key={color}
            type="button"
            className="backdrop-color-swatch"
            style={{ backgroundColor: color }}
            aria-label={`Set backdrop color ${color}`}
            onClick={() => setColor(color)}
          />
        ))}
      </div>
    </div>
  );
}
