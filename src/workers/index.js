import eligibleParticipantNotification from './eligibleParticipantNotification';
import eligibleParticipantBoostChances from './eligibleParticipantBoostChances';
import cdc from './cdc';
import clearFeaturesCache from './clearFeaturesCache';
import updateAlerts from './updateAlerts';
import updateSettings from './updateSettings';

const workers = [
  eligibleParticipantNotification,
  eligibleParticipantBoostChances,
  cdc,
  clearFeaturesCache,
  updateAlerts,
  updateSettings,
];

export default workers;
