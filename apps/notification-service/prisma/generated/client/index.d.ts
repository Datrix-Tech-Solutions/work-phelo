/**
 * Client
 **/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types; // general types
import $Public = runtime.Types.Public;
import $Utils = runtime.Types.Utils;
import $Extensions = runtime.Types.Extensions;
import $Result = runtime.Types.Result;

export type PrismaPromise<T> = $Public.PrismaPromise<T>;

/**
 * Model NotificationLog
 *
 */
export type NotificationLog =
  $Result.DefaultSelection<Prisma.$NotificationLogPayload>;

/**
 * Enums
 */
export namespace $Enums {
  export const NotificationType: {
    EMAIL_VERIFICATION: 'EMAIL_VERIFICATION';
    INVITE_USER: 'INVITE_USER';
    PASSWORD_RESET_LINK: 'PASSWORD_RESET_LINK';
    PASSWORD_RESET_OTP: 'PASSWORD_RESET_OTP';
    SMS_OTP: 'SMS_OTP';
    PUSH_GENERAL: 'PUSH_GENERAL';
  };

  export type NotificationType =
    (typeof NotificationType)[keyof typeof NotificationType];

  export const NotificationChannel: {
    EMAIL: 'EMAIL';
    SMS: 'SMS';
    PUSH: 'PUSH';
  };

  export type NotificationChannel =
    (typeof NotificationChannel)[keyof typeof NotificationChannel];

  export const NotificationStatus: {
    PENDING: 'PENDING';
    SENT: 'SENT';
    FAILED: 'FAILED';
  };

  export type NotificationStatus =
    (typeof NotificationStatus)[keyof typeof NotificationStatus];
}

export type NotificationType = $Enums.NotificationType;

export const NotificationType: typeof $Enums.NotificationType;

export type NotificationChannel = $Enums.NotificationChannel;

export const NotificationChannel: typeof $Enums.NotificationChannel;

export type NotificationStatus = $Enums.NotificationStatus;

export const NotificationStatus: typeof $Enums.NotificationStatus;

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more NotificationLogs
 * const notificationLogs = await prisma.notificationLog.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions
    ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition>
      ? Prisma.GetEvents<ClientOptions['log']>
      : never
    : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] };

  /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more NotificationLogs
   * const notificationLogs = await prisma.notificationLog.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(
    optionsArg?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>,
  );
  $on<V extends U>(
    eventType: V,
    callback: (
      event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent,
    ) => void,
  ): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void;

  /**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(
    query: string,
    ...values: any[]
  ): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>;

  $transaction<R>(
    fn: (
      prisma: Omit<PrismaClient, runtime.ITXClientDenyList>,
    ) => $Utils.JsPromise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): $Utils.JsPromise<R>;

  $extends: $Extensions.ExtendsHook<'extends', Prisma.TypeMapCb, ExtArgs>;

  /**
   * `prisma.notificationLog`: Exposes CRUD operations for the **NotificationLog** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more NotificationLogs
   * const notificationLogs = await prisma.notificationLog.findMany()
   * ```
   */
  get notificationLog(): Prisma.NotificationLogDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF;

  export type PrismaPromise<T> = $Public.PrismaPromise<T>;

  /**
   * Validator
   */
  export import validator = runtime.Public.validator;

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError;
  export import PrismaClientValidationError = runtime.PrismaClientValidationError;
  export import NotFoundError = runtime.NotFoundError;

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag;
  export import empty = runtime.empty;
  export import join = runtime.join;
  export import raw = runtime.raw;
  export import Sql = runtime.Sql;

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal;

  export type DecimalJsLike = runtime.DecimalJsLike;

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics;
  export type Metric<T> = runtime.Metric<T>;
  export type MetricHistogram = runtime.MetricHistogram;
  export type MetricHistogramBucket = runtime.MetricHistogramBucket;

  /**
   * Extensions
   */
  export import Extension = $Extensions.UserArgs;
  export import getExtensionContext = runtime.Extensions.getExtensionContext;
  export import Args = $Public.Args;
  export import Payload = $Public.Payload;
  export import Result = $Public.Result;
  export import Exact = $Public.Exact;

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string;
  };

  export const prismaVersion: PrismaVersion;

  /**
   * Utility Types
   */

  export import JsonObject = runtime.JsonObject;
  export import JsonArray = runtime.JsonArray;
  export import JsonValue = runtime.JsonValue;
  export import InputJsonObject = runtime.InputJsonObject;
  export import InputJsonArray = runtime.InputJsonArray;
  export import InputJsonValue = runtime.InputJsonValue;

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
     * Type of `Prisma.DbNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class DbNull {
      private DbNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.JsonNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class JsonNull {
      private JsonNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.AnyNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class AnyNull {
      private AnyNull: never;
      private constructor();
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull;

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull;

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull;

  type SelectAndInclude = {
    select: any;
    include: any;
  };

  type SelectAndOmit = {
    select: any;
    omit: any;
  };

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> =
    T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<
    T extends (...args: any) => $Utils.JsPromise<any>,
  > = PromiseType<ReturnType<T>>;

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
  };

  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K;
  }[keyof T];

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K;
  };

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>;

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & (T extends SelectAndInclude
    ? 'Please either choose `select` or `include`.'
    : T extends SelectAndOmit
      ? 'Please either choose `select` or `omit`.'
      : {});

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & K;

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> = T extends object
    ? U extends object
      ? (Without<T, U> & U) | (Without<U, T> & T)
      : U
    : T;

  /**
   * Is T a Record?
   */
  type IsObject<T extends any> =
    T extends Array<any>
      ? False
      : T extends Date
        ? False
        : T extends Uint8Array
          ? False
          : T extends BigInt
            ? False
            : T extends object
              ? True
              : False;

  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O>; // With K possibilities
    }[K];

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<
    __Either<O, K>
  >;

  type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
  }[strict];

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = O extends unknown ? _Either<O, K, strict> : never;

  export type Union = any;

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
  } & {};

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never;

  export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<
    Overwrite<
      U,
      {
        [K in keyof U]-?: At<U, K>;
      }
    >
  >;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O
    ? O[K]
    : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown
    ? AtStrict<O, K>
    : never;
  export type At<
    O extends object,
    K extends Key,
    strict extends Boolean = 1,
  > = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function
    ? A
    : {
        [K in keyof A]: A[K];
      } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
      ?
          | (K extends keyof O ? { [P in K]: O[P] } & O : O)
          | ({ [P in keyof O as P extends K ? K : never]-?: O[P] } & O)
      : never
  >;

  type _Strict<U, _U = U> = U extends unknown
    ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>>
    : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False;

  // /**
  // 1
  // */
  export type True = 1;

  /**
  0
  */
  export type False = 0;

  export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
  }[B];

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
      ? 1
      : 0;

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >;

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0;
      1: 1;
    };
    1: {
      0: 1;
      1: 1;
    };
  }[B1][B2];

  export type Keys<U extends Union> = U extends unknown ? keyof U : never;

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;

  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object
    ? {
        [P in keyof T]: P extends keyof O ? O[P] : never;
      }
    : never;

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>,
  > = IsObject<T> extends True ? U : T;

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<
            UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never
          >
        : never
      : {} extends FieldPaths<T[K]>
        ? never
        : K;
  }[keyof T];

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<
    T,
    K extends Enumerable<keyof T> | keyof T,
  > = Prisma__Pick<T, MaybeTupleToUnion<K>>;

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}`
    ? never
    : T;

  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;

  type FieldRefInputType<Model, FieldType> = Model extends never
    ? never
    : FieldRef<Model, FieldType>;

  export const ModelName: {
    NotificationLog: 'NotificationLog';
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName];

  export type Datasources = {
    db?: Datasource;
  };

  interface TypeMapCb extends $Utils.Fn<
    { extArgs: $Extensions.InternalArgs; clientOptions: PrismaClientOptions },
    $Utils.Record<string, any>
  > {
    returns: Prisma.TypeMap<
      this['params']['extArgs'],
      this['params']['clientOptions']
    >;
  }

  export type TypeMap<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    ClientOptions = {},
  > = {
    meta: {
      modelProps: 'notificationLog';
      txIsolationLevel: Prisma.TransactionIsolationLevel;
    };
    model: {
      NotificationLog: {
        payload: Prisma.$NotificationLogPayload<ExtArgs>;
        fields: Prisma.NotificationLogFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.NotificationLogFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.NotificationLogFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>;
          };
          findFirst: {
            args: Prisma.NotificationLogFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.NotificationLogFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>;
          };
          findMany: {
            args: Prisma.NotificationLogFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>[];
          };
          create: {
            args: Prisma.NotificationLogCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>;
          };
          createMany: {
            args: Prisma.NotificationLogCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.NotificationLogCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>[];
          };
          delete: {
            args: Prisma.NotificationLogDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>;
          };
          update: {
            args: Prisma.NotificationLogUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>;
          };
          deleteMany: {
            args: Prisma.NotificationLogDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.NotificationLogUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.NotificationLogUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$NotificationLogPayload>;
          };
          aggregate: {
            args: Prisma.NotificationLogAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateNotificationLog>;
          };
          groupBy: {
            args: Prisma.NotificationLogGroupByArgs<ExtArgs>;
            result: $Utils.Optional<NotificationLogGroupByOutputType>[];
          };
          count: {
            args: Prisma.NotificationLogCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<NotificationLogCountAggregateOutputType>
              | number;
          };
        };
      };
    };
  } & {
    other: {
      payload: any;
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
      };
    };
  };
  export const defineExtension: $Extensions.ExtendsHook<
    'define',
    Prisma.TypeMapCb,
    $Extensions.DefaultArgs
  >;
  export type DefaultPrismaClient = PrismaClient;
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal';
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources;
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string;
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat;
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     *
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[];
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    };
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error';
  export type LogDefinition = {
    level: LogLevel;
    emit: 'stdout' | 'event';
  };

  export type GetLogType<T extends LogLevel | LogDefinition> =
    T extends LogDefinition
      ? T['emit'] extends 'event'
        ? T['level']
        : never
      : never;
  export type GetEvents<T extends any> =
    T extends Array<LogLevel | LogDefinition>
      ?
          | GetLogType<T[0]>
          | GetLogType<T[1]>
          | GetLogType<T[2]>
          | GetLogType<T[3]>
      : never;

  export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
  };

  export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
  };
  /* End Types for Logging */

  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy';

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName;
    action: PrismaAction;
    args: any;
    dataPath: string[];
    runInTransaction: boolean;
  };

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>;

  // tested in getLogLevel.test.ts
  export function getLogLevel(
    log: Array<LogLevel | LogDefinition>,
  ): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<
    Prisma.DefaultPrismaClient,
    runtime.ITXClientDenyList
  >;

  export type Datasource = {
    url?: string;
  };

  /**
   * Count Types
   */

  /**
   * Models
   */

  /**
   * Model NotificationLog
   */

  export type AggregateNotificationLog = {
    _count: NotificationLogCountAggregateOutputType | null;
    _min: NotificationLogMinAggregateOutputType | null;
    _max: NotificationLogMaxAggregateOutputType | null;
  };

  export type NotificationLogMinAggregateOutputType = {
    id: string | null;
    tenantId: string | null;
    userId: string | null;
    type: $Enums.NotificationType | null;
    channel: $Enums.NotificationChannel | null;
    recipient: string | null;
    subject: string | null;
    status: $Enums.NotificationStatus | null;
    error: string | null;
    sentAt: Date | null;
    createdAt: Date | null;
  };

  export type NotificationLogMaxAggregateOutputType = {
    id: string | null;
    tenantId: string | null;
    userId: string | null;
    type: $Enums.NotificationType | null;
    channel: $Enums.NotificationChannel | null;
    recipient: string | null;
    subject: string | null;
    status: $Enums.NotificationStatus | null;
    error: string | null;
    sentAt: Date | null;
    createdAt: Date | null;
  };

  export type NotificationLogCountAggregateOutputType = {
    id: number;
    tenantId: number;
    userId: number;
    type: number;
    channel: number;
    recipient: number;
    subject: number;
    status: number;
    error: number;
    metadata: number;
    sentAt: number;
    createdAt: number;
    _all: number;
  };

  export type NotificationLogMinAggregateInputType = {
    id?: true;
    tenantId?: true;
    userId?: true;
    type?: true;
    channel?: true;
    recipient?: true;
    subject?: true;
    status?: true;
    error?: true;
    sentAt?: true;
    createdAt?: true;
  };

  export type NotificationLogMaxAggregateInputType = {
    id?: true;
    tenantId?: true;
    userId?: true;
    type?: true;
    channel?: true;
    recipient?: true;
    subject?: true;
    status?: true;
    error?: true;
    sentAt?: true;
    createdAt?: true;
  };

  export type NotificationLogCountAggregateInputType = {
    id?: true;
    tenantId?: true;
    userId?: true;
    type?: true;
    channel?: true;
    recipient?: true;
    subject?: true;
    status?: true;
    error?: true;
    metadata?: true;
    sentAt?: true;
    createdAt?: true;
    _all?: true;
  };

  export type NotificationLogAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which NotificationLog to aggregate.
     */
    where?: NotificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of NotificationLogs to fetch.
     */
    orderBy?:
      | NotificationLogOrderByWithRelationInput
      | NotificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: NotificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` NotificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` NotificationLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned NotificationLogs
     **/
    _count?: true | NotificationLogCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: NotificationLogMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: NotificationLogMaxAggregateInputType;
  };

  export type GetNotificationLogAggregateType<
    T extends NotificationLogAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateNotificationLog]: P extends
      | '_count'
      | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateNotificationLog[P]>
      : GetScalarType<T[P], AggregateNotificationLog[P]>;
  };

  export type NotificationLogGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: NotificationLogWhereInput;
    orderBy?:
      | NotificationLogOrderByWithAggregationInput
      | NotificationLogOrderByWithAggregationInput[];
    by: NotificationLogScalarFieldEnum[] | NotificationLogScalarFieldEnum;
    having?: NotificationLogScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: NotificationLogCountAggregateInputType | true;
    _min?: NotificationLogMinAggregateInputType;
    _max?: NotificationLogMaxAggregateInputType;
  };

  export type NotificationLogGroupByOutputType = {
    id: string;
    tenantId: string | null;
    userId: string | null;
    type: $Enums.NotificationType;
    channel: $Enums.NotificationChannel;
    recipient: string;
    subject: string | null;
    status: $Enums.NotificationStatus;
    error: string | null;
    metadata: JsonValue | null;
    sentAt: Date | null;
    createdAt: Date;
    _count: NotificationLogCountAggregateOutputType | null;
    _min: NotificationLogMinAggregateOutputType | null;
    _max: NotificationLogMaxAggregateOutputType | null;
  };

  type GetNotificationLogGroupByPayload<T extends NotificationLogGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<NotificationLogGroupByOutputType, T['by']> & {
          [P in keyof T &
            keyof NotificationLogGroupByOutputType]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], NotificationLogGroupByOutputType[P]>
            : GetScalarType<T[P], NotificationLogGroupByOutputType[P]>;
        }
      >
    >;

  export type NotificationLogSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      tenantId?: boolean;
      userId?: boolean;
      type?: boolean;
      channel?: boolean;
      recipient?: boolean;
      subject?: boolean;
      status?: boolean;
      error?: boolean;
      metadata?: boolean;
      sentAt?: boolean;
      createdAt?: boolean;
    },
    ExtArgs['result']['notificationLog']
  >;

  export type NotificationLogSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      tenantId?: boolean;
      userId?: boolean;
      type?: boolean;
      channel?: boolean;
      recipient?: boolean;
      subject?: boolean;
      status?: boolean;
      error?: boolean;
      metadata?: boolean;
      sentAt?: boolean;
      createdAt?: boolean;
    },
    ExtArgs['result']['notificationLog']
  >;

  export type NotificationLogSelectScalar = {
    id?: boolean;
    tenantId?: boolean;
    userId?: boolean;
    type?: boolean;
    channel?: boolean;
    recipient?: boolean;
    subject?: boolean;
    status?: boolean;
    error?: boolean;
    metadata?: boolean;
    sentAt?: boolean;
    createdAt?: boolean;
  };

  export type $NotificationLogPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'NotificationLog';
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        tenantId: string | null;
        userId: string | null;
        type: $Enums.NotificationType;
        channel: $Enums.NotificationChannel;
        recipient: string;
        subject: string | null;
        status: $Enums.NotificationStatus;
        error: string | null;
        metadata: Prisma.JsonValue | null;
        sentAt: Date | null;
        createdAt: Date;
      },
      ExtArgs['result']['notificationLog']
    >;
    composites: {};
  };

  type NotificationLogGetPayload<
    S extends boolean | null | undefined | NotificationLogDefaultArgs,
  > = $Result.GetResult<Prisma.$NotificationLogPayload, S>;

  type NotificationLogCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<NotificationLogFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: NotificationLogCountAggregateInputType | true;
  };

  export interface NotificationLogDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['NotificationLog'];
      meta: { name: 'NotificationLog' };
    };
    /**
     * Find zero or one NotificationLog that matches the filter.
     * @param {NotificationLogFindUniqueArgs} args - Arguments to find a NotificationLog
     * @example
     * // Get one NotificationLog
     * const notificationLog = await prisma.notificationLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends NotificationLogFindUniqueArgs>(
      args: SelectSubset<T, NotificationLogFindUniqueArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<
        Prisma.$NotificationLogPayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one NotificationLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {NotificationLogFindUniqueOrThrowArgs} args - Arguments to find a NotificationLog
     * @example
     * // Get one NotificationLog
     * const notificationLog = await prisma.notificationLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends NotificationLogFindUniqueOrThrowArgs>(
      args: SelectSubset<T, NotificationLogFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<
        Prisma.$NotificationLogPayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first NotificationLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationLogFindFirstArgs} args - Arguments to find a NotificationLog
     * @example
     * // Get one NotificationLog
     * const notificationLog = await prisma.notificationLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends NotificationLogFindFirstArgs>(
      args?: SelectSubset<T, NotificationLogFindFirstArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<
        Prisma.$NotificationLogPayload<ExtArgs>,
        T,
        'findFirst'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first NotificationLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationLogFindFirstOrThrowArgs} args - Arguments to find a NotificationLog
     * @example
     * // Get one NotificationLog
     * const notificationLog = await prisma.notificationLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends NotificationLogFindFirstOrThrowArgs>(
      args?: SelectSubset<T, NotificationLogFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<
        Prisma.$NotificationLogPayload<ExtArgs>,
        T,
        'findFirstOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more NotificationLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all NotificationLogs
     * const notificationLogs = await prisma.notificationLog.findMany()
     *
     * // Get first 10 NotificationLogs
     * const notificationLogs = await prisma.notificationLog.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const notificationLogWithIdOnly = await prisma.notificationLog.findMany({ select: { id: true } })
     *
     */
    findMany<T extends NotificationLogFindManyArgs>(
      args?: SelectSubset<T, NotificationLogFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$NotificationLogPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a NotificationLog.
     * @param {NotificationLogCreateArgs} args - Arguments to create a NotificationLog.
     * @example
     * // Create one NotificationLog
     * const NotificationLog = await prisma.notificationLog.create({
     *   data: {
     *     // ... data to create a NotificationLog
     *   }
     * })
     *
     */
    create<T extends NotificationLogCreateArgs>(
      args: SelectSubset<T, NotificationLogCreateArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<Prisma.$NotificationLogPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many NotificationLogs.
     * @param {NotificationLogCreateManyArgs} args - Arguments to create many NotificationLogs.
     * @example
     * // Create many NotificationLogs
     * const notificationLog = await prisma.notificationLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends NotificationLogCreateManyArgs>(
      args?: SelectSubset<T, NotificationLogCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many NotificationLogs and returns the data saved in the database.
     * @param {NotificationLogCreateManyAndReturnArgs} args - Arguments to create many NotificationLogs.
     * @example
     * // Create many NotificationLogs
     * const notificationLog = await prisma.notificationLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many NotificationLogs and only return the `id`
     * const notificationLogWithIdOnly = await prisma.notificationLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends NotificationLogCreateManyAndReturnArgs>(
      args?: SelectSubset<T, NotificationLogCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$NotificationLogPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a NotificationLog.
     * @param {NotificationLogDeleteArgs} args - Arguments to delete one NotificationLog.
     * @example
     * // Delete one NotificationLog
     * const NotificationLog = await prisma.notificationLog.delete({
     *   where: {
     *     // ... filter to delete one NotificationLog
     *   }
     * })
     *
     */
    delete<T extends NotificationLogDeleteArgs>(
      args: SelectSubset<T, NotificationLogDeleteArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<Prisma.$NotificationLogPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one NotificationLog.
     * @param {NotificationLogUpdateArgs} args - Arguments to update one NotificationLog.
     * @example
     * // Update one NotificationLog
     * const notificationLog = await prisma.notificationLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends NotificationLogUpdateArgs>(
      args: SelectSubset<T, NotificationLogUpdateArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<Prisma.$NotificationLogPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more NotificationLogs.
     * @param {NotificationLogDeleteManyArgs} args - Arguments to filter NotificationLogs to delete.
     * @example
     * // Delete a few NotificationLogs
     * const { count } = await prisma.notificationLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends NotificationLogDeleteManyArgs>(
      args?: SelectSubset<T, NotificationLogDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more NotificationLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many NotificationLogs
     * const notificationLog = await prisma.notificationLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends NotificationLogUpdateManyArgs>(
      args: SelectSubset<T, NotificationLogUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one NotificationLog.
     * @param {NotificationLogUpsertArgs} args - Arguments to update or create a NotificationLog.
     * @example
     * // Update or create a NotificationLog
     * const notificationLog = await prisma.notificationLog.upsert({
     *   create: {
     *     // ... data to create a NotificationLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the NotificationLog we want to update
     *   }
     * })
     */
    upsert<T extends NotificationLogUpsertArgs>(
      args: SelectSubset<T, NotificationLogUpsertArgs<ExtArgs>>,
    ): Prisma__NotificationLogClient<
      $Result.GetResult<Prisma.$NotificationLogPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of NotificationLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationLogCountArgs} args - Arguments to filter NotificationLogs to count.
     * @example
     * // Count the number of NotificationLogs
     * const count = await prisma.notificationLog.count({
     *   where: {
     *     // ... the filter for the NotificationLogs we want to count
     *   }
     * })
     **/
    count<T extends NotificationLogCountArgs>(
      args?: Subset<T, NotificationLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], NotificationLogCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a NotificationLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends NotificationLogAggregateArgs>(
      args: Subset<T, NotificationLogAggregateArgs>,
    ): Prisma.PrismaPromise<GetNotificationLogAggregateType<T>>;

    /**
     * Group by NotificationLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {NotificationLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends NotificationLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: NotificationLogGroupByArgs['orderBy'] }
        : { orderBy?: NotificationLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<
        Keys<MaybeTupleToUnion<T['orderBy']>>
      >,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [
                      Error,
                      'Field ',
                      P,
                      ` in "having" needs to be provided in "by"`,
                    ];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields
                        ? never
                        : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields
                      ? never
                      : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, NotificationLogGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetNotificationLogGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the NotificationLog model
     */
    readonly fields: NotificationLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for NotificationLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__NotificationLogClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?:
        | ((value: T) => TResult1 | PromiseLike<TResult1>)
        | undefined
        | null,
      onrejected?:
        | ((reason: any) => TResult2 | PromiseLike<TResult2>)
        | undefined
        | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(
      onrejected?:
        | ((reason: any) => TResult | PromiseLike<TResult>)
        | undefined
        | null,
    ): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the NotificationLog model
   */
  interface NotificationLogFieldRefs {
    readonly id: FieldRef<'NotificationLog', 'String'>;
    readonly tenantId: FieldRef<'NotificationLog', 'String'>;
    readonly userId: FieldRef<'NotificationLog', 'String'>;
    readonly type: FieldRef<'NotificationLog', 'NotificationType'>;
    readonly channel: FieldRef<'NotificationLog', 'NotificationChannel'>;
    readonly recipient: FieldRef<'NotificationLog', 'String'>;
    readonly subject: FieldRef<'NotificationLog', 'String'>;
    readonly status: FieldRef<'NotificationLog', 'NotificationStatus'>;
    readonly error: FieldRef<'NotificationLog', 'String'>;
    readonly metadata: FieldRef<'NotificationLog', 'Json'>;
    readonly sentAt: FieldRef<'NotificationLog', 'DateTime'>;
    readonly createdAt: FieldRef<'NotificationLog', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * NotificationLog findUnique
   */
  export type NotificationLogFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * Filter, which NotificationLog to fetch.
     */
    where: NotificationLogWhereUniqueInput;
  };

  /**
   * NotificationLog findUniqueOrThrow
   */
  export type NotificationLogFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * Filter, which NotificationLog to fetch.
     */
    where: NotificationLogWhereUniqueInput;
  };

  /**
   * NotificationLog findFirst
   */
  export type NotificationLogFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * Filter, which NotificationLog to fetch.
     */
    where?: NotificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of NotificationLogs to fetch.
     */
    orderBy?:
      | NotificationLogOrderByWithRelationInput
      | NotificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for NotificationLogs.
     */
    cursor?: NotificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` NotificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` NotificationLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of NotificationLogs.
     */
    distinct?:
      | NotificationLogScalarFieldEnum
      | NotificationLogScalarFieldEnum[];
  };

  /**
   * NotificationLog findFirstOrThrow
   */
  export type NotificationLogFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * Filter, which NotificationLog to fetch.
     */
    where?: NotificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of NotificationLogs to fetch.
     */
    orderBy?:
      | NotificationLogOrderByWithRelationInput
      | NotificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for NotificationLogs.
     */
    cursor?: NotificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` NotificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` NotificationLogs.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of NotificationLogs.
     */
    distinct?:
      | NotificationLogScalarFieldEnum
      | NotificationLogScalarFieldEnum[];
  };

  /**
   * NotificationLog findMany
   */
  export type NotificationLogFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * Filter, which NotificationLogs to fetch.
     */
    where?: NotificationLogWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of NotificationLogs to fetch.
     */
    orderBy?:
      | NotificationLogOrderByWithRelationInput
      | NotificationLogOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing NotificationLogs.
     */
    cursor?: NotificationLogWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` NotificationLogs from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` NotificationLogs.
     */
    skip?: number;
    distinct?:
      | NotificationLogScalarFieldEnum
      | NotificationLogScalarFieldEnum[];
  };

  /**
   * NotificationLog create
   */
  export type NotificationLogCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * The data needed to create a NotificationLog.
     */
    data: XOR<NotificationLogCreateInput, NotificationLogUncheckedCreateInput>;
  };

  /**
   * NotificationLog createMany
   */
  export type NotificationLogCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many NotificationLogs.
     */
    data: NotificationLogCreateManyInput | NotificationLogCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * NotificationLog createManyAndReturn
   */
  export type NotificationLogCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many NotificationLogs.
     */
    data: NotificationLogCreateManyInput | NotificationLogCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * NotificationLog update
   */
  export type NotificationLogUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * The data needed to update a NotificationLog.
     */
    data: XOR<NotificationLogUpdateInput, NotificationLogUncheckedUpdateInput>;
    /**
     * Choose, which NotificationLog to update.
     */
    where: NotificationLogWhereUniqueInput;
  };

  /**
   * NotificationLog updateMany
   */
  export type NotificationLogUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update NotificationLogs.
     */
    data: XOR<
      NotificationLogUpdateManyMutationInput,
      NotificationLogUncheckedUpdateManyInput
    >;
    /**
     * Filter which NotificationLogs to update
     */
    where?: NotificationLogWhereInput;
  };

  /**
   * NotificationLog upsert
   */
  export type NotificationLogUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * The filter to search for the NotificationLog to update in case it exists.
     */
    where: NotificationLogWhereUniqueInput;
    /**
     * In case the NotificationLog found by the `where` argument doesn't exist, create a new NotificationLog with this data.
     */
    create: XOR<
      NotificationLogCreateInput,
      NotificationLogUncheckedCreateInput
    >;
    /**
     * In case the NotificationLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<
      NotificationLogUpdateInput,
      NotificationLogUncheckedUpdateInput
    >;
  };

  /**
   * NotificationLog delete
   */
  export type NotificationLogDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
    /**
     * Filter which NotificationLog to delete.
     */
    where: NotificationLogWhereUniqueInput;
  };

  /**
   * NotificationLog deleteMany
   */
  export type NotificationLogDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which NotificationLogs to delete
     */
    where?: NotificationLogWhereInput;
  };

  /**
   * NotificationLog without action
   */
  export type NotificationLogDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the NotificationLog
     */
    select?: NotificationLogSelect<ExtArgs> | null;
  };

  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted';
    ReadCommitted: 'ReadCommitted';
    RepeatableRead: 'RepeatableRead';
    Serializable: 'Serializable';
  };

  export type TransactionIsolationLevel =
    (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];

  export const NotificationLogScalarFieldEnum: {
    id: 'id';
    tenantId: 'tenantId';
    userId: 'userId';
    type: 'type';
    channel: 'channel';
    recipient: 'recipient';
    subject: 'subject';
    status: 'status';
    error: 'error';
    metadata: 'metadata';
    sentAt: 'sentAt';
    createdAt: 'createdAt';
  };

  export type NotificationLogScalarFieldEnum =
    (typeof NotificationLogScalarFieldEnum)[keyof typeof NotificationLogScalarFieldEnum];

  export const SortOrder: {
    asc: 'asc';
    desc: 'desc';
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull;
    JsonNull: typeof JsonNull;
  };

  export type NullableJsonNullValueInput =
    (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput];

  export const QueryMode: {
    default: 'default';
    insensitive: 'insensitive';
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];

  export const JsonNullValueFilter: {
    DbNull: typeof DbNull;
    JsonNull: typeof JsonNull;
    AnyNull: typeof AnyNull;
  };

  export type JsonNullValueFilter =
    (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];

  export const NullsOrder: {
    first: 'first';
    last: 'last';
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];

  /**
   * Field references
   */

  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'String'
  >;

  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'String[]'
  >;

  /**
   * Reference to a field of type 'NotificationType'
   */
  export type EnumNotificationTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'NotificationType'>;

  /**
   * Reference to a field of type 'NotificationType[]'
   */
  export type ListEnumNotificationTypeFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'NotificationType[]'>;

  /**
   * Reference to a field of type 'NotificationChannel'
   */
  export type EnumNotificationChannelFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'NotificationChannel'>;

  /**
   * Reference to a field of type 'NotificationChannel[]'
   */
  export type ListEnumNotificationChannelFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'NotificationChannel[]'>;

  /**
   * Reference to a field of type 'NotificationStatus'
   */
  export type EnumNotificationStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'NotificationStatus'>;

  /**
   * Reference to a field of type 'NotificationStatus[]'
   */
  export type ListEnumNotificationStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'NotificationStatus[]'>;

  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Json'
  >;

  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'DateTime'
  >;

  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'DateTime[]'
  >;

  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Int'
  >;

  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Int[]'
  >;

  /**
   * Deep Input Types
   */

  export type NotificationLogWhereInput = {
    AND?: NotificationLogWhereInput | NotificationLogWhereInput[];
    OR?: NotificationLogWhereInput[];
    NOT?: NotificationLogWhereInput | NotificationLogWhereInput[];
    id?: StringFilter<'NotificationLog'> | string;
    tenantId?: StringNullableFilter<'NotificationLog'> | string | null;
    userId?: StringNullableFilter<'NotificationLog'> | string | null;
    type?:
      | EnumNotificationTypeFilter<'NotificationLog'>
      | $Enums.NotificationType;
    channel?:
      | EnumNotificationChannelFilter<'NotificationLog'>
      | $Enums.NotificationChannel;
    recipient?: StringFilter<'NotificationLog'> | string;
    subject?: StringNullableFilter<'NotificationLog'> | string | null;
    status?:
      | EnumNotificationStatusFilter<'NotificationLog'>
      | $Enums.NotificationStatus;
    error?: StringNullableFilter<'NotificationLog'> | string | null;
    metadata?: JsonNullableFilter<'NotificationLog'>;
    sentAt?: DateTimeNullableFilter<'NotificationLog'> | Date | string | null;
    createdAt?: DateTimeFilter<'NotificationLog'> | Date | string;
  };

  export type NotificationLogOrderByWithRelationInput = {
    id?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    userId?: SortOrderInput | SortOrder;
    type?: SortOrder;
    channel?: SortOrder;
    recipient?: SortOrder;
    subject?: SortOrderInput | SortOrder;
    status?: SortOrder;
    error?: SortOrderInput | SortOrder;
    metadata?: SortOrderInput | SortOrder;
    sentAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
  };

  export type NotificationLogWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: NotificationLogWhereInput | NotificationLogWhereInput[];
      OR?: NotificationLogWhereInput[];
      NOT?: NotificationLogWhereInput | NotificationLogWhereInput[];
      tenantId?: StringNullableFilter<'NotificationLog'> | string | null;
      userId?: StringNullableFilter<'NotificationLog'> | string | null;
      type?:
        | EnumNotificationTypeFilter<'NotificationLog'>
        | $Enums.NotificationType;
      channel?:
        | EnumNotificationChannelFilter<'NotificationLog'>
        | $Enums.NotificationChannel;
      recipient?: StringFilter<'NotificationLog'> | string;
      subject?: StringNullableFilter<'NotificationLog'> | string | null;
      status?:
        | EnumNotificationStatusFilter<'NotificationLog'>
        | $Enums.NotificationStatus;
      error?: StringNullableFilter<'NotificationLog'> | string | null;
      metadata?: JsonNullableFilter<'NotificationLog'>;
      sentAt?: DateTimeNullableFilter<'NotificationLog'> | Date | string | null;
      createdAt?: DateTimeFilter<'NotificationLog'> | Date | string;
    },
    'id'
  >;

  export type NotificationLogOrderByWithAggregationInput = {
    id?: SortOrder;
    tenantId?: SortOrderInput | SortOrder;
    userId?: SortOrderInput | SortOrder;
    type?: SortOrder;
    channel?: SortOrder;
    recipient?: SortOrder;
    subject?: SortOrderInput | SortOrder;
    status?: SortOrder;
    error?: SortOrderInput | SortOrder;
    metadata?: SortOrderInput | SortOrder;
    sentAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    _count?: NotificationLogCountOrderByAggregateInput;
    _max?: NotificationLogMaxOrderByAggregateInput;
    _min?: NotificationLogMinOrderByAggregateInput;
  };

  export type NotificationLogScalarWhereWithAggregatesInput = {
    AND?:
      | NotificationLogScalarWhereWithAggregatesInput
      | NotificationLogScalarWhereWithAggregatesInput[];
    OR?: NotificationLogScalarWhereWithAggregatesInput[];
    NOT?:
      | NotificationLogScalarWhereWithAggregatesInput
      | NotificationLogScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'NotificationLog'> | string;
    tenantId?:
      | StringNullableWithAggregatesFilter<'NotificationLog'>
      | string
      | null;
    userId?:
      | StringNullableWithAggregatesFilter<'NotificationLog'>
      | string
      | null;
    type?:
      | EnumNotificationTypeWithAggregatesFilter<'NotificationLog'>
      | $Enums.NotificationType;
    channel?:
      | EnumNotificationChannelWithAggregatesFilter<'NotificationLog'>
      | $Enums.NotificationChannel;
    recipient?: StringWithAggregatesFilter<'NotificationLog'> | string;
    subject?:
      | StringNullableWithAggregatesFilter<'NotificationLog'>
      | string
      | null;
    status?:
      | EnumNotificationStatusWithAggregatesFilter<'NotificationLog'>
      | $Enums.NotificationStatus;
    error?:
      | StringNullableWithAggregatesFilter<'NotificationLog'>
      | string
      | null;
    metadata?: JsonNullableWithAggregatesFilter<'NotificationLog'>;
    sentAt?:
      | DateTimeNullableWithAggregatesFilter<'NotificationLog'>
      | Date
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<'NotificationLog'> | Date | string;
  };

  export type NotificationLogCreateInput = {
    id?: string;
    tenantId?: string | null;
    userId?: string | null;
    type: $Enums.NotificationType;
    channel: $Enums.NotificationChannel;
    recipient: string;
    subject?: string | null;
    status?: $Enums.NotificationStatus;
    error?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    sentAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type NotificationLogUncheckedCreateInput = {
    id?: string;
    tenantId?: string | null;
    userId?: string | null;
    type: $Enums.NotificationType;
    channel: $Enums.NotificationChannel;
    recipient: string;
    subject?: string | null;
    status?: $Enums.NotificationStatus;
    error?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    sentAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type NotificationLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    userId?: NullableStringFieldUpdateOperationsInput | string | null;
    type?:
      | EnumNotificationTypeFieldUpdateOperationsInput
      | $Enums.NotificationType;
    channel?:
      | EnumNotificationChannelFieldUpdateOperationsInput
      | $Enums.NotificationChannel;
    recipient?: StringFieldUpdateOperationsInput | string;
    subject?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumNotificationStatusFieldUpdateOperationsInput
      | $Enums.NotificationStatus;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type NotificationLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    userId?: NullableStringFieldUpdateOperationsInput | string | null;
    type?:
      | EnumNotificationTypeFieldUpdateOperationsInput
      | $Enums.NotificationType;
    channel?:
      | EnumNotificationChannelFieldUpdateOperationsInput
      | $Enums.NotificationChannel;
    recipient?: StringFieldUpdateOperationsInput | string;
    subject?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumNotificationStatusFieldUpdateOperationsInput
      | $Enums.NotificationStatus;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type NotificationLogCreateManyInput = {
    id?: string;
    tenantId?: string | null;
    userId?: string | null;
    type: $Enums.NotificationType;
    channel: $Enums.NotificationChannel;
    recipient: string;
    subject?: string | null;
    status?: $Enums.NotificationStatus;
    error?: string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    sentAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type NotificationLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    userId?: NullableStringFieldUpdateOperationsInput | string | null;
    type?:
      | EnumNotificationTypeFieldUpdateOperationsInput
      | $Enums.NotificationType;
    channel?:
      | EnumNotificationChannelFieldUpdateOperationsInput
      | $Enums.NotificationChannel;
    recipient?: StringFieldUpdateOperationsInput | string;
    subject?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumNotificationStatusFieldUpdateOperationsInput
      | $Enums.NotificationStatus;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type NotificationLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: NullableStringFieldUpdateOperationsInput | string | null;
    userId?: NullableStringFieldUpdateOperationsInput | string | null;
    type?:
      | EnumNotificationTypeFieldUpdateOperationsInput
      | $Enums.NotificationType;
    channel?:
      | EnumNotificationChannelFieldUpdateOperationsInput
      | $Enums.NotificationChannel;
    recipient?: StringFieldUpdateOperationsInput | string;
    subject?: NullableStringFieldUpdateOperationsInput | string | null;
    status?:
      | EnumNotificationStatusFieldUpdateOperationsInput
      | $Enums.NotificationStatus;
    error?: NullableStringFieldUpdateOperationsInput | string | null;
    metadata?: NullableJsonNullValueInput | InputJsonValue;
    sentAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type EnumNotificationTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.NotificationType
      | EnumNotificationTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationTypeFilter<$PrismaModel>
      | $Enums.NotificationType;
  };

  export type EnumNotificationChannelFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.NotificationChannel
      | EnumNotificationChannelFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationChannelFilter<$PrismaModel>
      | $Enums.NotificationChannel;
  };

  export type EnumNotificationStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.NotificationStatus
      | EnumNotificationStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationStatus[]
      | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationStatus[]
      | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationStatusFilter<$PrismaModel>
      | $Enums.NotificationStatus;
  };
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonNullableFilterBase<$PrismaModel>>,
          Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>
        >,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>
      >;

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type SortOrderInput = {
    sort: SortOrder;
    nulls?: NullsOrder;
  };

  export type NotificationLogCountOrderByAggregateInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    channel?: SortOrder;
    recipient?: SortOrder;
    subject?: SortOrder;
    status?: SortOrder;
    error?: SortOrder;
    metadata?: SortOrder;
    sentAt?: SortOrder;
    createdAt?: SortOrder;
  };

  export type NotificationLogMaxOrderByAggregateInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    channel?: SortOrder;
    recipient?: SortOrder;
    subject?: SortOrder;
    status?: SortOrder;
    error?: SortOrder;
    sentAt?: SortOrder;
    createdAt?: SortOrder;
  };

  export type NotificationLogMinOrderByAggregateInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    channel?: SortOrder;
    recipient?: SortOrder;
    subject?: SortOrder;
    status?: SortOrder;
    error?: SortOrder;
    sentAt?: SortOrder;
    createdAt?: SortOrder;
  };

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    mode?: QueryMode;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type EnumNotificationTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.NotificationType
      | EnumNotificationTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.NotificationType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumNotificationTypeFilter<$PrismaModel>;
    _max?: NestedEnumNotificationTypeFilter<$PrismaModel>;
  };

  export type EnumNotificationChannelWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.NotificationChannel
      | EnumNotificationChannelFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationChannelWithAggregatesFilter<$PrismaModel>
      | $Enums.NotificationChannel;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumNotificationChannelFilter<$PrismaModel>;
    _max?: NestedEnumNotificationChannelFilter<$PrismaModel>;
  };

  export type EnumNotificationStatusWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?:
        | $Enums.NotificationStatus
        | EnumNotificationStatusFieldRefInput<$PrismaModel>;
      in?:
        | $Enums.NotificationStatus[]
        | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
      notIn?:
        | $Enums.NotificationStatus[]
        | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
      not?:
        | NestedEnumNotificationStatusWithAggregatesFilter<$PrismaModel>
        | $Enums.NotificationStatus;
      _count?: NestedIntFilter<$PrismaModel>;
      _min?: NestedEnumNotificationStatusFilter<$PrismaModel>;
      _max?: NestedEnumNotificationStatusFilter<$PrismaModel>;
    };
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
            'path'
          >
        >,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<
          Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>,
          'path'
        >
      >;

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedJsonNullableFilter<$PrismaModel>;
    _max?: NestedJsonNullableFilter<$PrismaModel>;
  };

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?:
      | NestedDateTimeNullableWithAggregatesFilter<$PrismaModel>
      | Date
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedDateTimeNullableFilter<$PrismaModel>;
    _max?: NestedDateTimeNullableFilter<$PrismaModel>;
  };

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type StringFieldUpdateOperationsInput = {
    set?: string;
  };

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
  };

  export type EnumNotificationTypeFieldUpdateOperationsInput = {
    set?: $Enums.NotificationType;
  };

  export type EnumNotificationChannelFieldUpdateOperationsInput = {
    set?: $Enums.NotificationChannel;
  };

  export type EnumNotificationStatusFieldUpdateOperationsInput = {
    set?: $Enums.NotificationStatus;
  };

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
  };

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
  };

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type NestedEnumNotificationTypeFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.NotificationType
      | EnumNotificationTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationTypeFilter<$PrismaModel>
      | $Enums.NotificationType;
  };

  export type NestedEnumNotificationChannelFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.NotificationChannel
      | EnumNotificationChannelFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationChannelFilter<$PrismaModel>
      | $Enums.NotificationChannel;
  };

  export type NestedEnumNotificationStatusFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.NotificationStatus
      | EnumNotificationStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationStatus[]
      | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationStatus[]
      | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationStatusFilter<$PrismaModel>
      | $Enums.NotificationStatus;
  };

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[] | ListStringFieldRefInput<$PrismaModel>;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[] | ListIntFieldRefInput<$PrismaModel>;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?:
      | NestedStringNullableWithAggregatesFilter<$PrismaModel>
      | string
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  export type NestedEnumNotificationTypeWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.NotificationType
      | EnumNotificationTypeFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationType[]
      | ListEnumNotificationTypeFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationTypeWithAggregatesFilter<$PrismaModel>
      | $Enums.NotificationType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumNotificationTypeFilter<$PrismaModel>;
    _max?: NestedEnumNotificationTypeFilter<$PrismaModel>;
  };

  export type NestedEnumNotificationChannelWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.NotificationChannel
      | EnumNotificationChannelFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationChannel[]
      | ListEnumNotificationChannelFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationChannelWithAggregatesFilter<$PrismaModel>
      | $Enums.NotificationChannel;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumNotificationChannelFilter<$PrismaModel>;
    _max?: NestedEnumNotificationChannelFilter<$PrismaModel>;
  };

  export type NestedEnumNotificationStatusWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.NotificationStatus
      | EnumNotificationStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.NotificationStatus[]
      | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.NotificationStatus[]
      | ListEnumNotificationStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumNotificationStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.NotificationStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumNotificationStatusFilter<$PrismaModel>;
    _max?: NestedEnumNotificationStatusFilter<$PrismaModel>;
  };
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<
          Required<NestedJsonNullableFilterBase<$PrismaModel>>,
          Exclude<
            keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>,
            'path'
          >
        >,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<
        Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>
      >;

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
    path?: string[];
    string_contains?: string | StringFieldRefInput<$PrismaModel>;
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>;
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>;
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null;
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>;
    not?:
      | InputJsonValue
      | JsonFieldRefInput<$PrismaModel>
      | JsonNullValueFilter;
  };

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
      in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null;
      notIn?:
        | Date[]
        | string[]
        | ListDateTimeFieldRefInput<$PrismaModel>
        | null;
      lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
      not?:
        | NestedDateTimeNullableWithAggregatesFilter<$PrismaModel>
        | Date
        | string
        | null;
      _count?: NestedIntNullableFilter<$PrismaModel>;
      _min?: NestedDateTimeNullableFilter<$PrismaModel>;
      _max?: NestedDateTimeNullableFilter<$PrismaModel>;
    };

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  /**
   * Aliases for legacy arg types
   */
  /**
   * @deprecated Use NotificationLogDefaultArgs instead
   */
  export type NotificationLogArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = NotificationLogDefaultArgs<ExtArgs>;

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number;
  };

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF;
}
