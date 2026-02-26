declare module 'connect-pg-simple' {
  import session from 'express-session';
  import { Pool } from 'pg';

  interface PgStoreOptions {
    pool?: Pool;
    tableName?: string;
    createTableIfMissing?: boolean;
    ttl?: number;
    pruneSessionInterval?: number | false;
    errorLog?: (err: Error) => void;
  }

  function connectPgSimple(s: typeof session): new (options: PgStoreOptions) => session.Store;
  export = connectPgSimple;
}
