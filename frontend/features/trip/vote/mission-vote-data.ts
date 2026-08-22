// 미션 투표 화면에서 사용하는 파라미터 변환을 담당합니다.
export function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
