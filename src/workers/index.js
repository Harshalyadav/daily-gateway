import updateMailingList from './updateMailingList';
import updateReputation from './updateReputation';
import updateReferralContest from './updateReferralContest';
import eligibleParticipantNotification from './eligibleParticipantNotification';
import eligibleParticipantBoostChances from './eligibleParticipantBoostChances';
import cdc from './cdc';
import clearFeaturesCache from './clearFeaturesCache';
import updateAlerts from './updateAlerts';
import updateSettings from './updateSettings';
import deleteUserFromMailingList from './deleteUserFromMailingList';

const workers = [
  updateMailingList,
  updateReputation,
  updateReferralContest,
  eligibleParticipantNotification,
  eligibleParticipantBoostChances,
  cdc,
  clearFeaturesCache,
  updateAlerts,
  updateSettings,
  deleteUserFromMailingList,
];

export default workers;
