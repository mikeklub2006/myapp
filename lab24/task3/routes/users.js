const Router = require('@koa/router');
const controller = require('../controllers/userController');
const validate = require('../middleware/validation');
const schemas = require('../validators/userSchema');

const router = new Router({ prefix: '/api/users' });

// статические пути объявляем раньше /:id
router.get('/', validate(schemas.listQuery, 'query'), controller.list);
router.get('/search', validate(schemas.searchQuery, 'query'), controller.search);
router.get('/stats', controller.stats);
router.get('/export', validate(schemas.listQuery, 'query'), controller.exportCsv);
router.get('/:id', controller.getOne);
router.post('/', validate(schemas.createUser), controller.create);
router.put('/:id', validate(schemas.updateUser), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
