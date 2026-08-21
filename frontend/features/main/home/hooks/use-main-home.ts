// main 홈의 사용자 정보와 최신 매거진 데이터를 불러옵니다.
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';

import { fetchMe } from '@/lib/auth-api';
import { getLatestMissionSession, type MissionSession } from '@/lib/mission-session-api';
import { getCachedTripSchedules, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';

import { getResultPhotoUrl, getScheduleEndTime, isClosedSchedule } from '../main-home-data';

export function useMainHome() {
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null);
  const [magazinePhotoUrls, setMagazinePhotoUrls] = useState<string[]>([]);
  const [magazineScheduleId, setMagazineScheduleId] = useState<string | null>(null);
  const [isMagazineLoading, setIsMagazineLoading] = useState(true);
  const [hasLoadedMagazine, setHasLoadedMagazine] = useState(false);

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
        if (isActive) {
          setIsMagazineLoading(true);
        }

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
              setMagazineScheduleId(null);
              setMagazinePhotoUrls([]);
            }
            return;
          }

          const photoUrls = (await Promise.all(latestClosedSchedule.missions.map(async (mission) => {
            try {
              const session: MissionSession = await getLatestMissionSession(latestClosedSchedule.scheduleId, mission.scheduleMissionId);
              return getResultPhotoUrl(session);
            } catch {
              return null;
            }
          }))).filter((photoUrl): photoUrl is string => Boolean(photoUrl)).slice(0, 3);

          await Promise.all(photoUrls.map((photoUrl) => Image.prefetch(photoUrl, 'memory-disk'))).catch(() => undefined);

          if (isActive) {
            setMagazineScheduleId(latestClosedSchedule.scheduleId);
            setMagazinePhotoUrls(photoUrls);
          }
        } catch {
          if (isActive) {
            setMagazineScheduleId(null);
            setMagazinePhotoUrls([]);
          }
        } finally {
          if (isActive) {
            setIsMagazineLoading(false);
            setHasLoadedMagazine(true);
          }
        }
      };

      void loadLatestMagazine();

      return () => {
        isActive = false;
      };
    }, []),
  );

  return {
    hasLoadedMagazine,
    isMagazineLoading,
    magazinePhotoUrls,
    magazineScheduleId,
    profileEmoji,
    profileImageUrl,
  };
}
