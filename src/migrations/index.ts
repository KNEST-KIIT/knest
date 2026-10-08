import * as migration_20261008_114259_baseline from './20261008_114259_baseline';

export const migrations = [
  {
    up: migration_20261008_114259_baseline.up,
    down: migration_20261008_114259_baseline.down,
    name: '20261008_114259_baseline'
  },
];
