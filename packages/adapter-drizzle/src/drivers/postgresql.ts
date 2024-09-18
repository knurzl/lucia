import { eq, lte, Table } from "drizzle-orm";

import type { Adapter, DatabaseSession, DatabaseUser, UserId } from "lucia";
import type { PgColumn, PgDatabase, PgTableWithColumns } from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";

export const dynamicSchema = <T extends Table>(table: T, schema: string): T => {
  // @ts-expect-error Symbol is @internal in drizzle-orm
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  table[Table.Symbol.Schema] = schema;
  return table;
};

export class DrizzlePostgreSQLAdapter implements Adapter {
  private db: PgDatabase<any, any, any>;
  private sessionTable: PostgreSQLSessionTable;
  private userTable: PostgreSQLUserTable;
  private defaultSchema: string;

  constructor(
    db: PgDatabase<any, any, any>,
    sessionTable: PostgreSQLSessionTable,
    userTable: PostgreSQLUserTable,
    defaultSchema: string
  ) {
    this.db = db;
    this.sessionTable = sessionTable;
    this.userTable = userTable;
    this.defaultSchema = defaultSchema;
  }

  private getSessionTable(schema?: string): PostgreSQLSessionTable {
    return schema ? dynamicSchema(this.sessionTable, schema) : this.sessionTable;
  }

  private getUserTable(schema?: string): PostgreSQLUserTable {
    return schema ? dynamicSchema(this.userTable, schema) : this.userTable;
  }

  public async deleteSession(sessionId: string, schema?: string): Promise<void> {
    const sessionTable = this.getSessionTable(schema);
    await this.db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
  }

  public async deleteUserSessions(userId: UserId, schema?: string): Promise<void> {
    const sessionTable = this.getSessionTable(schema);
    await this.db.delete(sessionTable).where(eq(sessionTable.userId, userId));
  }

  public async getSessionAndUser(
    sessionId: string,
    schema?: string
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    const sessionTable = this.getSessionTable(schema);
    const userTable = this.getUserTable(schema);

    const result = await this.db
      .select({
        user: userTable,
        session: sessionTable
      })
      .from(sessionTable)
      .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
      .where(eq(sessionTable.id, sessionId));

    if (result.length !== 1) return [null, null];
    return [
      transformIntoDatabaseSession(result[0].session),
      transformIntoDatabaseUser(result[0].user)
    ];
  }

  public async getUserSessions(userId: UserId, schema?: string): Promise<DatabaseSession[]> {
    const sessionTable = this.getSessionTable(schema);
    const result = await this.db.select().from(sessionTable).where(eq(sessionTable.userId, userId));
    return result.map((val) => transformIntoDatabaseSession(val));
  }

  public async setSession(session: DatabaseSession, schema?: string): Promise<void> {
    const sessionTable = this.getSessionTable(schema);
    await this.db.insert(sessionTable).values({
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      ...session.attributes
    });
  }

  public async updateSessionExpiration(
    sessionId: string,
    expiresAt: Date,
    schema?: string
  ): Promise<void> {
    const sessionTable = this.getSessionTable(schema);
    await this.db.update(sessionTable).set({ expiresAt }).where(eq(sessionTable.id, sessionId));
  }

  public async deleteExpiredSessions(schema?: string): Promise<void> {
    const sessionTable = this.getSessionTable(schema);
    await this.db.delete(sessionTable).where(lte(sessionTable.expiresAt, new Date()));
  }
}

export type PostgreSQLUserTable = PgTableWithColumns<{
  dialect: "pg";
  columns: {
    id: PgColumn<
      {
        name: any;
        tableName: any;
        dataType: any;
        columnType: any;
        data: UserId;
        driverParam: any;
        notNull: true;
        hasDefault: boolean;
        enumValues: any;
        baseColumn: any;
        isPrimaryKey: any;
        isAutoincrement: any;
        hasRuntimeDefault: any;
        generated: any;
      },
      object
    >;
  };
  schema: any;
  name: any;
}>;

export type PostgreSQLSessionTable = PgTableWithColumns<{
  dialect: "pg";
  columns: {
    id: PgColumn<
      {
        dataType: any;
        notNull: true;
        enumValues: any;
        tableName: any;
        columnType: any;
        data: string;
        driverParam: any;
        hasDefault: false;
        name: any;
        isPrimaryKey: any;
        isAutoincrement: any;
        hasRuntimeDefault: any;
        generated: any;
      },
      object
    >;
    expiresAt: PgColumn<
      {
        dataType: any;
        notNull: true;
        enumValues: any;
        tableName: any;
        columnType: any;
        data: Date;
        driverParam: any;
        hasDefault: false;
        name: any;
        isPrimaryKey: any;
        isAutoincrement: any;
        hasRuntimeDefault: any;
        generated: any;
      },
      object
    >;
    userId: PgColumn<
      {
        dataType: any;
        notNull: true;
        enumValues: any;
        tableName: any;
        columnType: any;
        data: UserId;
        driverParam: any;
        hasDefault: false;
        name: any;
        isPrimaryKey: any;
        isAutoincrement: any;
        hasRuntimeDefault: any;
        generated: any;
      },
      object
    >;
  };
  schema: any;
  name: any;
}>;

function transformIntoDatabaseSession(
  raw: InferSelectModel<PostgreSQLSessionTable>
): DatabaseSession {
  const { id, userId, expiresAt, ...attributes } = raw;
  return { userId, id, expiresAt, attributes };
}

function transformIntoDatabaseUser(raw: InferSelectModel<PostgreSQLUserTable>): DatabaseUser {
  const { id, ...attributes } = raw;
  return { id, attributes };
}
