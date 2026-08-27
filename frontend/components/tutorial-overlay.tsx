import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Circle, Defs, Mask, Rect, Svg } from 'react-native-svg';
import { useMemo, useState } from 'react';

export type TutorialTarget = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type TutorialShape = 'circle' | 'rect' | 'roundedRect';

type TutorialOverlayProps = {
  messageGap?: number;
  messageOffsetY?: number;
  messagePlacement?: 'above' | 'below' | 'center';
  message: string;
  gestureHint?: 'horizontalSwipe';
  nextLabel?: string;
  startButton?: boolean;
  avoidSkipOverlap?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
  onTargetSwipe?: (direction: 1 | -1) => void;
  onTargetPress?: () => void;
  shape?: TutorialShape;
  target?: TutorialTarget | null;
};

export function TutorialOverlay({ avoidSkipOverlap = true, gestureHint, message, messageGap = 40, messageOffsetY = 0, messagePlacement = 'below', nextLabel, onNext, onPrev, onSkip, onTargetSwipe, onTargetPress, shape = 'roundedRect', startButton = false, target }: TutorialOverlayProps) {
  const [overlaySize, setOverlaySize] = useState({ height: 0, width: 0 });
  const targetSwipeResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Boolean(onTargetSwipe)
        && Math.abs(gestureState.dx) > 10
        && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderRelease: (_, gestureState) => {
        if (!onTargetSwipe) {
          return;
        }

        if (gestureState.dx < -48) {
          onTargetSwipe(1);
        } else if (gestureState.dx > 48) {
          onTargetSwipe(-1);
        }
      },
    }),
    [onTargetSwipe],
  );
  const messageHeight = onNext || onPrev ? (message ? 106 : 52) : 72;
  const messageTop = (messagePlacement === 'center'
    ? Math.max(24, overlaySize.height / 2 - messageHeight / 2)
    : messagePlacement === 'above' && target
      ? Math.max(24, target.y - messageHeight - messageGap)
      : target
        ? Math.min(target.y + target.height + messageGap, Math.max(24, overlaySize.height - messageHeight - messageGap))
        : Math.max(24, overlaySize.height / 2 - messageHeight / 2)) + messageOffsetY;
  const shouldPlaceSkipOnLeft = avoidSkipOverlap && Boolean(
    target
    && overlaySize.width > 0
    && target.y < 160
    && target.x + target.width > overlaySize.width * 0.55,
  );

  return (
    <Modal animationType="none" onRequestClose={() => undefined} statusBarTranslucent transparent visible>
      <View
        accessibilityViewIsModal
        onLayout={({ nativeEvent }) => setOverlaySize(nativeEvent.layout)}
        style={styles.overlay}>
        <Pressable
          accessibilityLabel="튜토리얼 안내가 진행 중입니다"
          accessibilityRole="none"
          style={styles.backdropPressable}
        />

        {overlaySize.width > 0 && overlaySize.height > 0 ? (
          <Svg
            height={overlaySize.height}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            viewBox={`0 0 ${overlaySize.width} ${overlaySize.height}`}
            width={overlaySize.width}>
            {target ? (
              <Defs>
                <Mask id="tutorial-overlay-mask">
                  <Rect fill="#FFFFFF" height={overlaySize.height} width={overlaySize.width} x="0" y="0" />
                  {shape === 'circle' ? (
                    <Circle
                      cx={target.x + target.width / 2}
                      cy={target.y + target.height / 2}
                      fill="#000000"
                      r={Math.min(target.width, target.height) / 2}
                    />
                  ) : (
                    <Rect
                      fill="#000000"
                      height={target.height}
                      rx={shape === 'roundedRect' ? 18 : 0}
                      ry={shape === 'roundedRect' ? 18 : 0}
                      width={target.width}
                      x={target.x}
                      y={target.y}
                    />
                  )}
                </Mask>
              </Defs>
            ) : null}
            <Rect
              fill="rgba(0, 0, 0, 0.8)"
              height={overlaySize.height}
              mask={target ? "url(#tutorial-overlay-mask)" : undefined}
              width={overlaySize.width}
              x="0"
              y="0"
            />
            {target && shape === 'circle' ? (
              <Circle
                cx={target.x + target.width / 2}
                cy={target.y + target.height / 2}
                fill="none"
                r={Math.min(target.width, target.height) / 2}
                stroke="#FFFFFF"
                strokeDasharray="6, 6"
                strokeWidth="2"
              />
            ) : target ? (
              <Rect
                fill="none"
                height={target.height}
                rx={shape === 'roundedRect' ? 18 : 0}
                ry={shape === 'roundedRect' ? 18 : 0}
                stroke="#FFFFFF"
                strokeDasharray="6, 6"
                strokeWidth="2"
                width={target.width}
                x={target.x}
                y={target.y}
              />
            ) : null}
          </Svg>
        ) : null}

        {onTargetPress && target ? (
          <Pressable
            accessibilityLabel="강조된 아이콘 선택"
            accessibilityRole="button"
            onPress={onTargetPress}
            style={[styles.targetPressable, {
              height: target.height,
              left: target.x,
              top: target.y,
              width: target.width,
            }]}
          />
        ) : null}

        {onTargetSwipe && target ? (
          <View
            {...targetSwipeResponder.panHandlers}
            pointerEvents="box-only"
            style={[styles.targetGestureArea, {
              height: target.height + 32,
              left: target.x,
              top: target.y - 16,
              width: target.width,
            }]}
          />
        ) : null}

        {gestureHint === 'horizontalSwipe' && target ? (
          <View
            pointerEvents="none"
            style={[
              styles.swipeHint,
              target
                ? {
                    left: target.x + target.width / 2 - 34,
                    top: target.y + target.height / 2 - 34,
                  }
                : null,
            ]}>
            <Text style={styles.swipeHintText}>↔</Text>
          </View>
        ) : null}

        {onSkip ? (
          <Pressable accessibilityRole="button" onPress={onSkip} style={[styles.skipButton, shouldPlaceSkipOnLeft ? styles.skipButtonLeft : styles.skipButtonRight]}>
            <Text style={styles.skipButtonText}>건너뛰기</Text>
          </Pressable>
        ) : null}

        <View pointerEvents="box-none" style={[styles.messageContainer, { top: messageTop }]}>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {onPrev || onNext ? (
            <View style={[styles.navigationRow, !onPrev && styles.navigationRowNextOnly, startButton && styles.navigationRowCentered]}>
              {onPrev ? (
                <Pressable accessibilityRole="button" onPress={onPrev} style={styles.prevButton}>
                  <View style={styles.prevButtonContent}>
                    <Text style={styles.nextButtonText}>&lt; Prev</Text>
                    <View style={styles.nextButtonUnderline} />
                  </View>
                </Pressable>
              ) : null}
              {onNext ? (
                <Pressable accessibilityRole="button" onPress={onNext} style={[styles.nextButton, startButton && styles.startButton]}>
                  <View style={[styles.nextButtonContent, startButton && styles.startButtonContent]}>
                    <Text style={[styles.nextButtonText, startButton && styles.startButtonText]}>{nextLabel ?? 'Next >'}</Text>
                    {!startButton ? <View style={styles.nextButtonUnderline} /> : null}
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    elevation: 20,
    flex: 1,
    zIndex: 20,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  targetPressable: {
    position: 'absolute',
  },
  targetGestureArea: {
    position: 'absolute',
  },
  messageContainer: {
    alignItems: 'center',
    left: 24,
    position: 'absolute',
    right: 24,
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: 'absolute',
    top: 52,
  },
  skipButtonLeft: {
    left: 20,
  },
  skipButtonRight: {
    right: 20,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
  message: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
    textAlign: 'center',
  },
  navigationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    width: '100%',
  },
  navigationRowNextOnly: {
    justifyContent: 'flex-end',
  },
  navigationRowCentered: {
    justifyContent: 'center',
  },
  prevButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nextButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  startButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    minWidth: 176,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  prevButtonContent: {
    alignItems: 'flex-start',
  },
  nextButtonContent: {
    alignItems: 'flex-end',
  },
  startButtonContent: {
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
  startButtonText: {
    color: '#5E686D',
    fontWeight: '500',
  },
  nextButtonUnderline: {
    backgroundColor: '#FFFFFF',
    height: 0.5,
    marginTop: 1,
    width: '100%',
  },
  swipeHint: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 999,
    height: 68,
    justifyContent: 'center',
    position: 'absolute',
    width: 68,
  },
  swipeHintText: {
    color: '#5E686D',
    fontSize: 36,
    fontWeight: '500',
    lineHeight: 40,
  },
});
