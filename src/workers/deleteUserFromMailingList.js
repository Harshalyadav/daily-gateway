import { messageToJson } from '../pubsub';
import { getContactIdByEmail, removeUserContact } from '../mailing';

const worker = {
  topic: 'user-deleted',
  subscription: 'user-deleted-mailing',
  handler: async (message, log) => {
    const data = messageToJson(message);
    if (!data.email) {
      log.warn(
        { messageId: message.id, userId: data.id },
        'no email in user-deleted message',
      );
      return;
    }
    try {
      const contactId = await getContactIdByEmail(data.email);
      await removeUserContact(contactId);
    } catch (err) {
      log.error(
        { messageId: message.id, err, userId: data.id },
        'failed to delete user from mailing list',
      );
      throw err;
    }
  },
};

export default worker;
