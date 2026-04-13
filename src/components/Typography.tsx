interface TypographyProps {
  content: string,
  className?: string,
  component?: any
}

function Typography({ content, className, component: Component = 'div' }: TypographyProps) {
  return (
    <Component className={className}>
      {content}
    </Component>
  )
}

export default Typography