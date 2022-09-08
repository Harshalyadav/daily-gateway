import Router from 'koa-router';
import validator, { object, string, boolean } from 'koa-context-validator';
import _ from 'lodash';
import { ForbiddenError, ValidationError } from '../errors';
import userModel from '../models/user';
import role from '../models/role';
import upload from '../upload';
import { uploadAvatar } from '../cloudinary';
import { bootSharedLogic } from './boot';
import { logout, validateToken } from '../auth';
import { getFromDailyGraphQLApi } from '../integration';

const updateUser = async (userId, user, newProfile) => {
  await userModel.update(userId, newProfile);
};

const deleteUser = async (userId, ctx) => {
  await userModel.deleteAccount(userId);
  await getFromDailyGraphQLApi(ctx, {
    query: `mutation DeleteUser {
        deleteUser {
          _
        }
      }
      `,
  });
};

const router = Router({
  prefix: '/users',
});

router.get('/me', async (ctx) => {
  const shouldRefreshToken = await validateToken(ctx);
  const base = await bootSharedLogic(ctx, shouldRefreshToken);
  ctx.status = 200;
  ctx.body = {
    ...base.user,
    ...base.visit,
    accessToken: base.accessToken,
    registrationLink: base.registrationLink,
  };
});

router.put(
  '/me',
  validator(
    {
      body: object()
        .keys({
          name: string()
            .required()
            .trim()
            .min(1)
            .max(50),
          email: string()
            .email()
            .required(),
          company: string()
            .allow(null)
            .max(50),
          title: string()
            .allow(null)
            .max(50),
          acceptedMarketing: boolean(),
          username: string()
            .required()
            .regex(/^@?(\w){1,15}$/),
          bio: string()
            .allow(null)
            .max(160),
          twitter: string()
            .allow(null)
            .regex(/^@?(\w){1,15}$/),
          github: string()
            .allow(null)
            .regex(/^@?([\w-]){1,39}$/i),
          hashnode: string()
            .allow(null)
            .regex(/^@?([\w-]){1,39}$/i),
          timezone: string()
            .allow(null)
            .max(50),
          portfolio: string()
            .allow(null),
        }),
    },
    { stripUnknown: true },
  ),
  async (ctx) => {
    if (ctx.state.user) {
      const { userId } = ctx.state.user;
      const user = await userModel.getById(userId);
      if (!user) {
        throw new ForbiddenError();
      }
      const { body } = ctx.request;
      ['username', 'twitter', 'github', 'hashnode'].forEach((key) => {
        if (body[key]) {
          body[key] = body[key].replace('@', '');
        }
      });

      const {
        id,
        reputation,
        referralLink,
        createdAt,
        premium,
        ...restUser
      } = user;

      const newProfile = {
        ...restUser,
        acceptedMarketing: true,
        ...body,
        infoConfirmed: true,
      };
      ctx.log.info(`updating profile for ${userId}`);

      const res = await getFromDailyGraphQLApi(ctx, {
        query: `mutation UpdateUserProfile($data: UpdateUserInput) {
        updateUserProfile(data: $data) {
          id
        }
      }
      `,
        variables: {
          data: newProfile,
        },
      });

      if (res.errors?.length) {
        const errors = JSON.parse(res.errors[0]?.message);
        if (errors.name) {
          throw new ValidationError('name', 'name is not a correct format');
        }
        if (errors.username) {
          throw new ValidationError('username', 'username already exists');
        }
        if (errors.email) {
          throw new ValidationError('email', 'email already exists');
        }
        if (errors.github) {
          throw new ValidationError('github', 'github handle already exists');
        }
        if (errors.twitter) {
          throw new ValidationError(
            'twitter',
            'twitter handle already exists',
          );
        }
        if (errors.hashnode) {
          throw new ValidationError(
            'hashnode',
            'hashnode handle already exists',
          );
        }
      }

      ctx.body = {
        id,
        reputation,
        referralLink,
        createdAt,
        premium,
        ...newProfile,
      };
      ctx.status = 200;
    } else {
      throw new ForbiddenError();
    }
  },
);

router.get('/me/info', async (ctx) => {
  if (ctx.state.user) {
    const { userId } = ctx.state.user;
    const user = await userModel.getById(userId);
    if (!user) {
      throw new ForbiddenError();
    }
    ctx.body = {
      name: user.name,
      email: user.email,
    };
    ctx.status = 200;
  } else {
    throw new ForbiddenError();
  }
});

router.get('/me/roles', async (ctx) => {
  if (ctx.state.user) {
    const { userId } = ctx.state.user;
    ctx.body = await role.getByUserId(userId);
    ctx.status = 200;
  } else {
    throw new ForbiddenError();
  }
});

router.delete('/me', async (ctx) => {
  if (ctx.state.user) {
    const { userId } = ctx.state.user;
    await deleteUser(userId, ctx);
    await logout(ctx);
  } else {
    throw new ForbiddenError();
  }
});

router.post('/logout', async (ctx) => logout(ctx));

router.post('/me/image', async (ctx) => {
  if (ctx.state.user) {
    const { userId } = ctx.state.user;
    const { file } = await upload(ctx.req, {
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    });
    ctx.log.info(`updating image for ${userId}`);
    const avatarUrl = await uploadAvatar(userId, file);
    const user = await userModel.getById(userId);
    const newProfile = {
      ...user,
      image: avatarUrl,
    };
    await updateUser(userId, user, newProfile);
    ctx.body = newProfile;
    ctx.status = 200;
  } else {
    throw new ForbiddenError();
  }
});

router.get('/:id', async (ctx) => {
  const user = await userModel.getByIdOrUsername(ctx.params.id);
  if (!user) {
    ctx.status = 404;
    return;
  }
  ctx.status = 200;
  ctx.body = _.pick(user, [
    'id',
    'name',
    'image',
    'premium',
    'username',
    'bio',
    'twitter',
    'github',
    'hashnode',
    'timezone',
    'portfolio',
    'reputation',
    'createdAt',
  ]);
});

export default router;
