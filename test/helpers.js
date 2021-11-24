import nock from 'nock';

function base64(i) {
  return Buffer.from(i, 'utf8').toString('base64');
}

export const mockMessage = (
  data,
) => {
  const message = {
    data: Buffer.from(base64(JSON.stringify(data)), 'base64'),
    messageId: '1',
  };
  return { message };
};

export const invokeBackground = (
  worker,
  data,
) => worker.handler(mockMessage(data), console);

export const expectSuccessfulBackground = (
  worker,
  data,
) => invokeBackground(worker, data);

export const mockChangeMessage = ({
  before,
  after,
  table,
  op,
}) => ({
  schema: {
    type: 'type',
    fields: [],
    optional: false,
    name: 'name',
  },
  payload: {
    before,
    after,
    source: {
      version: '1',
      connector: 'gateway',
      name: 'gateway',
      ts_ms: 0,
      snapshot: false,
      db: 'gateway',
      sequence: 's',
      schema: 'public',
      table,
      txId: 0,
      lsn: 0,
      xmin: 0,
    },
    op,
    ts_ms: 0,
    transaction: 0,
  },
});

export const mockFeatureFlagForUser = (
  featureName,
  enabled,
  value,
) => nock('https://api.flagsmith.com')
  .filteringPath(/identifier=[^&]*/g, 'identifier=XXX')
  .get('/api/v1/identities/?identifier=XXX')
  .reply(200, {
    flags: [
      {
        feature: { name: featureName },
        enabled,
        feature_state_value: value,
      },
    ],
  });
