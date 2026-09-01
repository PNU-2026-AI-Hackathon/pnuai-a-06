// 인증 기능 화면들을 조립하고 라우팅하는 진입점입니다.
import { router, useLocalSearchParams } from 'expo-router';

import { AuthFormLayout } from '@/features/auth/components/auth-form-layout';
import { AuthHome } from '@/features/auth/components/auth-home';
import { EmailLoginForm } from '@/features/auth/components/email-login-form';
import { PasswordResetConfirmForm } from '@/features/auth/components/password-reset-confirm-form';
import { PasswordResetRequestForm } from '@/features/auth/components/password-reset-request-form';
import { RegisterForm } from '@/features/auth/components/register-form';
import { VerifyEmailForm } from '@/features/auth/components/verify-email-form';
import { useAuthFlow } from '@/features/auth/hooks/use-auth-flow';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import { hasAcceptedTerms } from '@/lib/terms-storage';
import { hasSeenWelcomeScreen } from '@/lib/tutorial-storage';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const { bottomActionInset, bottomSafeInset, horizontalPadding, topInset } = useResponsiveLayout();

  const routeAfterAuthentication = async (isNewUser = false) => {
    const userId = getAuthItem('user_id');

    if (userId && !(await hasAcceptedTerms(userId))) {
      router.push('/terms');
      return;
    }

    if (isNewUser || (userId && !(await hasSeenWelcomeScreen(userId)))) {
      router.replace('/welcome');
      return;
    }

    router.replace('/main');
  };

  const auth = useAuthFlow({
    initialMode: params.mode === 'reset' ? 'resetRequest' : 'home',
    onAuthenticated: (isNewUser) => routeAfterAuthentication(isNewUser),
  });

  if (auth.mode === 'home') {
    return (
      <AuthHome
        bottomActionInset={bottomActionInset}
        horizontalPadding={horizontalPadding}
        isSubmitting={auth.isSubmitting}
        onKakaoLogin={auth.handleKakaoLogin}
        onOpenMode={auth.openMode}
        topInset={topInset}
      />
    );
  }

  const isLoginMode = auth.mode === 'login';
  const isRegisterMode = auth.mode === 'register';
  const isVerifyMode = auth.mode === 'verify';
  const isPasswordResetRequestMode = auth.mode === 'resetRequest';
  const isPasswordResetConfirmMode = auth.mode === 'resetConfirm';
  const handleBack = () => {
    if (params.returnTo === 'profile' && isPasswordResetRequestMode) {
      router.back();
      return;
    }

    auth.handleBack();
  };

  const submitAuth = isLoginMode
    ? auth.handleLogin
    : isRegisterMode
      ? auth.handleRegister
      : isVerifyMode
        ? auth.handleVerify
        : isPasswordResetRequestMode
          ? auth.handlePasswordResetRequest
          : auth.handlePasswordResetConfirm;

  const submitLabel = isLoginMode
    ? '로그인'
    : isRegisterMode
      ? '회원가입'
      : isVerifyMode
        ? '인증하고 시작하기'
        : isPasswordResetRequestMode
          ? '인증 코드 받기'
          : '비밀번호 변경하기';

  const title = isLoginMode
    ? '로그인'
    : isRegisterMode
      ? '회원가입'
      : isVerifyMode
        ? '이메일 인증'
        : '비밀번호 재설정';

  return (
    <AuthFormLayout
      autoLogin={auth.autoLogin}
      bottomSafeInset={bottomSafeInset}
      isLoginMode={isLoginMode}
      isSubmitting={auth.isSubmitting}
      message={auth.message}
      onBack={handleBack}
      onKakaoLogin={auth.handleKakaoLogin}
      onOpenRegister={() => auth.openMode('register')}
      onSubmit={submitAuth}
      onToggleAutoLogin={() => auth.setAutoLogin((current) => !current)}
      submitLabel={submitLabel}
      title={title}
      topInset={topInset}
      horizontalPadding={horizontalPadding}>
      {(keepFocusedInputVisible) => {
        if (isVerifyMode) {
          return (
            <VerifyEmailForm
              isSubmitting={auth.isSubmitting}
              onChange={auth.setVerificationCode}
              value={auth.verificationCode}
            />
          );
        }

        if (isPasswordResetRequestMode) {
          return (
            <PasswordResetRequestForm
              email={auth.email}
              isSubmitting={auth.isSubmitting}
              onEmailChange={auth.setEmail}
              onFocus={keepFocusedInputVisible}
            />
          );
        }

        if (isPasswordResetConfirmMode) {
          return (
            <PasswordResetConfirmForm
              email={auth.email}
              isSubmitting={auth.isSubmitting}
              onEmailChange={auth.setEmail}
              onFocus={keepFocusedInputVisible}
              onPasswordChange={auth.setPassword}
              onPasswordConfirmationChange={auth.setPasswordConfirmation}
              onVerificationCodeChange={auth.setVerificationCode}
              password={auth.password}
              passwordConfirmation={auth.passwordConfirmation}
              verificationCode={auth.verificationCode}
            />
          );
        }

        if (isRegisterMode) {
          return (
            <RegisterForm
              email={auth.email}
              isSubmitting={auth.isSubmitting}
              name={auth.name}
              onEmailChange={auth.setEmail}
              onFocus={keepFocusedInputVisible}
              onNameChange={auth.setName}
              onPasswordChange={auth.setPassword}
              onPasswordConfirmationChange={auth.setPasswordConfirmation}
              password={auth.password}
              passwordConfirmation={auth.passwordConfirmation}
              passwordMatchState={auth.passwordMatchState}
            />
          );
        }

        return (
          <EmailLoginForm
            email={auth.email}
            isSubmitting={auth.isSubmitting}
            onEmailChange={auth.setEmail}
            onFocus={keepFocusedInputVisible}
            onPasswordChange={auth.setPassword}
            password={auth.password}
          />
        );
      }}
    </AuthFormLayout>
  );
}
