/**
 * Backend config — set in .env or .env.local.
 */
export const apiUrl = import.meta.env.VITE_API_URL ?? '';
export const wsUrl = import.meta.env.VITE_WS_URL ?? '';
export const cognitoUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '';
export const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID ?? '';
