import { StyleSheet } from 'react-native';

// 미션 투표 화면의 선택 카드와 하단 버튼 스타일입니다.
export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingTop: 16,
  },
  title: {
    color: '#2D3C43',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 52,
  },
  photoCard: {
    borderColor: 'transparent',
    borderRadius: 16,
    borderWidth: 4,
    overflow: 'hidden',
    position: 'relative',
    width: '48%',
  },
  selectedPhotoCard: {
    borderColor: '#63B5CD',
  },
  ownPhotoCard: {
    opacity: 0.48,
  },
  photo: {
    aspectRatio: 3 / 4,
    width: '100%',
  },
  selectedBadge: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 9,
    top: 9,
    width: 32,
  },
  message: {
    color: '#D06958',
    fontSize: 13,
    marginTop: 18,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    bottom: 0,
    left: 0,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  voteButton: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 100,
    height: 63,
    justifyContent: 'center',
  },
  voteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.42,
  },
});
