import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { useI18n } from '../../i18n';
import { accents, useAppearance, type Appearance } from '../../features/appearance/appearance';

/** Appearance (System/Light/Dark) and the accent color. Both apply at once and reach every Kora window. */
export default function AppearanceSettings() {
  const { t } = useI18n();
  const appearance = useAppearance();
  return <div className="space-y-4">
    <div className="space-y-2">
      <p className="text-sm text-slate-700">{t('appearance.label')}</p>
      <SegmentedControl label={t('appearance.label')} value={appearance.appearance} layout="fill"
        onChange={value => appearance.setAppearance(value as Appearance)}>
        {(['system', 'light', 'dark'] as const).map(value => <SegmentedControlItem key={value} value={value} label={t(`appearance.${value}`)}/>)}
      </SegmentedControl>
      <p className="text-xs text-slate-500">{t('appearance.hint')}</p>
    </div>
    <fieldset className="space-y-2">
      <legend className="text-sm text-slate-700">{t('appearance.accent')}</legend>
      <div className="flex flex-wrap gap-3">
        {accents.map(accent => <label key={accent} className="kora-swatch" data-accent={accent} title={t(`appearance.accent.${accent}`)}>
          <input type="radio" name="kora-accent" value={accent} checked={appearance.accent === accent}
            onChange={() => appearance.setAccent(accent)} aria-label={t(`appearance.accent.${accent}`)}/>
        </label>)}
      </div>
    </fieldset>
  </div>;
}
