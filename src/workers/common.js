import { messageToJson } from '../pubsub';
import { getUserRedisObjectKey, setRedisObject } from '../redis';

const defaultErrorMessage = 'failed to set cache value';

/**
   * This is a subscription handler generator for which data doesn't require post-processing
   * One example is the alerts entity, we want to store the whole object that the publisher sends
   */
export const createObjectHandler = (
  prefix,
  errorMessage = defaultErrorMessage,
) => async (message, log) => {
  const data = messageToJson(message);
  const key = getUserRedisObjectKey(prefix, data.userId);

  try {
    await setRedisObject(key, data);
  } catch (err) {
    log.error(
      { messageId: message.messageId, err },
      `${errorMessage}: ${key}`,
    );
    throw err;
  }
};

export default { createObjectHandler };
