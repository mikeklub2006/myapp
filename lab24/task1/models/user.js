const COLLECTION = 'users';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GROUP_RE = /^\d{3}$/;

function validate(data, partial = false) {
  const errors = [];
  const has = (field) => data[field] !== undefined;

  if (!partial || has('name')) {
    if (typeof data.name !== 'string' || !data.name.trim()) {
      errors.push({ field: 'name', message: 'обязательное поле, строка' });
    } else if (data.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'минимум 2 символа' });
    }
  }

  if (!partial || has('email')) {
    if (typeof data.email !== 'string' || !data.email) {
      errors.push({ field: 'email', message: 'обязательное поле' });
    } else if (!EMAIL_RE.test(data.email)) {
      errors.push({ field: 'email', message: 'неверный формат' });
    }
  }

  if (!partial || has('group_name')) {
    if (typeof data.group_name !== 'string' || !GROUP_RE.test(data.group_name)) {
      errors.push({ field: 'group_name', message: 'обязательное поле, формат XXX (например 401)' });
    }
  }

  if (has('age')) {
    if (!Number.isInteger(data.age) || data.age < 16 || data.age > 100) {
      errors.push({ field: 'age', message: 'целое число от 16 до 100' });
    }
  }

  return errors;
}

function toDocument(data) {
  const doc = {};
  if (data.name !== undefined) doc.name = data.name.trim();
  if (data.email !== undefined) doc.email = data.email.toLowerCase();
  if (data.group_name !== undefined) doc.group_name = data.group_name;
  if (data.age !== undefined) doc.age = data.age;
  return doc;
}

async function createIndexes(db) {
  await db.collection(COLLECTION).createIndex({ email: 1 }, { unique: true });
}

module.exports = { COLLECTION, validate, toDocument, createIndexes };
