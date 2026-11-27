const Router = require('@koa/router');
const controller = require('../controllers/userController');
const validate = require('../middleware/validation');
const { authMiddleware, requireOwnerOrRole } = require('../middleware/auth');
const schemas = require('../validators/userSchema');

const router = new Router({ prefix: '/api/users' });

// чтение публичное
router.get('/', validate(schemas.listQuery, 'query'), controller.list);
router.get('/search', validate(schemas.searchQuery, 'query'), controller.search);
router.get('/stats', controller.stats);
router.get('/export', validate(schemas.listQuery, 'query'), controller.exportCsv);
router.get('/:id', controller.getOne);

// изменение только с токеном
router.post('/', authMiddleware, validate(schemas.createUser), controller.create);
router.put('/:id', authMiddleware, requireOwnerOrRole('admin', 'moderator'), validate(schemas.updateUser), controller.update);
router.delete('/:id', authMiddleware, requireOwnerOrRole('admin'), controller.remove);

module.exports = router;
