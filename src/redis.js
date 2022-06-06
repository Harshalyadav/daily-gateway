import { IORedisPool, IORedisPoolOptions } from '@dailydotdev/ts-ioredis-pool';
import config from './config';

const ioRedisPoolOpts = IORedisPoolOptions.fromHostAndPort(
  config.redis.host,
  config.redis.port,
)
  .withIORedisOptions(config.redis)
  .withPoolOptions({
    min: 10,
    max: 50,
    evictionRunIntervalMillis: 60000,
    idleTimeoutMillis: 30000,
  });

export const ioRedisPool = new IORedisPool(ioRedisPoolOpts);

export const ALERTS_PREFIX = 'alerts';
export const SETTINGS_PREFIX = 'settings';
export const getUserRedisObjectKey = (prefix, userId) => `${prefix}:${userId}`;

export const SECONDS_IN_A_MONTH = 2628288;

export const isRedisEmptyValue = (value) => value === undefined || value === null || value === '';

export const setRedisWithOneMonthExpiry = (key, value) => ioRedisPool.execute((client) => client.set(key, value, 'EX', SECONDS_IN_A_MONTH));

export const setRedisObject = (key, obj) => setRedisWithOneMonthExpiry(key, JSON.stringify(obj));

export function deleteKeysByPattern(pattern) {
  return ioRedisPool.execute((client) => new Promise((resolve, reject) => {
    const stream = client.scanStream({ match: pattern });
    stream.on('data', (keys) => {
      if (keys.length) {
        client.unlink(keys);
      }
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  }));
}

export function countByPattern(pattern) {
  return ioRedisPool.execute((client) => new Promise((resolve, reject) => {
    const stream = client.scanStream({ match: pattern });
    let count = 0;
    stream.on('data', (keys) => {
      count += keys.length;
    });
    stream.on('end', () => resolve(count));
    stream.on('error', reject);
  }));
}

export const ALERTS_DEFAULT = {
  filter: true,
  rankLastSeen: null,
  myFeed: null,
  companionHelper: true,
};
export const SETTINGS_DEFAULT = {
  theme: 'darcula',
  showTopSites: true,
  insaneMode: false,
  spaciness: 'eco',
  showOnlyUnreadPosts: false,
  openNewTab: true,
  sidebarExpanded: true,
  companionExpanded: false,
  autoDismissNotifications: true,
  customLinks: null,
  optOutCompanion: false,
  optOutWeeklyGoal: false,
  sortingEnabled: false,
};
export const getRedisObject = async (ctx, prefix, defaultValues, getFromApi) => {
  if (!ctx.state.user) {
    return defaultValues;
  }

  const { userId } = ctx.state.user;
  const key = getUserRedisObjectKey(prefix, userId);
  const cache = await ioRedisPool.execute((client) => client.get(key));

  if (isRedisEmptyValue(cache)) {
    try {
      const data = await getFromApi();

      await setRedisObject(userId, data);

      return data;
    } catch (ex) {
      // TODO: use a dedicated logger for exceptions
      // eslint-disable-next-line no-console
      console.error(`Unable to set cache value for: ${key}`, ex);
    }
  }

  const data = JSON.parse(cache);

  return { ...defaultValues, ...data };
};
