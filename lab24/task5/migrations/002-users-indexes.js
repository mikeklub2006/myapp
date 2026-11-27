module.exports = {
  name: '002-users-indexes',
  async up(db) {
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ group_name: 1, course: 1 });
    await users.createIndex({ deleted_at: 1 });
    await users.createIndex(
      { name: 'text', email: 'text' },
      { weights: { name: 3, email: 1 }, default_language: 'russian', name: 'name_email_text' }
    );
  }
};
