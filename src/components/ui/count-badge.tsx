import React from 'react';

interface CountBadgeProps {
  count: number;
  className?: string;
  ariaLabel?: string;
}

export default function CountBadge({ count, className, ariaLabel }: CountBadgeProps) {
  const n = Math.min(Math.max(count ?? 0, 0), 99);

  if (n <= 0) return null;

  return (
    <span
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={[
        "inline-flex items-center justify-center",
        "h-4 min-w-4 px-1.5 rounded",
        "bg-black text-white text-[11px] leading-4 font-medium",
        "ml-1.5 select-none", // gap from label
        className || ""
      ].join(" ")}
    >
      {n}
    </span>
  );
}