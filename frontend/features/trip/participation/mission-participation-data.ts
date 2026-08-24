import { MissionSessionApiError, type MissionParticipationStatus } from '@/lib/mission-session-api';

// 미션 참여 화면에서 사용하는 상태 판정과 오류 메시지를 담당합니다.
export function isParticipating(status: MissionParticipationStatus | null | undefined) {
  return status === 'PARTICIPATING' || status === 'COMPLETED';
}

export function hasLeftParticipation(status: MissionParticipationStatus | null | undefined) {
  return status === 'LOCKED_OUT';
}

export function getParticipationErrorMessage(error: unknown) {
  if (error instanceof MissionSessionApiError) {
    switch (error.code) {
      case 'MISSION_LOCATION_REQUIRED':
        return '위치 권한을 허용하고 현재 위치를 다시 확인해 주세요.';
      case 'MISSION_LOCATION_TIMESTAMP_INVALID':
        return '현재 위치 시간을 확인하지 못했어요. 다시 시도해 주세요.';
      case 'MISSION_LOCATION_STALE':
        return '위치 정보가 오래됐어요. 현재 위치를 다시 측정해 주세요.';
      case 'MISSION_LOCATION_INACCURATE':
        return '현재 위치의 정확도가 낮아요. 야외에서 잠시 후 다시 시도해 주세요.';
      case 'MISSION_LOCATION_OUT_OF_RANGE':
        return '미션 장소 근처에서만 참여할 수 있어요.';
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : '참여 상태를 바꾸지 못했어요.';
}
