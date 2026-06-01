import Skeleton from './Skeleton';

interface SkeletonPageHeaderProps {
  className?: string;
}

/**
 * Header placeholder sized to roughly match the `PageHeader` atom: an eyebrow,
 * a large title, and a description line. Presentation only.
 */
export default function SkeletonPageHeader({ className = '' }: SkeletonPageHeaderProps) {
  return (
    <div aria-hidden="true" className={className}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-9 w-64" rounded="rounded-lg" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
    </div>
  );
}
