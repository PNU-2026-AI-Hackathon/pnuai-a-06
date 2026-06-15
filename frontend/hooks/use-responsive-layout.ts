import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const screenRatio = height / width;
    const isCompactWidth = width < 390;
    const isTallScreen = screenRatio >= 1.9;
    const isWideScreen = screenRatio < 1.55;
    const horizontalPadding = isCompactWidth ? 20 : 24;
    const availableWidth = width - horizontalPadding * 2;
    const contentMaxWidth = isWideScreen ? 520 : 360;
    const mediaMaxWidth = isWideScreen ? 620 : 520;
    const centerContentOffset = isTallScreen ? -24 : isWideScreen ? 12 : 0;
    const bottomActionInset = isTallScreen ? 40 : 24;
    const topInset = isTallScreen ? 64 : 40;

    return {
      width,
      height,
      screenRatio,
      isCompactWidth,
      isTallScreen,
      isWideScreen,
      availableWidth,
      horizontalPadding,
      contentMaxWidth,
      mediaMaxWidth,
      centerContentOffset,
      bottomActionInset,
      topInset,
    };
  }, [height, width]);
}
