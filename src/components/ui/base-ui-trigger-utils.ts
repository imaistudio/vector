'use client';

import * as React from 'react';

export function resolveRenderNativeButton(
  child: React.ReactElement,
  nativeButton?: boolean,
) {
  if (nativeButton !== undefined) {
    return nativeButton;
  }

  if (typeof child.type === 'string') {
    return child.type === 'button';
  }

  const childProps = child.props as { href?: unknown };

  if (childProps.href != null) {
    return false;
  }

  return undefined;
}
