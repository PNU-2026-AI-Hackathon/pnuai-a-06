// 일정 생성 화면의 라우트 진입점입니다.

import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { TripCreateCalendar } from '@/features/trip/create/components/trip-create-calendar';
import { TripCreateNameForm } from '@/features/trip/create/components/trip-create-name-form';
import { TripInviteModal } from '@/features/trip/create/components/trip-invite-modal';
import { useTripCreate } from '@/features/trip/create/hooks/use-trip-create';
import { getParamValue, shiftMonth } from '@/features/trip/create/trip-create-data';
import { styles } from '@/features/trip/create/trip-create-styles';
import { ScalePressable } from '@/components/scale-pressable';
import { TopBar } from '@/components/top-bar';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function TripCreateScreen() {
  const params = useLocalSearchParams<{ pendingMissionId?: string | string[] }>();
  const pendingMissionId = getParamValue(params.pendingMissionId);
  const { bottomActionInset, horizontalPadding, isCompactWidth, isTallScreen, topInset } = useResponsiveLayout();
  const contentTopGap = isTallScreen ? 36 : 22;
  const nextButtonPadding = isTallScreen ? 18 : 15;
  const bottomButtonInset = Math.max(bottomActionInset - 8, 0);
  const nextButtonOffset = 32;
  const titleSize = isCompactWidth ? 21 : 23;
  const {
    calendarDays,
    calendarMonth,
    canGoNextMonth,
    canGoPrevMonth,
    closeInviteSheet,
    endDate,
    handleBack,
    handleCopyInviteLink,
    handleDateSelect,
    handleDateStepNext,
    handleNext,
    handleScheduleNameChange,
    handleShareInvite,
    inviteSheetVisible,
    isBottomButtonDisabled,
    isCreatingSchedule,
    isSharingInvite,
    message,
    occupiedDateValues,
    setCalendarMonth,
    setScheduleName,
    scheduleName,
    startDate,
    step,
  } = useTripCreate({
    onBack: () => router.back(),
    onCreated: (scheduleId, createdPendingMissionId) => {
      if (createdPendingMissionId) {
        router.replace({ pathname: '/trip/active', params: { scheduleId } });
        return;
      }

      router.replace('/trip/hub');
    },
    pendingMissionId,
  });

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomButtonInset,
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <TopBar title="여행 시작하기" onBack={handleBack} />

      <View style={[styles.content, { paddingBottom: 14, paddingTop: contentTopGap }]}>
        {step === 'date' ? (
          <>
            <View>
              <Text style={styles.stepText}>1/2</Text>
              <Text style={[styles.heading, { fontSize: titleSize }]}>여행 기간을 알려주세요</Text>
              <Text style={styles.description}>여행 기간에 맞춰 미션이 부여돼요.</Text>
            </View>
            <TripCreateCalendar
              calendarDays={calendarDays}
              calendarMonth={calendarMonth}
              canGoNextMonth={canGoNextMonth}
              canGoPrevMonth={canGoPrevMonth}
              endDate={endDate}
              occupiedDateValues={occupiedDateValues}
              onChangeMonth={(offset) => setCalendarMonth((current) => shiftMonth(current, offset))}
              onSelectDate={handleDateSelect}
              startDate={startDate}
            />
          </>
        ) : (
          <>
            <View>
              <Text style={styles.stepText}>2/2</Text>
              <Text style={[styles.heading, { fontSize: titleSize }]}>어떤 여행인가요?</Text>
              <Text style={styles.description}>일정 이름을 작성해주세요</Text>
            </View>
            <TripCreateNameForm onChangeName={handleScheduleNameChange} onClearName={() => setScheduleName('')} scheduleName={scheduleName} />
          </>
        )}

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>

      <View style={{ transform: [{ translateY: nextButtonOffset }] }}>
        <ScalePressable
          disabled={isBottomButtonDisabled}
          onPress={step === 'date' ? handleDateStepNext : handleNext}
          pressedScale={0.97}
          style={[styles.nextButton, { paddingVertical: nextButtonPadding }, step === 'people' && styles.startTripButton, isBottomButtonDisabled && styles.disabledButton]}>
          {isCreatingSchedule ? <ActivityIndicator color="#ffffff" /> : <Text style={[styles.nextButtonText, step === 'people' && styles.startTripButtonText]}>{step === 'date' ? '다음' : '여행 시작'}</Text>}
        </ScalePressable>
      </View>

      <TripInviteModal
        isSharingInvite={isSharingInvite}
        message={message}
        onClose={closeInviteSheet}
        onCopyLink={handleCopyInviteLink}
        onShare={handleShareInvite}
        visible={inviteSheetVisible}
      />
    </View>
  );
}
