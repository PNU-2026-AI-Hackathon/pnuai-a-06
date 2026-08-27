import { router } from 'expo-router';
import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { TutorialOverlay, type TutorialShape, type TutorialTarget } from '@/components/tutorial-overlay';
import { getAuthItem } from '@/lib/auth-storage';
import { hasSeenTutorial, markTutorialCompleted, type TutorialId } from '@/lib/tutorial-storage';

export type TutorialTargetId =
  | 'home-nav'
  | 'magazine'
  | 'profile-edit'
  | 'profile-header'
  | 'profile-nav'
  | 'mission-nav'
  | 'map-mountain'
  | 'map-sea'
  | 'map-city'
  | 'map-demo'
  | 'map-dongnae'
  | 'mission-card'
  | 'mission-detail'
  | 'mission-list'
  | 'trip-create'
  | 'trip-list'
  | 'trip-invite'
  | 'trip-add-mission'
  | 'trip-mission-list'
  | 'trip-route'
  | 'trip-settings'
  | 'trip-feed';

type TutorialStep = {
  action: 'next' | 'target';
  messageGap?: number;
  message: string;
  messageOffsetY?: number;
  startButton?: boolean;
  nextLabel?: string;
  placement: 'above' | 'below' | 'center';
  shape: TutorialShape;
  targetId?: TutorialTargetId;
  gestureHint?: 'horizontalSwipe';
};

const tutorialStepsById: Record<TutorialId, TutorialStep[]> = {
  profile: [
    {
      action: 'next',
      message: '',
      messageOffsetY: 32,
      nextLabel: '튜토리얼 시작하기',
      placement: 'center',
      shape: 'roundedRect',
      startButton: true,
    },
    {
      action: 'next',
      message: '일정을 생성해서 미션을 수행하면 여행이 끝난 후 매거진이 이곳에 자동으로 생성돼요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'magazine',
    },
    {
      action: 'target',
      message: '프로필을 눌러 내 정보와 설정을 확인해보세요.',
      placement: 'below',
      shape: 'circle',
      targetId: 'profile-header',
    },
    {
      action: 'next',
      message: '프로필 사진과 닉네임을 변경할 수 있어요.',
      nextLabel: 'Finish',
      placement: 'below',
      shape: 'circle',
      targetId: 'profile-edit',
    },
  ],
  map: [
    {
      action: 'next',
      message: '산 테마에서 지역별 미션을 확인할 수 있어요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'map-mountain',
    },
    {
      action: 'next',
      message: '바다 테마에서도 다양한 미션을 만날 수 있어요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'map-sea',
    },
    {
      action: 'next',
      message: '도시 테마에서는 도심 속 미션을 확인할 수 있어요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'map-city',
    },
    {
      action: 'target',
      message: '지도에서 해당 활성 구역을 눌러 미션을 확인해보세요.',
      placement: 'below',
      shape: 'circle',
      targetId: 'map-dongnae',
    },
    {
      action: 'next',
      gestureHint: 'horizontalSwipe',
      message: '카드를 오른쪽으로 스와이프해서\n다음 미션을 볼 수 있어요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'mission-card',
    },
    {
      action: 'target',
      message: '미션 상세 보기를 눌러 자세한 내용을 확인해보세요.',
      placement: 'above',
      shape: 'roundedRect',
      targetId: 'mission-detail',
    },
    {
      action: 'next',
      message: '하고 싶은 미션을 원하는 일정에 담을 수 있어요.',
      nextLabel: 'Finish',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'mission-list',
    },
  ],
  'trip-hub': [
    {
      action: 'next',
      message: '새 일정 만들기 버튼으로\n여행 일정을 생성할 수 있어요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'trip-create',
    },
    {
      action: 'next',
      message: '생성한 일정은 이곳에 리스트 형태로 보여요.',
      nextLabel: 'Finish',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'trip-list',
    },
  ],
  'trip-active': [
    {
      action: 'next',
      message: '친구 추가 버튼으로\n카카오톡 공유 및 동행자 초대가 가능해요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'trip-invite',
    },
    {
      action: 'next',
      message: '미션 추가 버튼으로 원하는\n날짜에 미션을 추가할 수 있어요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'trip-add-mission',
    },
    {
      action: 'next',
      message: '추가한 미션은 이곳에 표시되고,\n미션을 누르면 시작할 수 있는 버튼이 나와요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'trip-mission-list',
    },
    {
      action: 'next',
      message: '날짜별 경로에서 하루에 2개 이상 미션을 담으면\n경로를 계산해 미션 순서를 추천해줘요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'trip-route',
    },
    {
      action: 'next',
      message: '우측 상단 설정에서 여행 이름, 일정, 동행자, 미션을 관리할 수 있어요.',
      placement: 'below',
      shape: 'roundedRect',
      targetId: 'trip-settings',
    },
    {
      action: 'next',
      message: '미션을 모두 수행하면\n함께 찍은 사진이 이곳 피드에 보여요.',
      nextLabel: 'Finish',
      placement: 'above',
      shape: 'roundedRect',
      targetId: 'trip-feed',
    },
  ],
};

type TutorialTargetEntry = {
  metadata?: string;
  onPress?: () => void;
  onSwipe?: (direction: 1 | -1) => void;
  target: TutorialTarget;
};

type TutorialContextValue = {
  activeStep: TutorialStep | null;
  activeStepIndex: number;
  activeTarget: TutorialTarget | null;
  activeTargetSwipe?: (direction: 1 | -1) => void;
  activeTutorial: TutorialId | null;
  advance: () => void;
  goBack: () => void;
  handleTargetPress: () => void;
  registerTarget: (id: TutorialTargetId, target: TutorialTarget, onPress?: () => void, onSwipe?: (direction: 1 | -1) => void, metadata?: string) => void;
  skip: () => void;
  start: (tutorialId?: TutorialId) => Promise<void>;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: PropsWithChildren) {
  const [activeTutorial, setActiveTutorial] = useState<TutorialId | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targets, setTargets] = useState<Partial<Record<TutorialTargetId, TutorialTargetEntry>>>({});
  const isStarting = useRef(false);

  const registerTarget = useCallback((id: TutorialTargetId, target: TutorialTarget, onPress?: () => void, onSwipe?: (direction: 1 | -1) => void, metadata?: string) => {
    setTargets((currentTargets) => {
      const currentEntry = currentTargets[id];
      const currentTarget = currentEntry?.target;
      const isSameTarget = currentTarget
        && currentTarget.x === target.x
        && currentTarget.y === target.y
        && currentTarget.width === target.width
        && currentTarget.height === target.height
        && currentEntry?.onPress === onPress
        && currentEntry?.onSwipe === onSwipe
        && currentEntry?.metadata === metadata;

      return isSameTarget ? currentTargets : { ...currentTargets, [id]: { metadata, onPress, onSwipe, target } };
    });
  }, []);

  const finish = useCallback(() => {
    setStepIndex(null);
    setActiveTutorial(null);

    const userId = getAuthItem('user_id');

    if (userId && activeTutorial) {
      void markTutorialCompleted(userId, activeTutorial);
    }
  }, [activeTutorial]);

  const advance = useCallback(() => {
    if (stepIndex === null || !activeTutorial) {
      return;
    }

    const tutorialSteps = tutorialStepsById[activeTutorial];

    if (stepIndex >= tutorialSteps.length - 1) {
      finish();
      return;
    }

    if (activeTutorial === 'map') {
      const currentTargetId = tutorialSteps[stepIndex].targetId;

      if (currentTargetId === 'map-mountain') {
        targets['map-sea']?.onPress?.();
      } else if (currentTargetId === 'map-sea') {
        targets['map-city']?.onPress?.();
      } else if (currentTargetId === 'map-city') {
        targets['map-demo']?.onPress?.();
        setStepIndex(stepIndex + 1);
        return;
      }
    }

    setStepIndex(stepIndex + 1);
  }, [activeTutorial, finish, stepIndex, targets]);

  const goBack = useCallback(() => {
    if (stepIndex === null || stepIndex === 0 || !activeTutorial) {
      return;
    }

    if (activeTutorial === 'map') {
      if (stepIndex === 6) {
        const missionCode = targets['mission-card']?.metadata;
        router.replace({
          pathname: '/map',
          params: {
            tutorialMissionCode: missionCode ?? '',
            tutorialRestoreDeck: 'true',
          },
        });
        setStepIndex(5);
        return;
      }

      if (stepIndex === 5) {
        const missionCode = targets['mission-card']?.metadata;
        router.replace({
          pathname: '/map',
          params: {
            tutorialMissionCode: missionCode ?? '',
            tutorialRestoreDeck: 'true',
          },
        });
      } else if (stepIndex === 4) {
        const missionCode = targets['mission-card']?.metadata;
        router.replace({
          pathname: '/map',
          params: { tutorialMissionCode: missionCode ?? '' },
        });
      } else {
        router.replace('/map');
      }
    } else if (activeTutorial === 'profile' && stepIndex === 3) {
      router.replace('/main/profile');
    } else if (activeTutorial === 'profile' && stepIndex >= 2) {
      router.replace('/main');
    }

    setStepIndex(stepIndex - 1);
  }, [activeTutorial, stepIndex, targets]);

  const handleTargetPress = useCallback(() => {
    if (stepIndex === null || !activeTutorial) {
      return;
    }

    const tutorialSteps = tutorialStepsById[activeTutorial];
    const currentStep = tutorialSteps[stepIndex];

    if (currentStep.targetId) {
      targets[currentStep.targetId]?.onPress?.();
    }

    if (currentStep.targetId === 'profile-header') {
      router.push('/main/profile');
    }

    if (stepIndex >= tutorialSteps.length - 1) {
      finish();
      return;
    }

    setStepIndex(stepIndex + 1);
  }, [activeTutorial, finish, stepIndex, targets]);

  const start = useCallback(async (tutorialId: TutorialId = 'profile') => {
    if (isStarting.current || stepIndex !== null || activeTutorial !== null) {
      return;
    }

    const userId = getAuthItem('user_id');

    if (!userId) {
      return;
    }

    isStarting.current = true;

    try {
      if (!(await hasSeenTutorial(userId, tutorialId))) {
        await markTutorialCompleted(userId, tutorialId);
        setActiveTutorial(tutorialId);
        setStepIndex(0);
      }
    } finally {
      isStarting.current = false;
    }
  }, [activeTutorial, stepIndex]);

  const activeSteps = activeTutorial ? tutorialStepsById[activeTutorial] : null;
  const activeStep = activeSteps && stepIndex !== null ? activeSteps[stepIndex] ?? null : null;
  const activeTarget = activeStep?.targetId ? targets[activeStep.targetId]?.target ?? null : null;
  const activeTargetSwipe = activeStep?.targetId ? targets[activeStep.targetId]?.onSwipe : undefined;
  const value = useMemo(() => ({
    activeStep,
    activeStepIndex: stepIndex ?? 0,
    activeTarget,
    activeTargetSwipe,
    activeTutorial,
    advance,
    goBack,
    handleTargetPress,
    registerTarget,
    skip: finish,
    start,
  }), [activeStep, activeTarget, activeTargetSwipe, activeTutorial, advance, finish, goBack, handleTargetPress, registerTarget, start, stepIndex]);

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function TutorialOverlayHost() {
  const { activeStep, activeStepIndex, activeTarget, activeTargetSwipe, activeTutorial, advance, goBack, handleTargetPress, skip } = useTutorial();

  if (!activeStep) {
    return null;
  }

  return (
    <TutorialOverlay
      message={activeStep.message}
      messageGap={activeStep.messageGap}
      messageOffsetY={activeStep.messageOffsetY}
      messagePlacement={activeStep.placement}
      avoidSkipOverlap={activeTutorial !== 'map'}
      startButton={activeStep.startButton}
      nextLabel={activeStep.nextLabel}
      onNext={activeStep.action === 'next' ? advance : undefined}
      onPrev={activeStepIndex > 0 ? goBack : undefined}
      onTargetSwipe={activeTargetSwipe}
      onTargetPress={activeStep.action === 'target' ? handleTargetPress : undefined}
      onSkip={skip}
      shape={activeStep.shape}
      target={activeTarget}
      gestureHint={activeStep.gestureHint}
    />
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);

  if (!context) {
    throw new Error('useTutorial must be used inside TutorialProvider');
  }

  return context;
}

type TutorialTargetOptions = Pick<TutorialTarget, 'height' | 'width'> & {
  metadata?: string;
  onPress?: () => void;
  onSwipe?: (direction: 1 | -1) => void;
  offsetX?: number;
  offsetY?: number;
};

export function useTutorialTarget(id: TutorialTargetId, options?: Partial<TutorialTargetOptions>) {
  const { registerTarget } = useTutorial();
  const targetRef = useRef<View>(null);
  const targetHeight = options?.height;
  const targetWidth = options?.width;
  const offsetX = options?.offsetX ?? 0;
  const offsetY = options?.offsetY ?? 0;
  const onPressRef = useRef(options?.onPress);
  const onSwipeRef = useRef(options?.onSwipe);
  const metadataRef = useRef(options?.metadata);
  onPressRef.current = options?.onPress;
  onSwipeRef.current = options?.onSwipe;
  metadataRef.current = options?.metadata;
  const handlePress = useCallback(() => onPressRef.current?.(), []);
  const handleSwipe = useCallback((direction: 1 | -1) => onSwipeRef.current?.(direction), []);
  const onLayout = useCallback(() => {
    targetRef.current?.measureInWindow((x, y, width, height) => {
      const nextWidth = targetWidth ?? width;
      const nextHeight = targetHeight ?? height;

      registerTarget(
        id,
        {
          height: nextHeight,
          width: nextWidth,
          x: x - (nextWidth - width) / 2 + offsetX,
          y: y - (nextHeight - height) / 2 + offsetY,
        },
        options?.onPress ? handlePress : undefined,
        options?.onSwipe ? handleSwipe : undefined,
        metadataRef.current,
      );
    });
  }, [handlePress, handleSwipe, id, offsetX, offsetY, options?.onPress, options?.onSwipe, registerTarget, targetHeight, targetWidth]);

  return { onLayout, ref: targetRef };
}
