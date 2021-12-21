import { ALERTS_PREFIX } from '../redis';
import { createObjectHandler } from './common';

const handler = createObjectHandler(ALERTS_PREFIX);

const worker = {
  topic: 'alerts-updated',
  subscription: 'alerts-updated-redis',
  handler,
};

export default worker;
