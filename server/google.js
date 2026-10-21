// Checks a Google Identity Services ID token by asking Google's tokeninfo endpoint, which validates the
// signature and expiry. We then check it was issued for our client and that Google verified the email.
export async function verifyGoogleToken(credential, clientId) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;
  const t = await res.json();
  const issuer = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  if (t.aud !== clientId || !issuer || t.email_verified !== 'true' && t.email_verified !== true || !t.email) return null;
  if (Number(t.exp) * 1000 < Date.now()) return null;
  return { email: t.email, name: t.name || '' };
}
