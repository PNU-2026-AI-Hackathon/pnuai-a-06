// 지도 화면에서 사용하는 테마와 카테고리 타입입니다.
export type MissionTheme = 'MOUNTAIN' | 'SEA' | 'CITY' | 'DEMO';
export type CategoryValue = MissionTheme | 'ACQUIRED';

export type MapPieceTarget = {
  number: number;
  district: string;
  districtCode: string;
  x: number;
  y: number;
};

export type CategoryItem = {
  icon: number;
  selectedIcon: number;
  label: string;
  value: CategoryValue;
};
