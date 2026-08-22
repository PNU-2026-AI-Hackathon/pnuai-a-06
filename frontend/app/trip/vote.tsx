import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { useMissionVote } from '@/features/trip/vote/hooks/use-mission-vote';
import { getParamValue } from '@/features/trip/vote/mission-vote-data';
import { styles } from '@/features/trip/vote/mission-vote-styles';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';

export default function MissionVoteScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const currentUserId = getAuthItem('user_id');
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const {
    handleVote,
    hasVoted,
    isLoading,
    isSubmitting,
    message,
    selectedSubmissionId,
    setSelectedSubmissionId,
    submissions,
  } = useMissionVote({ currentUserId, scheduleId, sessionId });

  return (
    <View style={styles.container}>

      {isLoading ? (
        <View style={styles.centerState}><ActivityIndicator color="#63B5CD" /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSafeInset + 118, paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 90 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>당신의 선택은?</Text>
          <Text style={styles.description}>이번 미션을 대표할 사진을 골라주세요.</Text>
          <View style={styles.photoGrid}>
            {submissions.map((submission) => {
              const isOwnSubmission = Boolean(currentUserId && submission.userId === currentUserId);
              const isSelected = !isOwnSubmission && submission.id === selectedSubmissionId;
              const isPhotoDisabled = hasVoted || isOwnSubmission;

              return (
                <ScalePressable accessibilityState={{ disabled: isPhotoDisabled }} disabled={isPhotoDisabled} key={submission.id} onPress={() => setSelectedSubmissionId(submission.id)} pressedScale={0.97} style={[styles.photoCard, isSelected && styles.selectedPhotoCard, isOwnSubmission && styles.ownPhotoCard]}>
                  <Image contentFit="cover" source={{ uri: submission.imageUrl }} style={styles.photo} />
                  {isSelected ? <View style={styles.selectedBadge}><Ionicons color="#FFFFFF" name="checkmark" size={18} /></View> : null}
                </ScalePressable>
              );
            })}
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: bottomSafeInset + 14, paddingHorizontal: horizontalPadding }]}>
        <ScalePressable disabled={!selectedSubmissionId || isSubmitting || hasVoted} onPress={handleVote} pressedScale={0.97} style={[styles.voteButton, (!selectedSubmissionId || isSubmitting || hasVoted) && styles.disabledButton]}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.voteButtonText}>다음</Text>}
        </ScalePressable>
      </View>
    </View>
  );
}
