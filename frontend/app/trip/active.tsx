import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { useTutorial } from '@/components/tutorial-provider';
import { TripInviteSheet } from '@/components/trip-invite-sheet';
import { ActiveMissionFeed } from '@/features/trip/active/components/active-mission-feed';
import { ActiveMissionListModal } from '@/features/trip/active/components/active-mission-list-modal';
import { ActiveMissionStartModal } from '@/features/trip/active/components/active-mission-start-modal';
import { ActiveMissionStrip } from '@/features/trip/active/components/active-mission-strip';
import { ActiveTripHeader } from '@/features/trip/active/components/active-trip-header';
import { getParamValue } from '@/features/trip/trip-data';
import { styles } from '@/features/trip/active/active-screen-styles';
import { useActiveInvite } from '@/features/trip/active/hooks/use-active-invite';
import { useActiveMissionActions } from '@/features/trip/active/hooks/use-active-mission-actions';
import { useActiveMissionSockets } from '@/features/trip/active/hooks/use-active-mission-sockets';
import { useActiveMissionState } from '@/features/trip/active/hooks/use-active-mission-state';
import { useActiveSchedule } from '@/features/trip/active/hooks/use-active-schedule';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import type { TripSchedule } from '@/lib/trip-schedule-api';

// 진행 중인 여행의 미션·초대·세션 화면을 조합하는 라우트입니다.
export default function ActiveTripScreen() {
  const params = useLocalSearchParams<{
    cancelledScheduleMissionId?: string | string[];
    cancelledSessionId?: string | string[];
    scheduleId?: string | string[];
    sessionId?: string | string[];
    suppressedParticipationSessionId?: string | string[];
  }>();
  const scheduleId = getParamValue(params.scheduleId);
  const cancelledScheduleMissionId = getParamValue(params.cancelledScheduleMissionId);
  const cancelledSessionId = getParamValue(params.cancelledSessionId);
  const initialSessionId = getParamValue(params.sessionId);
  const suppressedParticipationSessionId = getParamValue(params.suppressedParticipationSessionId);
  const currentUserId = getAuthItem('user_id');
  const { start: startTutorial } = useTutorial();
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      void startTutorial('trip-active');
    }
  }, [isFocused, startTutorial]);
  const [schedule, setSchedule] = useState<TripSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const requiredScheduleMemberCount = schedule?.participants.length ?? 0;
  const isScheduleCreator = Boolean(schedule?.creatorId && currentUserId && schedule.creatorId === currentUserId);
  const missionState = useActiveMissionState({ currentUserId, ignoredSessionId: cancelledSessionId, requiredScheduleMemberCount, schedule, scheduleId });
  const {
    handleScheduleMissing: resetMissionState,
    handleScheduleSessionCacheLoaded: loadMissionSessionCache,
    clearMissionState,
    missionSessions,
    revealedSessions,
    refreshSession,
    rememberFeedSession,
  } = missionState;

  useEffect(() => {
    if (!cancelledSessionId) {
      return;
    }

    const cancelledSession = [
      ...Object.values(missionSessions),
      ...Object.values(revealedSessions),
    ].find((session) => session.id === cancelledSessionId);

    if (cancelledSession) {
      clearMissionState(cancelledScheduleMissionId ?? cancelledSession.scheduleMissionId);
    }
  }, [cancelledScheduleMissionId, cancelledSessionId, clearMissionState, missionSessions, revealedSessions]);

  const handleScheduleMissing = useCallback(() => {
    resetMissionState();
  }, [resetMissionState]);

  const handleScheduleSessionCacheLoaded = useCallback((cachedSessions: Parameters<typeof loadMissionSessionCache>[0]) => {
    loadMissionSessionCache(cachedSessions);
  }, [loadMissionSessionCache]);

  const { reloadCurrentSchedule } = useActiveSchedule({
    initialSessionId,
    onScheduleMissing: handleScheduleMissing,
    onScheduleSessionCacheLoaded: handleScheduleSessionCacheLoaded,
    refreshSession,
    scheduleId,
    setIsLoading,
    setMessage,
    setSchedule,
    rememberFeedSession,
  });

  useActiveMissionSockets({
    activeBlockingSession: missionState.activeBlockingSession,
    currentUserId,
    isFocused,
    leaderStartingMissionRef: missionState.leaderStartingMissionRef,
    openingParticipationSessionIdRef: missionState.openingParticipationSessionIdRef,
    rememberFeedSession: missionState.rememberFeedSession,
    schedule,
    scheduleId,
    suppressedLeaderSessionIdsRef: missionState.suppressedLeaderSessionIdsRef,
    suppressedParticipationSessionId,
  });

  const {
    closeInviteSheet,
    handleCopyInviteLink,
    handleCreateInvite,
    handleShareInvite,
    inviteData,
    inviteMessage,
    inviteSheetVisible,
    isCreatingInvite,
    isSharingInvite,
  } = useActiveInvite({ hasStartedMissionSession: missionState.hasStartedMissionSession, schedule });
  const actions = useActiveMissionActions({
    activeBlockingSession: missionState.activeBlockingSession,
    clearMissionState: missionState.clearMissionState,
    isMissionLockedForEdit: missionState.isMissionLockedForEdit,
    isScheduleCreator,
    isTemporaryMission: missionState.isTemporaryMission,
    leaderStartingMissionRef: missionState.leaderStartingMissionRef,
    missionSessions: missionState.missionSessions,
    onMessage: setMessage,
    reloadCurrentSchedule,
    rememberFeedSession: missionState.rememberFeedSession,
    requiredScheduleMemberCount,
    schedule,
    scheduleId,
    suppressedParticipationSessionId,
    suppressedLeaderSessionIdsRef: missionState.suppressedLeaderSessionIdsRef,
  });
  const canAddMission = schedule?.permissions.canAddMission ?? false;
  const canInviteCompanion = (schedule?.permissions.canInviteCompanion ?? false) && !missionState.hasStartedMissionSession;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: missionState.missions.length > 0 ? 24 : 0,
            paddingHorizontal: horizontalPadding,
            paddingTop: topSafeInset + 28,
          },
        ]}
        scrollEnabled={missionState.missions.length > 0 || isLoading || Boolean(message)}
        showsVerticalScrollIndicator={false}>
        <ActiveTripHeader
          canInviteCompanion={canInviteCompanion}
          isCreatingInvite={isCreatingInvite}
          isScheduleCreator={isScheduleCreator}
          onCreateInvite={handleCreateInvite}
          onOpenSettings={() => {
            if (schedule?.scheduleId) {
              router.push({ pathname: '/trip/edit' as never, params: { scheduleId: schedule.scheduleId } });
            }
          }}
          schedule={schedule}
        />
        <ActiveMissionStrip
          activeMissions={missionState.activeMissions}
          canAddMission={canAddMission}
          hasSchedule={Boolean(schedule)}
          horizontalPadding={horizontalPadding}
          isMissionBlockedForPlay={actions.isMissionBlockedForPlay}
          onOpenMissionDetail={actions.openMissionDetail}
          onOpenRouteRecommendation={() => {
            if (schedule?.scheduleId) {
              router.push({ pathname: '/trip/route', params: { scheduleId: schedule.scheduleId } });
            }
          }}
          onOpenMissionSession={actions.openMissionSession}
        />
        {inviteMessage && !inviteSheetVisible ? <Text style={styles.inlineMessage}>{inviteMessage}</Text> : null}

        <ActiveMissionFeed
          currentUserId={currentUserId}
          hasSchedule={Boolean(schedule)}
          isLoading={isLoading}
          message={message}
          missionSessions={missionState.missionSessions}
          missions={missionState.missions}
          onOpenFeedSession={actions.openFeedSession}
          requiredScheduleMemberCount={requiredScheduleMemberCount}
          revealedSessions={missionState.revealedSessions}
          tripDayLabel={missionState.tripDayLabel}
        />
      </ScrollView>

      <ActiveMissionListModal
        busyScheduleMissionId={actions.busyScheduleMissionId}
        canRemoveMission={schedule?.permissions.canRemoveMission ?? false}
        dateEditorMissionId={actions.dateEditorMissionId}
        isMissionBlockedForPlay={actions.isMissionBlockedForPlay}
        isMissionLockedForEdit={actions.isMissionLockedForEdit}
        isTemporaryMission={actions.isTemporaryMission}
        missionDateGroups={missionState.missionDateGroups}
        missionListMessage={actions.missionListMessage}
        onChangeMissionDate={actions.handleChangeMissionDate}
        onClose={() => actions.setMissionListVisible(false)}
        onOpenMissionSession={actions.openMissionSession}
        onRemoveMission={actions.handleRemoveScheduledMission}
        onToggleDateEditor={(missionId) => actions.setDateEditorMissionId((currentId) => currentId === missionId ? null : missionId)}
        scheduleDateOptions={missionState.scheduleDateOptions}
        visible={actions.missionListVisible}
        visibleMissions={missionState.visibleMissions}
      />
      <TripInviteSheet
        bottomSafeInset={bottomSafeInset}
        invite={inviteData}
        isSharing={isSharingInvite}
        message={inviteMessage}
        onClose={closeInviteSheet}
        onCopy={() => void handleCopyInviteLink()}
        onShare={() => void handleShareInvite()}
        visible={inviteSheetVisible}
      />

      <ActiveMissionStartModal
        bottomSafeInset={bottomSafeInset}
        isSessionBusy={actions.isSessionBusy}
        onClose={actions.onClosePendingMission}
        onStart={actions.startPendingMission}
        pendingMission={actions.pendingMission}
      />
    </View>
  );
}
