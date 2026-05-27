const fs = require('fs');
const path = require('path');

const backupRoot = path.join(__dirname, '..', 'data', 'backups');

const getLatestDirectory = () => {
  if (!fs.existsSync(backupRoot)) {
    return null;
  }

  const directories = fs.readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (!directories.length) {
    return null;
  }

  return path.join(backupRoot, directories[directories.length - 1]);
};

const getLatestFile = (dirPath, prefix) => {
  const files = fs.readdirSync(dirPath)
    .filter((fileName) => fileName.startsWith(prefix))
    .sort();

  if (!files.length) {
    return null;
  }

  return path.join(dirPath, files[files.length - 1]);
};

const validatePortalJson = (filePath) => {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('portal backup is not a valid object');
  }

  if (!Array.isArray(parsed.users) || !Array.isArray(parsed.forumThreads) || !Array.isArray(parsed.forumPosts)) {
    throw new Error('portal backup is missing expected arrays');
  }
};

const validateAuthWrapper = (filePath) => {
  if (!filePath) {
    return;
  }

  const wrapped = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const hasFields = wrapped
    && wrapped.v === 1
    && wrapped.alg === 'aes-256-gcm'
    && typeof wrapped.iv === 'string'
    && typeof wrapped.tag === 'string'
    && typeof wrapped.data === 'string';

  if (!hasFields) {
    throw new Error('auth backup has invalid wrapper format');
  }
};

const run = () => {
  const latestDir = getLatestDirectory();
  if (!latestDir) {
    throw new Error('no backup directory found');
  }

  const portalBackup = getLatestFile(latestDir, 'portal-data.');
  if (!portalBackup) {
    throw new Error('no portal-data backup found in latest backup directory');
  }

  const authBackup = getLatestFile(latestDir, 'auth.enc.');

  validatePortalJson(portalBackup);
  validateAuthWrapper(authBackup);

  console.log('Backup verification succeeded');
  console.log(`Latest backup dir: ${latestDir}`);
  console.log(`Portal backup:     ${portalBackup}`);
  console.log(`Auth backup:       ${authBackup || 'none'}`);
};

try {
  run();
} catch (error) {
  console.error('Backup verification failed:', error.message);
  process.exit(1);
}
