// 지도 이미지와 구역별 터치 영역 및 상태 메시지를 담당합니다.
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

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
  return (
    <View style={styles.mapArea}>
      <View style={{ height: mapHeight, width: mapWidth }}>
        <View style={styles.mapPieceStage}>
          <Image contentFit="contain" pointerEvents="none" source={mapSource} style={styles.mapImage} />
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
    </View>
  );
}
