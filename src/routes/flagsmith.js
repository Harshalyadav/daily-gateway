import Router from 'koa-router';
import config from '../config';
import { featuresResetTopic, publishEvent } from '../pubsub';

const router = Router({
  prefix: '/flagsmith',
});

router.post('/reset', async (ctx) => {
  const { key } = ctx.request.query;
  if (key === config.flagsmithWebhookSecret) {
    ctx.log.info('sending features reset message');
    await publishEvent(featuresResetTopic, {});
  } else {
    ctx.log.info('wrong webhook key');
  }
  ctx.status = 204;
});

export default router;
