import { MissionReviewWaitingView } from '@/features/trip/review/components/mission-review-waiting-view';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function MissionWaitingScreen() {
  const { bottomSafeInset, topSafeInset } = useResponsiveLayout();

  return <MissionReviewWaitingView bottomSafeInset={bottomSafeInset} topSafeInset={topSafeInset} />;
}
