import { StyleSheet } from 'react-native';

// active 여행 화면의 일정 제목과 상단 액션 영역 스타일입니다.
export const styles = StyleSheet.create({
  tripHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    marginBottom: 38,
    marginTop: 12,
  },
  tripTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  tripTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  tripTitle: {
    color: '#2D3C43',
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 37,
  },
  creatorCrown: {
    height: 20,
    width: 20,
  },
  companionsText: {
    color: '#8A9194',
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  settingsButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerIcon: {
    height: 20,
    width: 20,
  },
});
