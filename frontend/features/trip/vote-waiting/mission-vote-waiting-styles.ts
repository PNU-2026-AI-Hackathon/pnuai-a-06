import { StyleSheet } from 'react-native';

// 투표 대기 화면의 결과 안내와 장식 스타일입니다.
export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    overflow: 'hidden',
  },
  title: {
    color: '#2D3C43',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 100,
    textAlign: 'center',
  },
  effects: {
    ...StyleSheet.absoluteFillObject,
  },
  pinkEffect: {
    height: 375,
    left: -8,
    position: 'absolute',
    top: 165,
    width: 270,
  },
  yellowEffect: {
    height: 650,
    position: 'absolute',
    right: -90,
    top: 120,
    width: 550,
  },
  blueEffect: {
    bottom: 72,
    height: 386,
    left: -20,
    position: 'absolute',
    width: 303,
  },
  copy: {
    bottom: 118,
    left: 24,
    position: 'absolute',
    right: 24,
  },
  description: {
    color: '#8A9194',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    textAlign: 'center',
  },
});
