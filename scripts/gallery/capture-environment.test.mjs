import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { filesUnder, fingerprintFiles, fingerprintManifest } from './capture-environment.mjs';

test('capture fingerprints ignore enumeration order and follow renderer, font and recipe bytes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gallery-capture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = ['browser', 'library', 'font', 'recipe'].map((name) => [name, join(root, name)]);
  for (const [name, path] of files) await writeFile(path, name);
  const metadata = { arch: 'x64', fontMatch: 'Arial' };
  const initial = await fingerprintFiles(files, metadata);
  const manifest = await fingerprintManifest(files, metadata);
  assert.equal(manifest.fingerprint, initial);
  assert.deepEqual(manifest.metadata, metadata);
  assert.deepEqual(manifest.files.map(([name]) => name), ['browser', 'font', 'library', 'recipe']);
  assert.ok(manifest.files.every(([, digest]) => /^[a-f0-9]{64}$/.test(digest)));
  assert.equal(await fingerprintFiles([...files].reverse(), metadata), initial);
  for (const [name, path] of files) {
    await writeFile(path, `changed ${name}`);
    assert.notEqual(await fingerprintFiles(files, metadata), initial, name);
    await writeFile(path, name);
  }
  assert.notEqual(await fingerprintFiles(files, { ...metadata, fontMatch: 'Liberation Sans' }), initial);
  await rm(files[0][1]);
  await assert.rejects(fingerprintFiles(files, metadata), { code: 'ENOENT' });
});

test('capture input discovery follows directory links without looping and refuses broken inputs', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gallery-capture-links-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'actual'));
  await writeFile(join(root, 'actual/font.conf'), 'font configuration');
  await symlink(join(root, 'actual'), join(root, 'enabled'));
  await symlink(root, join(root, 'actual/loop'));
  assert.deepEqual(await filesUnder(root), [join(root, 'actual/font.conf'), join(root, 'enabled/font.conf')]);
  await symlink(join(root, 'missing'), join(root, 'broken'));
  await assert.rejects(filesUnder(root), { code: 'ENOENT' });
});

test('enabled fontconfig links participate in capture identity even when their target remains available', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'gallery-fontconfig-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'conf.avail')); await mkdir(join(root, 'conf.d'));
  await writeFile(join(root, 'conf.avail/antialias.conf'), 'antialias=true');
  await symlink('../conf.avail/antialias.conf', join(root, 'conf.d/10-antialias.conf'));
  const fingerprint = async () => fingerprintFiles((await filesUnder(root)).map((path) => [relative(root, path), path]), {});
  const enabled = await fingerprint();
  await rename(join(root, 'conf.d/10-antialias.conf'), join(root, 'conf.d/90-antialias.conf'));
  const reordered = await fingerprint();
  assert.notEqual(reordered, enabled);
  await rm(join(root, 'conf.d/90-antialias.conf'));
  const disabled = await fingerprint();
  assert.notEqual(disabled, reordered); assert.notEqual(disabled, enabled);
});
