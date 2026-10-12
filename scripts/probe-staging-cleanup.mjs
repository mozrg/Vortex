// Temporary diagnostic: times fsp.rm on the leftover update-staging folders,
// exactly like cleanupLegacyUpdateFiles() does.
import { rm, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

const stagingRoot = path.join(process.env.APPDATA, 'vortex-roblox-launcher', 'update-staging');
console.log('staging root:', stagingRoot);

const entries = await readdir(stagingRoot).catch((error) => {
  console.log('readdir failed:', error.message);
  return [];
});
console.log('entries:', entries.join(', '));

for (const entry of entries) {
  const target = path.join(stagingRoot, entry);
  const started = Date.now();
  try {
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    console.log(`rm ok    ${entry} in ${Date.now() - started} ms`);
  } catch (error) {
    console.log(`rm FAILED ${entry} after ${Date.now() - started} ms: ${error.code} ${error.message}`);
    const probe = path.join(target, 'resources', 'app.asar');
    try {
      const info = await stat(probe);
      console.log(`   app.asar size ${info.size}`);
      const unlinkStarted = Date.now();
      await unlink(probe);
      console.log(`   unlink ok in ${Date.now() - unlinkStarted} ms`);
    } catch (probeError) {
      console.log(`   unlink failed after ${Date.now() - unlinkStarted} ms: ${probeError.code} ${probeError.message}`);
    }
  }
}
