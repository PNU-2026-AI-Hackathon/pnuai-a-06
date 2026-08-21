// 인증 화면 전체에서 사용하는 스타일 모음입니다.
import { StyleSheet } from 'react-native';

export const MATCH_COLOR = '#409CB7';
export const MISMATCH_COLOR = '#B74040';

export const styles = StyleSheet.create({
  homeScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  homeHero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 42,
  },
  homeLogoText: {
    height: 42,
    width: 119,
  },
  homeSubtitle: {
    color: '#70777B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 20,
  },
  homeLogoMap: {
    height: 170,
    marginTop: 72,
    width: 218,
  },
  homeBottomArea: {
    alignItems: 'center',
    gap: 34,
    marginBottom: 24,
  },
  homeKakaoButton: {
    alignItems: 'center',
    backgroundColor: '#FFE812',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 24,
    width: '95%',
  },
  homeKakaoIcon: {
    height: 24,
    width: 24,
  },
  homeKakaoText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  homeLinkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
  },
  homeDivider: {
    backgroundColor: '#676D70',
    height: 17,
    width: 1,
  },
  homeLinkText: {
    color: '#676D70',
    fontSize: 12,
    fontWeight: '500',
  },
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  header: {
    height: 48,
    justifyContent: 'center',
  },
  formArea: {
    gap: 11,
    marginTop: 62,
  },
  title: {
    color: '#10161F',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1.5,
    color: '#151A20',
    fontSize: 14,
    minHeight: 49,
    paddingHorizontal: 16,
  },
  passwordLabel: {
    color: '#8A9194',
    fontSize: 12,
    marginLeft: 6,
    marginTop: 8,
  },
  matchInput: {
    borderColor: MATCH_COLOR,
  },
  mismatchInput: {
    borderColor: MISMATCH_COLOR,
  },
  passwordMessage: {
    fontSize: 12,
    marginLeft: 6,
    marginTop: 6,
  },
  verifyDescription: {
    color: '#8A9194',
    fontSize: 14,
    marginBottom: 3,
  },
  messageText: {
    color: MISMATCH_COLOR,
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 6,
  },
  autoLoginRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 3,
    marginTop: 8,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#8A9194',
    borderRadius: 13,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkedBox: {
    backgroundColor: '#8A9194',
    borderColor: '#8A9194',
  },
  autoLoginText: {
    color: '#8A9194',
    fontSize: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#E3F0F6',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 32,
    minHeight: 63,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#409CB7',
    fontSize: 16,
    fontWeight: '500',
  },
  signupPrompt: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  promptText: {
    color: '#8A9194',
    fontSize: 12,
  },
  signupLink: {
    color: '#10161F',
    fontSize: 12,
    fontWeight: '500',
  },
  easyLoginArea: {
    alignItems: 'center',
    gap: 16,
    marginTop: 83,
  },
  easyLoginText: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
  },
  kakaoButton: {
    alignItems: 'center',
    backgroundColor: '#FFE812',
    borderRadius: 38,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  kakaoIcon: {
    height: 22,
    width: 22,
  },
});
