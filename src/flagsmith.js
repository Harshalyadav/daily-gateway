import flagsmith from 'flagsmith-nodejs';
import { ioRedisPool } from './redis';
import config from './config';

const getKey = (key) => `features:${key}`;

flagsmith.init({
  environmentID: config.flagsmithKey,
  cache: {
    has: async (key) => {
      const reply = await ioRedisPool.execute(async (client) => client.exists(getKey(key)));
      return reply === 1;
    },
    get: async (key) => {
      const cacheValue = await ioRedisPool.execute(async (client) => client.get(getKey(key)));
      return cacheValue && JSON.parse(cacheValue);
    },
    set: async (key, value) => {
      await ioRedisPool.execute(async (client) => client.set(getKey(key), JSON.stringify(value), 'EX', 60 * 60));
    },
  },
});

export default flagsmith;
