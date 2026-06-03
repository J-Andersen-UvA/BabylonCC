import { useState } from "react";
import {
  AVATAR_DEFAULT_STORAGE_KEY,
  AVATAR_SELECTION_CONFIG,
  type AvatarSelectionConfig,
} from "../config/avatarSelectionConfig";
import "./AvatarSelectScreen.css";

type AvatarSelectScreenProps = {
  onSelect: (avatar: AvatarSelectionConfig) => void;
};

export function AvatarSelectScreen({ onSelect }: AvatarSelectScreenProps) {
  const [selectedId, setSelectedId] = useState(AVATAR_SELECTION_CONFIG[0]?.id ?? "");
  const [keepAsDefault, setKeepAsDefault] = useState(false);

  const selectedAvatar =
    AVATAR_SELECTION_CONFIG.find(avatar => avatar.id === selectedId) ?? AVATAR_SELECTION_CONFIG[0];

  const handleSelect = (avatar: AvatarSelectionConfig) => {
    setSelectedId(avatar.id);
  };

  const handleContinue = () => {
    if (!selectedAvatar) return;

    if (keepAsDefault) {
      localStorage.setItem(AVATAR_DEFAULT_STORAGE_KEY, selectedAvatar.id);
    }

    onSelect(selectedAvatar);
  };

  return (
    <main className="avatar-select-screen">
      <section className="avatar-select-shell" aria-labelledby="avatar-select-title">
        <h1 id="avatar-select-title">Choose your avatar</h1>

        <div className="avatar-select-grid">
          {AVATAR_SELECTION_CONFIG.map(avatar => {
            const isSelected = avatar.id === selectedAvatar?.id;

            return (
              <button
                key={avatar.id}
                type="button"
                className={`avatar-select-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => handleSelect(avatar)}
                aria-pressed={isSelected}
              >
                <span className="avatar-select-thumb-wrap">
                  <img src={avatar.thumbnailUrl} alt="" className="avatar-select-thumb" />
                </span>
                <span className="avatar-select-name">{avatar.name}</span>
              </button>
            );
          })}
        </div>

        <div className="avatar-select-actions">
          <label className="avatar-select-default">
            <input
              type="checkbox"
              checked={keepAsDefault}
              onChange={event => setKeepAsDefault(event.target.checked)}
            />
            <span>Keep as default</span>
          </label>

          <button type="button" className="avatar-select-continue" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </section>
    </main>
  );
}
