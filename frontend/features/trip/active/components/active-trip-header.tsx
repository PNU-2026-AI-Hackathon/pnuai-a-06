import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';
import type { TripSchedule } from '@/lib/trip-schedule-api';
import { getParticipantText } from '../active-data';
import { styles } from './active-trip-header-styles';

const activeAddPeopleIcon = require('@/assets/svg/active/add_people.svg');
const activeSettingIcon = require('@/assets/svg/active/setting.svg');
const crownIcon = require('@/assets/svg/active/crown.svg');

type ActiveTripHeaderProps = {
  schedule: TripSchedule | null;
  isScheduleCreator: boolean;
  canInviteCompanion: boolean;
  isCreatingInvite: boolean;
  onCreateInvite: () => void | Promise<void>;
  onOpenSettings: () => void;
};

// active 여행 화면의 일정 제목, 동행자 수, 초대 및 설정 액션을 담당합니다.
export function ActiveTripHeader({
  canInviteCompanion,
  isCreatingInvite,
  isScheduleCreator,
  onCreateInvite,
  onOpenSettings,
  schedule,
}: ActiveTripHeaderProps) {
  const inviteTarget = useTutorialTarget('trip-invite', { offsetY: 27 });
  const settingsTarget = useTutorialTarget('trip-settings', { offsetY: 27 });

  return (
    <View style={styles.tripHeader}>
      <View style={styles.tripTitleBlock}>
        <View style={styles.tripTitleRow}>
          <Text numberOfLines={2} style={styles.tripTitle}>{schedule?.roomName ?? '여행 일정'}</Text>
          {isScheduleCreator ? <Image contentFit="contain" source={crownIcon} style={styles.creatorCrown} /> : null}
        </View>
        <Text style={styles.companionsText}>{getParticipantText(schedule)}</Text>
      </View>
      <View style={styles.headerActions}>
        {canInviteCompanion ? (
          <View onLayout={inviteTarget.onLayout} ref={inviteTarget.ref}>
            <ScalePressable accessibilityLabel="동행자 추가" disabled={!schedule || isCreatingInvite} onPress={onCreateInvite} pressedScale={0.9} style={styles.settingsButton}>
              {isCreatingInvite ? <ActivityIndicator color="#8A9194" /> : <Image source={activeAddPeopleIcon} style={styles.headerIcon} contentFit="contain" />}
            </ScalePressable>
          </View>
        ) : null}
        <View onLayout={settingsTarget.onLayout} ref={settingsTarget.ref}>
          <ScalePressable accessibilityLabel="여행 설정" onPress={onOpenSettings} pressedScale={0.9} style={styles.settingsButton}>
            <Image source={activeSettingIcon} style={styles.headerIcon} contentFit="contain" />
          </ScalePressable>
        </View>
      </View>
    </View>
  );
}
