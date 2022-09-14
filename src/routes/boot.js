import Router from 'koa-router';
import pTimeout from 'p-timeout';
import { logout, validateToken } from '../auth';
import generateId from '../generateId';
import visit from '../models/visit';
import flagsmith from '../flagsmith';
import config from '../config';
import userModel from '../models/user';
import provider from '../models/provider';
import role from '../models/role';
import { setSessionId } from '../tracking';
import { setAuthCookie } from '../cookies';
import {
  getAlertsFromAPI,
  getSettingsFromAPI,
  getFromDailyGraphQLApi, getUserFromAPI,
} from '../integration';
import { excludeProperties } from '../common';
import {
  ALERTS_DEFAULT,
  ALERTS_PREFIX,
  getRedisObject,
  SETTINGS_DEFAULT,
  SETTINGS_PREFIX,
} from '../redis';

const router = Router({
  prefix: '/boot',
});

const generateSessionId = (ctx) => {
  if (!ctx.userAgent.isBot && !ctx.state.service) {
    if (!ctx.sessionId || !ctx.sessionId.length) {
      ctx.sessionId = generateId();
    }
    // Refresh session cookie
    setSessionId(ctx, ctx.sessionId);
  }
};

const updateUserVisit = async (ctx, now, referral, trackingId) => {
  if (!trackingId) {
    return;
  }
  const app = ctx.request.get('app');
  if (app === 'extension' || app === 'web') {
    const referrer = referral
      ? await userModel.getByIdOrUsername(referral)
      : {};
    await visit.upsert(trackingId, app, now, now, referrer?.id, ctx.request.ip);
  }
};

const getTimeOrMax = (time) => time?.getTime?.() || Number.MAX_VALUE;

const bootBaseResponse = async (
  ctx,
  visitId,
  visitPromise,
  now,
  referral,
  user = null,
) => {
  const visitObject = visitPromise ? await visitPromise : null;
  const baseResponse = {
    visit: {
      visitId,
      sessionId: ctx.sessionId,
    },
  };
  if (visitObject) {
    const firstVisitEpoch = Math.min(
      getTimeOrMax(visitObject?.firstVisit),
      getTimeOrMax(user?.createdAt),
    );
    return {
      ...baseResponse,
      user: {
        firstVisit:
          firstVisitEpoch < Number.MAX_VALUE
            ? new Date(firstVisitEpoch)
            : undefined,
        referrer: visitObject.referral,
      },
    };
  }
  if (referral) {
    const referrer = await userModel.getByIdOrUsername(referral);
    if (referrer) {
      return {
        ...baseResponse,
        user: {
          isFirstVisit: true,
          firstVisit: now,
          referrer: referrer.id,
        },
      };
    }
  }
  return {
    ...baseResponse,
    user: {
      isFirstVisit: true,
      firstVisit: now,
    },
  };
};

const getTrackingId = (ctx) => ctx.state?.user?.userId || ctx.trackingId;

const annonymouseBootResponse = async (
  ctx,
  visitId,
  visitPromise,
  now,
  referral,
  trackingId,
  shouldLogout,
) => {
  const base = await bootBaseResponse(
    ctx,
    visitId,
    visitPromise,
    now,
    referral,
  );
  return {
    ...base,
    shouldLogout,
    user: {
      ...base.user,
      id: trackingId,
    },
  };
};

export const bootSharedLogic = async (ctx, shouldRefreshToken) => {
  const trackingId = getTrackingId(ctx);

  const visitId = generateId();
  generateSessionId(ctx);
  const now = new Date();
  const visitPromise = trackingId && visit.getFirstVisitAndReferral(trackingId);
  const referral = ctx.cookies.get(
    config.cookies.referral.key,
    config.cookies.referral.opts,
  );
  let returnObject;
  if (ctx.state.user) {
    /**
     * As we still need to support legacy users we temporary add a context for isKratos users
     * This way we can determine who should query which database
     */
    const {
      userId,
      isKratos = false,
    } = ctx.state.user;
    const userRequests = isKratos
      ? [getUserFromAPI(ctx), [], []]
      : [getUserFromAPI(ctx), provider.getByUserId(userId), role.getByUserId(userId)];
    try {
      const [user, userProvider, roles] = await Promise.all(userRequests);
      if (!user) {
        returnObject = await annonymouseBootResponse(
          ctx,
          visitId,
          visitPromise,
          now,
          referral,
          trackingId,
          true,
        );
        await logout(ctx);
      } else {
        const accessToken = shouldRefreshToken
          ? await setAuthCookie(ctx, user.id, roles)
          : undefined;

        const base = await bootBaseResponse(
          ctx,
          visitId,
          visitPromise,
          now,
          referral,
          user,
        );
        returnObject = {
          ...base,
          user: {
            ...base.user,
            ...user,
            providers: [userProvider?.provider],
            roles,
            permalink: `${config.webappOrigin}/${user.username || user.id}`,
          },
          accessToken,
        };
        if (!user.infoConfirmed) {
          returnObject = {
            ...returnObject,
            registrationLink: `${config.webappOrigin}/register`,
          };
        }
      }
    } catch (error) {
      if (error.statusCode === 403 || error.statusCode === 404) {
        ctx.log.error({ error }, 'failed to fetch user from API');
        returnObject = await annonymouseBootResponse(
          ctx,
          visitId,
          visitPromise,
          now,
          referral,
          trackingId,
          true,
        );
        await logout(ctx);
      } else {
        throw error;
      }
    }
  } else {
    returnObject = await annonymouseBootResponse(
      ctx,
      visitId,
      visitPromise,
      now,
      referral,
      trackingId,
    );
  }

  updateUserVisit(ctx, now, referral, trackingId)
    .catch((err) => ctx.log.error({ err }, `failed to update visit for ${trackingId}`));

  return returnObject;
};

const excludedBootProperties = ['userId'];

const getAlerts = async (ctx) => {
  const getAlertsApi = () => getAlertsFromAPI(ctx);

  const rawAlerts = await getRedisObject(
    ctx,
    ALERTS_PREFIX,
    ALERTS_DEFAULT,
    getAlertsApi,
  );
  const alerts = excludeProperties(rawAlerts, excludedBootProperties);

  return alerts;
};

const getSettings = async (ctx) => {
  const getSettingsApi = () => getSettingsFromAPI(ctx);

  const rawSettings = await getRedisObject(
    ctx,
    SETTINGS_PREFIX,
    SETTINGS_DEFAULT,
    getSettingsApi,
  );
  const settings = excludeProperties(rawSettings, [
    ...excludedBootProperties,
    'updatedAt',
    'bookmarkSlug',
  ]);

  return settings;
};

const FLAGSMITH_TIMEOUT = 1000;
export const DEFAULT_FLAGS = {
  feed_version: {
    enabled: true,
    value: 7,
  },
  my_feed_on: {
    enabled: true,
    value: '',
  },
};

const getFeaturesForUser = async (ctx) => {
  const trackingId = getTrackingId(ctx);
  if (trackingId) {
    try {
      const { flags } = await pTimeout(flagsmith.getIdentityFlags(trackingId), FLAGSMITH_TIMEOUT);
      // Extract only enabled and value
      return Object.keys(flags)
        .reduce((acc, key) => ({
          ...acc,
          [key]: {
            enabled: flags[key].enabled,
            value: flags[key].value,
          },
        }), {});
    } catch (err) {
      ctx.log.error({ err }, 'failed to fetch feature flags');
    }
  }
  return { ...DEFAULT_FLAGS };
};

const getCompanionExpandedState = (settings, flags) => {
  if (settings.companionExpanded === null || settings.companionExpanded === undefined) {
    const flag = !!flags?.companion_expanded?.enabled;
    return flag;
  }

  return settings.companionExpanded;
};

const getSubmitArticleState = (flags, user) => {
  if (!flags?.submit_article?.enabled) {
    if (user?.reputation >= process.env.SUBMIT_ARTICLE_THRESHOLD) {
      return {
        enabled: true,
        value: '',
      };
    }
  }

  return flags?.submit_article;
};

router.get(
  '/companion',
  async (ctx) => {
    const shouldRefreshToken = await validateToken(ctx);
    const [data, base, flags, settings, alerts] = await Promise.all([
      getFromDailyGraphQLApi(ctx, {
        query: `query Post($url: String) {
        postByUrl(url: $url) {
          id
          title
          image
          permalink
          commentsPermalink
          trending
          summary
          numUpvotes
          upvoted
          numComments
          bookmarked
          createdAt
          readTime
          tags
          source {
            id
            name
            image
          }
          author {
            id
          }
        }
      }
      `,
        variables: { url: ctx.query.url },
      }),
      bootSharedLogic(ctx, shouldRefreshToken),
      getFeaturesForUser(ctx),
      getSettings(ctx),
      getAlerts(ctx),
    ]);

    if (!data) {
      ctx.status = 404;
      return ctx;
    }

    settings.companionExpanded = getCompanionExpandedState(settings, flags);

    ctx.body = {
      ...base,
      postData: data?.data?.postByUrl,
      settings,
      flags,
      alerts,
    };
    return ctx;
  },
);

router.get('/', async (ctx) => {
  const shouldRefreshToken = await validateToken(ctx);
  const [flags, base, alerts, settings] = await Promise.all([
    getFeaturesForUser(ctx),
    bootSharedLogic(ctx, shouldRefreshToken),
    getAlerts(ctx),
    getSettings(ctx),
  ]);

  if (flags) {
    flags.submit_article = getSubmitArticleState(flags, base.user);
  }
  settings.companionExpanded = getCompanionExpandedState(settings, flags);

  ctx.status = 200;
  ctx.body = {
    ...base,
    flags,
    alerts,
    settings,
  };
});

router.get('/features', async (ctx) => {
  const flags = await getFeaturesForUser(ctx);
  ctx.status = 200;
  ctx.body = flags;
});

export default router;
