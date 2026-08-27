// main 홈의 사용자 정보와 최신 매거진 데이터를 불러옵니다.
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';

import { fetchMe } from '@/lib/auth-api';
import { getAuthItem } from '@/lib/auth-storage';
import { getMagazine, MagazineApiError } from '@/lib/magazine-api';
import { getLatestMissionSession, type MissionSession } from '@/lib/mission-session-api';
import { getCachedTripSchedules, getTripSchedule, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';

import { getResultPhotoUrl, getScheduleEndTime, isClosedSchedule } from '../main-home-data';

type MagazineHomeCache = {
  magazinePreviewUrl: string | null;
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

function cacheMagazineHome(scheduleId: string, photoUrls: string[], magazinePreviewUrl: string | null) {
  const userId = getAuthItem('user_id');

  if (!userId) {
    return;
  }

  magazineHomeCache = { magazinePreviewUrl, photoUrls, scheduleId, userId };
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
  const [magazinePreviewUrl, setMagazinePreviewUrl] = useState<string | null>(null);
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
        setMagazinePreviewUrl(cachedMagazine.magazinePreviewUrl);
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

          let latestClosedSchedule = schedules
            .filter(isClosedSchedule)
            .sort((left, right) => getScheduleEndTime(right) - getScheduleEndTime(left))[0];

          if (!latestClosedSchedule) {
            if (isActive) {
              clearMagazineHomeCache();
              setMagazinePreviewUrl(null);
              setMagazineScheduleId(null);
              setMagazinePhotoUrls([]);
            }
            return;
          }

          // The list endpoint can omit missions after a fresh login. Hydrate the
          // selected schedule so the cover can still be assembled from sessions.
          if (latestClosedSchedule.missions.length === 0) {
            try {
              latestClosedSchedule = await getTripSchedule(latestClosedSchedule.scheduleId);
            } catch {
              // The saved magazine lookup below can still recover a generated cover.
            }
          }

          // A generated magazine is persisted on the server. Use its first page
          // as a fallback preview when session photos are not available locally.
          let savedMagazinePreviewUrl: string | null = null;
          try {
            const savedMagazine = await getMagazine(latestClosedSchedule.scheduleId);
            savedMagazinePreviewUrl = savedMagazine.imageUrls[0] ?? null;
          } catch (error) {
            if (!(error instanceof MagazineApiError && error.status === 404)) {
              // Keep the existing session-photo fallback for transient errors.
            }
          }

          const photoUrls = (await Promise.all(latestClosedSchedule.missions.map(async (mission) => {
            try {
              const session: MissionSession = await getLatestMissionSession(latestClosedSchedule.scheduleId, mission.scheduleMissionId);
              return getResultPhotoUrl(session);
            } catch {
              return null;
            }
          }))).filter((photoUrl): photoUrl is string => Boolean(photoUrl)).slice(0, 3);

          cacheMagazineHome(latestClosedSchedule.scheduleId, photoUrls, savedMagazinePreviewUrl);
          prefetchMagazinePhotos(photoUrls);

          if (isActive) {
            setMagazinePreviewUrl(savedMagazinePreviewUrl);
            setMagazineScheduleId(latestClosedSchedule.scheduleId);
            setMagazinePhotoUrls(photoUrls);
          }
        } catch {
          if (isActive && !cachedMagazine) {
            clearMagazineHomeCache();
            setMagazinePreviewUrl(null);
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
    magazinePreviewUrl,
    magazinePhotoUrls,
    magazineScheduleId,
    profileEmoji,
    profileImageUrl,
  };
}
