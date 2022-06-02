import { expect } from 'chai';
import flagsmith from 'flagsmith-nodejs';
import worker from '../../src/workers/clearFeaturesCache';
import { expectSuccessfulBackground, mockChangeMessage, mockFeatureFlagForUser } from '../helpers';
import { deleteKeysByPattern, countByPattern } from '../../src/redis';

describe('clear features cache', () => {
  beforeEach(async () => {
    await deleteKeysByPattern('*');
  });

  it('should delete features cache', async () => {
    mockFeatureFlagForUser('feat_limit_dev_card', false);
    await flagsmith.getFlagsForUser('1');
    mockFeatureFlagForUser('feat_limit_dev_card', false);
    await flagsmith.getFlagsForUser('2');
    expect(await countByPattern('features:*')).to.equal(2);
    await expectSuccessfulBackground(
      worker,
      mockChangeMessage({
        after,
        op: 'c',
        table: 'users',
      }),
    );
    expect(await countByPattern('features:*')).to.equal(0);
  });
});
