// 로그인·회원가입·인증·비밀번호 재설정 흐름과 상태를 관리합니다.
import { useState } from 'react';

import {
  confirmPasswordReset,
  loginWithEmail,
  registerWithEmail,
  requestPasswordReset,
  saveAuthTokens,
  verifyEmail,
} from '@/lib/auth-api';
import { getLoginErrorMessage, getRegisterErrorMessage, getRequestErrorMessage } from '@/lib/auth-error';
import { clearDeletedAccountEmail } from '@/lib/auth-storage';
import { getPasswordMatchState, isValidEmail, isValidPassword } from '@/lib/auth-validation';

import { continueWithKakao } from '../services/kakao-auth';
import type { AuthMode } from '../types';

type UseAuthFlowOptions = {
  initialMode: AuthMode;
  onAuthenticated: () => void;
};

export function useAuthFlow({ initialMode, onAuthenticated }: UseAuthFlowOptions) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoLogin, setAutoLogin] = useState(true);

  const passwordMatchState = getPasswordMatchState(password, passwordConfirmation);

  const resetMessage = () => setMessage('');

  const completeLogin = async (shouldPersist = false) => {
    const tokens = await loginWithEmail(email.trim(), password);
    await saveAuthTokens(tokens, shouldPersist);
    onAuthenticated();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setMessage('이메일 주소와 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await completeLogin(autoLogin);
    } catch (error) {
      setMessage(getLoginErrorMessage(error, email));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !passwordConfirmation) {
      setMessage('모든 항목을 입력해주세요.');
      return;
    }

    if (!isValidEmail(email)) {
      setMessage('올바른 이메일 형식으로 입력해 주세요.');
      return;
    }

    if (!isValidPassword(password)) {
      setMessage('비밀번호는 영문·숫자 포함 8자 이상이어야 합니다.');
      return;
    }

    if (password !== passwordConfirmation) {
      setMessage('비밀번호가 일치하지 않아요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await registerWithEmail(email.trim(), password, name.trim());
      await clearDeletedAccountEmail();
      setMode('verify');
      setMessage('이메일로 받은 인증 코드를 입력해주세요.');
    } catch (error) {
      setMessage(getRegisterErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setMessage('인증 코드를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await verifyEmail(email.trim(), verificationCode.trim());
      await completeLogin();
    } catch (error) {
      setMessage(getRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    if (!email.trim()) {
      setMessage('이메일 주소를 입력해주세요.');
      return;
    }

    if (!isValidEmail(email)) {
      setMessage('올바른 이메일 형식으로 입력해 주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await requestPasswordReset(email.trim());
      setMode('resetConfirm');
      setMessage('인증 코드를 이메일로 전송했어요.');
    } catch (error) {
      setMessage(getRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetConfirm = async () => {
    if (!email.trim() || !verificationCode.trim() || !password || !passwordConfirmation) {
      setMessage('모든 항목을 입력해주세요.');
      return;
    }

    if (verificationCode.trim().length !== 6) {
      setMessage('인증 코드는 6자리로 입력해주세요.');
      return;
    }

    if (!isValidPassword(password)) {
      setMessage('비밀번호는 영문·숫자 포함 8자 이상이어야 합니다.');
      return;
    }

    if (password !== passwordConfirmation) {
      setMessage('비밀번호가 일치하지 않아요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await confirmPasswordReset(email.trim(), verificationCode.trim(), password);
      setPassword('');
      setPasswordConfirmation('');
      setVerificationCode('');
      setMode('login');
      setMessage('비밀번호가 변경되었어요. 새 비밀번호로 로그인해 주세요.');
    } catch (error) {
      setMessage(getRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKakaoLogin = async () => {
    try {
      setIsSubmitting(true);
      resetMessage();
      const result = await continueWithKakao();

      if (!result.redirected) {
        onAuthenticated();
      }
    } catch (error) {
      setMessage(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMode = (nextMode: AuthMode) => {
    resetMessage();
    setVerificationCode('');
    setPassword('');
    setPasswordConfirmation('');
    if (nextMode !== 'register') {
      setName('');
    }
    setMode(nextMode);
  };

  const handleBack = () => {
    if (mode === 'verify') {
      setMode('register');
      resetMessage();
      return;
    }

    if (mode === 'resetConfirm') {
      setMode('resetRequest');
      setVerificationCode('');
      setPassword('');
      setPasswordConfirmation('');
      resetMessage();
      return;
    }

    openMode('home');
  };

  return {
    autoLogin,
    email,
    handleBack,
    handleKakaoLogin,
    handleLogin,
    handlePasswordResetConfirm,
    handlePasswordResetRequest,
    handleRegister,
    handleVerify,
    isSubmitting,
    message,
    mode,
    name,
    openMode,
    password,
    passwordConfirmation,
    passwordMatchState,
    setAutoLogin,
    setEmail,
    setName,
    setPassword,
    setPasswordConfirmation,
    setVerificationCode,
    verificationCode,
  };
}
