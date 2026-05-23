import type { ElementType } from 'react';

interface TypographyProps {
  content: string,
  className?: string,
  component?: ElementType
}

function Typography({ content, className, component: Component = 'div' }: TypographyProps) {
  return (
    <Component className={className}>
      {content}
    </Component>
  )
}

export default Typography
