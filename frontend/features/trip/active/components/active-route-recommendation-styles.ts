import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#10161F',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 4,
  },
  dayCard: {
    backgroundColor: '#F4F7F8',
    borderRadius: 18,
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayTitle: {
    color: '#53626A',
    fontSize: 13,
    fontWeight: '800',
  },
  routeButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 13,
  },
  routeButtonBusy: {
    backgroundColor: '#83B9C8',
  },
  routeButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  missionList: {
    gap: 8,
  },
  missionRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  orderBadge: {
    alignItems: 'center',
    backgroundColor: '#D8EEF4',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  orderText: {
    color: '#267C96',
    fontSize: 12,
    fontWeight: '800',
  },
  missionCopy: {
    flex: 1,
  },
  missionTitle: {
    color: '#10161F',
    fontSize: 13,
    fontWeight: '700',
  },
  missionLocation: {
    color: '#8A9194',
    fontSize: 11,
    marginTop: 3,
  },
});
