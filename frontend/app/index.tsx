import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

const splashText = require('../assets/svg/logo_text.svg');
const splashMap = require('../assets/svg/splash_map.svg');

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('로그인 화면 진입');
      router.replace('/login');
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.brandGroup}>
        <Image source={splashText} style={styles.logoText} contentFit="contain" />
        <Image source={splashMap} style={styles.logoMap} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
  },
  brandGroup: {
    alignItems: 'center',
    gap: 28,
    transform: [{ translateY: -36 }],
  },
  logoText: {
    height: 42,
    width: 119,
  },
  logoMap: {
    height: 170,
    width: 218,
  },
});
