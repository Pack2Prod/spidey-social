import { Amplify } from 'aws-amplify';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession,
  confirmSignUp,
  resendSignUpCode,
} from 'aws-amplify/auth';
import { cognitoUserPoolId, cognitoClientId } from '../config';

let configured = false;

export function configureAuth() {
  if (configured || !cognitoUserPoolId || !cognitoClientId) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: cognitoUserPoolId,
        userPoolClientId: cognitoClientId,
      },
    },
  });
  configured = true;
}

export async function login(email: string, password: string): Promise<{ success: boolean; needsConfirmation?: boolean; error?: string }> {
  try {
    const result = await signIn({ username: email, password });
    if (result.isSignedIn) return { success: true };
    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') return { success: false, needsConfirmation: true };
    return { success: false, error: 'Sign in incomplete.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('User is not confirmed') || msg.includes('UserNotConfirmedException'))
      return { success: false, needsConfirmation: true };
    if (msg.includes('Incorrect') || msg.includes('NotAuthorizedException'))
      return { success: false, error: 'Invalid email or password.' };
    return { success: false, error: msg };
  }
}

export async function register(email: string, password: string, preferredUsername?: string) {
  const userAttributes: Record<string, string> = { email };
  if (preferredUsername) userAttributes['preferred_username'] = preferredUsername;
  return signUp({
    username: email,
    password,
    options: { userAttributes },
  });
}

export async function confirmRegistration(email: string, code: string) {
  await confirmSignUp({ username: email, confirmationCode: code });
}

export async function resendConfirmationCode(email: string) {
  return resendSignUpCode({ username: email });
}

export async function logout() {
  await signOut();
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentUserInfo(): Promise<{ email?: string; username?: string }> {
  try {
    const user = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const email = attrs.email ?? user.signInDetails?.loginId;
    return { email, username: user.username };
  } catch {
    return {};
  }
}

/** Returns Cognito sub (matches backend claims.sub) for WebSocket routing */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const sub = (session.tokens?.idToken?.payload as { sub?: string })?.sub;
    if (sub) return sub;
    const user = await getCurrentUser();
    return user.userId ?? null;
  } catch {
    return null;
  }
}
