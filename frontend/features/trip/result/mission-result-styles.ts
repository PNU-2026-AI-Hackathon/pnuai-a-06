import { StyleSheet } from 'react-native';

// 미션 결과 화면의 결과 카드와 이동 버튼 스타일입니다.
export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  title: {
    color: '#252B30',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 7,
    textAlign: 'center',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyContent: {
    flex: 1,
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(24, 31, 35, 0.9)',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 13,
    left: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 11,
    position: 'absolute',
    right: 24,
    textAlign: 'center',
  },
  resultContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  resultHeading: {
    alignItems: 'center',
    overflow: 'visible',
    width: '100%',
    zIndex: 0,
  },
  effects: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  pinkEffect: {
    height: 375,
    left: -8,
    position: 'absolute',
    top: 165,
    width: 270,
  },
  yellowEffect: {
    height: 600,
    position: 'absolute',
    right: -80,
    top: 50,
    width: 500,
  },
  blueEffect: {
    bottom: 72,
    height: 386,
    left: -20,
    position: 'absolute',
    width: 303,
  },
  photo: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    marginTop: 32,
    width: '78%',
    zIndex: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    width: '100%',
    zIndex: 2,
  },
  savedText: {
    color: '#8A9194',
    fontSize: 12,
    marginBottom: 17,
  },
  tripButton: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 63,
    justifyContent: 'center',
    width: '100%',
  },
  tripButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
