const Router = require('@koa/router');
const controller = require('../controllers/studentController');

const router = new Router({ prefix: '/api' });

// статические пути должны идти раньше /:id
router.get('/students/stats', controller.stats);
router.get('/students/search', controller.search);
router.post('/students/batch', controller.batch);

router.get('/students', controller.list);
router.get('/students/:id', controller.getOne);
router.post('/students', controller.create);
router.put('/students/:id', controller.update);
router.delete('/students/:id', controller.remove);

router.get('/metrics', controller.metrics);

module.exports = router;
