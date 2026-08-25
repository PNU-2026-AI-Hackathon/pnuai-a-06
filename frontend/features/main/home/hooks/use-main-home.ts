// main 홈의 사용자 정보와 최신 매거진 데이터를 불러옵니다.
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';

import { fetchMe } from '@/lib/auth-api';
import { getAuthItem } from '@/lib/auth-storage';
import { getLatestMissionSession, type MissionSession } from '@/lib/mission-session-api';
import { getCachedTripSchedules, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';

import { getResultPhotoUrl, getScheduleEndTime, isClosedSchedule } from '../main-home-data';

type MagazineHomeCache = {
  photoUrls: string[];
  scheduleId: string;
  userId: string;
};

let magazineHomeCache: MagazineHomeCache | null = null;
const prefetchedMagazinePhotoUrls = new Set<string>();

function getCachedMagazineHome() {
  const userId = getAuthItem('user_id');

  if (!userId || magazineHomeCache?.userId !== userId) {
    return null;
  }

  return magazineHomeCache;
}

function cacheMagazineHome(scheduleId: string, photoUrls: string[]) {
  const userId = getAuthItem('user_id');

  if (!userId) {
    return;
  }

  magazineHomeCache = { photoUrls, scheduleId, userId };
}

function clearMagazineHomeCache() {
  magazineHomeCache = null;
}

function prefetchMagazinePhotos(photoUrls: string[]) {
  const urlsToPrefetch = photoUrls.filter((photoUrl) => {
    if (prefetchedMagazinePhotoUrls.has(photoUrl)) {
      return false;
    }

    prefetchedMagazinePhotoUrls.add(photoUrl);
    return true;
  });

  if (urlsToPrefetch.length === 0) {
    return;
  }

  void Image.prefetch(urlsToPrefetch, 'memory-disk').catch(() => {
    urlsToPrefetch.forEach((photoUrl) => prefetchedMagazinePhotoUrls.delete(photoUrl));
  });
}

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
      const cachedMagazine = getCachedMagazineHome();

      if (cachedMagazine) {
        setMagazineScheduleId(cachedMagazine.scheduleId);
        setMagazinePhotoUrls(cachedMagazine.photoUrls);
        setIsMagazineLoading(false);
        setHasLoadedMagazine(true);
      }

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
              clearMagazineHomeCache();
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

          cacheMagazineHome(latestClosedSchedule.scheduleId, photoUrls);
          prefetchMagazinePhotos(photoUrls);

          if (isActive) {
            setMagazineScheduleId(latestClosedSchedule.scheduleId);
            setMagazinePhotoUrls(photoUrls);
          }
        } catch {
          if (isActive && !cachedMagazine) {
            clearMagazineHomeCache();
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
