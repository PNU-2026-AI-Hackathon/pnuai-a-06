import { StyleSheet } from 'react-native';

// 미션 참여 화면의 참여자 목록과 하단 액션 스타일입니다.
export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  closeHeader: {
    height: 60,
  },
  closeButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  stateText: {
    color: '#8A9194',
    fontSize: 13,
    marginTop: 12,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingTop: 47,
  },
  title: {
    color: '#10161F',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  leaderCard: {
    alignItems: 'center',
    backgroundColor: '#E9F8FF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 13,
    marginTop: 99,
    minHeight: 59,
    paddingHorizontal: 16,
  },
  leaderName: {
    color: '#10161F',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  leaderBadge: {
    backgroundColor: '#C9EBFA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  leaderBadgeText: {
    color: '#63B5CD',
    fontSize: 12,
    fontWeight: '600',
  },
  participantCard: {
    backgroundColor: '#F6F9FB',
    borderRadius: 20,
    marginTop: 22,
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 17,
  },
  participantLabel: {
    color: '#8A9194',
    fontSize: 14,
    marginBottom: 8,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 68,
  },
  lastMemberRow: {
    marginBottom: 0,
  },
  memberName: {
    color: '#10161F',
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomAction: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
  },
  startButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 63,
    justifyContent: 'center',
  },
  enabledStartButton: {
    backgroundColor: '#63B5CD',
  },
  disabledStartButton: {
    backgroundColor: '#E3F0F6',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledStartButtonText: {
    color: '#409CB7',
  },
  participationButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 63,
    justifyContent: 'center',
  },
  participateButton: {
    backgroundColor: '#63B5CD',
  },
  passButton: {
    backgroundColor: '#E3F0F6',
  },
  participationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  passButtonText: {
    color: '#409CB7',
  },
  message: {
    color: '#D06958',
    fontSize: 13,
    marginTop: 18,
    textAlign: 'center',
  },
});
