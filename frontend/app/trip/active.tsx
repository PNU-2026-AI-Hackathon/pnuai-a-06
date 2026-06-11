import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function ActiveTripScreen() {
  return (
    <FlowScreen title="T03 여행 중" subtitle="동행자 피드, 댓글 스타일 SNS">
      <FlowButton label="미션 카드 클릭" onPress={() => router.push('/trip/capture')} />
      <FlowButton label="여행 종료" onPress={() => router.push('/trip/after')} />
    </FlowScreen>
  );
}
