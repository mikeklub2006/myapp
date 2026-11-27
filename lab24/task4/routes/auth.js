const Router = require('@koa/router');
const controller = require('../controllers/authController');
const validate = require('../middleware/validation');
const { authMiddleware, requireRole } = require('../middleware/auth');
const authSchema = require('../validators/authSchema');
const userSchema = require('../validators/userSchema');

const auth = new Router({ prefix: '/api/auth' });

auth.post('/register', validate(authSchema.register), controller.register);
auth.post('/login', validate(authSchema.login), controller.login);
auth.post('/refresh', validate(authSchema.refresh), controller.refresh);
auth.post('/logout', authMiddleware, validate(authSchema.refresh), controller.logout);
auth.get('/me', authMiddleware, controller.me);

const admin = new Router({ prefix: '/api/admin' });

admin.use(authMiddleware, requireRole('admin'));
admin.get('/users', validate(userSchema.listQuery, 'query'), controller.adminUsers);
admin.patch('/users/:id/role', validate(authSchema.role), controller.setRole);

module.exports = { auth, admin };
