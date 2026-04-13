import type { CSSProperties } from 'react';

type SafeAreaOffsets = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
};

const buildInsetValue = (insetName: string, extra: string) => {
  const normalizedExtra = extra.trim();
  return normalizedExtra === '0px'
    ? `env(${insetName})`
    : `calc(env(${insetName}) + ${normalizedExtra})`;
};

export const buildSafeAreaPaddingStyle = ({ top, right, bottom, left }: SafeAreaOffsets): CSSProperties => {
  const style: CSSProperties = {};

  if (top !== undefined) {
    style.paddingTop = buildInsetValue('safe-area-inset-top', top);
  }
  if (right !== undefined) {
    style.paddingRight = buildInsetValue('safe-area-inset-right', right);
  }
  if (bottom !== undefined) {
    style.paddingBottom = buildInsetValue('safe-area-inset-bottom', bottom);
  }
  if (left !== undefined) {
    style.paddingLeft = buildInsetValue('safe-area-inset-left', left);
  }

  return style;
};

export const buildSafeAreaInsetStyle = ({ top, right, bottom, left }: SafeAreaOffsets): CSSProperties => {
  const style: CSSProperties = {};

  if (top !== undefined) {
    style.top = buildInsetValue('safe-area-inset-top', top);
  }
  if (right !== undefined) {
    style.right = buildInsetValue('safe-area-inset-right', right);
  }
  if (bottom !== undefined) {
    style.bottom = buildInsetValue('safe-area-inset-bottom', bottom);
  }
  if (left !== undefined) {
    style.left = buildInsetValue('safe-area-inset-left', left);
  }

  return style;
};