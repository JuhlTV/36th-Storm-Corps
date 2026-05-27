const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const backupRoot = path.join(dataDir, 'backups');
const sourcePortal = path.join(dataDir, 'portal-data.json');
const sourceAuth = path.join(dataDir, 'auth.enc.json');

const now = new Date();
const dayStamp = now.toISOString().slice(0, 10);
const fileStamp = now.toISOString().replace(/[:.]/g, '-');
const destinationDir = path.join(backupRoot, dayStamp);

const ensureDataDir = () => {
  fs.mkdirSync(dataDir, { recursive: true });
};

const ensurePortalStore = () => {
  if (!fs.existsSync(sourcePortal)) {
    const initialStore = {
      counters: { users: 0, threads: 0, posts: 0, auditEvents: 0 },
      users: [],
      forumThreads: [],
      forumPosts: [],
      auditEvents: [],
    };

    fs.writeFileSync(sourcePortal, JSON.stringify(initialStore, null, 2));
  }
};

const validatePortalJson = (filePath) => {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('portal-data backup is not an object');
  }

  if (!Array.isArray(parsed.users) || !Array.isArray(parsed.forumThreads) || !Array.isArray(parsed.forumPosts)) {
    throw new Error('portal-data backup is missing expected arrays');
  }
};

const validateAuthWrapper = (filePath) => {
  if (!fs.existsSync(filePath)) {
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
  ensureDataDir();
  ensurePortalStore();

  fs.mkdirSync(destinationDir, { recursive: true });

  const portalBackup = path.join(destinationDir, `portal-data.${fileStamp}.json`);
  const authBackup = path.join(destinationDir, `auth.enc.${fileStamp}.json`);

  fs.copyFileSync(sourcePortal, portalBackup);
  validatePortalJson(portalBackup);

  if (fs.existsSync(sourceAuth)) {
    fs.copyFileSync(sourceAuth, authBackup);
    validateAuthWrapper(authBackup);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    source: {
      portal: sourcePortal,
      auth: fs.existsSync(sourceAuth) ? sourceAuth : null,
    },
    backup: {
      portal: portalBackup,
      auth: fs.existsSync(sourceAuth) ? authBackup : null,
    },
    checks: {
      portalJsonValid: true,
      authWrapperValid: fs.existsSync(sourceAuth),
    },
  };

  const manifestPath = path.join(destinationDir, `manifest.${fileStamp}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('Backup completed successfully');
  console.log(`Portal backup: ${portalBackup}`);
  if (fs.existsSync(sourceAuth)) {
    console.log(`Auth backup:   ${authBackup}`);
  } else {
    console.log('Auth backup:   skipped (auth.enc.json not found)');
  }
  console.log(`Manifest:      ${manifestPath}`);
};

try {
  run();
} catch (error) {
  console.error('Backup failed:', error.message);
  process.exit(1);
}
