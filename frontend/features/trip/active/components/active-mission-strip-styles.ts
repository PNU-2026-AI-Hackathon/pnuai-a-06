import { StyleSheet } from 'react-native';

// active 여행 화면의 미션 가로 목록 타일 스타일입니다.
export const styles = StyleSheet.create({
  sectionLabel: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  photoStrip: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 24,
  },
  inviteTile: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#E7EAEB',
    borderRadius: 24,
    borderWidth: 3,
    height: 98,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 80,
  },
  addTileIcon: {
    height: 20,
    width: 20,
  },
  addTileText: {
    color: '#8A9194',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 8,
  },
  photoTile: {
    alignItems: 'center',
    height: 96,
    justifyContent: 'center',
    overflow: 'visible',
    transform: [{ rotate: '4deg' }],
    width: 82,
  },
  blockedMissionTile: {
    opacity: 0.35,
  },
  photoTileGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  photoTileInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 86,
    overflow: 'hidden',
    padding: 4,
    width: 72,
  },
  missionTileContent: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  todayMissionTileInner: {
    backgroundColor: '#AFD8E5',
  },
  futureMissionTileInner: {
    backgroundColor: '#C3D2D7',
  },
  missionTileIcon: {
    height: 58,
    width: 58,
  },
});
