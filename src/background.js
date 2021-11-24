import { PubSub } from '@google-cloud/pubsub';
import logger from './logger';
import workers from './workers';

export default function background() {
  const pubsub = new PubSub();

  workers.forEach((worker) => {
    const { subscription } = worker;
    logger.info(`subscribing to ${subscription}`);
    const sub = pubsub.subscription(subscription, {
      flowControl: {
        maxMessages: worker.maxMessages || 1,
      },
      batching: { maxMilliseconds: 10 },
    });
    const childLogger = logger.child({ subscription });
    sub.on('message', async (message) => {
      try {
        await worker.handler({
          messageId: message.id,
          data: message.data,
        }, childLogger);
        message.ack();
      } catch (err) {
        childLogger.error(
          { messageId: message.id, data: message.data.toString('utf-8'), err },
          'failed to process message',
        );
        message.nack();
      }
    });
  });
}
