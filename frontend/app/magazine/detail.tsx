import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function MagazineDetailScreen() {
  return (
    <FlowScreen title="M03 매거진 상세/편집" subtitle="표지, 페이지, 저장, 공유">
      <FlowButton label="저장/공유 후 메인으로" onPress={() => router.replace('/main')} />
    </FlowScreen>
  );
}
