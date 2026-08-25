import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#E8F6F9',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    width: 52,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: '#163745',
    fontSize: 16,
    fontWeight: '800',
  },
  heroDescription: {
    color: '#5E7D86',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  permissionHint: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 18,
    textAlign: 'center',
  },
  resultMessage: {
    color: '#409CB7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  stateBox: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    minHeight: 180,
    paddingHorizontal: 20,
  },
  stateText: {
    color: '#6F7E84',
    fontSize: 13,
    textAlign: 'center',
  },
});
