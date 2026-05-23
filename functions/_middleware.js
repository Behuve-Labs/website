// Runs on every Functions request. If a valid `bv_session` JWT is present,
// it attaches a `user` object to `ctx.data` so endpoints can do:
//   if (!ctx.data.user) return 401;
// Endpoints that allow anonymous access just ignore `ctx.data.user`.

import { parseCookies } from './_lib/cookies.js';
import { verifyJwt } from './_lib/jwt.js';

export async function onRequest(ctx) {
  const cookies = parseCookies(ctx.request.headers.get('Cookie'));
  const token = cookies.bv_session;
  if (token && ctx.env.JWT_SECRET) {
    try {
      const payload = await verifyJwt(token, ctx.env.JWT_SECRET);
      ctx.data.user = {
        email: payload.sub,
        name: payload.name,
        provider: payload.provider,
      };
    } catch {
      // Invalid or expired — leave ctx.data.user undefined.
    }
  }
  return ctx.next();
}
