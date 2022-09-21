import userModel from '../models/user';
import { messageToJson } from '../pubsub';

const worker = {
  topic: 'user-deleted',
  subscription: 'delete-user-gateway',
  handler: async (message, log) => {
    const data = messageToJson(message);
    try {
      log.info('deleting gateway user');
      await userModel.deleteAccount(data.id);
    } catch (err) {
      log.error(
        {
          userId: data.id,
          err,
        },
        'failed to delete user in gateway',
      );
      throw err;
    }
  },
};

export default worker;
