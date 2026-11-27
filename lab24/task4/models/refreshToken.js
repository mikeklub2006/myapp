const { getDb } = require('../db');

const COLLECTION = 'refresh_tokens';

class RefreshToken {
  static collection() {
    return getDb().collection(COLLECTION);
  }

  static async createIndexes() {
    // ttl-индекс сам удалит просроченные токены
    await RefreshToken.collection().createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    await RefreshToken.collection().createIndex({ jti: 1 }, { unique: true });
  }

  static async save(jti, userId, expiresAt) {
    await RefreshToken.collection().insertOne({ jti, user_id: userId, expires_at: expiresAt, created_at: new Date() });
  }

  static async exists(jti) {
    return (await RefreshToken.collection().countDocuments({ jti: String(jti) })) > 0;
  }

  static async remove(jti) {
    const result = await RefreshToken.collection().deleteOne({ jti: String(jti) });
    return result.deletedCount === 1;
  }

  static async removeAllForUser(userId) {
    await RefreshToken.collection().deleteMany({ user_id: userId });
  }
}

module.exports = RefreshToken;
