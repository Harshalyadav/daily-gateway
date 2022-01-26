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

const getFromDailyApi = async (ctx, method, route, params = {}) => {
  const headers = getHeaders(ctx);
  const res = await rp({
    method,
    url: config.apiUrl + route,
    body: JSON.stringify(params),
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
  });

  return JSON.parse(res);
};

export const getFromDailyGraphQLApi = (ctx, query) => getFromDailyApi(ctx, 'POST', '/graphql', { query });

export const getSettingsFromAPI = (ctx) => getFromDailyApi(ctx, 'GET', '/settings');

export const getAlertsFromAPI = (ctx) => getFromDailyApi(ctx, 'GET', '/alerts');
