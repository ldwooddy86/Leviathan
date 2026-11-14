/* Where the link keeps what it reads from a dashboard.

   A dashboard is built for one client, so everything read out of it that names or describes that client (the brand, the
   ZIP by ZIP model, the copy of the dashboard file itself) lives outside the repository, under ~/.leviathan. The
   repository holds only the libraries a vertical shares: keywords, copy templates, platform rules. The console's build
   scans every file under the repository, ignored by git or not, and refuses it while a withheld name is anywhere in it. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(HERE, '..');

/* ~/.leviathan, or LEVIATHAN_HOME. The content strategist's CS_LOCAL and the paid ads PA_LOCAL sit beside the link's folder. */
export const HOME = path.resolve(process.env.LEVIATHAN_HOME || path.join(os.homedir(), '.leviathan'));
export const LINK = path.resolve(process.env.LEVIATHAN_DASHBOARD || path.join(HOME, 'dashboard'));
export const CS_LOCAL = path.resolve(process.env.CS_LOCAL || path.join(HOME, 'content-strategist'));
export const PA_LOCAL = path.resolve(process.env.PA_LOCAL || path.join(HOME, 'paid-ads'));

/* true when p is the repository or sits inside it */
export function inRepo(p, repo = REPO) {
  if (!fs.existsSync(path.join(repo, '.git'))) return false;
  const r = path.relative(repo, path.resolve(p));
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}

/* refuses a folder for client files that is inside the repository; returns the absolute path */
export function outside(p, what = 'This folder') {
  const abs = path.resolve(p);
  if (inRepo(abs)) throw new Error(`${what} (${abs}) is inside the repository. Client files stay outside it: the repository is scanned for withheld names, ignored by git or not.`);
  return abs;
}

/* a path as a person would type it from where they stand */
export function rel(p) { const r = path.relative(process.cwd(), p) || '.'; return r.startsWith('..') ? p : r; }

export function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file} is not valid JSON: ${e.message}`); }
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 1) + '\n');
  return file;
}
