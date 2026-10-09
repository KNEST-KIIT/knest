import * as migration_20261008_114259_baseline from './20261008_114259_baseline';
import * as migration_20261009_073957_media_s3_prefix from './20261009_073957_media_s3_prefix';
import * as migration_20261009_083013_drop_cms_lab_bookings from './20261009_083013_drop_cms_lab_bookings';

export const migrations = [
  {
    up: migration_20261008_114259_baseline.up,
    down: migration_20261008_114259_baseline.down,
    name: '20261008_114259_baseline',
  },
  {
    up: migration_20261009_073957_media_s3_prefix.up,
    down: migration_20261009_073957_media_s3_prefix.down,
    name: '20261009_073957_media_s3_prefix',
  },
  {
    up: migration_20261009_083013_drop_cms_lab_bookings.up,
    down: migration_20261009_083013_drop_cms_lab_bookings.down,
    name: '20261009_083013_drop_cms_lab_bookings'
  },
];
