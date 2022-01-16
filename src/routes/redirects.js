import Router from 'koa-router';
import validator, { string, object } from 'koa-context-validator';
import rp from 'request-promise-native';
import config from '../config';
import { addSubdomainOpts } from '../cookies';
import { bootSharedLogic } from './boot';

const router = Router();

const setReferral = (ctx) => {
  const { r: referral } = ctx.request.query;
  if (referral) {
    ctx.log.info({ referral }, 'redirecting by referral');
    ctx.cookies.set(
      config.cookies.referral.key, referral,
      addSubdomainOpts(ctx, config.cookies.referral.opts),
    );
  }
};

const generateEventId = (now) => {
  const randomStr = (Math.random() + 1).toString(36).substring(8);
  const timePart = (now.getTime() / 1000).toFixed(0);
  return `${timePart}${randomStr}`;
};

const sendAnalyticsEvent = async (ctx) => {
  try {
    const boot = await bootSharedLogic(ctx, false);
    const { query } = ctx.request;
    const queryStr = JSON.stringify(query);
    const now = new Date();
    const events = [{
      event_timestamp: now,
      event_id: generateEventId(now),
      event_name: 'page view',
      event_page: '/get',
      app_platform: 'redirector',
      query_params: queryStr.length > 2 ? queryStr : undefined,
      session_id: boot.visit.sessionId,
      user_first_visit: boot.user.firstVisit,
      user_id: boot.user.id,
      visit_id: boot.visit.visitId,
      utm_campaign: query?.utm_campaign,
      utm_content: query?.utm_content,
      utm_medium: query?.utm_medium,
      utm_source: query?.utm_source,
      utm_term: query?.utm_term,
      page_referrer: ctx.headers.referer,
    }];
    await rp({
      method: 'POST',
      url: `${config.analyticsUrl}/e`,
      body: JSON.stringify({ events }),
      headers: {
        'content-type': 'application/json',
      },
    });
  } catch (err) {
    ctx.log.error({ err }, 'failed to send analytics event');
  }
};

router.get(
  '/landing',
  validator({
    query: object().keys({
      r: string(),
    }).unknown(),
  }),
  async (ctx) => {
    ctx.status = 307;

    if (!ctx.userAgent.isBot) {
      setReferral(ctx);
    }
    ctx.redirect(`https://daily.dev?${ctx.request.querystring}`);
  },
);

router.get(
  ['/download', '/get'],
  async (ctx) => {
    ctx.status = 307;

    if (ctx.userAgent.isBot) {
      ctx.redirect('https://daily.dev');
      return;
    }

    setReferral(ctx);
    await sendAnalyticsEvent(ctx);

    if (ctx.userAgent.browser.toLowerCase() === 'firefox') {
      ctx.redirect(`https://addons.mozilla.org/en-US/firefox/addon/daily/?${ctx.request.querystring}`);
    } else if (ctx.userAgent.source.indexOf('Edg/') > -1) {
      ctx.redirect(`https://microsoftedge.microsoft.com/addons/detail/daily-20-source-for-bu/cbdhgldgiancdheindpekpcbkccpjaeb?${ctx.request.querystring}`);
    } else {
      ctx.redirect(`https://chrome.google.com/webstore/detail/daily-discover-web-techno/jlmpjdjjbgclbocgajdjefcidcncaied?${ctx.request.querystring}`);
    }
  },
);

router.get('/privacy', (ctx) => ctx.redirect('https://www.iubenda.com/privacy-policy/14695236'));
router.get('/tos', (ctx) => ctx.redirect('https://medium.com/daily-now/daily-terms-of-service-47bb9c9a4b99'));
router.get('/', (ctx) => ctx.redirect('https://daily.dev'));

export default router;
