/**
 * Client-side auth helpers.
 * Token is stored in localStorage under 'dealbot_token'.
 */

const TOKEN_KEY = 'dealbot_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}
