import { FlowButton, FlowScreen } from '@/components/flow-screen';

// 1인 미션 시간 초과 시 실패 상태와 일정 복귀 버튼을 보여주는 화면입니다.
export function MissionFailureView({ onGoBack }: { onGoBack: () => void }) {
  return (
    <FlowScreen title="미션 실패" subtitle="제한 시간 안에 미션을 완료하지 못했어요.">
      <FlowButton label="일정으로 돌아가기" onPress={onGoBack} />
    </FlowScreen>
  );
}
