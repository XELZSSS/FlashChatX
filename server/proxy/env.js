import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env.local');
const USER_ENV_DIR =
  process.env.FLASHCHATX_USER_DATA ||
  (process.platform === 'win32'
    ? path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'FlashChatX'
      )
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'FlashChatX')
      : path.join(
          process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
          'FlashChatX'
        ));
const USER_ENV_PATH = path.join(USER_ENV_DIR, 'flashchatx.env');

const isWritablePath = targetPath => {
  try {
    const dir = path.dirname(targetPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const resolveEnvPath = () => {
  if (process.env.FLASHCHATX_ENV_PATH) {
    return process.env.FLASHCHATX_ENV_PATH;
  }
  if (fs.existsSync(DEFAULT_ENV_PATH) && isWritablePath(DEFAULT_ENV_PATH)) {
    return DEFAULT_ENV_PATH;
  }
  if (isWritablePath(DEFAULT_ENV_PATH)) {
    return DEFAULT_ENV_PATH;
  }
  return USER_ENV_PATH;
};

export const ENV_PATH = resolveEnvPath();

// Lightweight .env loader to avoid extra dependencies
export const loadEnv = () => {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
  const map = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
    map[key] = value;
  }
  return map;
};

export const envMap = loadEnv();

export const getEnvValue = key => process.env[key] || envMap[key];

const upsertEnv = (key, value, src) => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (src.match(regex)) {
    return src.replace(regex, `${key}=${value}`);
  }
  const trimmed = src.trim();
  return `${trimmed}\n${key}=${value}\n`;
};

const readEnvFile = () => {
  if (fs.existsSync(ENV_PATH)) {
    return fs.readFileSync(ENV_PATH, 'utf-8');
  }
  return '';
};

export const persistEnvUpdates = updates => {
  let content = readEnvFile();
  let next = content;
  const updatedKeys = [];

  updates.forEach(({ key, value }) => {
    next = upsertEnv(key, value ?? '', next);
    updatedKeys.push(key);
    // Keep runtime env in sync so future requests see new values
    process.env[key] = value ?? '';
    if (envMap[key] !== undefined) {
      envMap[key] = value ?? '';
    }
  });

  fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
  fs.writeFileSync(ENV_PATH, next, 'utf-8');
  return updatedKeys;
};
