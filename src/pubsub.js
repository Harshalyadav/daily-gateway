import { PubSub } from '@google-cloud/pubsub';

export const pubsub = new PubSub();
export const userDeletedTopic = pubsub.topic('user-deleted');
export const participantEligilbleTopic = pubsub.topic('new-eligible-participant');
export const featuresResetTopic = pubsub.topic('features-reset');

export const messageToJson = (message) => JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8').trim());

export const publishEvent = async (topic, payload) => {
  await topic.publishJSON(payload);
};
