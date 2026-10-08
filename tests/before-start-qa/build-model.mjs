import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative } from 'node:path';
import { app, output, projection } from './qa-paths.mjs';
const require = createRequire(app + '/package.json'),
  esbuild = require('esbuild'),
  entry = output + '/actual-entry.ts';
writeFileSync(
  entry,
  `export {scoreDecision,freshWorkspace,applyCommand} from ${JSON.stringify(app + '/lib/academy-engine.ts')};export {validateDocument,applyWorkspaceContentCommand} from ${JSON.stringify(app + '/lib/academy-authoring.ts')};export {programs,LEGACY_CONTENT_VERSION,createCurriculumRegistry,curriculumRegistry} from ${JSON.stringify(app + '/lib/academy-curriculum.ts')};export {createTeam,applyTeamCommand,projectTeam} from ${JSON.stringify(app + '/lib/academy-teams.ts')};export {deriveBeforeStartSummary} from ${JSON.stringify(projection)};`,
);
const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: output + '/actual-model.mjs',
  metafile: true,
});
const files = Object.keys(result.metafile.inputs)
  .filter((file) => file !== relative(process.cwd(), entry))
  .map((file) => ({
    file: relative(app, file),
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  }));
writeFileSync(
  output + '/source-evidence.json',
  JSON.stringify(
    {
      at: new Date().toISOString(),
      projection,
      files,
      limits: [
        'Actual adopted root pure modules plus explicitly staged display guard. No application build, Worker, network, browser, SQL or persistent mutation.',
      ],
    },
    null,
    2,
  ),
);
console.log(`Bundled actual scoring/authoring and display guard; recorded ${files.length} source hashes.`);
