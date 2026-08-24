import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import {
  createMagazine,
  getMagazine,
  getMagazineCandidates,
  MagazineApiError,
  type MagazineCandidate,
} from '@/lib/magazine-api';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function MagazineDetailScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<MagazineCandidate[]>([]);
  const [maxSelectable, setMaxSelectable] = useState(0);
  const [selectionRequired, setSelectionRequired] = useState(false);
  const [selectedMissionIds, setSelectedMissionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState('');

  const loadMagazine = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    setCandidates([]);
    setSelectedMissionIds([]);

    if (!scheduleId) {
      setImageUrls([]);
      setMessage('매거진 일정 정보가 없습니다.');
      setIsLoading(false);
      return;
    }

    try {
      const magazine = await getMagazine(scheduleId);
      setImageUrls(magazine.imageUrls);

      if (magazine.imageUrls.length === 0) {
        setMessage('표시할 매거진 이미지가 없습니다.');
      }
      setIsLoading(false);
      return;
    } catch (error) {
      if (!(error instanceof MagazineApiError) || error.status !== 404) {
        setImageUrls([]);
        setMessage(error instanceof Error ? error.message : '매거진을 불러오지 못했어요.');
        setIsLoading(false);
        return;
      }
    }

    try {
      const available = await getMagazineCandidates(scheduleId);
      setCandidates(available.candidates);
      setMaxSelectable(available.maxSelectable);
      setSelectionRequired(available.selectionRequired);

      if (available.candidates.length === 0) {
        setImageUrls([]);
        setMessage('매거진에 넣을 수 있는 완료 미션 사진이 아직 없어요.');
        return;
      }

      if (!available.selectionRequired) {
        setIsCreating(true);
        const magazine = await createMagazine(scheduleId);
        setImageUrls(magazine.imageUrls);

        if (magazine.imageUrls.length === 0) {
          setMessage('생성된 매거진 이미지가 없습니다.');
        }
      } else {
        setImageUrls([]);
        setMessage('매거진에 넣을 미션을 선택해주세요.');
      }
    } catch (error) {
      setImageUrls([]);
      setMessage(error instanceof Error ? error.message : '매거진을 생성하지 못했어요.');
    } finally {
      setIsCreating(false);
      setIsLoading(false);
    }
  }, [scheduleId]);

  useFocusEffect(
    useCallback(() => {
      void loadMagazine();
    }, [loadMagazine]),
  );

  const toggleMission = (missionId: string) => {
    setSelectedMissionIds((current) => {
      if (current.includes(missionId)) {
        return current.filter((id) => id !== missionId);
      }

      if (current.length >= maxSelectable) {
        return current;
      }

      return [...current, missionId];
    });
  };

  const handleCreateSelectedMagazine = async () => {
    if (!scheduleId || selectedMissionIds.length === 0 || isCreating) {
      return;
    }

    setIsCreating(true);
    setMessage('');

    try {
      const magazine = await createMagazine(scheduleId, { scheduleMissionIds: selectedMissionIds });
      setCandidates([]);
      setImageUrls(magazine.imageUrls);
      setMessage(magazine.imageUrls.length > 0 ? '' : '생성된 매거진 이미지가 없습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '매거진을 생성하지 못했어요.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { marginBottom: 14, marginTop: 14, paddingTop: topSafeInset + 12, paddingHorizontal: horizontalPadding },
        ]}>
        <Pressable accessibilityLabel="뒤로 가기" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>매거진</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading || isCreating ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          <Text style={styles.message}>{isCreating ? '매거진을 만들고 있어요.' : '매거진을 불러오는 중이에요.'}</Text>
        </View>
      ) : imageUrls.length > 0 ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: bottomSafeInset + 96 }}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}>
          {imageUrls.map((imageUrl, index) => (
            <Image
              key={imageUrl + '-' + index}
              contentFit="contain"
              source={{ uri: imageUrl }}
              style={styles.magazineImage}
            />
          ))}
        </ScrollView>
      ) : candidates.length > 0 && selectionRequired ? (
        <ScrollView
          contentContainerStyle={[styles.selectionContent, { paddingBottom: bottomSafeInset + 32, paddingHorizontal: horizontalPadding }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.selectionTitle}>매거진에 넣을 미션을 선택해주세요</Text>
          <Text style={styles.selectionSubtitle}>최대 {maxSelectable}개까지 선택할 수 있어요.</Text>
          {candidates.map((candidate) => {
            const isSelected = selectedMissionIds.includes(candidate.scheduleMissionId);

            return (
              <Pressable
                key={candidate.scheduleMissionId}
                onPress={() => toggleMission(candidate.scheduleMissionId)}
                style={[styles.candidateCard, isSelected && styles.selectedCandidateCard]}>
                {candidate.photoUrl ? <Image contentFit="cover" source={{ uri: candidate.photoUrl }} style={styles.candidatePhoto} /> : null}
                <View style={styles.candidateCopy}>
                  <Text style={styles.candidateTitle}>{candidate.title}</Text>
                  {candidate.placeLabel ? <Text style={styles.candidateMeta}>{candidate.placeLabel}</Text> : null}
                </View>
                <View style={[styles.check, isSelected && styles.selectedCheck]}>
                  {isSelected ? <Text style={styles.checkText}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
          <Pressable
            disabled={selectedMissionIds.length === 0}
            onPress={handleCreateSelectedMagazine}
            style={[styles.createButton, selectedMissionIds.length === 0 && styles.disabledCreateButton]}>
            <Text style={styles.createButtonText}>{selectedMissionIds.length}개 미션으로 매거진 만들기</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.centerState}>
          <Text style={styles.message}>{message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  backButtonText: {
    color: '#252B30',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
  },
  headerTitle: {
    color: '#252B30',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 36,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  message: {
    color: '#6E767B',
    fontSize: 15,
    textAlign: 'center',
  },
  magazineImage: {
    aspectRatio: 360 / 2112,
    width: '100%',
  },
  selectionContent: {
    paddingTop: 36,
  },
  selectionTitle: {
    color: '#252B30',
    fontSize: 16,
    fontWeight: '600',
  },
  selectionSubtitle: {
    color: '#6E767B',
    fontSize: 12,
    marginBottom: 16,
    marginTop: 6,
  },
  candidateCard: {
    alignItems: 'center',
    borderColor: '#E2E7E9',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    minHeight: 76,
    padding: 10,
  },
  selectedCandidateCard: {
    backgroundColor: '#F0FAFC',
    borderColor: '#409CB7',
  },
  candidatePhoto: {
    borderRadius: 10,
    height: 56,
    width: 56,
  },
  candidateCopy: {
    flex: 1,
  },
  candidateTitle: {
    color: '#252B30',
    fontSize: 15,
    fontWeight: '600',
  },
  candidateMeta: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 4,
  },
  check: {
    alignItems: 'center',
    borderColor: '#B8C2C6',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  selectedCheck: {
    backgroundColor: '#409CB7',
    borderColor: '#409CB7',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    marginTop: 20,
    paddingVertical: 16,
  },
  disabledCreateButton: {
    backgroundColor: '#B8C2C6',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
