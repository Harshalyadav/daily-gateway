import rp from 'request-promise-native';
import config from './config';

const getHeaders = (ctx) => {
  if (!ctx.state.user || !ctx.state.user.userId) {
    return {};
  }

  return {
    authorization: `Service ${config.apiSecret}`,
    'logged-in': true,
    'user-id': ctx.state.user.userId,
  };
};

export const getFromDailyApi = async (ctx, query) => {
  const headers = getHeaders(ctx);
  const res = await rp({
    method: 'POST',
    url: `${config.apiUrl}/graphql`,
    body: JSON.stringify({ query }),
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
  });

  return JSON.parse(res);
};

export const getSettingsFromAPI = (ctx) => {
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

  return getFromDailyApi(ctx, query);
};

export const getAlertsFromAPI = (ctx) => {
  const query = `{
    userAlerts {
      filter
      rankLastSeen
      myFeed
    }
  }`;

  return getFromDailyApi(ctx, query);
};
