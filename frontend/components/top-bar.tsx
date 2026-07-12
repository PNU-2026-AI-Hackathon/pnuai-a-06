import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type TopBarProps = {
  onBack?: () => void;
  title: string;
  titleNumberOfLines?: number;
};

export function TopBar({ onBack, title, titleNumberOfLines = 1 }: TopBarProps) {
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.container}>
      <Pressable accessibilityLabel="뒤로 가기" onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text numberOfLines={titleNumberOfLines} style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 48,
  },
  backIcon: {
    color: '#202124',
    fontSize: 42,
    lineHeight: 42,
  },
  title: {
    color: '#10161F',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  spacer: {
    width: 48,
  },
});
