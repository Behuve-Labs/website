import { clearCookieHeader } from '../../_lib/cookies.js';

export function onRequestPost() {
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': clearCookieHeader('bv_session') },
  });
}
