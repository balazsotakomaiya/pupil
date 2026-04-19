declare module "sql.js" {
  const initSqlJs: (config?: { locateFile?: (file: string) => string }) => Promise<{
    Database: new (
      data?: Uint8Array,
    ) => {
      close: () => void;
      exec: (sql: string) => Array<{ values?: unknown[][] }>;
    };
  }>;

  export default initSqlJs;
}
