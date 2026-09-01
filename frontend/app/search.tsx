import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.title}>관광지 검색</Text>

      <View style={styles.searchField}>
        <Feather color="#92999D" name="search" size={28} />
        <TextInput
          onChangeText={setQuery}
          placeholder="관광지 검색해주세요..."
          placeholderTextColor="#92999D"
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
      </View>

      <Text style={styles.sectionTitle}>최근 검색어</Text>
      <Text style={[styles.sectionTitle, styles.recommendedTitle]}>추천 검색어</Text>

      <View style={styles.notes}>
        <Text style={styles.note}>돌아갈 내용-지역/위치/이미지/행사.축제 정보/소개정보/반려동물 정보</Text>
        <Text style={styles.note}>상단에 지역-위치</Text>
        <Text style={styles.note}>메인에 이미지+상세 소개 정보</Text>
        <Text style={styles.note}>하단에 행사 축제 정보 및 반려동물 정보</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 25,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: '#F5F7F8',
    borderRadius: 30,
    flexDirection: 'row',
    height: 60,
    marginTop: 43,
    paddingHorizontal: 30,
  },
  input: {
    color: '#10161F',
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    marginLeft: 15,
    paddingVertical: 0,
  },
  sectionTitle: {
    color: '#10161F',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 71,
  },
  recommendedTitle: {
    marginTop: 35,
  },
  notes: {
    marginTop: 91,
  },
  note: {
    color: '#92999D',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
});
