// коллекция users с валидатором на уровне mongodb
const validator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'email', 'group_name', 'role', 'created_at'],
    properties: {
      name: { bsonType: 'string', minLength: 2, maxLength: 100 },
      email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
      group_name: { bsonType: 'string', pattern: '^[0-9]{3}$' },
      age: { bsonType: 'int', minimum: 16, maximum: 100 },
      course: { bsonType: 'int', minimum: 1, maximum: 4 },
      role: { enum: ['user', 'moderator', 'admin'] },
      password: { bsonType: 'string' },
      avatar: { bsonType: ['string', 'null'] },
      created_at: { bsonType: 'date' },
      updated_at: { bsonType: 'date' },
      deleted_at: { bsonType: ['date', 'null'] }
    }
  }
};

module.exports = {
  name: '001-users-collection',
  async up(db) {
    const exists = await db.listCollections({ name: 'users' }).hasNext();
    if (exists) {
      await db.command({ collMod: 'users', validator, validationLevel: 'strict' });
    } else {
      await db.createCollection('users', { validator, validationLevel: 'strict' });
    }
  }
};
