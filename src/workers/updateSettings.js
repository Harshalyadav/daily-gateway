import { SETTINGS_PREFIX } from '../redis';
import { createObjectHandler } from './common';

const handler = createObjectHandler(SETTINGS_PREFIX);

const worker = {
  topic: 'settings-updated',
  subscription: 'settings-updated-redis',
  handler,
};

export default worker;
