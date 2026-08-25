// main 홈과 매거진 카드에서 사용하는 스타일 모음입니다.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 27,
  },
  logoText: {
    height: 23,
    width: 72,
  },
  logoButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  profileButton: {
    borderRadius: 999,
    height: 56,
    overflow: 'hidden',
    width: 56,
  },
  magazineCard: {
    backgroundColor: '#224958',
    borderRadius: 20,
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    overflow: 'hidden',
    paddingHorizontal: 32,
    paddingVertical: 32,
    width: '100%',
  },
  singleMagazineFrame: {
    backgroundColor: '#EAEAEA',
    gap: 0,
    padding: 0,
  },
  singleMagazineInner: {
    backgroundColor: '#EAEAEA',
    borderRadius: 20,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  singleMagazineTitle: {
    aspectRatio: 206 / 63,
    left: '2%',
    position: 'absolute',
    top: '1%',
    width: '80%',
    zIndex: 1,
  },
  singleMagazinePhoto: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  singleMagazineDotTop: {
    height: 30,
    left: '2%',
    position: 'absolute',
    top: '23%',
    width: 30,
    zIndex: 1,
  },
  singleMagazineDotBottom: {
    bottom: '15%',
    height: 25,
    position: 'absolute',
    right: '2%',
    width: 25,
    zIndex: 1,
  },
  singleMagazinePhotoBubble: {
    borderRadius: 999,
    bottom: '1%',
    height: 60,
    left: '2%',
    position: 'absolute',
    width: 60,
    zIndex: 1,
  },
  singleMagazineNumber: {
    aspectRatio: 94 / 27,
    bottom: '1%',
    position: 'absolute',
    right: '2%',
    width: '35%',
    zIndex: 1,
  },
  emptyMagazineState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyMagazineImage: {
    height: 180,
    width: 180,
  },
  emptyMagazineImageTarget: {
    height: 180,
    width: 180,
  },
  emptyMagazineCopy: {
    alignItems: 'center',
    marginTop: 40,
    width: '100%',
  },
  emptyMagazineTitle: {
    color: '#10161F',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyMagazineDescription: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  magazineCopy: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  magazineTitle: {
    aspectRatio: 161 / 105,
    maxWidth: 205,
    width: '100%',
  },
  magazineNumber: {
    height: 34,
    width: 120,
  },
  magazinePhotos: {
    gap: 10,
    width: '37%',
  },
  magazinePhoto: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  magazinePhotoPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  magazinePreview: {
    borderRadius: 10,
    flex: 1,
    width: '37%',
  },
});
