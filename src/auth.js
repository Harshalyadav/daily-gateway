import crypto from 'crypto';
import rp from 'request-promise-native';
import config from './config';
import refreshTokenModel from './models/refreshToken';
import { ForbiddenError } from './errors';
import logger from './logger';

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
    const res = await rp(`${config.kratosOrigin}/sessions/whoami`, { headers: ctx.req.headers });
    const kratos = JSON.parse(res);
    const endTime = performance.now();
    logger.info({
      startTime,
      endTime,
      totalTime: endTime - startTime,
    }, 'Time to Kratos whoami call');
    if (kratos?.identity?.id) {
      ctx.state.user = { userId: kratos.identity.id, isKratos: true };
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
