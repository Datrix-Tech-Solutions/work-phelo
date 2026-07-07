'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { WorkPheloWordmark } from '@/components/atoms/WorkPheloWordmark';

interface CompanyLogoProps {
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  priority?: boolean;
}

const LOGO_SRC = '/iriskr.png';
const LOGO_ALT = 'iRisk logo';

export function CompanyLogo({
  className,
  style,
  width = 80,
  height = 60,
  priority = false,
}: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <WorkPheloWordmark className={className} />;
  }

  return (
    <Image
      src={LOGO_SRC}
      alt={LOGO_ALT}
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
