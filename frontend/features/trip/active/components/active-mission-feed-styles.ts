import { StyleSheet } from 'react-native';

// active 여행 화면의 미션 사진 피드 스타일입니다.
export const styles = StyleSheet.create({
  feedPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginHorizontal: -24,
    marginTop: 28,
    minHeight: 520,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  emptyFeedPanel: {
    minHeight: 0,
    paddingBottom: 30,
  },
  dayLabel: {
    borderBottomColor: '#E7EAEB',
    borderBottomWidth: 1,
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: -24,
    marginBottom: 28,
    paddingBottom: 14,
    paddingHorizontal: 24,
  },
  feedMissionItem: {
    flexDirection: 'row',
    gap: 15,
    paddingBottom: 38,
  },
  feedIcon: {
    alignItems: 'center',
    backgroundColor: '#6EA6BF',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  feedCameraIcon: {
    height: 18,
    width: 18,
  },
  feedCopy: {
    flex: 1,
  },
  feedTitle: {
    color: '#10161F',
    fontSize: 14,
    fontWeight: '600',
  },
  feedLocation: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  feedPhotoRow: {
    gap: 14,
    paddingRight: 24,
    paddingTop: 22,
  },
  feedPhoto: {
    backgroundColor: '#E3E9EC',
    borderRadius: 14,
    height: 170,
    width: 128,
  },
  stateBox: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  stateText: {
    color: '#8A9194',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 34,
  },
  emptyTitle: {
    color: '#2D3C43',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
});
