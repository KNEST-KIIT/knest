import fs from 'fs';
const p = 'src/db/seed.ts';
let c = fs.readFileSync(p, 'utf8');
if (!c.includes('seedDummy')) {
    c = c.replace("import { seedCms } from './seed-cms'", "import { seedCms } from './seed-cms'\nimport { seedDummy } from './seed-dummy'");
    c = c.replace("await seedCms()", "await seedCms()\n  await seedDummy()");
    fs.writeFileSync(p, c, 'utf8');
}
