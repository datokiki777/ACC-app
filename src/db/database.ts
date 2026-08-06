import Dexie, { type EntityTable } from 'dexie';

import type { MetadataRecord, ModeDataRecord, SettingRecord } from '../types/persistence';

export const ACC_REACT_DB_NAME = 'acc-react-db';
export const ACC_REACT_SCHEMA_VERSION = 1;

export class AccReactDatabase extends Dexie {
  modeData!: EntityTable<ModeDataRecord, 'mode'>;
  settings!: EntityTable<SettingRecord, 'key'>;
  metadata!: EntityTable<MetadataRecord, 'key'>;

  public constructor(name = ACC_REACT_DB_NAME) {
    super(name);
    this.version(ACC_REACT_SCHEMA_VERSION).stores({
      modeData: '&mode',
      settings: '&key',
      metadata: '&key',
    });
  }
}

export function createAccReactDatabase(name = ACC_REACT_DB_NAME): AccReactDatabase {
  return new AccReactDatabase(name);
}

export const accReactDatabase = createAccReactDatabase();
