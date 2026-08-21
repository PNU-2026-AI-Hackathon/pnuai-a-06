// 미션 화면에서 사용하는 테마와 화면 전용 타입을 정의합니다.

export type MissionTheme = 'MOUNTAIN' | 'SEA' | 'CITY' | 'DEMO';

export type MissionThemeItem = {
  icon: number;
  label: string;
  value: MissionTheme;
};
