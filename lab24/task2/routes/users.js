const Router = require('@koa/router');
const controller = require('../controllers/userController');
const validate = require('../middleware/validation');
const schemas = require('../validators/userSchema');

const router = new Router({ prefix: '/api/users' });

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', validate(schemas.createUser), controller.create);
router.put('/:id', validate(schemas.updateUser), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
