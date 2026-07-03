import { useState } from 'react';

import { useI18n, type Language } from '../../i18n';
import type { HomeAppearance } from '../../hooks/useHomeAppearance';

interface HomeAppearanceSwitcherProps {
  current: HomeAppearance;
  onChange: (next: HomeAppearance) => void;
}

interface ThemeOption {
  id: HomeAppearance;
  label: Record<Language, string>;
  icon: string;
  description: Record<Language, string>;
}

const THEMES: ThemeOption[] = [
    {
    id: 'default',
    label: { en: 'Clean', vi: 'Cơ bản' },
    icon: '◈',
    description: { en: 'Original interface - bright and compact.', vi: 'Giao diện gốc - sáng, gọn.' },
  },
  {
    id: 'doodle',
    label: { en: 'Doodle', vi: 'Doodle' },
    icon: '✏',
    description: { en: 'Hand-sketched visual style.', vi: 'Phong cách phác thảo tay.' },
  },
  {
    id: 'paper',
    label: { en: 'Paper', vi: 'Paper' },
    icon: '▤',
    description: { en: 'Warm paper and classic ink.', vi: 'Giấy ấm, mực kiểu cổ điển.' },
  },
  {
    id: 'retrotune',
    label: { en: 'RetroTune', vi: 'RetroTune' },
    icon: '▣',
    description: { en: 'Retro phosphor screen.', vi: 'Màn hình phosphor retro.' },
  },
];

const switcherText: Record<Language, { region: string; trigger: string; choose: string; prefix: string; fallback: string }> = {
  en: {
    region: 'Home appearance',
    trigger: 'Change home appearance',
    choose: 'Choose appearance',
    prefix: 'Appearance',
    fallback: 'Clean',
  },
  vi: {
    region: 'Giao diện trang chủ',
    trigger: 'Đổi giao diện trang chủ',
    choose: 'Chọn giao diện',
    prefix: 'Giao diện',
    fallback: 'Cơ bản',
  },
};

export default function HomeAppearanceSwitcher({ current, onChange }: HomeAppearanceSwitcherProps) {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  const selectedTheme = THEMES.find((theme) => theme.id === current);
  const copy = switcherText[language];

  return (
    <div className="home-appearance-dock" role="region" aria-label={copy.region}>
      <button
        type="button"
        id="home-appearance-trigger"
        aria-expanded={open}
        aria-controls="home-appearance-panel"
        aria-label={copy.trigger}
        className="home-appearance-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="home-appearance-trigger-icon" aria-hidden="true">
          {selectedTheme?.icon ?? '◈'}
        </span>
                        <span>{copy.prefix}: {selectedTheme?.label[language] ?? copy.fallback}</span>
        <span
          className={`home-appearance-chevron ${open ? 'is-open' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          id="home-appearance-panel"
          role="listbox"
          aria-label={copy.choose}
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
                  <strong>{theme.label[language]}</strong>
                  <em>{theme.description[language]}</em>
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
