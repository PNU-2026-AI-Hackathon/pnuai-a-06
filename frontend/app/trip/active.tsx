import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem, setAuthItem } from '@/lib/auth-storage';
import { shareKakaoInvite } from '@/lib/kakao-share';
import {
  completeMissionSession,
  createMissionSession,
  getActiveMissionSession,
  getLatestMissionSession,
  getMissionSession,
  isMissionSessionNotFoundError,
  joinMissionSession,
  readyMissionSession,
  revealMissionSession,
  startMissionSession,
  type MissionSession,
} from '@/lib/mission-session-api';
import { getTripSchedule, type TripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';
import { createKakaoInviteTemplateArgs, createTripInvite, type TripInvite } from '@/lib/trip-invite-api';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createFallbackInviteUrl(inviteToken: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL('/trip/invite', window.location.origin);
    url.searchParams.set('inviteToken', inviteToken);

    return url.toString();
  }

  return Linking.createURL('/trip/invite', {
    isTripleSlashed: true,
    queryParams: { inviteToken },
  });
}

function getInviteUrl(invite: TripInvite | null) {
  if (!invite) {
    return '';
  }

  return invite.inviteUrl ?? createFallbackInviteUrl(invite.inviteToken);
}

const REVEALED_SESSION_CACHE_PREFIX = 'trip_revealed_sessions:';

function getRevealedSessionCacheKey(scheduleId: string) {
  return `${REVEALED_SESSION_CACHE_PREFIX}${scheduleId}`;
}

function readCachedRevealedSessions(scheduleId: string) {
  const raw = getAuthItem(getRevealedSessionCacheKey(scheduleId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, MissionSession>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveCachedRevealedSessions(scheduleId: string, sessions: Record<string, MissionSession>) {
  setAuthItem(getRevealedSessionCacheKey(scheduleId), JSON.stringify(sessions));
}

function isAlreadyJoinedSessionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return message.includes('이미') || message.includes('already') || message.includes('joined') || message.includes('member');
}


function hasAllComments(session: MissionSession) {
  const requiredCommentsPerPhoto = session.members.length;

  return requiredCommentsPerPhoto > 0 && session.submissions.length > 0 && session.submissions.every((submission) => submission.comments.length >= requiredCommentsPerPhoto);
}

function isFinishedSession(session: MissionSession | undefined) {
  return Boolean(session && (session.status === 'VOTING' || session.status === 'COMPLETED' || hasAllComments(session)));
}

function isReviewableSession(session: MissionSession) {
  return session.status === 'REVEALED' && session.submissions.length > 0 && !isFinishedSession(session);
}

function isCompletedScheduleMission(mission: TripScheduleMission) {
  return mission.status === 'COMPLETED';
}

function getMissionLocation(mission: TripScheduleMission) {
  if (mission.districtLabel && mission.placeLabel) {
    return `${mission.districtLabel}(${mission.placeLabel})`;
  }

  return mission.placeLabel ?? mission.districtLabel ?? '부산';
}

export default function ActiveTripScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const initialSessionId = getParamValue(params.sessionId);
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [schedule, setSchedule] = useState<TripSchedule | null>(null);
  const [selectedMission, setSelectedMission] = useState<TripScheduleMission | null>(null);
  const [session, setSession] = useState<MissionSession | null>(null);
  const [revealedSessions, setRevealedSessions] = useState<Record<string, MissionSession>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionBusy, setIsSessionBusy] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [message, setMessage] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [missionListVisible, setMissionListVisible] = useState(false);
  const [sessionPanelVisible, setSessionPanelVisible] = useState(false);
  const [reviewAlertSession, setReviewAlertSession] = useState<MissionSession | null>(null);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [inviteData, setInviteData] = useState<TripInvite | null>(null);
  const missions = schedule?.missions ?? [];
  const activeMissions = missions.filter((mission) => !isCompletedScheduleMission(mission) && !isFinishedSession(revealedSessions[mission.scheduleMissionId]));
  const canAddMission = schedule?.permissions.canAddMission ?? false;
  const canInviteCompanion = schedule?.permissions.canInviteCompanion ?? false;
  const inviteUrl = getInviteUrl(inviteData);

  const rememberFeedSession = useCallback((nextSession: MissionSession, fallbackScheduleMissionId?: string) => {
    const scheduleMissionId = nextSession.scheduleMissionId || fallbackScheduleMissionId;
    const shouldShowInFeed = nextSession.submissions.length > 0 && scheduleMissionId;

    if (!shouldShowInFeed) {
      return;
    }

    setRevealedSessions((currentSessions) => {
      const normalizedSession = {
        ...nextSession,
        scheduleMissionId,
      };
      const nextSessions = {
        ...currentSessions,
        [scheduleMissionId]: normalizedSession,
      };

      if (scheduleId) {
        saveCachedRevealedSessions(scheduleId, nextSessions);
      }

      if (isReviewableSession(normalizedSession)) {
        setReviewAlertSession(normalizedSession);
      } else if (isFinishedSession(normalizedSession)) {
        setReviewAlertSession((currentAlert) => (currentAlert?.id === normalizedSession.id ? null : currentAlert));
      }

      return nextSessions;
    });
  }, [scheduleId]);

  const refreshSession = useCallback(async (sessionId: string) => {
    const nextSession = await getMissionSession(sessionId);
    setSession(nextSession);
    rememberFeedSession(nextSession);
    return nextSession;
  }, [rememberFeedSession]);

  const refreshSchedule = useCallback(() => {
    if (!scheduleId) {
      setSchedule(null);
      setRevealedSessions({});
      setMessage('일정 정보가 없습니다.');
      return;
    }

    const cachedRevealedSessions = readCachedRevealedSessions(scheduleId);
    setReviewAlertSession(null);
    setRevealedSessions(cachedRevealedSessions);

    let isActive = true;

    setIsLoading(true);
    setMessage('');

    getTripSchedule(scheduleId)
      .then(async (nextSchedule) => {
        if (!isActive) {
          return;
        }

        setSchedule(nextSchedule);

        void Promise.all(Object.values(cachedRevealedSessions).map(async (cachedSession) => {
          try {
            const latestSession = await getMissionSession(cachedSession.id);
            if (isActive) {
              rememberFeedSession(latestSession, cachedSession.scheduleMissionId);
            }
          } catch {
            // Cached feed sessions are best-effort and can disappear server-side.
          }
        }));

        void Promise.all(nextSchedule.missions.map(async (mission) => {
          try {
            const latestSession = await getLatestMissionSession(nextSchedule.scheduleId, mission.scheduleMissionId);
            if (isActive) {
              rememberFeedSession(latestSession, mission.scheduleMissionId);
            }
          } catch (error) {
            if (!isMissionSessionNotFoundError(error)) {
              throw error;
            }
          }
        })).catch(() => {
          // Schedule rendering should not fail just because one session refresh failed.
        });

        void getActiveMissionSession(nextSchedule.scheduleId)
          .then((activeSession) => {
            if (isActive) {
              rememberFeedSession(activeSession);
            }
          })
          .catch(() => {
            // A schedule can legitimately have no active mission session yet.
          });

        if (initialSessionId) {
          try {
            const nextSession = await refreshSession(initialSessionId);
            if (isActive) {
              setSelectedMission(nextSchedule.missions.find((mission) => mission.scheduleMissionId === nextSession.scheduleMissionId) ?? null);
              setSessionPanelVisible(true);
            }
          } catch (error) {
            if (isActive) {
              setSessionMessage(error instanceof Error ? error.message : '세션을 불러오지 못했어요.');
            }
          }
        }
      })
      .catch((error) => {
        if (isActive) {
          setSchedule(null);
          setMessage(error instanceof Error ? error.message : '일정을 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [initialSessionId, refreshSession, rememberFeedSession, scheduleId]);

  useFocusEffect(refreshSchedule);

  const closeInviteSheet = () => {
    if (isSharingInvite) {
      return;
    }

    setInviteSheetVisible(false);
    setInviteMessage('');
  };

  const handleCreateInvite = async () => {
    if (!schedule?.permissions.canInviteCompanion) {
      setInviteMessage('동행자 추가 권한이 없습니다.');
      return;
    }

    if (!schedule || isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);
      setInviteMessage('');
      const nextInvite = await createTripInvite({ roomName: schedule.roomName, scheduleId: schedule.scheduleId });
      setInviteData(nextInvite);
      setInviteSheetVisible(true);
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : '초대장을 만들지 못했어요.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteData || !inviteUrl || isSharingInvite) {
      return;
    }

    try {
      setIsSharingInvite(true);
      setInviteMessage('');
      await shareKakaoInvite(createKakaoInviteTemplateArgs({ ...inviteData, inviteUrl }));
      setInviteSheetVisible(false);
      setInviteMessage('카카오톡 초대장을 열었어요.');
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : '카카오 초대에 실패했어요.');
    } finally {
      setIsSharingInvite(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return;
    }

    await Clipboard.setStringAsync(inviteUrl);
    setInviteMessage('초대 링크를 복사했어요.');
  };

  const openMissionSession = async (mission: TripScheduleMission) => {
    if (!schedule?.scheduleId || isSessionBusy) {
      return;
    }

    try {
      setIsSessionBusy(true);
      setSession(null);
      setSessionMessage('');
      setSelectedMission(mission);
      setMissionListVisible(false);

      let nextSession: MissionSession;

      try {
        const existingSession = await getLatestMissionSession(schedule.scheduleId, mission.scheduleMissionId);

        try {
          nextSession = await joinMissionSession(existingSession.id);
        } catch (error) {
          if (!isAlreadyJoinedSessionError(error)) {
            throw error;
          }

          nextSession = await getMissionSession(existingSession.id);
        }
      } catch (error) {
        if (!isMissionSessionNotFoundError(error)) {
          throw error;
        }

        nextSession = await createMissionSession(schedule.scheduleId, mission.scheduleMissionId);
      }

      setSession(nextSession);
      rememberFeedSession(nextSession, mission.scheduleMissionId);
      setSessionPanelVisible(true);
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : '미션 세션을 열지 못했어요.');
      setSessionPanelVisible(true);
    } finally {
      setIsSessionBusy(false);
    }
  };

  const runSessionAction = async (action: () => Promise<MissionSession>, successMessage: string, options?: { refreshAfter?: boolean }) => {
    if (isSessionBusy) {
      return;
    }

    try {
      setIsSessionBusy(true);
      setSessionMessage('');
      const actionSession = await action();
      const nextSession = options?.refreshAfter && actionSession.id ? await getMissionSession(actionSession.id) : actionSession;
      setSession(nextSession);
      rememberFeedSession(nextSession, selectedMission?.scheduleMissionId);
      setSessionMessage(successMessage);
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : '미션 세션 요청에 실패했어요.');
    } finally {
      setIsSessionBusy(false);
    }
  };

  const requireSessionId = () => {
    if (!session?.id) {
      throw new Error('먼저 미션 세션을 만들어 주세요.');
    }

    return session.id;
  };

  const openCapture = () => {
    if (!session?.id || !schedule?.scheduleId || !selectedMission?.scheduleMissionId) {
      setSessionMessage('먼저 미션 세션을 만들어 주세요.');
      return;
    }

    router.push({
      pathname: '/trip/capture',
      params: {
        scheduleId: schedule.scheduleId,
        scheduleMissionId: selectedMission.scheduleMissionId,
        sessionId: session.id,
      },
    });
  };

  const openReview = (targetSession: MissionSession | null) => {
    if (!targetSession?.id) {
      return;
    }

    setReviewAlertSession(null);
    router.push({
      pathname: '/trip/review',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId: targetSession.id,
      },
    });
  };
  const getMissionPhotos = (mission: TripScheduleMission) => {
    return revealedSessions[mission.scheduleMissionId]?.submissions.map((submission) => submission.imageUrl) ?? [];
  };

  const openFeedSession = (targetSession: MissionSession | undefined) => {
    if (!targetSession?.id) {
      return;
    }

    if (isFinishedSession(targetSession)) {
      router.push({
        pathname: '/trip/result',
        params: {
          ...(scheduleId ? { scheduleId } : {}),
          sessionId: targetSession.id,
        },
      });
      return;
    }

    openReview(targetSession);
  };

  const completedMissionFeeds = missions
    .map((mission) => ({ mission, photos: getMissionPhotos(mission), session: revealedSessions[mission.scheduleMissionId] }))
    .filter((item) => item.photos.length > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: bottomSafeInset + 94,
            paddingHorizontal: horizontalPadding,
            paddingTop: topSafeInset + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.tripHeader}>
          <View style={styles.tripTitleBlock}>
            <Text numberOfLines={2} style={styles.tripTitle}>{schedule?.roomName ?? '여행 일정'}</Text>
            <Text style={styles.companionsText}>나 · 선우 · 이정</Text>
          </View>
          <ScalePressable accessibilityLabel="담긴 미션 보기" onPress={() => setMissionListVisible(true)} pressedScale={0.9} style={styles.settingsButton}>
            <Ionicons color="#8A9194" name="options-outline" size={28} />
          </ScalePressable>
        </View>
        <Text style={styles.sectionLabel}>담긴 미션</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -horizontalPadding }}
          contentContainerStyle={[styles.photoStrip, { paddingHorizontal: horizontalPadding }]}>
          {canInviteCompanion ? (
            <ScalePressable accessibilityRole="button" accessibilityLabel="동행자 추가" disabled={!schedule || isCreatingInvite} onPress={handleCreateInvite} pressedScale={0.96} style={styles.inviteTile}>
              {isCreatingInvite ? <ActivityIndicator color="#8A9194" /> : <Ionicons color="#8A9194" name="person-add" size={20} />}
              <Text style={styles.inviteTileText}>초대하기</Text>
            </ScalePressable>
          ) : null}
          {activeMissions.map((mission) => (
            <ScalePressable key={mission.scheduleMissionId} onPress={() => openMissionSession(mission)} pressedScale={0.96} style={styles.photoTile}>
              <Svg height="100%" pointerEvents="none" style={styles.photoTileGradient} viewBox="0 0 82 96" width="100%">
                <Defs>
                  <LinearGradient id="missionTileBorderGradient" x1="1" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor="#CCEBF5" />
                    <Stop offset="1" stopColor="#5FC1E0" />
                  </LinearGradient>
                </Defs>
                <Rect fill="url(#missionTileBorderGradient)" height="96" rx="28" width="82" x="0" y="0" />
              </Svg>
              <View style={styles.photoTileInner}>
                {mission.photoUrl ? <Image source={{ uri: mission.photoUrl }} style={styles.photoTileImage} contentFit="cover" /> : <View style={styles.photoTilePlaceholder} />}
              </View>
            </ScalePressable>
          ))}
        </ScrollView>
        {inviteMessage && !inviteSheetVisible ? <Text style={styles.inlineMessage}>{inviteMessage}</Text> : null}

        <View style={styles.feedPanel}>
          <Text style={styles.dayLabel}>오늘 · 여행 2일차</Text>
          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#409CB7" />
              <Text style={styles.stateText}>담긴 미션을 불러오는 중이에요.</Text>
            </View>
          ) : message ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{message}</Text>
            </View>
          ) : missions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>아직 담긴 미션이 없어요</Text>
              <Text style={styles.emptyText}>미션 상세 리스트에서 원하는 미션을 담아보세요.</Text>
              {canAddMission ? (
                <ScalePressable onPress={() => router.push('/mission/detail')} pressedScale={0.96} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>미션 보러가기</Text>
                </ScalePressable>
              ) : null}
            </View>
          ) : completedMissionFeeds.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>아직 찍은 사진이 없어요</Text>
              <Text style={styles.emptyText}>카메라로 미션 사진을 찍으면 여기에 보여요.</Text>
            </View>
          ) : (
            completedMissionFeeds.map(({ mission, photos, session: feedSession }) => (
              <ScalePressable key={mission.scheduleMissionId} onPress={() => openFeedSession(feedSession)} pressedScale={0.99} style={styles.feedMissionItem}>
                <View style={styles.feedIcon}>
                  <Ionicons color="#ffffff" name="camera" size={20} />
                </View>
                <View style={styles.feedCopy}>
                  <Text style={styles.feedTitle}>{mission.title}</Text>
                  <Text style={styles.feedLocation}>{getMissionLocation(mission)}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedPhotoRow}>
                    {photos.map((photoUrl, index) => (
                      <Image key={`${mission.scheduleMissionId}-${index}`} source={{ uri: photoUrl }} style={styles.feedPhoto} contentFit="cover" />
                    ))}
                  </ScrollView>
                </View>
              </ScalePressable>
            ))
          )}
        </View>
      </ScrollView>

      {reviewAlertSession ? (
        <View style={[styles.reviewAlert, { bottom: bottomSafeInset + 106, left: horizontalPadding, right: horizontalPadding }]}>
          <View style={styles.reviewAlertCopy}>
            <Text style={styles.reviewAlertTitle}>댓글을 남길 시간이 왔어요</Text>
            <Text style={styles.reviewAlertText}>{reviewAlertSession.missionTitle} · 사진 {reviewAlertSession.submissions.length}장</Text>
          </View>
          <ScalePressable onPress={() => openReview(reviewAlertSession)} pressedScale={0.94} style={styles.reviewAlertButton}>
            <Text style={styles.reviewAlertButtonText}>열기</Text>
          </ScalePressable>
          <ScalePressable accessibilityLabel="댓글 알림 닫기" onPress={() => setReviewAlertSession(null)} pressedScale={0.86} style={styles.reviewAlertClose}>
            <Ionicons color="#6A747A" name="close" size={18} />
          </ScalePressable>
        </View>
      ) : null}

      <Modal animationType="fade" transparent visible={missionListVisible} onRequestClose={() => setMissionListVisible(false)}>
        <Pressable accessibilityLabel="담긴 미션 닫기" onPress={() => setMissionListVisible(false)} style={styles.modalBackdrop}>
          <Pressable style={styles.missionPanel}>
            <Text style={styles.panelTitle}>담긴 미션</Text>
            <ScrollView contentContainerStyle={styles.panelMissionList} showsVerticalScrollIndicator={false}>
              {activeMissions.length === 0 ? (
                <View style={styles.panelEmptyBox}>
                  <Text style={styles.emptyTitle}>진행할 미션이 없어요</Text>
                  <Text style={styles.emptyText}>완료된 미션은 피드에서 계속 볼 수 있어요.</Text>
                </View>
              ) : activeMissions.map((mission) => (
                <ScalePressable accessibilityRole="button" key={mission.scheduleMissionId} onPress={() => openMissionSession(mission)} pressedScale={0.98} style={styles.panelMissionItem}>
                  {mission.photoUrl ? <Image source={{ uri: mission.photoUrl }} style={styles.panelMissionPhoto} contentFit="cover" /> : <View style={styles.panelMissionPhotoPlaceholder} />}
                  <View style={styles.panelMissionCopy}>
                    <Text numberOfLines={1} style={styles.panelMissionTitle}>{mission.title}</Text>
                    <Text numberOfLines={2} style={styles.panelMissionDescription}>{mission.description}</Text>
                    <Text style={styles.panelMissionStatus}>{mission.status ?? 'ADDED'}</Text>
                  </View>
                </ScalePressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" transparent visible={sessionPanelVisible} onRequestClose={() => setSessionPanelVisible(false)}>
        <Pressable accessibilityLabel="미션 세션 닫기" onPress={() => setSessionPanelVisible(false)} style={styles.modalBackdrop}>
          <Pressable style={styles.sessionPanel}>
            <Text style={styles.panelTitle}>미션 세션 테스트</Text>
            <Text style={styles.sessionMissionTitle}>{selectedMission?.title ?? session?.missionTitle ?? '미션'}</Text>
            <View style={styles.sessionInfoBox}>
              <Text style={styles.sessionInfoText}>sessionId: {session?.id ?? '-'}</Text>
              <Text style={styles.sessionInfoText}>status: {session?.status ?? '-'}</Text>
              <Text style={styles.sessionInfoText}>members: {session?.members.length ?? 0}</Text>
              <Text style={styles.sessionInfoText}>submissions: {session?.submissions.length ?? 0}</Text>
            </View>
            {sessionMessage ? <Text style={styles.sessionMessage}>{sessionMessage}</Text> : null}
            {isSessionBusy ? <ActivityIndicator color="#409CB7" style={styles.sessionLoader} /> : null}
            <View style={styles.sessionActionGrid}>
              <ScalePressable disabled={!session?.id || isSessionBusy} onPress={() => runSessionAction(() => refreshSession(requireSessionId()), '세션을 조회했어요.')} pressedScale={0.95} style={styles.sessionActionButton}><Text style={styles.sessionActionText}>조회</Text></ScalePressable>
              <ScalePressable disabled={!session?.id || isSessionBusy} onPress={() => runSessionAction(() => joinMissionSession(requireSessionId()), '세션에 참여했어요.')} pressedScale={0.95} style={styles.sessionActionButton}><Text style={styles.sessionActionText}>join</Text></ScalePressable>
              <ScalePressable disabled={!session?.id || isSessionBusy} onPress={() => runSessionAction(() => readyMissionSession(requireSessionId()), '준비 완료 처리했어요.')} pressedScale={0.95} style={styles.sessionActionButton}><Text style={styles.sessionActionText}>ready</Text></ScalePressable>
              <ScalePressable disabled={!session?.id || isSessionBusy} onPress={() => runSessionAction(() => startMissionSession(requireSessionId()), '촬영 시작 처리했어요.')} pressedScale={0.95} style={styles.sessionActionButton}><Text style={styles.sessionActionText}>start</Text></ScalePressable>
              <ScalePressable disabled={!session?.id || isSessionBusy} onPress={openCapture} pressedScale={0.95} style={[styles.sessionActionButton, styles.captureActionButton]}><Text style={[styles.sessionActionText, styles.captureActionText]}>촬영</Text></ScalePressable>
              <ScalePressable disabled={!session?.id || isSessionBusy || !session?.submissions.length} onPress={() => openReview(session)} pressedScale={0.95} style={styles.sessionActionButton}><Text style={styles.sessionActionText}>댓글</Text></ScalePressable>
              <ScalePressable disabled={!session?.id || isSessionBusy} onPress={() => runSessionAction(() => revealMissionSession(requireSessionId()), '사진을 공개했어요.', { refreshAfter: true })} pressedScale={0.95} style={styles.sessionActionButton}><Text style={styles.sessionActionText}>reveal</Text></ScalePressable>
              <ScalePressable disabled={!session?.id || isSessionBusy} onPress={() => runSessionAction(() => completeMissionSession(requireSessionId()), '미션을 완료했어요.', { refreshAfter: true })} pressedScale={0.95} style={styles.sessionActionButton}><Text style={styles.sessionActionText}>complete</Text></ScalePressable>
            </View>
            {session?.submissions.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.submissionRow}>
                {session.submissions.map((submission) => (
                  <View key={submission.id} style={styles.submissionCard}>
                    <Image source={{ uri: submission.imageUrl }} style={styles.submissionImage} contentFit="cover" />
                    <Text numberOfLines={1} style={styles.submissionText}>{submission.nickname ?? submission.userId}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={inviteSheetVisible} onRequestClose={closeInviteSheet}>
        <Pressable accessibilityLabel="초대 닫기" onPress={closeInviteSheet} style={styles.inviteModalBackdrop}>
          <Pressable style={[styles.invitePanel, { paddingBottom: bottomSafeInset + 22 }]}>
            <Text style={styles.invitePanelTitle}>동행자 추가하기</Text>
            <View style={styles.inviteOptionsRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="카카오톡으로 초대하기" onPress={handleShareInvite} style={styles.inviteOption}>
                <View style={[styles.kakaoInviteAvatar, isSharingInvite && styles.disabledButton]}>
                  {isSharingInvite ? <ActivityIndicator color="#3A2D00" /> : <Text style={styles.kakaoTalkText}>TALK</Text>}
                </View>
                <Text style={styles.inviteOptionText}>카카오톡</Text>
              </Pressable>
              {[{ label: '연진이' }, { label: '김민지' }].map((item) => (
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}에게 초대 공유`} key={item.label} onPress={handleShareInvite} style={styles.inviteOption}>
                  <View style={styles.inviteContactAvatar}>
                    <View style={styles.contactKakaoBadge}><Text style={styles.contactKakaoText}>TALK</Text></View>
                  </View>
                  <Text style={styles.inviteOptionText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inviteDivider} />
            <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 복사하기" onPress={handleCopyInviteLink} style={styles.copyInviteButton}>
              <Text style={styles.copyInviteText}>링크 복사하기</Text>
              <Ionicons color="#626E75" name="copy-outline" size={27} />
            </Pressable>
            {inviteMessage ? <Text style={styles.inviteMessageText}>{inviteMessage}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F4F7FA',
    flex: 1,
  },
  scrollContent: {
    paddingTop: 28,
  },
  tripHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    marginBottom: 38,
    marginTop: 12,
  },
  tripTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  tripTitle: {
    color: '#2D3C43',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 37,
  },
  companionsText: {
    color: '#8A9194',
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  settingsButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sectionLabel: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  photoStrip: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 24,
  },
  inviteTile: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E7EAEB',
    height: 98,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 80,
  },
  inviteTileText: {
    color: '#8A9194',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
  },
  photoTile: {
    alignItems: 'center',
    height: 96,
    justifyContent: 'center',
    overflow: 'visible',
    transform: [{ rotate: '4deg' }],
    width: 82,
  },
  photoTileGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  photoTileInner: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    height: 86,
    overflow: 'hidden',
    padding: 2,
    width: 72,
  },
  photoTileImage: {
    borderRadius: 19,
    height: '100%',
    width: '100%',
  },
  photoTilePlaceholder: {
    backgroundColor: '#D7E2E8',
    borderRadius: 19,
    height: '100%',
    width: '100%',
  },
  inlineMessage: {
    color: '#409CB7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  feedPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginHorizontal: -24,
    marginTop: 28,
    minHeight: 520,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  dayLabel: {
    borderBottomColor: '#E7EAEB',
    borderBottomWidth: 1,
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: -24,
    marginBottom: 28,
    paddingBottom: 14,
    paddingHorizontal: 24,
  },
  feedMissionItem: {
    flexDirection: 'row',
    gap: 15,
    paddingBottom: 38,
  },
  feedIcon: {
    alignItems: 'center',
    backgroundColor: '#6EA6BF',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  feedCopy: {
    flex: 1,
  },
  feedTitle: {
    color: '#10161F',
    fontSize: 14,
    fontWeight: '600',
  },
  feedLocation: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  feedPhotoRow: {
    gap: 14,
    paddingRight: 24,
    paddingTop: 22,
  },
  feedPhoto: {
    backgroundColor: '#E3E9EC',
    borderRadius: 14,
    height: 170,
    width: 128,
  },
  feedPhotoPlaceholder: {
    backgroundColor: '#E3E9EC',
    borderRadius: 14,
    height: 170,
    width: 128,
  },
  stateBox: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  stateText: {
    color: '#8A9194',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 34,
  },
  emptyTitle: {
    color: '#2D3C43',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyButton: {
    alignItems: 'center',
    backgroundColor: '#6EA6BF',
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 22,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  reviewAlert: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D7EAF0',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 76,
    padding: 12,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    zIndex: 20,
  },
  reviewAlertCopy: {
    flex: 1,
  },
  reviewAlertTitle: {
    color: '#111820',
    fontSize: 15,
    fontWeight: '800',
  },
  reviewAlertText: {
    color: '#6F7A80',
    fontSize: 12,
    marginTop: 3,
  },
  reviewAlertButton: {
    alignItems: 'center',
    backgroundColor: '#6EA8BE',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reviewAlertButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewAlertClose: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 34,
  },
  missionPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    maxHeight: '72%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  panelTitle: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  panelMissionList: {
    gap: 12,
  },
  panelEmptyBox: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  panelMissionItem: {
    backgroundColor: '#F4F7F8',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  panelMissionPhoto: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionPhotoPlaceholder: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionCopy: {
    flex: 1,
  },
  panelMissionTitle: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
  },
  panelMissionDescription: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  panelMissionStatus: {
    color: '#409CB7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  sessionPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    maxHeight: '84%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  sessionMissionTitle: {
    color: '#2D3C43',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  sessionInfoBox: {
    backgroundColor: '#F4F7F8',
    borderRadius: 14,
    gap: 5,
    padding: 12,
  },
  sessionInfoText: {
    color: '#53626A',
    fontSize: 12,
    fontWeight: '600',
  },
  sessionMessage: {
    color: '#409CB7',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 10,
  },
  sessionLoader: {
    marginTop: 10,
  },
  sessionActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  sessionActionButton: {
    alignItems: 'center',
    backgroundColor: '#EAF5F9',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 15,
  },
  sessionActionText: {
    color: '#409CB7',
    fontSize: 13,
    fontWeight: '800',
  },
  captureActionButton: {
    backgroundColor: '#409CB7',
  },
  captureActionText: {
    color: '#ffffff',
  },
  submissionRow: {
    gap: 10,
    marginTop: 16,
  },
  submissionCard: {
    width: 116,
  },
  submissionImage: {
    aspectRatio: 1,
    backgroundColor: '#E3E9EC',
    borderRadius: 14,
    width: '100%',
  },
  submissionText: {
    color: '#53626A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  inviteModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
  },
  invitePanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingTop: 23,
    width: '100%',
  },
  invitePanelTitle: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 32,
  },
  inviteOptionsRow: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 32,
    paddingTop: 27,
  },
  inviteOption: {
    alignItems: 'center',
    gap: 7,
    width: 72,
  },
  kakaoInviteAvatar: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderRadius: 999,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  kakaoTalkText: {
    color: '#3A2D00',
    fontSize: 10,
    fontWeight: '800',
  },
  inviteContactAvatar: {
    backgroundColor: '#E9EDF0',
    borderRadius: 999,
    height: 62,
    position: 'relative',
    width: 62,
  },
  contactKakaoBadge: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 21,
  },
  contactKakaoText: {
    color: '#3A2D00',
    fontSize: 5,
    fontWeight: '800',
  },
  inviteOptionText: {
    color: '#72787D',
    fontSize: 12,
    fontWeight: '500',
  },
  inviteDivider: {
    backgroundColor: '#E8ECEF',
    height: 1,
    marginTop: 20,
  },
  copyInviteButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E9EDF0',
    borderRadius: 16,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 28,
    width: '77%',
  },
  copyInviteText: {
    color: '#626E75',
    fontSize: 13,
    fontWeight: '600',
  },
  inviteMessageText: {
    color: '#409CB7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    paddingHorizontal: 32,
  },
  disabledButton: {
    opacity: 0.6,
  },
});