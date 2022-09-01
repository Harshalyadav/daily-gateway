import { expect } from 'chai';
import sinon from 'sinon';
import knexCleaner from 'knex-cleaner';
import worker from '../../src/workers/cdc';
import * as pubsub from '../../src/pubsub';
import { expectSuccessfulBackground, mockChangeMessage } from '../helpers';
import {
  participantEligilbleTopic,
  userDeletedTopic,
} from '../../src/pubsub';
import db, { migrate, toCamelCase } from '../../src/db';

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

  const baseUser = {
    id: '1',
    username: 'idoshamun',
    name: 'Ido Shamun',
    created_at: new Date(2021, 9, 19),
    updated_at: new Date(2021, 9, 19),
  };

  it('should notify on user deleted', async () => {
    await expectSuccessfulBackground(

      worker,
      mockChangeMessage({
        before: baseUser,
        op: 'd',
        table: 'users',
      }),
    );
    expect(publishEventStub.calledWith(userDeletedTopic, toCamelCase({
      ...baseUser,
      created_at: baseUser.created_at.toISOString(),
      updated_at: baseUser.updated_at.toISOString(),
    }))).to.be.ok;
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
