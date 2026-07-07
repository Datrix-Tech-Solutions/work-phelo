'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { WorkPheloWordmark } from '@/components/atoms/WorkPheloWordmark';
import { getStoredCompanyLogo } from '@/lib/companyLogoStorage';

interface CompanyLogoProps {
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function CompanyLogo({ className, style, width = 80, height = 60 }: CompanyLogoProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setLogoSrc(getStoredCompanyLogo()));
  }, []);

  if (!logoSrc || failed) {
    return <WorkPheloWordmark className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoSrc}
      alt="Company logo"
      width={width}
      height={height}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
