import { StyleSheet } from 'react-native';

// active 여행 화면의 미션 시작 팝업 스타일입니다.
export const styles = StyleSheet.create({
  missionStartOverlay: {
    backgroundColor: 'rgba(16, 22, 31, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  missionStartDialog: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 450,
    overflow: 'hidden',
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 30,
    position: 'relative',
    width: '100%',
  },
  missionStartFrame: {
    bottom: -20,
    left: -20,
    position: 'absolute',
    right: -20,
    top: -20,
    transform: [{ scale: 1.5 }],
    zIndex: 0,
  },
  missionStartContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  missionStartCardIcon: {
    height: 150,
    marginVertical: 12,
    width: 150,
  },
  missionStartQuestion: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 36,
    textAlign: 'center',
  },
  missionStartDescription: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  missionStartButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 55,
    justifyContent: 'center',
    marginTop: 28,
    width: '100%',
  },
  missionStartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
