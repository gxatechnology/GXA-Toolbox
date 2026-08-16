import {
  acceptInvite,
  getSettings,
  getUser,
  handleAuthCallback,
  login,
  logout,
  oauthLogin as netlifyOauthLogin,
  onAuthChange,
  requestPasswordRecovery,
  signup,
  updateUser
} from '@netlify/identity';

function oauthLogin(provider) {
  const currentLocation = window.location.href;
  try {
    return netlifyOauthLogin(provider);
  } catch (error) {
    // The official client deliberately throws after assigning location.href.
    // Treat that navigation sentinel as a successful redirect, while still
    // surfacing genuine configuration/provider errors to the branded UI.
    if (window.location.href !== currentLocation) return undefined;
    throw error;
  }
}

// Keep the application UI independent from the provider package. This small,
// locally bundled bridge is the only browser-facing authentication dependency.
window.GxaIdentity = Object.freeze({
  acceptInvite,
  getSettings,
  getUser,
  handleAuthCallback,
  login,
  logout,
  oauthLogin,
  onAuthChange,
  requestPasswordRecovery,
  signup,
  updateUser
});

window.dispatchEvent(new CustomEvent('gxa-identity-ready'));
