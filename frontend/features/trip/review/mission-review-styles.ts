import { StyleSheet } from 'react-native';

// review 화면의 댓글·사진·입력 영역 스타일입니다.
export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  title: {
    color: '#111111',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  nextArrowIcon: {
    height: 14,
    width: 18,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  stateText: {
    color: '#7D868C',
    fontSize: 14,
  },
  readyWrap: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  readyTitle: {
    color: '#2D3C43',
    fontSize: 24,
    fontWeight: '600',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 20,
  },
  readyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
  },
  memberList: {
    gap: 10,
    marginVertical: 22,
  },
  memberRow: {
    alignItems: 'center',
    borderBottomColor: '#EEF1F3',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  memberName: {
    color: '#111820',
    fontSize: 15,
    fontWeight: '700',
  },
  memberStatus: {
    color: '#A1A9AE',
    fontSize: 12,
    fontWeight: '800',
  },
  memberReady: {
    color: '#409CB7',
  },
  readyGuide: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  readyGuideText: {
    color: '#8A9194',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  readyAutoText: {
    color: '#409CB7',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 32,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 14,
  },
  reviewStage: {
    flex: 1
  },
  pageDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: 27,
    justifyContent: 'center',
    paddingTop: 4
  },
  pageDot: {
    backgroundColor: '#D0D3D5',
    borderRadius: 999,
    height: 8,
    width: 8
  },
  pageDotActive: {
    backgroundColor: '#A9D4E3'
  },
  progressBox: {
    backgroundColor: '#EAF5F8',
    borderRadius: 14,
    padding: 14,
  },
  progressTitle: {
    color: '#111820',
    fontSize: 16,
    fontWeight: '800',
  },
  timerText: {
    color: '#D86C59',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  timerDangerText: {
    color: '#C94435',
  },
  progressDangerBox: {
    backgroundColor: '#FDEBE8',
  },
  progressText: {
    color: '#5C737D',
    fontSize: 13,
    marginTop: 4,
  },
  photoCard: {
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  photoTransitionOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 24, 30, 0.52)',
    borderRadius: 20,
    bottom: 0,
    justifyContent: 'center',
    left: '5%',
    position: 'absolute',
    right: '5%',
    top: 0,
  },
  transitionCheck: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    marginBottom: 12,
    width: 30,
  },
  transitionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  transitionDescription: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
    textAlign: 'center',
  },
  keyboardPhotoCard: {
    alignSelf: 'center',
    width: '62%',
  },
  photo: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    width: '90%',
  },
  anonymousLabel: {
    color: '#7D868C',
    fontSize: 14,
    marginTop: 10,
  },
  commentPanel: {
    gap: 9,
    paddingTop: 10,
  },
  sectionTitle: {
    color: '#111820',
    fontSize: 18,
    fontWeight: '800',
  },
  commentBubble: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F6F9FB',
    borderRadius: 20,
    flexDirection: 'row',
    maxWidth: '96%',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#D7DADD',
    borderRadius: 999,
    height: 35,
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    width: 35
  },
  commentCopy: {
    flexShrink: 1,
    paddingRight: 5
  },
  commentAuthor: {
    color: '#30363A',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentText: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  emptyText: {
    color: '#8A9194',
    fontSize: 12,
  },
  emptyComments: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center', minHeight: 140
  },
  emptyTitle: {
    color: '#10161F', fontSize: 14,
    fontWeight: '600', marginBottom: 8
  },
  inputPanel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingBottom: 14,
    paddingHorizontal: 30,
    paddingTop: 8,
  },
  input: {
    backgroundColor: '#F5F7F8',
    borderRadius: 999,
    color: '#111820',
    flex: 1,
    fontSize: 14,
    height: 58,
    paddingLeft: 22,
    paddingRight: 58,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#ADD8E7',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: 42,
    top: 18,
    width: 38,
  },
  sendButtonDisabled: {
    backgroundColor: '#E1EAEE',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6EA8BE',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  message: {
    alignSelf: 'center',
    backgroundColor: '#111820',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: 13,
    maxWidth: '90%',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 9,
    position: 'absolute',
  },
});

