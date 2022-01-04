import Router from 'koa-router';

const router = Router({
  prefix: '/p',
});

router.all(['/', '/(.*)'], async (ctx) => {
  ctx.status = 404;
});

export default router;
