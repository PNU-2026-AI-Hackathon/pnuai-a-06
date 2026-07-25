import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMe } from '@/lib/auth-api';
import { getLatestMissionSession, getPassedMissionSubmissions, type MissionSession } from '@/lib/mission-session-api';
import { getCachedTripSchedules, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';
import { ClipPath, Defs, Ellipse, Image as SvgImage, Svg } from 'react-native-svg';

const splashText = require('../../assets/svg/logo_text.svg');
const magazineTitle = require('../../assets/svg/magazine/JUST THE TWO OF US.svg');
const magazineNumber = require('../../assets/svg/magazine/No.05.svg');
const singleMagazineTitle = require('../../assets/svg/magazine/THE Starry Night.svg');
const singleMagazineNumber = require('../../assets/svg/magazine/No.02.svg');
const magazineBlackEllipse = require('../../assets/svg/magazine/black_ellipse.svg');

function getDateKey(date: string | undefined) {
  if (!date) {
    return null;
  }

  const match = date.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function isClosedSchedule(schedule: TripSchedule) {
  const lastDate = getDateKey(schedule.endDate ?? schedule.startDate);
  if (!lastDate) {
    return false;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return lastDate < todayKey;
}

function getScheduleEndTime(schedule: TripSchedule) {
  const lastDate = getDateKey(schedule.endDate ?? schedule.startDate);
  return lastDate ? new Date(`${lastDate}T00:00:00`).getTime() : 0;
}

function getResultPhotoUrl(session: MissionSession) {
  if (session.status !== 'REVEALED' && session.status !== 'COMPLETED') {
    return null;
  }

  const passedSubmissions = getPassedMissionSubmissions(session);
  const savedWinner = session.winnerUserId ? passedSubmissions.find((submission) => submission.userId === session.winnerUserId) : null;
  const winnerSubmission = savedWinner ?? [...passedSubmissions].sort((left, right) => right.likeCount - left.likeCount)[0];

  return winnerSubmission?.imageUrl ?? null;
}

export default function MainScreen() {
  const {
    bottomActionInset,
    horizontalPadding,
    topInset,
  } = useResponsiveLayout();
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null);
  const [magazinePhotoUrls, setMagazinePhotoUrls] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      fetchMe()
        .then((user) => {
          if (isActive) {
            setProfileImageUrl(user.profile_image_url);
            setProfileEmoji(user.profile_emoji);
          }
        })
        .catch(() => {
          if (isActive) {
            setProfileImageUrl(null);
            setProfileEmoji(null);
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadLatestMagazine = async () => {
        try {
          let schedules: TripSchedule[];

          try {
            schedules = await listTripSchedules();
          } catch {
            schedules = getCachedTripSchedules();
          }

          const latestClosedSchedule = schedules
            .filter(isClosedSchedule)
            .sort((left, right) => getScheduleEndTime(right) - getScheduleEndTime(left))[0];

          if (!latestClosedSchedule) {
            if (isActive) {
              setMagazinePhotoUrls([]);
            }
            return;
          }

          const photoUrls = (await Promise.all(latestClosedSchedule.missions.map(async (mission) => {
            try {
              const session = await getLatestMissionSession(latestClosedSchedule.scheduleId, mission.scheduleMissionId);
              return getResultPhotoUrl(session);
            } catch {
              return null;
            }
          }))).filter((photoUrl): photoUrl is string => Boolean(photoUrl)).slice(0, 3);

          if (isActive) {
            setMagazinePhotoUrls(photoUrls);
          }
        } catch {
          if (isActive) {
            setMagazinePhotoUrls([]);
          }
        }
      };

      void loadLatestMagazine();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const isSingleMagazine = magazinePhotoUrls.length === 1;
  const magazinePhotoSlots = [0, 1, 2].map((index) => magazinePhotoUrls[index] ?? null);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomActionInset,
          paddingHorizontal: horizontalPadding,
        },
      ]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Image source={splashText} style={styles.logoText} contentFit="contain" />
        <Pressable accessibilityLabel="프로필" onPress={() => router.push('/main/profile')} style={styles.profileButton}>
          <ProfileAvatar profileImageUrl={profileImageUrl} profileEmoji={profileEmoji} size={56} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/magazine/detail')}
        style={[styles.magazineCard, isSingleMagazine && styles.singleMagazineFrame]}>
        {isSingleMagazine ? (
          <View style={styles.singleMagazineInner}>
            <Image source={singleMagazineTitle} style={styles.singleMagazineTitle} contentFit="contain" />
            <Svg height="100%" style={styles.singleMagazinePhoto} viewBox="0 0 100 100" width="100%">
              <Defs>
                <ClipPath id="singleMagazinePhotoClip">
                  <Ellipse cx="50" cy="51" rx="34" ry="52" transform="rotate(28 50 51)" />
                </ClipPath>
              </Defs>
              <SvgImage
                clipPath="url(#singleMagazinePhotoClip)"
                height="100"
                href={{ uri: magazinePhotoUrls[0] }}
                preserveAspectRatio="xMidYMid slice"
                width="100"
                x="0"
                y="0"
              />
            </Svg>
            <Image source={magazineBlackEllipse} style={styles.singleMagazineDotTop} />
            <Image source={magazineBlackEllipse} style={styles.singleMagazineDotBottom} />
            <Image source={{ uri: magazinePhotoUrls[0] }} style={styles.singleMagazinePhotoBubble} contentFit="cover" />
            <Image source={singleMagazineNumber} style={styles.singleMagazineNumber} contentFit="contain" />
          </View>
        ) : (
          <>
            <View style={styles.magazineCopy}>
              <Image source={magazineTitle} style={styles.magazineTitle} contentFit="contain" />
              <Image source={magazineNumber} style={styles.magazineNumber} contentFit="contain" />
            </View>
            <View style={styles.magazinePhotos}>
              {magazinePhotoSlots.map((photoUrl, index) => photoUrl ? (
                <Image key={`${photoUrl}-${index}`} source={{ uri: photoUrl }} style={styles.magazinePhoto} contentFit="cover" />
              ) : (
                <View key={`magazine-photo-placeholder-${index}`} style={styles.magazinePhotoPlaceholder} />
              ))}
            </View>
          </>
        )}
      </Pressable>
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
    justifyContent: 'space-between',
    marginBottom: 27,
  },
  brandText: {
    color: '#000000',
    fontSize: 14,
  },
  logoText: {
    height: 23,
    width: 72,
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
});
