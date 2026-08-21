// main 홈 화면을 구성하고 매거진 상세 이동을 연결합니다.
import { router } from 'expo-router';
import { View } from 'react-native';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

import { EmptyMagazineState } from './components/empty-magazine-state';
import { MainHeader } from './components/main-header';
import { MagazineCard } from './components/magazine-card';
import { useMainHome } from './hooks/use-main-home';
import { styles } from './styles';

export default function MainHomeScreen() {
  const { bottomActionInset, centerContentOffset, horizontalPadding, topInset } = useResponsiveLayout();
  const main = useMainHome();
  const shouldShowEmptyMagazine = main.hasLoadedMagazine && main.magazinePhotoUrls.length === 0;

  const openMagazine = () => {
    if (!main.magazineScheduleId) {
      return;
    }

    router.push({
      pathname: '/magazine/detail',
      params: { scheduleId: main.magazineScheduleId },
    });
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomActionInset, paddingHorizontal: horizontalPadding }]}>
      <MainHeader
        onOpenLogin={() => router.replace('/login')}
        onOpenProfile={() => router.push('/main/profile')}
        profileEmoji={main.profileEmoji}
        profileImageUrl={main.profileImageUrl}
        topInset={topInset}
      />

      {shouldShowEmptyMagazine ? (
        <EmptyMagazineState centerContentOffset={centerContentOffset} />
      ) : main.hasLoadedMagazine ? (
        <MagazineCard
          isLoading={main.isMagazineLoading}
          onPress={openMagazine}
          photoUrls={main.magazinePhotoUrls}
          scheduleId={main.magazineScheduleId}
        />
      ) : null}
    </View>
  );
}
