const express = require('express');
const { db } = require('./data');
const { schemas, validate } = require('./validation');

const router = express.Router();

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

router.get('/users', (req, res) => {
  res.json(db.users.map(publicUser));
});

router.patch('/users/:id/role', validate(schemas.role), (req, res) => {
  const user = db.users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден', status: 404 });
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя менять роль самому себе', status: 400 });
  }

  user.role = req.body.role;
  res.json({ message: `Роль пользователя изменена на ${user.role}`, user: publicUser(user) });
});

router.get('/stats', (req, res) => {
  const byGenre = {};
  let copies = 0;
  let available = 0;
  let reviews = 0;
  for (const book of db.books) {
    byGenre[book.genre] = (byGenre[book.genre] || 0) + 1;
    copies += book.copies;
    available += book.available;
    reviews += book.reviews.length;
  }

  res.json({
    books: db.books.length,
    copies,
    available,
    onHands: copies - available,
    reviews,
    users: db.users.length,
    byGenre
  });
});

module.exports = router;
