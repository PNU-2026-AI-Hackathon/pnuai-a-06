import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type FlowScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

type FlowButtonProps = {
  label: string;
  onPress: () => void;
};

export function FlowScreen({ title, subtitle, children }: FlowScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

export function FlowButton({ label, onPress }: FlowButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#555555',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: 10,
    marginTop: 8,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#222222',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
