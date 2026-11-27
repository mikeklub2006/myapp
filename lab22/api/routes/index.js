const Router = require('@koa/router');
const students = require('../controllers/studentController');
const groups = require('../controllers/groupController');
const system = require('../controllers/systemController');

const router = new Router({ prefix: '/api' });

router.get('/students', students.list);
router.get('/students/stats', students.stats);
router.post('/students/batch', students.batch);
router.get('/students/:id', students.get);
router.post('/students', students.create);
router.put('/students/:id', students.update);
router.delete('/students/:id', students.remove);

router.get('/groups', groups.list);
router.post('/groups', groups.create);
router.get('/groups/:id/students', groups.students);

router.get('/cache/stats', system.cacheStats);
router.get('/metrics', system.dbMetrics);

module.exports = router;
