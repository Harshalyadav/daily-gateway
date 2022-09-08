import {
  messageToJson,
  participantEligilbleTopic,
  publishEvent,
} from '../pubsub';
import { toCamelCase } from '../db';

const onReferralContestsChange = async (log, data) => {
  if (data.payload.op === 'u') {
    if (!data.payload.before.eligible && data.payload.after.eligible) {
      await publishEvent(participantEligilbleTopic, data.payload.after);
    }
  }
};

const worker = {
  topic: 'gateway.changes',
  subscription: 'gateway-cdc',
  maxMessages: 10,
  handler: async (message, log) => {
    try {
      const data = messageToJson(message);
      data.payload.before = toCamelCase(data.payload.before);
      data.payload.after = toCamelCase(data.payload.after);
      if (data.schema?.name === 'io.debezium.connector.common.Heartbeat') {
        return;
      }
      switch (data.payload?.source?.table) {
        case 'referral_participants':
          await onReferralContestsChange(log, data);
          break;
        default:
        // Nothing here
      }
    } catch (err) {
      log.error(
        {
          messageId: message.messageId,
          err,
        },
        'failed to handle cdc message',
      );
      throw err;
    }
  },
};

export default worker;
