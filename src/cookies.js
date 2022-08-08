import config from './config';
import { sign as signJwt } from './jwt';

const extractDomain = (ctx) => {
  const host = ctx.request.hostname;
  // Localhost fix for local testing
  if (host === '127.0.0.1') return host;
  const parts = host.split('.');
  while (parts.length > 2) {
    parts.shift();
  }
  return parts.join('.');
};

export const addSubdomainOpts = (ctx, opts) => {
  const domain = extractDomain(ctx);
  return { ...opts, domain };
};

export const setAuthCookie = async (ctx, userId, roles = []) => {
  const accessToken = await signJwt(
    { userId, roles },
    15 * 60 * 1000,
  );
  ctx.cookies.set(
    config.cookies.auth.key,
    accessToken.token,
    addSubdomainOpts(ctx, config.cookies.auth.opts),
  );
  return accessToken;
};
