// import { expect } from 'chai';
// import flagsmith from '../../src/flagsmith';
// import worker from '../../src/workers/clearFeaturesCache';
// eslint-disable-next-line max-len
// import { expectSuccessfulBackground, mockChangeMessage, mockFeatureFlagForUser } from '../helpers';
// import { deleteKeysByPattern, countByPattern } from '../../src/redis';

describe('clear features cache', () => {
  // beforeEach(async () => {
  //   await deleteKeysByPattern('*');
  // });

  // TODO: Temporarily disabled due incident
  // it('should delete features cache', async () => {
  //   mockFeatureFlagForUser('feat_limit_dev_card', false);
  //   await flagsmith.getIdentityFlags('1');
  //   mockFeatureFlagForUser('feat_limit_dev_card', false);
  //   await flagsmith.getIdentityFlags('2');
  //   expect(await countByPattern('features:*')).to.equal(2);
  //   await expectSuccessfulBackground(
  //     worker,
  //     mockChangeMessage({
  //       after,
  //       op: 'c',
  //       table: 'users',
  //     }),
  //   );
  //   expect(await countByPattern('features:*')).to.equal(0);
  // });
});
