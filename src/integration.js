import rp from 'request-promise-native';
import config from './config';

const getHeaders = (ctx) => {
  if (!ctx.state?.user || !ctx.state.user.userId) {
    return {
      authorization: `Service ${config.apiSecret}`,
    };
  }

  return {
    authorization: `Service ${config.apiSecret}`,
    'logged-in': true,
    'user-id': ctx.state.user.userId,
  };
};

const queryDailyApi = async (ctx, method, route, params = {}) => {
  try {
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
  } catch (err) {
    ctx.log.error({
      err,
      route,
    }, 'failed to request api');
    throw err;
  }
};

export const getFromDailyGraphQLApi = (ctx, query) => queryDailyApi(ctx, 'POST', '/graphql', query);

export const getSettingsFromAPI = (ctx) => queryDailyApi(ctx, 'GET', '/settings');

export const getAlertsFromAPI = (ctx) => queryDailyApi(ctx, 'GET', '/alerts');

export const getUserFromAPI = (ctx) => queryDailyApi(ctx, 'GET', '/whoami');

export const addUserToAPI = (ctx, data) => queryDailyApi(ctx, 'POST', '/p/newUser', data);
