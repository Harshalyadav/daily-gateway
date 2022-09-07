import crypto from 'crypto';
import rp from 'request-promise-native';
import config from './config';
import refreshTokenModel from './models/refreshToken';
import { ForbiddenError } from './errors';
import logger from './logger';
import { setTrackingId } from './tracking';
import { addSubdomainOpts } from './cookies';

const base64URLEncode = (str) => str.toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest();

export const generateChallenge = (verifier) => base64URLEncode(sha256(verifier));

const validateRefreshToken = async (ctx) => {
  const refreshToken = ctx.cookies.get(config.cookies.refreshToken.key);
  let shouldRefreshToken = false;
  if (refreshToken) {
    const refreshTokenObject = await refreshTokenModel.getByToken(refreshToken);
    if (refreshTokenObject) {
      shouldRefreshToken = true;
      ctx.state.user = { userId: refreshTokenObject.userId };
    } else {
      throw new ForbiddenError();
    }
  }
  return shouldRefreshToken;
};

const validateKratosToken = async (ctx) => {
  try {
    const startTime = performance.now();
    const res = await rp(`${config.kratosOrigin}/sessions/whoami`, { headers: { cookie: ctx.req.headers.cookie, forwarded: ctx.req.headers.forwarded } });
    const kratos = JSON.parse(res);
    const endTime = performance.now();
    logger.info({
      startTime,
      endTime,
      totalTime: endTime - startTime,
    }, 'Time to Kratos whoami call');
    if (kratos?.traits?.userId) {
      ctx.state.user = { userId: kratos.traits.userId, isKratos: true };
      return true;
    }
  } catch (e) {
    if (e.statusCode === 401) {
      return false;
    }

    throw e;
  }

  return false;
};

export const validateToken = async (ctx) => {
  const isKratos = ctx.cookies.get(config.cookies.kratos.key);
  if (isKratos) {
    return validateKratosToken(ctx);
  }

  return validateRefreshToken(ctx);
};

export const logout = async (ctx) => {
  setTrackingId(ctx, undefined);
  ctx.cookies.set(
    config.cookies.auth.key,
    undefined,
    addSubdomainOpts(ctx, config.cookies.auth.opts),
  );
  ctx.cookies.set(
    config.cookies.refreshToken.key,
    undefined,
    addSubdomainOpts(ctx, config.cookies.refreshToken.opts),
  );
  ctx.cookies.set(
    config.cookies.referral.key,
    undefined,
    addSubdomainOpts(ctx, config.cookies.referral.opts),
  );

  const isKratos = ctx.cookies.get(config.cookies.kratos.key);
  if (isKratos) {
    const logoutInit = await rp(`${config.kratosOrigin}/self-service/logout/browser`, { headers: { cookie: ctx.req.headers.cookie, forwarded: ctx.req.headers.forwarded } });
    const logoutFlow = JSON.parse(logoutInit);
    if (logoutFlow?.logout_url) {
      await rp(logoutFlow.logout_url, { headers: ctx.req.headers });
      ctx.cookies.set('ory_kratos_continuity');
      ctx.cookies.set('ory_kratos_session');
      // Remove all existing CSRF tokens
      const cookies = ctx.req.headers.cookie.split(';');
      cookies.forEach((cookie) => {
        if (cookie.replace(/\s/, '').indexOf('csrf_token_') === 0) {
          ctx.cookies.set(cookie.split('=')[0].trim());
        }
      });
    }
  }

  ctx.status = 204;
  return ctx;
};
