const Router = require('@koa/router');
const users = require('../controllers/users');

const router = new Router({ prefix: '/api/users' });

router.get('/', users.list);
router.get('/:id', users.getOne);
router.post('/', users.create);
router.put('/:id', users.update);
router.delete('/:id', users.remove);

module.exports = router;
