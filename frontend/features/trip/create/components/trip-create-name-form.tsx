// 일정 생성 두 번째 단계의 일정 이름 입력 UI입니다.

import { View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';

import { styles } from '../trip-create-styles';

type TripCreateNameFormProps = {
  scheduleName: string;
  onChangeName: (value: string) => void;
  onClearName: () => void;
};

export function TripCreateNameForm({ scheduleName, onChangeName, onClearName }: TripCreateNameFormProps) {
  return (
    <View style={styles.tripSetupSection}>
      <Text style={styles.formLabel}>일정 이름</Text>
      <View style={styles.inputLine}>
        <TextInput
          accessibilityLabel="일정 이름"
          onChangeText={onChangeName}
          placeholder="우정여행"
          placeholderTextColor="#A3AAAE"
          style={styles.scheduleInput}
          value={scheduleName}
        />
        {scheduleName ? (
          <Pressable accessibilityRole="button" accessibilityLabel="일정 이름 지우기" onPress={onClearName} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
