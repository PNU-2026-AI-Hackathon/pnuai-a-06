import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type TopBarProps = {
  onBack?: () => void;
  title: string;
};

export function TopBar({ onBack, title }: TopBarProps) {
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.container}>
      <Pressable accessibilityLabel="뒤로 가기" onPress={handleBack} style={styles.backButton}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 38,
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
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    width: 48,
  },
});
