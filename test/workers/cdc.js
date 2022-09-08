import { expect } from 'chai';
import sinon from 'sinon';
import knexCleaner from 'knex-cleaner';
import worker from '../../src/workers/cdc';
import * as pubsub from '../../src/pubsub';
import { expectSuccessfulBackground, mockChangeMessage } from '../helpers';
import {
  participantEligilbleTopic,
} from '../../src/pubsub';
import db, { migrate } from '../../src/db';

describe('cdc', () => {
  let publishEventStub;

  beforeEach(async () => {
    publishEventStub = sinon.stub(pubsub, 'publishEvent').returns(Promise.resolve());
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    return migrate();
  });

  afterEach(() => {
    sinon.restore();
  });

  const baseParticipant = {
    contestId: 'c1',
    userId: '1',
    referrals: 3,
    eligible: false,
  };

  it('should notify on new eligible participant of the contest', async () => {
    const after = {
      ...baseParticipant,
      eligible: true,
    };
    await expectSuccessfulBackground(

      worker,
      mockChangeMessage({
        before: baseParticipant,
        after,
        op: 'u',
        table: 'referral_participants',
      }),
    );
    expect(publishEventStub.calledWith(participantEligilbleTopic, after)).to.be.ok;
  });

  it('should not notify on new eligible participant', async () => {
    const after = {
      ...baseParticipant,
      referrals: 5,
    };
    await expectSuccessfulBackground(

      worker,
      mockChangeMessage({
        before: baseParticipant,
        after,
        op: 'u',
        table: 'referral_participants',
      }),
    );
    expect(publishEventStub.callCount).to.equal(0);
  });
});
