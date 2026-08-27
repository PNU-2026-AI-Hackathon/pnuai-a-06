// 지도 이미지와 구역별 터치 영역 및 상태 메시지를 담당합니다.
import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';

import { LocalizedText as Text } from '@/components/localized-text';

import { districtTouchPolygons, getPolygonBounds, mapPieceTargets } from '../map-data';
import { styles } from '../styles';

type InteractiveMapProps = {
  activeDistrictKeys: Set<string>;
  hasThemeDistrictFilter: boolean;
  isMissionDeckOpen: boolean;
  isThemeDistrictLoading: boolean;
  mapHeight: number;
  mapSource: number;
  mapWidth: number;
  onOpenMissionDeck: (pieceNumber: number) => void;
  themeDistrictError: string;
};

export function InteractiveMap({
  activeDistrictKeys,
  hasThemeDistrictFilter,
  isMissionDeckOpen,
  isThemeDistrictLoading,
  mapHeight,
  mapSource,
  mapWidth,
  onOpenMissionDeck,
  themeDistrictError,
}: InteractiveMapProps) {
  const dongnaeTarget = useTutorialTarget('map-dongnae', { onPress: () => onOpenMissionDeck(6) });

  return (
    <View style={styles.mapArea}>
      <View style={[styles.mapContent, { width: mapWidth }]}>
        <Text style={styles.mapGuideText}>테마별 미션을 확인해보세요</Text>

        <View style={{ height: mapHeight, width: mapWidth }}>
          <View style={styles.mapPieceStage}>
            <Image cachePolicy="memory-disk" contentFit="contain" pointerEvents="none" priority="high" source={mapSource} style={styles.mapImage} transition={0} />
            {!isMissionDeckOpen ? (
              <View pointerEvents="box-none" style={styles.districtTouchLayer}>
                {mapPieceTargets.map((target) => {
                  const polygonPoints = districtTouchPolygons[target.number];

                  if (!polygonPoints) {
                    return null;
                  }

                  const bounds = getPolygonBounds(polygonPoints);
                  const isActive =
                    !hasThemeDistrictFilter || activeDistrictKeys.has(target.district) || activeDistrictKeys.has(target.districtCode);

                  return (
                    <Pressable
                      accessibilityLabel={`${target.district} ${isActive ? '미션 보기' : '비활성 구'}`}
                      accessibilityRole="button"
                      disabled={!isActive}
                      hitSlop={6}
                      key={`district-touch-${target.number}`}
                      onPress={() => onOpenMissionDeck(target.number)}
                      onLayout={target.number === 6 ? dongnaeTarget.onLayout : undefined}
                      ref={target.number === 6 ? dongnaeTarget.ref : undefined}
                      style={[
                        styles.districtTouchTarget,
                        {
                          height: (bounds.maxY - bounds.minY) * mapHeight,
                          left: bounds.minX * mapWidth,
                          top: bounds.minY * mapHeight,
                          width: (bounds.maxX - bounds.minX) * mapWidth,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
            {!isMissionDeckOpen && isThemeDistrictLoading ? <ActivityIndicator color="#202124" size="small" style={styles.mapLoadingIndicator} /> : null}
            {!isMissionDeckOpen && !isThemeDistrictLoading && themeDistrictError ? (
              <View style={styles.mapStatusBox}>
                <Text style={styles.mapStatusText}>{themeDistrictError}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Text style={styles.mapGuideText}>부산은 산과 바다, 도심이 아우러진{`\n`}15개 구와 1개 군으로 구성되어 있습니다.</Text>
      </View>
    </View>
  );
}
