import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

import { getTermsDocument } from './terms-data';

export default function TermsDetailScreen() {
  const { bottomSafeInset, height, horizontalPadding, topSafeInset, width } = useResponsiveLayout();
  const params = useLocalSearchParams<{ document?: string | string[] }>();
  const document = getTermsDocument(params.document);

  return (
    <View style={styles.container}>
      <Svg height={height} pointerEvents="none" preserveAspectRatio="none" style={StyleSheet.absoluteFill} width={width}>
        <Defs>
          <LinearGradient id="terms-detail-background" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#BDEAFB" stopOpacity="0.7" />
            <Stop offset="0.24" stopColor="#BDEAFB" stopOpacity="0.32" />
            <Stop offset="0.56" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#terms-detail-background)" height={height} width={width} />
      </Svg>
      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingBottom: bottomSafeInset + 38, paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 32 }}
        showsVerticalScrollIndicator={false}>
        <ScalePressable accessibilityLabel="뒤로 가기" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color="#10161F" name="chevron-back" size={29} />
        </ScalePressable>

        <TextBlock style={styles.title}>{document.detailTitle}</TextBlock>

        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <TextBlock style={styles.sectionTitle}>{section.title}</TextBlock>
            {section.blocks.map((block, blockIndex) => {
              if (block.type === 'paragraph') {
                return <TextBlock key={`${section.title}-paragraph-${blockIndex}`} style={styles.paragraph}>{block.text}</TextBlock>;
              }

              return (
                <View key={`${section.title}-list-${blockIndex}`} style={styles.list}>
                  {block.items.map((item, itemIndex) => (
                    <TextBlock key={`${section.title}-${itemIndex}`} style={styles.listItem}>{`${itemIndex + 1}. ${item}`}</TextBlock>
                  ))}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function TextBlock({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={style}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  backButton: {
    alignItems: 'center',
    height: 35,
    justifyContent: 'center',
    marginLeft: -8,
    width: 35,
  },
  title: {
    color: '#10161F',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 35,
    marginTop: 39,
    marginBottom: 20,
  },
  section: {
    marginTop: 37,
  },
  sectionTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.4,
    lineHeight: 25,
    marginBottom: 15,
  },
  paragraph: {
    color: '#9EA5A9',
    fontSize: 14,
    lineHeight: 21,
  },
  list: {
    gap: 10,
  },
  listItem: {
    color: '#9EA5A9',
    fontSize: 14,
    lineHeight: 18,
  },
});
