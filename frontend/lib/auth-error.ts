export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '요청 처리 중 오류가 발생했습니다.';
}

function isNetworkError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('timed out') ||
    message.includes('네트워크') ||
    message.includes('연결')
  );
}

export function getRequestErrorMessage(error: unknown) {
  const message = getErrorMessage(error);

  return isNetworkError(message) ? '네트워크 연결이 불안정합니다. 다시 시도해 주세요.' : message;
}

export function getRegisterErrorMessage(error: unknown) {
  const message = getRequestErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (message === '네트워크 연결이 불안정합니다. 다시 시도해 주세요.') {
    return message;
  }

  if (
    normalizedMessage.includes('already') ||
    normalizedMessage.includes('exist') ||
    normalizedMessage.includes('duplicate') ||
    normalizedMessage.includes('unique') ||
    message.includes('이미') ||
    message.includes('중복')
  ) {
    return '이미 가입된 이메일입니다. 로그인해 주세요.';
  }

  return message;
}

export function getLoginErrorMessage(error: unknown) {
  const message = getRequestErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (message === '네트워크 연결이 불안정합니다. 다시 시도해 주세요.') {
    return message;
  }

  if (
    normalizedMessage.includes('invalid email, password, or unverified email') ||
    normalizedMessage.includes('not registered') ||
    normalizedMessage.includes('email not found') ||
    normalizedMessage.includes('account not found') ||
    normalizedMessage.includes('user not found') ||
    normalizedMessage.includes('does not exist') ||
    normalizedMessage.includes('no account') ||
    message.includes('가입된 이메일이 없습니다') ||
    message.includes('등록되지 않은 이메일') ||
    message.includes('가입되지 않은 이메일')
  ) {
    return '입력하신 이메일로 가입된 계정을 찾을 수 없어요. 먼저 회원가입을 진행해 주세요.';
  }

  if (
    normalizedMessage.includes('not verified') ||
    normalizedMessage.includes('not verify') ||
    normalizedMessage.includes('verification') ||
    normalizedMessage.includes('verify your email') ||
    message.includes('인증')
  ) {
    return '이메일 인증 후 이용 가능합니다. 메일함을 확인해 주세요.';
  }

  if (
    normalizedMessage.includes('invalid credential') ||
    normalizedMessage.includes('invalid email') ||
    normalizedMessage.includes('invalid password') ||
    normalizedMessage.includes('incorrect') ||
    normalizedMessage.includes('wrong password') ||
    normalizedMessage.includes('password') ||
    message.includes('비밀번호')
  ) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }

  return message;
}
