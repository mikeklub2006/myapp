const Router = require('@koa/router');
const users = require('../controllers/userController');
const auth = require('../controllers/authController');
const health = require('../controllers/healthController');
const { validate } = require('../middleware/validate');
const { authMiddleware, requireRole, requireOwnerOrRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const schemas = require('../validators/schemas');

const router = new Router();

router.get('/health', health.health);
router.get('/ready', health.ready);
router.get('/metrics', health.metrics);

router.post('/api/auth/register', validate(schemas.register), auth.register);
router.post('/api/auth/login', validate(schemas.login), auth.login);
router.post('/api/auth/refresh', validate(schemas.refresh), auth.refresh);
router.post('/api/auth/logout', authMiddleware, validate(schemas.refresh), auth.logout);
router.get('/api/auth/me', authMiddleware, auth.me);

router.get('/api/users', validate(schemas.listQuery, 'query'), users.list);
router.get('/api/users/search', validate(schemas.searchQuery, 'query'), users.search);
router.get('/api/users/stats', users.stats);
router.get('/api/users/export', validate(schemas.listQuery, 'query'), users.exportUsers);
router.post('/api/users/import', authMiddleware, requireRole('admin'), upload.importFile.single('file'), users.importUsers);
router.get('/api/users/:id', users.getOne);
router.get('/api/users/:id/avatar', users.getAvatar);
router.post('/api/users', authMiddleware, validate(schemas.createUser), users.create);
router.put('/api/users/:id', authMiddleware, requireOwnerOrRole('admin', 'moderator'), validate(schemas.updateUser), users.update);
router.delete('/api/users/:id', authMiddleware, requireOwnerOrRole('admin'), users.remove);
router.post('/api/users/:id/avatar', authMiddleware, requireOwnerOrRole('admin'), upload.avatar.single('avatar'), users.uploadAvatar);

router.get('/api/admin/users', authMiddleware, requireRole('admin'), validate(schemas.listQuery, 'query'), users.adminList);
router.post('/api/admin/users/:id/restore', authMiddleware, requireRole('admin'), users.restore);
router.patch('/api/admin/users/:id/role', authMiddleware, requireRole('admin'), validate(schemas.role), users.setRole);

module.exports = router;
