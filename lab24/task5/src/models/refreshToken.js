const { getDb } = require('../db');

class RefreshToken {
  static collection() {
    return getDb().collection('refresh_tokens');
  }

  static async save(jti, userId, expiresAt) {
    await RefreshToken.collection().insertOne({ jti, user_id: userId, expires_at: expiresAt, created_at: new Date() });
  }

  static async remove(jti) {
    const result = await RefreshToken.collection().deleteOne({ jti: String(jti) });
    return result.deletedCount === 1;
  }

  static async removeAllForUser(userId) {
    await RefreshToken.collection().deleteMany({ user_id: String(userId) });
  }
}

module.exports = RefreshToken;
