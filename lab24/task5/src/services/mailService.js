const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../logger');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    // без smtp письма не уходят наружу, nodemailer просто собирает их в json
    transporter = config.smtpUrl
      ? nodemailer.createTransport(config.smtpUrl)
      : nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

async function send(to, subject, text) {
  try {
    const info = await getTransporter().sendMail({ from: config.mailFrom, to, subject, text });
    logger.info({ to, subject, messageId: info.messageId }, 'Email отправлен');
    return info;
  } catch (err) {
    // ошибка почты не должна ломать основной запрос
    logger.error({ err, to }, 'Не удалось отправить email');
    return null;
  }
}

function sendWelcome(user) {
  return send(user.email, 'Добро пожаловать', `Здравствуйте, ${user.name}! Вы зарегистрированы в группе ${user.group_name}.`);
}

module.exports = { send, sendWelcome };
