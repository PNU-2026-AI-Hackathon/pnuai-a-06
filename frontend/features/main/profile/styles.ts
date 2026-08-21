// 프로필 화면에서 사용하는 스타일 모음입니다.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F2F8FB',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minHeight: 368,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    width: '100%',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 65,
  },
  avatarButton: {
    height: 110,
    position: 'relative',
    width: 110,
  },
  editBadge: {
    alignItems: 'center',
    backgroundColor: '#CECECE',
    borderRadius: 999,
    bottom: 5,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 30,
  },
  username: {
    color: '#10161F',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 15,
  },
  menuSection: {
    alignItems: 'center',
    paddingTop: 27,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 34,
    paddingVertical: 20,
    width: '100%',
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 75,
    justifyContent: 'space-between',
  },
  menuLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  menuText: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
  menuDivider: {
    backgroundColor: '#E7ECEE',
    height: 1,
    marginVertical: 8,
  },
  deleteAccountText: {
    color: '#C74444',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 22, 31, 0.38)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  languageModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#10161F',
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalDescription: {
    color: '#6E767B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  languageOption: {
    alignItems: 'center',
    borderColor: '#E2E7E9',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  selectedLanguageOption: {
    backgroundColor: '#F0FAFC',
    borderColor: '#409CB7',
  },
  languageOptionText: {
    color: '#252B30',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedLanguageOptionText: {
    color: '#287D95',
    fontWeight: '700',
  },
});
