import { useState } from 'react';

import type { HomeAppearance } from '../../hooks/useHomeAppearance';

interface HomeAppearanceSwitcherProps {
  current: HomeAppearance;
  onChange: (next: HomeAppearance) => void;
}

interface ThemeOption {
  id: HomeAppearance;
  label: string;
  icon: string;
  description: string;
}

const THEMES: ThemeOption[] = [
  { id: 'default', label: 'Mặc định', icon: '◈', description: 'Giao diện gốc — sáng, gọn.' },
  { id: 'doodle', label: 'Doodle', icon: '✏', description: 'Phong cách phác thảo tay.' },
  { id: 'paper', label: 'Paper', icon: '📜', description: 'Giấy ấm, mực kiểu cổ điển.' },
  { id: 'retrotune', label: 'RetroTune', icon: '📺', description: 'Màn hình phosphor retro.' },
];

export default function HomeAppearanceSwitcher({ current, onChange }: HomeAppearanceSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="home-appearance-dock" role="region" aria-label="Giao diện trang chủ">
      {/* Trigger pill */}
      <button
        type="button"
        id="home-appearance-trigger"
        aria-expanded={open}
        aria-controls="home-appearance-panel"
        aria-label="Đổi giao diện trang chủ"
        className="home-appearance-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="home-appearance-trigger-icon" aria-hidden="true">
          {THEMES.find((t) => t.id === current)?.icon ?? '◈'}
        </span>
        <span>{THEMES.find((t) => t.id === current)?.label ?? 'Mặc định'}</span>
        <span
          className={`home-appearance-chevron ${open ? 'is-open' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {/* Theme panel */}
      {open && (
        <div
          id="home-appearance-panel"
          role="listbox"
          aria-label="Chọn giao diện"
          className="home-appearance-panel"
        >
          {THEMES.map((theme) => {
            const active = current === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`home-appearance-option ${active ? 'is-active' : ''}`}
                onClick={() => {
                  onChange(theme.id);
                  setOpen(false);
                }}
              >
                <span className="home-appearance-option-icon" aria-hidden="true">
                  {theme.icon}
                </span>
                <span className="home-appearance-option-copy">
                  <strong>{theme.label}</strong>
                  <em>{theme.description}</em>
                </span>
                {active && (
                  <span className="home-appearance-option-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
