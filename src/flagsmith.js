import Flagsmith from 'flagsmith-nodejs';
import { ioRedisPool } from './redis';
import config from './config';

const getKey = (key) => `features:${key}`;

const flagsmith = new Flagsmith({
  apiUrl: 'https://api.flagsmith.com/api/v1/',
  requestTimeoutSeconds: 0.5,
  environmentKey: config.flagsmithKey,
  cache: {
    has: async (key) => {
      const reply = await ioRedisPool.execute((client) => client.exists(getKey(key)));
      return reply === 1;
    },
    get: async (key) => {
      const cacheValue = await ioRedisPool.execute((client) => client.get(getKey(key)));
      const parsed = cacheValue && JSON.parse(cacheValue);
      if (parsed && !parsed.flags) {
        return { flags: parsed };
      }
      return parsed;
    },
    set: async (key, value) => {
      await ioRedisPool.execute((client) => client.set(getKey(key), JSON.stringify(value), 'EX', 60 * 60 * 24 * 30));
    },
  },
});

export default flagsmith;
