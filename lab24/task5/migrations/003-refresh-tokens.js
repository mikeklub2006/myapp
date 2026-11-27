module.exports = {
  name: '003-refresh-tokens',
  async up(db) {
    const tokens = db.collection('refresh_tokens');
    await tokens.createIndex({ jti: 1 }, { unique: true });
    // просроченные токены mongodb удалит сама
    await tokens.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
  }
};
