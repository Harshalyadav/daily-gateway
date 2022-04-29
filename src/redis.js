import Redis from 'ioredis';
import config from './config';

const redis = new Redis(config.redis);

export default redis;

export const ALERTS_PREFIX = 'alerts';
export const SETTINGS_PREFIX = 'settings';
export const getUserRedisObjectKey = (prefix, userId) => `${prefix}:${userId}`;

export const SECONDS_IN_A_MONTH = 2628288;

export const isRedisEmptyValue = (value) => value === undefined || value === null || value === '';

export const setRedisWithOneMonthExpiry = (key, value) => redis.set(key, value, 'EX', SECONDS_IN_A_MONTH);

export const setRedisObject = (key, obj) => setRedisWithOneMonthExpiry(key, JSON.stringify(obj));

export function deleteKeysByPattern(pattern) {
  return new Promise((resolve, reject) => {
    const stream = redis.scanStream({ match: pattern });
    stream.on('data', (keys) => {
      if (keys.length) {
        redis.unlink(keys);
      }
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

export const ALERTS_DEFAULT = { filter: true };
export const SETTINGS_DEFAULT = {
  theme: 'darcula',
  showTopSites: true,
  insaneMode: false,
  spaciness: 'eco',
  showOnlyUnreadPosts: false,
  openNewTab: true,
  sidebarExpanded: true,
  companionExpanded: false,
};
export const getRedisObject = async (ctx, prefix, defaultValues, getFromApi) => {
  if (!ctx.state.user) {
    return defaultValues;
  }

  const { userId } = ctx.state.user;
  const key = getUserRedisObjectKey(prefix, userId);
  const cache = await redis.get(key);

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
