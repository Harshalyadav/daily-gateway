import rp from 'request-promise-native';
import config from './config';

export const getFromDailyApi = async (ctx, query, headers = {}) => {
  const res = await rp({
    method: 'POST',
    url: `${config.apiUrl}/graphql`,
    body: JSON.stringify({ query }),
    headers: {
      ...headers,
      cookie: ctx.request.header.cookie,
      'content-type': 'application/json',
    },
  });

  return JSON.parse(res);
};

export const getSettingsFromAPI = (ctx) => {
  const headers = { authorization: `Service ${config.apiSecret}` };
  const query = `{
    userSettings {
      openNewTab
      showOnlyUnreadPosts
      theme
      spaciness
      insaneMode
      showTopSites
      sidebarExpanded
    }
  }`;

  return getFromDailyApi(ctx, query, headers);
};

export const getAlertsFromAPI = (ctx) => {
  const headers = { authorization: `Service ${config.apiSecret}` };
  const query = `{
    userAlerts {
      filter
      rankLastSeen
    }
  }`;

  return getFromDailyApi(ctx, query, headers);
};
