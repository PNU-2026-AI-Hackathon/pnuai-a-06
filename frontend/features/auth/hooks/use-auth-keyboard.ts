import { useEffect, useRef, useState } from 'react';
import { Keyboard, type ScrollView } from 'react-native';

export function useAuthKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const authScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      authScrollRef.current?.scrollTo({ animated: true, y: 0 });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const keepFocusedInputVisible = () => {
    setTimeout(() => {
      authScrollRef.current?.scrollTo({ animated: true, y: 96 });
    }, 80);
  };

  return { authScrollRef, keyboardHeight, keepFocusedInputVisible };
}
