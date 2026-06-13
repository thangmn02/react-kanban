import { normalizeVietnameseText } from '../utils/normalizeVietnameseText';

interface ArcanaStepHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
}

function ArcanaStepHeader({
  eyebrow,
  title,
  description,
  align = 'center',
}: ArcanaStepHeaderProps) {
  return (
    <header className={`arcana-step-header arcana-step-header--${align}`}>
      {eyebrow && <p className="arcana-step-eyebrow">{normalizeVietnameseText(eyebrow)}</p>}
      <h3>{normalizeVietnameseText(title)}</h3>
      {description && <p className="arcana-step-description">{normalizeVietnameseText(description)}</p>}
    </header>
  );
}

export default ArcanaStepHeader;
