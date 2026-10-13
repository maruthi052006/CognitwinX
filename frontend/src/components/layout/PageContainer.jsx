import React from 'react';

/**
 * PageContainer enforces standard max-width, responsive horizontal padding,
 * and unified margin alignment across every page in the application.
 */
export default function PageContainer({
  children,
  maxWidth = 'max-w-[1920px]',
  className = '',
  id,
}) {
  return (
    <div
      id={id}
      className={`w-full mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-4 ${maxWidth} ${className}`}
    >
      {children}
    </div>
  );
}
