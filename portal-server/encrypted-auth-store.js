const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
const authFilePath = path.join(dataDir, 'auth.enc.json');

const nowIso = () => new Date().toISOString();

const normalizeLogin = (value) => String(value || '').trim().toLowerCase();

const getEncryptionKey = () => {
  const source = process.env.AUTH_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!source || String(source).trim().length < 16) {
    throw new Error('AUTH_ENCRYPTION_KEY or SESSION_SECRET must be set for encrypted auth store');
  }

  return crypto.createHash('sha256').update(`36th-auth:${String(source).trim()}`).digest();
};

const encryptPayload = (payloadObject) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payloadObject), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
    updatedAt: nowIso(),
  };
};

const decryptPayload = (wrappedPayload) => {
  if (!wrappedPayload || wrappedPayload.v !== 1 || wrappedPayload.alg !== 'aes-256-gcm') {
    throw new Error('Unsupported encrypted auth store format');
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(wrappedPayload.iv, 'base64');
    const tag = Buffer.from(wrappedPayload.tag, 'base64');
    const data = Buffer.from(wrappedPayload.data, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString('utf8'));

    if (!parsed || !Array.isArray(parsed.accounts)) {
      return { accounts: [] };
    }

    return parsed;
  } catch (error) {
    throw new Error('Could not decrypt auth store. Check AUTH_ENCRYPTION_KEY/SESSION_SECRET consistency.');
  }
};

const readStore = () => {
  if (!fs.existsSync(authFilePath)) {
    return { accounts: [] };
  }

  try {
    const wrapped = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
    return decryptPayload(wrapped);
  } catch (error) {
    const backupPath = `${authFilePath}.invalid-${Date.now()}`;
    try {
      fs.copyFileSync(authFilePath, backupPath);
    } catch {
      // Ignore backup failures and continue with clean recovery store.
    }

    return { accounts: [] };
  }
};

const writeStore = (store) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const wrapped = encryptPayload(store);
  const tmpPath = `${authFilePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(wrapped));
  fs.renameSync(tmpPath, authFilePath);
};

const findAccountByLogin = (login) => {
  const normalized = normalizeLogin(login);
  if (!normalized) {
    return null;
  }

  const store = readStore();
  return store.accounts.find((entry) => {
    return entry.username === normalized || (entry.email && entry.email === normalized);
  }) || null;
};

const createAccount = ({ userId, username, email = null, passwordHash }) => {
  const normalizedUsername = normalizeLogin(username);
  const normalizedEmail = email ? normalizeLogin(email) : null;

  if (!normalizedUsername) {
    throw new Error('Username is required for encrypted account creation');
  }

  const store = readStore();
  const exists = store.accounts.some((entry) => {
    return entry.username === normalizedUsername || (normalizedEmail && entry.email === normalizedEmail);
  });

  if (exists) {
    throw new Error('Username or email already exists');
  }

  const timestamp = nowIso();
  const account = {
    id: crypto.randomUUID(),
    userId,
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: null,
  };

  store.accounts.push(account);
  writeStore(store);
  return account;
};

const touchAccountLogin = ({ accountId }) => {
  const store = readStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  if (!account) {
    return null;
  }

  account.lastLoginAt = nowIso();
  account.updatedAt = account.lastLoginAt;
  writeStore(store);
  return account;
};

module.exports = {
  createAccount,
  findAccountByLogin,
  touchAccountLogin,
};