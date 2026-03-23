import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageRoot = resolve(__dirname, '../../..');
const envFilesByPriority = ['.env.local', '.env'];

const stripQuotes = (value: string): string => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
};

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return null;
  }

  const normalizedLine = trimmedLine.startsWith('export ')
    ? trimmedLine.slice('export '.length).trim()
    : trimmedLine;
  const separatorIndex = normalizedLine.indexOf('=');

  if (separatorIndex < 1) {
    return null;
  }

  const key = normalizedLine.slice(0, separatorIndex).trim();
  const value = normalizedLine.slice(separatorIndex + 1).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  return [key, stripQuotes(value)];
};

const loadRuntimeEnv = (): void => {
  for (const fileName of envFilesByPriority) {
    const filePath = resolve(packageRoot, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const fileContents = readFileSync(filePath, 'utf8');

    for (const line of fileContents.split(/\r?\n/u)) {
      const entry = parseEnvLine(line);

      if (!entry) {
        continue;
      }

      const [key, value] = entry;

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
};

loadRuntimeEnv();

export const getRuntimeEnv = (key: string, fallback?: string): string | undefined =>
  process.env[key] ?? fallback;

export const queuesEnabled = getRuntimeEnv('DISABLE_QUEUES') !== 'true';
