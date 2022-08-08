import knexCleaner from 'knex-cleaner';
import supertest from 'supertest';
import nock from 'nock';
import { expect } from 'chai';
import sinon from 'sinon';
import db, { migrate } from '../../../src/db';
import {
  deleteKeysByPattern,
  ALERTS_DEFAULT,
  SETTINGS_DEFAULT,
  setRedisObject,
  getUserRedisObjectKey,
  ALERTS_PREFIX,
  SETTINGS_PREFIX,
} from '../../../src/redis';
import app from '../../../src';
import { sign } from '../../../src/jwt';
import { mockFeatureFlagForUser } from '../../helpers';
import role from '../../../src/models/role';
import userModel from '../../../src/models/user';
import provider from '../../../src/models/provider';
import refreshTokenModel from '../../../src/models/refreshToken';
import visit from '../../../src/models/visit';
import config from '../../../src/config';
import { DEFAULT_FLAGS } from '../../../src/routes/boot';

const POST_DEFAULT = {
  postByUrl: {
    id: 'p1',
    title: 'p1 title',
    commentsPermalink: 'http://daily.dev/p1',
    summary: 'p1 summary',
    numUpvotes: 1,
    upvoted: null,
    numComments: 2,
    commented: null,
    bookmarked: null,
    source: {
      id: 's1',
      name: 'source 1',
      image: null,
    },
  },
};

const mockKratos = (expected) => {
  nock(config.kratosOrigin)
    .get('/sessions/whoami')
    .reply(200, JSON.stringify(expected));
};

const mockUserApi = (expected) => {
  nock(config.apiUrl)
    .get('/whoami')
    .reply(200, JSON.stringify(expected));
};

const mockAlertsApi = (
  expected = { filter: true },
) => {
  nock(config.apiUrl)
    .get('/alerts')
    .reply(200, JSON.stringify(expected));
};

const mockSettingsApi = (
  expected = { filter: false },
) => {
  nock(config.apiUrl)
    .get('/settings')
    .reply(200, JSON.stringify(expected));
};

const mockGraphApi = (
  expected = {},
) => {
  nock(config.apiUrl)
    .post('/graphql')
    .reply(200, expected);
};

describe('boot routes', () => {
  let request;
  let server;
  let accessToken;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await deleteKeysByPattern('features:*');
    await deleteKeysByPattern('alerts:*');
    await deleteKeysByPattern('settings:*');
    await userModel.add('1', 'John', 'john@daily.dev', 'https://daily.dev/john.jpg');
    await userModel.update('1', { username: 'john' });
    await provider.add('1', 'github', 'github_id');
    await refreshTokenModel.add('1', 'refresh');
    return migrate();
  });

  before(async () => {
    server = app.listen();
    request = supertest(server);
    accessToken = await sign({ userId: '1' }, null);
  });

  afterEach(() => {
    sinon.restore();
  });

  after(() => {
    server.close();
  });

  it('should return alerts.filter as true if user is not logged in', async () => {
    const res = await request
      .get('/boot')
      .expect(200);

    expect(res.body.alerts.filter)
      .to
      .be
      .equals(true);
  });

  it('should return settings default values if user is not logged in', async () => {
    const res = await request
      .get('/boot')
      .expect(200);

    expect(res.body.settings)
      .to
      .deep
      .equals(SETTINGS_DEFAULT);
  });

  it('should return settings value accurately from cache', async () => {
    const userId = '1';
    const updates = {
      theme: 'bright',
      spaciness: 'cozy',
    };
    const expected = { ...SETTINGS_DEFAULT, ...updates };
    const key = getUserRedisObjectKey(SETTINGS_PREFIX, userId);

    await setRedisObject(key, updates);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.settings)
      .to
      .deep
      .equal(expected);
  });

  it('should return companion expanded value accurately from cache', async () => {
    const userId = '1';
    const updates = {
      companionExpanded: true,
    };
    const expected = { ...SETTINGS_DEFAULT, ...updates };
    const key = getUserRedisObjectKey(SETTINGS_PREFIX, userId);

    await setRedisObject(key, updates);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.settings)
      .to
      .deep
      .equal(expected);
  });

  it('should return settings value from api if cache is empty', async () => {
    const expected = {
      ...SETTINGS_DEFAULT,
      theme: 'bright',
    };

    mockAlertsApi();
    mockSettingsApi(expected);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.settings)
      .to
      .deep
      .equal(expected);
  });

  it('should return alerts value accurately from cache', async () => {
    const userId = '1';
    const expected = {
      ...ALERTS_DEFAULT,
      filter: false,
    };
    const key = getUserRedisObjectKey(ALERTS_PREFIX, userId);

    await setRedisObject(key, expected);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.alerts)
      .to
      .deep
      .equal(expected);
  });

  it('should return alerts value from api if cache is empty', async () => {
    const expected = {
      ...ALERTS_DEFAULT,
      filter: false,
    };

    mockAlertsApi(expected);
    mockSettingsApi();

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.alerts)
      .to
      .deep
      .equal(expected);
  });

  it('should return registered user profile for kratos user', async () => {
    mockFeatureFlagForUser('feat_limit_dev_card', false);
    const expected = {
      id: '1',
      bio: null,
      github: null,
      hashnode: null,
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      createdAt: new Date(),
      twitter: null,
      username: 'idoshamun',
      infoConfirmed: true,
    };

    mockUserApi(expected);
    mockKratos({ identity: { id: 1 } });

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`, 'ory_kratos_session=test123'])
      .expect(200);

    expect(res.body.user.createdAt)
      .to
      .be
      .a('string');
    expect(res.body.visit.visitId)
      .to
      .be
      .a('string');
    expect(res.body.visit.sessionId)
      .to
      .be
      .a('string');
    delete res.body.visit;
    delete res.body.user.createdAt;
    delete res.body.accessToken;

    const {
      createdAt,
      ...userExpected
    } = expected;

    expect(res.body)
      .to
      .deep
      .equal({
        user: {
          ...userExpected,
          firstVisit: res.body.user.firstVisit,
          isFirstVisit: res.body.user.isFirstVisit,
          permalink: 'http://127.0.0.1:5002/idoshamun',
          providers: [null],
          roles: [],
        },
        flags: {
          feat_limit_dev_card: {
            enabled: false,
          },
        },
        alerts: ALERTS_DEFAULT,
        settings: SETTINGS_DEFAULT,
      });
  });

  it('should return registered user profile', async () => {
    mockFeatureFlagForUser('feat_limit_dev_card', false);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.user.createdAt)
      .to
      .be
      .a('string');
    expect(res.body.visit.visitId)
      .to
      .be
      .a('string');
    expect(res.body.visit.sessionId)
      .to
      .be
      .a('string');
    delete res.body.visit;
    delete res.body.user.createdAt;
    expect(res.body)
      .to
      .deep
      .equal({
        user: {
          id: '1',
          providers: ['github'],
          name: 'John',
          image: 'https://daily.dev/john.jpg',
          email: 'john@daily.dev',
          infoConfirmed: false,
          premium: false,
          acceptedMarketing: true,
          roles: [],
          reputation: 10,
          permalink: 'http://127.0.0.1:5002/john',
          referralLink: 'https://api.daily.dev/get?r=john',
          firstVisit: res.body.user.firstVisit,
          isFirstVisit: res.body.user.isFirstVisit,
          username: 'john',
        },
        registrationLink: 'http://127.0.0.1:5002/register',
        flags: {
          feat_limit_dev_card: {
            enabled: false,
          },
        },
        alerts: ALERTS_DEFAULT,
        settings: SETTINGS_DEFAULT,
      });
  });

  it('should return profile with roles', async () => {
    await role.add('1', 'admin');
    await role.add('1', 'moderator');

    mockFeatureFlagForUser('feat_limit_dev_card', false);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.user.createdAt)
      .to
      .be
      .a('string');
    expect(res.body.visit.visitId)
      .to
      .be
      .a('string');
    expect(res.body.visit.sessionId)
      .to
      .be
      .a('string');
    delete res.body.visit;
    delete res.body.user.createdAt;
    expect(res.body)
      .to
      .deep
      .equal({
        user: {
          id: '1',
          providers: ['github'],
          name: 'John',
          image: 'https://daily.dev/john.jpg',
          email: 'john@daily.dev',
          infoConfirmed: false,
          premium: false,
          acceptedMarketing: true,
          roles: ['admin', 'moderator'],
          reputation: 10,
          permalink: 'http://127.0.0.1:5002/john',
          referralLink: 'https://api.daily.dev/get?r=john',
          firstVisit: res.body.user.firstVisit,
          isFirstVisit: res.body.user.isFirstVisit,
          username: 'john',
        },
        registrationLink: 'http://127.0.0.1:5002/register',
        flags: {
          feat_limit_dev_card: {
            enabled: false,
          },
        },
        alerts: ALERTS_DEFAULT,
        settings: SETTINGS_DEFAULT,
      });
  });

  it('should refresh access token when refresh token is available', async () => {
    const res = await request
      .get('/boot')
      .set('Cookie', ['da5=refresh'])
      .expect(200);

    expect(res.body.accessToken)
      .to
      .be
      .a('object');
  });

  it('should throw forbidden error when refresh token is not valid', async () => {
    await request
      .get('/boot')
      .set('Cookie', ['da5=refresh2'])
      .expect(403);
  });

  it('should return isFirstVisit variable for first time user', async () => {
    const res = await request
      .get('/boot')
      .set('Cookie', ['da2=999'])
      .expect(200);

    expect(res.body.user.isFirstVisit)
      .to
      .equal(true);
  });

  it('should not return isFirstVisit variable for returning user', async () => {
    const date1 = new Date('2020-01-21T21:44:16Z');
    const date2 = new Date('2020-01-21T21:45:16Z');
    await visit.upsert('123', 'app', date2, date1, '1', '');

    const res = await request
      .get('/boot')
      .set('Cookie', ['da2=123'])
      .expect(200);

    expect(res.body.user)
      .to
      .not
      .have
      .property('isFirstVisit');
  });

  it('should return first visit time and referral of anonymous user', async () => {
    const date1 = new Date('2020-01-21T21:44:16Z');
    const date2 = new Date('2020-01-21T21:45:16Z');
    await visit.upsert('123', 'app', date2, date1, '1', '');

    mockFeatureFlagForUser('feat_limit_dev_card', false);

    const res = await request
      .get('/boot')
      .set('Cookie', ['da2=123'])
      .expect(200);

    expect(res.body.user.firstVisit)
      .to
      .equal('2020-01-21T21:44:16.000Z');
    expect(res.body.visit.visitId)
      .to
      .be
      .a('string');
    expect(res.body.visit.sessionId)
      .to
      .be
      .a('string');
    delete res.body.visit;
    expect(res.body)
      .to
      .deep
      .equal({
        user: {
          id: '123',
          firstVisit: '2020-01-21T21:44:16.000Z',
          referrer: '1',
        },
        flags: {
          feat_limit_dev_card: {
            enabled: false,
          },
        },
        alerts: ALERTS_DEFAULT,
        settings: SETTINGS_DEFAULT,
      });
  });

  it('should return first visit time and referral when visit entry does not exist', async () => {
    mockFeatureFlagForUser('feat_limit_dev_card', false);

    const res = await request
      .get('/boot')
      .set('Cookie', ['da2=123;da4=john'])
      .expect(200);

    expect(res.body.user.firstVisit)
      .to
      .a('string');
    expect(res.body.visit.visitId)
      .to
      .be
      .a('string');
    expect(res.body.visit.sessionId)
      .to
      .be
      .a('string');
    delete res.body.visit;
    expect(res.body)
      .to
      .deep
      .equal({
        user: {
          id: '123',
          isFirstVisit: true,
          firstVisit: res.body.user.firstVisit,
          referrer: '1',
        },
        flags: {
          feat_limit_dev_card: {
            enabled: false,
          },
        },
        alerts: ALERTS_DEFAULT,
        settings: SETTINGS_DEFAULT,
      });
  });

  it('should return valid response when flagsmith returns error', async () => {
    nock('https://api.flagsmith.com')
      .post('/api/v1/identities/')
      .reply(500);

    const res = await request
      .get('/boot')
      .set('Cookie', ['da2=123'])
      .expect(200);

    expect(res.body.user.firstVisit)
      .to
      .a('string');
    expect(res.body.visit.visitId)
      .to
      .be
      .a('string');
    expect(res.body.visit.sessionId)
      .to
      .be
      .a('string');
    delete res.body.visit;
    delete res.body.flags;
    expect(res.body)
      .to
      .deep
      .equal({
        user: {
          id: '123',
          isFirstVisit: true,
          firstVisit: res.body.user.firstVisit,
        },
        alerts: ALERTS_DEFAULT,
        settings: SETTINGS_DEFAULT,
      });
  });

  it('should add visit entry', async () => {
    await request
      .get('/boot')
      .set('App', 'extension')
      .set('Cookie', ['da2=123;da4=john'])
      .expect(200);

    // Sleep as adding a new visit happens in the background
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 50));
    const visitObj = await visit.get('123', 'extension');
    expect(visitObj.referral, '1');
  });

  it('should add visit entry with no referral', async () => {
    await request
      .get('/boot')
      .set('App', 'extension')
      .set('Cookie', ['da2=123;da4=john2'])
      .expect(200);

    // Sleep as adding a new visit happens in the background
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, 50));
    const visitObj = await visit.get('123', 'extension');
    expect(visitObj.referral, null);
  });

  it('should return a post based on url', async () => {
    mockFeatureFlagForUser();

    const EXPECTED = {
      data: {
        ...POST_DEFAULT,
      },
    };

    mockGraphApi(EXPECTED);

    const res = await request
      .get('/boot/companion')
      .set('qs', JSON.stringify({ url: encodeURIComponent('http://test.dev/article-1') }))
      .set('Cookie', ['da2=123;da4=john2'])
      .set('App', 'companion')
      .expect(200);

    delete res.body.visit;

    expect(res.body)
      .to
      .deep
      .equal({
        alerts: ALERTS_DEFAULT,
        flags: DEFAULT_FLAGS,
        postData: POST_DEFAULT.postByUrl,
        settings: SETTINGS_DEFAULT,
        user: {
          id: '123',
          isFirstVisit: true,
          firstVisit: res.body.user.firstVisit,
        },
      });
  });

  it('should return submit_article false if flag exists', async () => {
    mockFeatureFlagForUser('submit_article', false);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.flags.submit_article.enabled)
      .to
      .equal(false);
  });

  it('should set submit_article to true if user has enough reputation', async () => {
    mockFeatureFlagForUser('submit_article', false);
    await userModel.updateReputation('1', 250);

    const res = await request
      .get('/boot')
      .set('Cookie', [`da3=${accessToken.token}`])
      .expect(200);

    expect(res.body.flags.submit_article.enabled)
      .to
      .equal(true);
  });
});
