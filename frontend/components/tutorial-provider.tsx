import { router } from 'expo-router';
import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { TutorialOverlay, type TutorialShape, type TutorialTarget } from '@/components/tutorial-overlay';
import { getAuthItem } from '@/lib/auth-storage';
import { hasSeenAppTutorial, markAppTutorialCompleted } from '@/lib/tutorial-storage';

export type TutorialTargetId = 'home-nav' | 'magazine' | 'profile-edit' | 'profile-header' | 'profile-nav' | 'mission-nav';

type TutorialStep = {
  action: 'next' | 'target';
  messageGap?: number;
  message: string;
  placement: 'above' | 'below';
  shape: TutorialShape;
  targetId: TutorialTargetId;
};

const tutorialSteps: TutorialStep[] = [
  {
    action: 'next',
    message: '홈 아이콘에서는 여행을 통해 만들어지는 매거진을 확인할 수 있어요.',
    placement: 'above',
    shape: 'roundedRect',
    targetId: 'home-nav',
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
    message: '오른쪽 상단 프로필을 눌러 내 정보와 설정을 확인해보세요.',
    placement: 'below',
    shape: 'circle',
    targetId: 'profile-header',
  },
  {
    action: 'next',
    message: '프로필 사진과 닉네임을 변경할 수 있어요.',
    placement: 'below',
    shape: 'circle',
    targetId: 'profile-edit',
  },
  {
    action: 'target',
    message: '깃발 아이콘을 눌러 미션을 확인해보세요.',
    placement: 'above',
    shape: 'roundedRect',
    targetId: 'mission-nav',
  },
];

type TutorialContextValue = {
  activeStep: TutorialStep | null;
  activeTarget: TutorialTarget | null;
  advance: () => void;
  goBack: () => void;
  handleTargetPress: () => void;
  registerTarget: (id: TutorialTargetId, target: TutorialTarget) => void;
  start: () => Promise<void>;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: PropsWithChildren) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targets, setTargets] = useState<Partial<Record<TutorialTargetId, TutorialTarget>>>({});
  const isStarting = useRef(false);

  const registerTarget = useCallback((id: TutorialTargetId, target: TutorialTarget) => {
    setTargets((currentTargets) => {
      const currentTarget = currentTargets[id];
      const isSameTarget = currentTarget
        && currentTarget.x === target.x
        && currentTarget.y === target.y
        && currentTarget.width === target.width
        && currentTarget.height === target.height;

      return isSameTarget ? currentTargets : { ...currentTargets, [id]: target };
    });
  }, []);

  const finish = useCallback(() => {
    setStepIndex(null);

    const userId = getAuthItem('user_id');

    if (userId) {
      void markAppTutorialCompleted(userId);
    }
  }, []);

  const advance = useCallback(() => {
    setStepIndex((currentStepIndex) => {
      if (currentStepIndex === null || currentStepIndex >= tutorialSteps.length - 1) {
        return currentStepIndex;
      }

      return currentStepIndex + 1;
    });
  }, []);

  const goBack = useCallback(() => {
    if (stepIndex === null || stepIndex === 0) {
      return;
    }

    if (stepIndex === 4) {
      router.replace('/main/profile');
    } else if (stepIndex >= 3) {
      router.replace('/main');
    }

    setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  const handleTargetPress = useCallback(() => {
    if (stepIndex === null) {
      return;
    }

    const currentStep = tutorialSteps[stepIndex];

    if (currentStep.targetId === 'profile-header') {
      router.push('/main/profile');
    } else if (currentStep.targetId === 'mission-nav') {
      router.push('/map');
    }

    if (currentStepIndexIsLast(currentStep)) {
      finish();
      return;
    }

    setStepIndex(stepIndex + 1);
  }, [finish, stepIndex]);

  const start = useCallback(async () => {
    if (isStarting.current || stepIndex !== null) {
      return;
    }

    const userId = getAuthItem('user_id');

    if (!userId) {
      return;
    }

    isStarting.current = true;

    try {
      if (!(await hasSeenAppTutorial(userId))) {
        setStepIndex(0);
      }
    } finally {
      isStarting.current = false;
    }
  }, [stepIndex]);

  const activeStep = stepIndex === null ? null : tutorialSteps[stepIndex] ?? null;
  const activeTarget = activeStep ? targets[activeStep.targetId] ?? null : null;
  const value = useMemo(() => ({
    activeStep,
    activeTarget,
    advance,
    goBack,
    handleTargetPress,
    registerTarget,
    start,
  }), [activeStep, activeTarget, advance, goBack, handleTargetPress, registerTarget, start]);

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

function currentStepIndexIsLast(step: TutorialStep) {
  return step === tutorialSteps[tutorialSteps.length - 1];
}

export function TutorialOverlayHost() {
  const { activeStep, activeTarget, advance, goBack, handleTargetPress } = useTutorial();

  if (!activeStep || !activeTarget) {
    return null;
  }

  return (
    <TutorialOverlay
      message={activeStep.message}
      messageGap={activeStep.messageGap}
      messagePlacement={activeStep.placement}
      onNext={activeStep.action === 'next' ? advance : undefined}
      onPrev={activeStepIndex(activeStep) > 0 ? goBack : undefined}
      onTargetPress={activeStep.action === 'target' ? handleTargetPress : undefined}
      shape={activeStep.shape}
      target={activeTarget}
    />
  );
}

function activeStepIndex(step: TutorialStep) {
  return tutorialSteps.indexOf(step);
}

export function useTutorial() {
  const context = useContext(TutorialContext);

  if (!context) {
    throw new Error('useTutorial must be used inside TutorialProvider');
  }

  return context;
}

type TutorialTargetOptions = Pick<TutorialTarget, 'height' | 'width'> & {
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
  const onLayout = useCallback(() => {
    targetRef.current?.measureInWindow((x, y, width, height) => {
      const nextWidth = targetWidth ?? width;
      const nextHeight = targetHeight ?? height;

      registerTarget(id, {
        height: nextHeight,
        width: nextWidth,
        x: x - (nextWidth - width) / 2 + offsetX,
        y: y - (nextHeight - height) / 2 + offsetY,
      });
    });
  }, [id, offsetX, offsetY, registerTarget, targetHeight, targetWidth]);

  return { onLayout, ref: targetRef };
}
