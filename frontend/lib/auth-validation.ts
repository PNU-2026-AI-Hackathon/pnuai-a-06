export type PasswordMatchState = 'empty' | 'match' | 'mismatch';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export function isValidPassword(password: string) {
  return PASSWORD_PATTERN.test(password);
}

export function getPasswordMatchState(password: string, confirmation: string): PasswordMatchState {
  if (!confirmation) {
    return 'empty';
  }

  return password === confirmation ? 'match' : 'mismatch';
}
