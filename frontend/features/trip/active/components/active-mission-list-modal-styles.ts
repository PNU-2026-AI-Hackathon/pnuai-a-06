import { StyleSheet } from 'react-native';

// active 여행 화면의 날짜별 미션 관리 모달 스타일입니다.
export const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 34,
  },
  missionPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    maxHeight: '72%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  panelTitle: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  missionListMessage: {
    color: '#409CB7',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 12,
  },
  panelMissionList: {
    gap: 12,
  },
  panelEmptyBox: {
    alignItems: 'center',
    paddingVertical: 26,
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
  missionDateGroup: {
    gap: 8,
  },
  missionDateTitle: {
    color: '#53626A',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptyDateBox: {
    backgroundColor: '#F4F7F8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyDateText: {
    color: '#9AA3A8',
    fontSize: 12,
    fontWeight: '600',
  },
  panelMissionItem: {
    backgroundColor: '#F4F7F8',
    borderRadius: 16,
    gap: 10,
    padding: 12,
  },
  panelMissionOpenArea: {
    flexDirection: 'row',
    gap: 12,
  },
  blockedMissionOpenArea: {
    opacity: 0.45,
  },
  panelMissionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  iconActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  disabledButton: {
    opacity: 0.6,
  },
  dateEditorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateEditorOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  selectedDateEditorOption: {
    backgroundColor: '#409CB7',
  },
  dateEditorText: {
    color: '#53626A',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedDateEditorText: {
    color: '#FFFFFF',
  },
  panelMissionPhoto: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionPhotoPlaceholder: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionCopy: {
    flex: 1,
  },
  panelMissionTitle: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
  },
  panelMissionDescription: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  panelMissionStatus: {
    color: '#409CB7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
});
