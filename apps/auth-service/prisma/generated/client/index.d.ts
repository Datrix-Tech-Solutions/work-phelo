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
 * Model Tenant
 *
 */
export type Tenant = $Result.DefaultSelection<Prisma.$TenantPayload>;
/**
 * Model User
 *
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>;
/**
 * Model RefreshToken
 *
 */
export type RefreshToken =
  $Result.DefaultSelection<Prisma.$RefreshTokenPayload>;
/**
 * Model OtpCode
 *
 */
export type OtpCode = $Result.DefaultSelection<Prisma.$OtpCodePayload>;
/**
 * Model SocialAccount
 *
 */
export type SocialAccount =
  $Result.DefaultSelection<Prisma.$SocialAccountPayload>;
/**
 * Model UserPermission
 *
 */
export type UserPermission =
  $Result.DefaultSelection<Prisma.$UserPermissionPayload>;

/**
 * Enums
 */
export namespace $Enums {
  export const TenantStatus: {
    PENDING: 'PENDING';
    ACTIVE: 'ACTIVE';
    SUSPENDED: 'SUSPENDED';
    CANCELLED: 'CANCELLED';
  };

  export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

  export const UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN';
    TENANT_ADMIN: 'TENANT_ADMIN';
    HR_MANAGER: 'HR_MANAGER';
    HR_STAFF: 'HR_STAFF';
    EMPLOYEE: 'EMPLOYEE';
    ACCOUNTANT: 'ACCOUNTANT';
    MARKETING_MANAGER: 'MARKETING_MANAGER';
    MARKETING_STAFF: 'MARKETING_STAFF';
  };

  export type UserRole = (typeof UserRole)[keyof typeof UserRole];

  export const UserStatus: {
    ACTIVE: 'ACTIVE';
    INACTIVE: 'INACTIVE';
    SUSPENDED: 'SUSPENDED';
    PENDING_VERIFICATION: 'PENDING_VERIFICATION';
  };

  export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

  export const MfaMethod: {
    TOTP: 'TOTP';
    SMS: 'SMS';
  };

  export type MfaMethod = (typeof MfaMethod)[keyof typeof MfaMethod];

  export const OtpType: {
    EMAIL_VERIFICATION: 'EMAIL_VERIFICATION';
    PASSWORD_RESET: 'PASSWORD_RESET';
    MFA_SMS: 'MFA_SMS';
  };

  export type OtpType = (typeof OtpType)[keyof typeof OtpType];

  export const SocialProvider: {
    GOOGLE: 'GOOGLE';
    MICROSOFT: 'MICROSOFT';
  };

  export type SocialProvider =
    (typeof SocialProvider)[keyof typeof SocialProvider];

  export const PermissionEffect: {
    GRANT: 'GRANT';
    REVOKE: 'REVOKE';
  };

  export type PermissionEffect =
    (typeof PermissionEffect)[keyof typeof PermissionEffect];
}

export type TenantStatus = $Enums.TenantStatus;

export const TenantStatus: typeof $Enums.TenantStatus;

export type UserRole = $Enums.UserRole;

export const UserRole: typeof $Enums.UserRole;

export type UserStatus = $Enums.UserStatus;

export const UserStatus: typeof $Enums.UserStatus;

export type MfaMethod = $Enums.MfaMethod;

export const MfaMethod: typeof $Enums.MfaMethod;

export type OtpType = $Enums.OtpType;

export const OtpType: typeof $Enums.OtpType;

export type SocialProvider = $Enums.SocialProvider;

export const SocialProvider: typeof $Enums.SocialProvider;

export type PermissionEffect = $Enums.PermissionEffect;

export const PermissionEffect: typeof $Enums.PermissionEffect;

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Tenants
 * const tenants = await prisma.tenant.findMany()
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
   * // Fetch zero or more Tenants
   * const tenants = await prisma.tenant.findMany()
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
   * `prisma.tenant`: Exposes CRUD operations for the **Tenant** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Tenants
   * const tenants = await prisma.tenant.findMany()
   * ```
   */
  get tenant(): Prisma.TenantDelegate<ExtArgs>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   */
  get user(): Prisma.UserDelegate<ExtArgs>;

  /**
   * `prisma.refreshToken`: Exposes CRUD operations for the **RefreshToken** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more RefreshTokens
   * const refreshTokens = await prisma.refreshToken.findMany()
   * ```
   */
  get refreshToken(): Prisma.RefreshTokenDelegate<ExtArgs>;

  /**
   * `prisma.otpCode`: Exposes CRUD operations for the **OtpCode** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more OtpCodes
   * const otpCodes = await prisma.otpCode.findMany()
   * ```
   */
  get otpCode(): Prisma.OtpCodeDelegate<ExtArgs>;

  /**
   * `prisma.socialAccount`: Exposes CRUD operations for the **SocialAccount** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more SocialAccounts
   * const socialAccounts = await prisma.socialAccount.findMany()
   * ```
   */
  get socialAccount(): Prisma.SocialAccountDelegate<ExtArgs>;

  /**
   * `prisma.userPermission`: Exposes CRUD operations for the **UserPermission** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more UserPermissions
   * const userPermissions = await prisma.userPermission.findMany()
   * ```
   */
  get userPermission(): Prisma.UserPermissionDelegate<ExtArgs>;
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
    Tenant: 'Tenant';
    User: 'User';
    RefreshToken: 'RefreshToken';
    OtpCode: 'OtpCode';
    SocialAccount: 'SocialAccount';
    UserPermission: 'UserPermission';
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
      modelProps:
        | 'tenant'
        | 'user'
        | 'refreshToken'
        | 'otpCode'
        | 'socialAccount'
        | 'userPermission';
      txIsolationLevel: Prisma.TransactionIsolationLevel;
    };
    model: {
      Tenant: {
        payload: Prisma.$TenantPayload<ExtArgs>;
        fields: Prisma.TenantFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.TenantFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.TenantFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>;
          };
          findFirst: {
            args: Prisma.TenantFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.TenantFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>;
          };
          findMany: {
            args: Prisma.TenantFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>[];
          };
          create: {
            args: Prisma.TenantCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>;
          };
          createMany: {
            args: Prisma.TenantCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.TenantCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>[];
          };
          delete: {
            args: Prisma.TenantDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>;
          };
          update: {
            args: Prisma.TenantUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>;
          };
          deleteMany: {
            args: Prisma.TenantDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.TenantUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.TenantUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$TenantPayload>;
          };
          aggregate: {
            args: Prisma.TenantAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateTenant>;
          };
          groupBy: {
            args: Prisma.TenantGroupByArgs<ExtArgs>;
            result: $Utils.Optional<TenantGroupByOutputType>[];
          };
          count: {
            args: Prisma.TenantCountArgs<ExtArgs>;
            result: $Utils.Optional<TenantCountAggregateOutputType> | number;
          };
        };
      };
      User: {
        payload: Prisma.$UserPayload<ExtArgs>;
        fields: Prisma.UserFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[];
          };
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[];
          };
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPayload>;
          };
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateUser>;
          };
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>;
            result: $Utils.Optional<UserGroupByOutputType>[];
          };
          count: {
            args: Prisma.UserCountArgs<ExtArgs>;
            result: $Utils.Optional<UserCountAggregateOutputType> | number;
          };
        };
      };
      RefreshToken: {
        payload: Prisma.$RefreshTokenPayload<ExtArgs>;
        fields: Prisma.RefreshTokenFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.RefreshTokenFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.RefreshTokenFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>;
          };
          findFirst: {
            args: Prisma.RefreshTokenFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.RefreshTokenFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>;
          };
          findMany: {
            args: Prisma.RefreshTokenFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>[];
          };
          create: {
            args: Prisma.RefreshTokenCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>;
          };
          createMany: {
            args: Prisma.RefreshTokenCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.RefreshTokenCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>[];
          };
          delete: {
            args: Prisma.RefreshTokenDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>;
          };
          update: {
            args: Prisma.RefreshTokenUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>;
          };
          deleteMany: {
            args: Prisma.RefreshTokenDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.RefreshTokenUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.RefreshTokenUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$RefreshTokenPayload>;
          };
          aggregate: {
            args: Prisma.RefreshTokenAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateRefreshToken>;
          };
          groupBy: {
            args: Prisma.RefreshTokenGroupByArgs<ExtArgs>;
            result: $Utils.Optional<RefreshTokenGroupByOutputType>[];
          };
          count: {
            args: Prisma.RefreshTokenCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<RefreshTokenCountAggregateOutputType>
              | number;
          };
        };
      };
      OtpCode: {
        payload: Prisma.$OtpCodePayload<ExtArgs>;
        fields: Prisma.OtpCodeFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.OtpCodeFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.OtpCodeFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>;
          };
          findFirst: {
            args: Prisma.OtpCodeFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.OtpCodeFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>;
          };
          findMany: {
            args: Prisma.OtpCodeFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>[];
          };
          create: {
            args: Prisma.OtpCodeCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>;
          };
          createMany: {
            args: Prisma.OtpCodeCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.OtpCodeCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>[];
          };
          delete: {
            args: Prisma.OtpCodeDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>;
          };
          update: {
            args: Prisma.OtpCodeUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>;
          };
          deleteMany: {
            args: Prisma.OtpCodeDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.OtpCodeUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.OtpCodeUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$OtpCodePayload>;
          };
          aggregate: {
            args: Prisma.OtpCodeAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateOtpCode>;
          };
          groupBy: {
            args: Prisma.OtpCodeGroupByArgs<ExtArgs>;
            result: $Utils.Optional<OtpCodeGroupByOutputType>[];
          };
          count: {
            args: Prisma.OtpCodeCountArgs<ExtArgs>;
            result: $Utils.Optional<OtpCodeCountAggregateOutputType> | number;
          };
        };
      };
      SocialAccount: {
        payload: Prisma.$SocialAccountPayload<ExtArgs>;
        fields: Prisma.SocialAccountFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.SocialAccountFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.SocialAccountFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>;
          };
          findFirst: {
            args: Prisma.SocialAccountFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.SocialAccountFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>;
          };
          findMany: {
            args: Prisma.SocialAccountFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>[];
          };
          create: {
            args: Prisma.SocialAccountCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>;
          };
          createMany: {
            args: Prisma.SocialAccountCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.SocialAccountCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>[];
          };
          delete: {
            args: Prisma.SocialAccountDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>;
          };
          update: {
            args: Prisma.SocialAccountUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>;
          };
          deleteMany: {
            args: Prisma.SocialAccountDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.SocialAccountUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.SocialAccountUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SocialAccountPayload>;
          };
          aggregate: {
            args: Prisma.SocialAccountAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateSocialAccount>;
          };
          groupBy: {
            args: Prisma.SocialAccountGroupByArgs<ExtArgs>;
            result: $Utils.Optional<SocialAccountGroupByOutputType>[];
          };
          count: {
            args: Prisma.SocialAccountCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<SocialAccountCountAggregateOutputType>
              | number;
          };
        };
      };
      UserPermission: {
        payload: Prisma.$UserPermissionPayload<ExtArgs>;
        fields: Prisma.UserPermissionFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.UserPermissionFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.UserPermissionFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>;
          };
          findFirst: {
            args: Prisma.UserPermissionFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.UserPermissionFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>;
          };
          findMany: {
            args: Prisma.UserPermissionFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>[];
          };
          create: {
            args: Prisma.UserPermissionCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>;
          };
          createMany: {
            args: Prisma.UserPermissionCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.UserPermissionCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>[];
          };
          delete: {
            args: Prisma.UserPermissionDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>;
          };
          update: {
            args: Prisma.UserPermissionUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>;
          };
          deleteMany: {
            args: Prisma.UserPermissionDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.UserPermissionUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          upsert: {
            args: Prisma.UserPermissionUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$UserPermissionPayload>;
          };
          aggregate: {
            args: Prisma.UserPermissionAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateUserPermission>;
          };
          groupBy: {
            args: Prisma.UserPermissionGroupByArgs<ExtArgs>;
            result: $Utils.Optional<UserPermissionGroupByOutputType>[];
          };
          count: {
            args: Prisma.UserPermissionCountArgs<ExtArgs>;
            result:
              | $Utils.Optional<UserPermissionCountAggregateOutputType>
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
   * Count Type TenantCountOutputType
   */

  export type TenantCountOutputType = {
    users: number;
  };

  export type TenantCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    users?: boolean | TenantCountOutputTypeCountUsersArgs;
  };

  // Custom InputTypes
  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the TenantCountOutputType
     */
    select?: TenantCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * TenantCountOutputType without action
   */
  export type TenantCountOutputTypeCountUsersArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: UserWhereInput;
  };

  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    refreshTokens: number;
    otpCodes: number;
    socialAccounts: number;
    userPermissions: number;
    grantedPermissions: number;
  };

  export type UserCountOutputTypeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    refreshTokens?: boolean | UserCountOutputTypeCountRefreshTokensArgs;
    otpCodes?: boolean | UserCountOutputTypeCountOtpCodesArgs;
    socialAccounts?: boolean | UserCountOutputTypeCountSocialAccountsArgs;
    userPermissions?: boolean | UserCountOutputTypeCountUserPermissionsArgs;
    grantedPermissions?:
      | boolean
      | UserCountOutputTypeCountGrantedPermissionsArgs;
  };

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountRefreshTokensArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: RefreshTokenWhereInput;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountOtpCodesArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: OtpCodeWhereInput;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSocialAccountsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: SocialAccountWhereInput;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountUserPermissionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: UserPermissionWhereInput;
  };

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountGrantedPermissionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: UserPermissionWhereInput;
  };

  /**
   * Models
   */

  /**
   * Model Tenant
   */

  export type AggregateTenant = {
    _count: TenantCountAggregateOutputType | null;
    _min: TenantMinAggregateOutputType | null;
    _max: TenantMaxAggregateOutputType | null;
  };

  export type TenantMinAggregateOutputType = {
    id: string | null;
    name: string | null;
    slug: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    country: string | null;
    status: $Enums.TenantStatus | null;
    logoUrl: string | null;
    website: string | null;
    industry: string | null;
    size: string | null;
    subscriptionId: string | null;
    trialEndsAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type TenantMaxAggregateOutputType = {
    id: string | null;
    name: string | null;
    slug: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    country: string | null;
    status: $Enums.TenantStatus | null;
    logoUrl: string | null;
    website: string | null;
    industry: string | null;
    size: string | null;
    subscriptionId: string | null;
    trialEndsAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type TenantCountAggregateOutputType = {
    id: number;
    name: number;
    slug: number;
    email: number;
    phone: number;
    address: number;
    country: number;
    status: number;
    logoUrl: number;
    website: number;
    industry: number;
    size: number;
    subscriptionId: number;
    trialEndsAt: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type TenantMinAggregateInputType = {
    id?: true;
    name?: true;
    slug?: true;
    email?: true;
    phone?: true;
    address?: true;
    country?: true;
    status?: true;
    logoUrl?: true;
    website?: true;
    industry?: true;
    size?: true;
    subscriptionId?: true;
    trialEndsAt?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type TenantMaxAggregateInputType = {
    id?: true;
    name?: true;
    slug?: true;
    email?: true;
    phone?: true;
    address?: true;
    country?: true;
    status?: true;
    logoUrl?: true;
    website?: true;
    industry?: true;
    size?: true;
    subscriptionId?: true;
    trialEndsAt?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type TenantCountAggregateInputType = {
    id?: true;
    name?: true;
    slug?: true;
    email?: true;
    phone?: true;
    address?: true;
    country?: true;
    status?: true;
    logoUrl?: true;
    website?: true;
    industry?: true;
    size?: true;
    subscriptionId?: true;
    trialEndsAt?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type TenantAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Tenant to aggregate.
     */
    where?: TenantWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: TenantWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Tenants.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Tenants
     **/
    _count?: true | TenantCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: TenantMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: TenantMaxAggregateInputType;
  };

  export type GetTenantAggregateType<T extends TenantAggregateArgs> = {
    [P in keyof T & keyof AggregateTenant]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTenant[P]>
      : GetScalarType<T[P], AggregateTenant[P]>;
  };

  export type TenantGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: TenantWhereInput;
    orderBy?:
      | TenantOrderByWithAggregationInput
      | TenantOrderByWithAggregationInput[];
    by: TenantScalarFieldEnum[] | TenantScalarFieldEnum;
    having?: TenantScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: TenantCountAggregateInputType | true;
    _min?: TenantMinAggregateInputType;
    _max?: TenantMaxAggregateInputType;
  };

  export type TenantGroupByOutputType = {
    id: string;
    name: string;
    slug: string;
    email: string;
    phone: string | null;
    address: string | null;
    country: string;
    status: $Enums.TenantStatus;
    logoUrl: string | null;
    website: string | null;
    industry: string | null;
    size: string | null;
    subscriptionId: string | null;
    trialEndsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: TenantCountAggregateOutputType | null;
    _min: TenantMinAggregateOutputType | null;
    _max: TenantMaxAggregateOutputType | null;
  };

  type GetTenantGroupByPayload<T extends TenantGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<TenantGroupByOutputType, T['by']> & {
          [P in keyof T & keyof TenantGroupByOutputType]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TenantGroupByOutputType[P]>
            : GetScalarType<T[P], TenantGroupByOutputType[P]>;
        }
      >
    >;

  export type TenantSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      slug?: boolean;
      email?: boolean;
      phone?: boolean;
      address?: boolean;
      country?: boolean;
      status?: boolean;
      logoUrl?: boolean;
      website?: boolean;
      industry?: boolean;
      size?: boolean;
      subscriptionId?: boolean;
      trialEndsAt?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      users?: boolean | Tenant$usersArgs<ExtArgs>;
      _count?: boolean | TenantCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['tenant']
  >;

  export type TenantSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      name?: boolean;
      slug?: boolean;
      email?: boolean;
      phone?: boolean;
      address?: boolean;
      country?: boolean;
      status?: boolean;
      logoUrl?: boolean;
      website?: boolean;
      industry?: boolean;
      size?: boolean;
      subscriptionId?: boolean;
      trialEndsAt?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
    },
    ExtArgs['result']['tenant']
  >;

  export type TenantSelectScalar = {
    id?: boolean;
    name?: boolean;
    slug?: boolean;
    email?: boolean;
    phone?: boolean;
    address?: boolean;
    country?: boolean;
    status?: boolean;
    logoUrl?: boolean;
    website?: boolean;
    industry?: boolean;
    size?: boolean;
    subscriptionId?: boolean;
    trialEndsAt?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type TenantInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    users?: boolean | Tenant$usersArgs<ExtArgs>;
    _count?: boolean | TenantCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type TenantIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {};

  export type $TenantPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'Tenant';
    objects: {
      users: Prisma.$UserPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        name: string;
        slug: string;
        email: string;
        phone: string | null;
        address: string | null;
        country: string;
        status: $Enums.TenantStatus;
        logoUrl: string | null;
        website: string | null;
        industry: string | null;
        size: string | null;
        subscriptionId: string | null;
        trialEndsAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs['result']['tenant']
    >;
    composites: {};
  };

  type TenantGetPayload<
    S extends boolean | null | undefined | TenantDefaultArgs,
  > = $Result.GetResult<Prisma.$TenantPayload, S>;

  type TenantCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<TenantFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: TenantCountAggregateInputType | true;
  };

  export interface TenantDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['Tenant'];
      meta: { name: 'Tenant' };
    };
    /**
     * Find zero or one Tenant that matches the filter.
     * @param {TenantFindUniqueArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TenantFindUniqueArgs>(
      args: SelectSubset<T, TenantFindUniqueArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'findUnique'> | null,
      null,
      ExtArgs
    >;

    /**
     * Find one Tenant that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TenantFindUniqueOrThrowArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TenantFindUniqueOrThrowArgs>(
      args: SelectSubset<T, TenantFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'findUniqueOrThrow'>,
      never,
      ExtArgs
    >;

    /**
     * Find the first Tenant that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindFirstArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TenantFindFirstArgs>(
      args?: SelectSubset<T, TenantFindFirstArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'findFirst'> | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first Tenant that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindFirstOrThrowArgs} args - Arguments to find a Tenant
     * @example
     * // Get one Tenant
     * const tenant = await prisma.tenant.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TenantFindFirstOrThrowArgs>(
      args?: SelectSubset<T, TenantFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'findFirstOrThrow'>,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more Tenants that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Tenants
     * const tenants = await prisma.tenant.findMany()
     *
     * // Get first 10 Tenants
     * const tenants = await prisma.tenant.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const tenantWithIdOnly = await prisma.tenant.findMany({ select: { id: true } })
     *
     */
    findMany<T extends TenantFindManyArgs>(
      args?: SelectSubset<T, TenantFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a Tenant.
     * @param {TenantCreateArgs} args - Arguments to create a Tenant.
     * @example
     * // Create one Tenant
     * const Tenant = await prisma.tenant.create({
     *   data: {
     *     // ... data to create a Tenant
     *   }
     * })
     *
     */
    create<T extends TenantCreateArgs>(
      args: SelectSubset<T, TenantCreateArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many Tenants.
     * @param {TenantCreateManyArgs} args - Arguments to create many Tenants.
     * @example
     * // Create many Tenants
     * const tenant = await prisma.tenant.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends TenantCreateManyArgs>(
      args?: SelectSubset<T, TenantCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Tenants and returns the data saved in the database.
     * @param {TenantCreateManyAndReturnArgs} args - Arguments to create many Tenants.
     * @example
     * // Create many Tenants
     * const tenant = await prisma.tenant.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Tenants and only return the `id`
     * const tenantWithIdOnly = await prisma.tenant.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends TenantCreateManyAndReturnArgs>(
      args?: SelectSubset<T, TenantCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$TenantPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a Tenant.
     * @param {TenantDeleteArgs} args - Arguments to delete one Tenant.
     * @example
     * // Delete one Tenant
     * const Tenant = await prisma.tenant.delete({
     *   where: {
     *     // ... filter to delete one Tenant
     *   }
     * })
     *
     */
    delete<T extends TenantDeleteArgs>(
      args: SelectSubset<T, TenantDeleteArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one Tenant.
     * @param {TenantUpdateArgs} args - Arguments to update one Tenant.
     * @example
     * // Update one Tenant
     * const tenant = await prisma.tenant.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends TenantUpdateArgs>(
      args: SelectSubset<T, TenantUpdateArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more Tenants.
     * @param {TenantDeleteManyArgs} args - Arguments to filter Tenants to delete.
     * @example
     * // Delete a few Tenants
     * const { count } = await prisma.tenant.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends TenantDeleteManyArgs>(
      args?: SelectSubset<T, TenantDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Tenants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Tenants
     * const tenant = await prisma.tenant.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends TenantUpdateManyArgs>(
      args: SelectSubset<T, TenantUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one Tenant.
     * @param {TenantUpsertArgs} args - Arguments to update or create a Tenant.
     * @example
     * // Update or create a Tenant
     * const tenant = await prisma.tenant.upsert({
     *   create: {
     *     // ... data to create a Tenant
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Tenant we want to update
     *   }
     * })
     */
    upsert<T extends TenantUpsertArgs>(
      args: SelectSubset<T, TenantUpsertArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      $Result.GetResult<Prisma.$TenantPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of Tenants.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantCountArgs} args - Arguments to filter Tenants to count.
     * @example
     * // Count the number of Tenants
     * const count = await prisma.tenant.count({
     *   where: {
     *     // ... the filter for the Tenants we want to count
     *   }
     * })
     **/
    count<T extends TenantCountArgs>(
      args?: Subset<T, TenantCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TenantCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a Tenant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends TenantAggregateArgs>(
      args: Subset<T, TenantAggregateArgs>,
    ): Prisma.PrismaPromise<GetTenantAggregateType<T>>;

    /**
     * Group by Tenant.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TenantGroupByArgs} args - Group by arguments.
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
      T extends TenantGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TenantGroupByArgs['orderBy'] }
        : { orderBy?: TenantGroupByArgs['orderBy'] },
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
      args: SubsetIntersection<T, TenantGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetTenantGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Tenant model
     */
    readonly fields: TenantFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Tenant.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TenantClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    users<T extends Tenant$usersArgs<ExtArgs> = {}>(
      args?: Subset<T, Tenant$usersArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findMany'> | Null
    >;
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
   * Fields of the Tenant model
   */
  interface TenantFieldRefs {
    readonly id: FieldRef<'Tenant', 'String'>;
    readonly name: FieldRef<'Tenant', 'String'>;
    readonly slug: FieldRef<'Tenant', 'String'>;
    readonly email: FieldRef<'Tenant', 'String'>;
    readonly phone: FieldRef<'Tenant', 'String'>;
    readonly address: FieldRef<'Tenant', 'String'>;
    readonly country: FieldRef<'Tenant', 'String'>;
    readonly status: FieldRef<'Tenant', 'TenantStatus'>;
    readonly logoUrl: FieldRef<'Tenant', 'String'>;
    readonly website: FieldRef<'Tenant', 'String'>;
    readonly industry: FieldRef<'Tenant', 'String'>;
    readonly size: FieldRef<'Tenant', 'String'>;
    readonly subscriptionId: FieldRef<'Tenant', 'String'>;
    readonly trialEndsAt: FieldRef<'Tenant', 'DateTime'>;
    readonly createdAt: FieldRef<'Tenant', 'DateTime'>;
    readonly updatedAt: FieldRef<'Tenant', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * Tenant findUnique
   */
  export type TenantFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * Filter, which Tenant to fetch.
     */
    where: TenantWhereUniqueInput;
  };

  /**
   * Tenant findUniqueOrThrow
   */
  export type TenantFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * Filter, which Tenant to fetch.
     */
    where: TenantWhereUniqueInput;
  };

  /**
   * Tenant findFirst
   */
  export type TenantFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * Filter, which Tenant to fetch.
     */
    where?: TenantWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Tenants.
     */
    cursor?: TenantWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Tenants.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Tenants.
     */
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[];
  };

  /**
   * Tenant findFirstOrThrow
   */
  export type TenantFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * Filter, which Tenant to fetch.
     */
    where?: TenantWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Tenants.
     */
    cursor?: TenantWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Tenants.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Tenants.
     */
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[];
  };

  /**
   * Tenant findMany
   */
  export type TenantFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * Filter, which Tenants to fetch.
     */
    where?: TenantWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Tenants to fetch.
     */
    orderBy?: TenantOrderByWithRelationInput | TenantOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Tenants.
     */
    cursor?: TenantWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Tenants from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Tenants.
     */
    skip?: number;
    distinct?: TenantScalarFieldEnum | TenantScalarFieldEnum[];
  };

  /**
   * Tenant create
   */
  export type TenantCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * The data needed to create a Tenant.
     */
    data: XOR<TenantCreateInput, TenantUncheckedCreateInput>;
  };

  /**
   * Tenant createMany
   */
  export type TenantCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Tenants.
     */
    data: TenantCreateManyInput | TenantCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Tenant createManyAndReturn
   */
  export type TenantCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many Tenants.
     */
    data: TenantCreateManyInput | TenantCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * Tenant update
   */
  export type TenantUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * The data needed to update a Tenant.
     */
    data: XOR<TenantUpdateInput, TenantUncheckedUpdateInput>;
    /**
     * Choose, which Tenant to update.
     */
    where: TenantWhereUniqueInput;
  };

  /**
   * Tenant updateMany
   */
  export type TenantUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Tenants.
     */
    data: XOR<TenantUpdateManyMutationInput, TenantUncheckedUpdateManyInput>;
    /**
     * Filter which Tenants to update
     */
    where?: TenantWhereInput;
  };

  /**
   * Tenant upsert
   */
  export type TenantUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * The filter to search for the Tenant to update in case it exists.
     */
    where: TenantWhereUniqueInput;
    /**
     * In case the Tenant found by the `where` argument doesn't exist, create a new Tenant with this data.
     */
    create: XOR<TenantCreateInput, TenantUncheckedCreateInput>;
    /**
     * In case the Tenant was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TenantUpdateInput, TenantUncheckedUpdateInput>;
  };

  /**
   * Tenant delete
   */
  export type TenantDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
    /**
     * Filter which Tenant to delete.
     */
    where: TenantWhereUniqueInput;
  };

  /**
   * Tenant deleteMany
   */
  export type TenantDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Tenants to delete
     */
    where?: TenantWhereInput;
  };

  /**
   * Tenant.users
   */
  export type Tenant$usersArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    where?: UserWhereInput;
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    cursor?: UserWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  };

  /**
   * Tenant without action
   */
  export type TenantDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the Tenant
     */
    select?: TenantSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TenantInclude<ExtArgs> | null;
  };

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null;
    _min: UserMinAggregateOutputType | null;
    _max: UserMaxAggregateOutputType | null;
  };

  export type UserMinAggregateOutputType = {
    id: string | null;
    tenantId: string | null;
    email: string | null;
    password: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: $Enums.UserRole | null;
    status: $Enums.UserStatus | null;
    avatarUrl: string | null;
    isMfaEnabled: boolean | null;
    mfaMethod: $Enums.MfaMethod | null;
    mfaSecret: string | null;
    forcePasswordReset: boolean | null;
    inviteToken: string | null;
    inviteExpiresAt: Date | null;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    passwordChangedAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type UserMaxAggregateOutputType = {
    id: string | null;
    tenantId: string | null;
    email: string | null;
    password: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: $Enums.UserRole | null;
    status: $Enums.UserStatus | null;
    avatarUrl: string | null;
    isMfaEnabled: boolean | null;
    mfaMethod: $Enums.MfaMethod | null;
    mfaSecret: string | null;
    forcePasswordReset: boolean | null;
    inviteToken: string | null;
    inviteExpiresAt: Date | null;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    passwordChangedAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };

  export type UserCountAggregateOutputType = {
    id: number;
    tenantId: number;
    email: number;
    password: number;
    firstName: number;
    lastName: number;
    phone: number;
    role: number;
    status: number;
    avatarUrl: number;
    isMfaEnabled: number;
    mfaMethod: number;
    mfaSecret: number;
    forcePasswordReset: number;
    inviteToken: number;
    inviteExpiresAt: number;
    emailVerifiedAt: number;
    lastLoginAt: number;
    passwordChangedAt: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
  };

  export type UserMinAggregateInputType = {
    id?: true;
    tenantId?: true;
    email?: true;
    password?: true;
    firstName?: true;
    lastName?: true;
    phone?: true;
    role?: true;
    status?: true;
    avatarUrl?: true;
    isMfaEnabled?: true;
    mfaMethod?: true;
    mfaSecret?: true;
    forcePasswordReset?: true;
    inviteToken?: true;
    inviteExpiresAt?: true;
    emailVerifiedAt?: true;
    lastLoginAt?: true;
    passwordChangedAt?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type UserMaxAggregateInputType = {
    id?: true;
    tenantId?: true;
    email?: true;
    password?: true;
    firstName?: true;
    lastName?: true;
    phone?: true;
    role?: true;
    status?: true;
    avatarUrl?: true;
    isMfaEnabled?: true;
    mfaMethod?: true;
    mfaSecret?: true;
    forcePasswordReset?: true;
    inviteToken?: true;
    inviteExpiresAt?: true;
    emailVerifiedAt?: true;
    lastLoginAt?: true;
    passwordChangedAt?: true;
    createdAt?: true;
    updatedAt?: true;
  };

  export type UserCountAggregateInputType = {
    id?: true;
    tenantId?: true;
    email?: true;
    password?: true;
    firstName?: true;
    lastName?: true;
    phone?: true;
    role?: true;
    status?: true;
    avatarUrl?: true;
    isMfaEnabled?: true;
    mfaMethod?: true;
    mfaSecret?: true;
    forcePasswordReset?: true;
    inviteToken?: true;
    inviteExpiresAt?: true;
    emailVerifiedAt?: true;
    lastLoginAt?: true;
    passwordChangedAt?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
  };

  export type UserAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Users
     **/
    _count?: true | UserCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: UserMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: UserMaxAggregateInputType;
  };

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
    [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>;
  };

  export type UserGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: UserWhereInput;
    orderBy?:
      | UserOrderByWithAggregationInput
      | UserOrderByWithAggregationInput[];
    by: UserScalarFieldEnum[] | UserScalarFieldEnum;
    having?: UserScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: UserCountAggregateInputType | true;
    _min?: UserMinAggregateInputType;
    _max?: UserMaxAggregateInputType;
  };

  export type UserGroupByOutputType = {
    id: string;
    tenantId: string;
    email: string;
    password: string | null;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: $Enums.UserRole;
    status: $Enums.UserStatus;
    avatarUrl: string | null;
    isMfaEnabled: boolean;
    mfaMethod: $Enums.MfaMethod | null;
    mfaSecret: string | null;
    forcePasswordReset: boolean;
    inviteToken: string | null;
    inviteExpiresAt: Date | null;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    passwordChangedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: UserCountAggregateOutputType | null;
    _min: UserMinAggregateOutputType | null;
    _max: UserMaxAggregateOutputType | null;
  };

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> & {
        [P in keyof T & keyof UserGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], UserGroupByOutputType[P]>
          : GetScalarType<T[P], UserGroupByOutputType[P]>;
      }
    >
  >;

  export type UserSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      tenantId?: boolean;
      email?: boolean;
      password?: boolean;
      firstName?: boolean;
      lastName?: boolean;
      phone?: boolean;
      role?: boolean;
      status?: boolean;
      avatarUrl?: boolean;
      isMfaEnabled?: boolean;
      mfaMethod?: boolean;
      mfaSecret?: boolean;
      forcePasswordReset?: boolean;
      inviteToken?: boolean;
      inviteExpiresAt?: boolean;
      emailVerifiedAt?: boolean;
      lastLoginAt?: boolean;
      passwordChangedAt?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenant?: boolean | TenantDefaultArgs<ExtArgs>;
      refreshTokens?: boolean | User$refreshTokensArgs<ExtArgs>;
      otpCodes?: boolean | User$otpCodesArgs<ExtArgs>;
      socialAccounts?: boolean | User$socialAccountsArgs<ExtArgs>;
      userPermissions?: boolean | User$userPermissionsArgs<ExtArgs>;
      grantedPermissions?: boolean | User$grantedPermissionsArgs<ExtArgs>;
      _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['user']
  >;

  export type UserSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      tenantId?: boolean;
      email?: boolean;
      password?: boolean;
      firstName?: boolean;
      lastName?: boolean;
      phone?: boolean;
      role?: boolean;
      status?: boolean;
      avatarUrl?: boolean;
      isMfaEnabled?: boolean;
      mfaMethod?: boolean;
      mfaSecret?: boolean;
      forcePasswordReset?: boolean;
      inviteToken?: boolean;
      inviteExpiresAt?: boolean;
      emailVerifiedAt?: boolean;
      lastLoginAt?: boolean;
      passwordChangedAt?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      tenant?: boolean | TenantDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['user']
  >;

  export type UserSelectScalar = {
    id?: boolean;
    tenantId?: boolean;
    email?: boolean;
    password?: boolean;
    firstName?: boolean;
    lastName?: boolean;
    phone?: boolean;
    role?: boolean;
    status?: boolean;
    avatarUrl?: boolean;
    isMfaEnabled?: boolean;
    mfaMethod?: boolean;
    mfaSecret?: boolean;
    forcePasswordReset?: boolean;
    inviteToken?: boolean;
    inviteExpiresAt?: boolean;
    emailVerifiedAt?: boolean;
    lastLoginAt?: boolean;
    passwordChangedAt?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
  };

  export type UserInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    tenant?: boolean | TenantDefaultArgs<ExtArgs>;
    refreshTokens?: boolean | User$refreshTokensArgs<ExtArgs>;
    otpCodes?: boolean | User$otpCodesArgs<ExtArgs>;
    socialAccounts?: boolean | User$socialAccountsArgs<ExtArgs>;
    userPermissions?: boolean | User$userPermissionsArgs<ExtArgs>;
    grantedPermissions?: boolean | User$grantedPermissionsArgs<ExtArgs>;
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type UserIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    tenant?: boolean | TenantDefaultArgs<ExtArgs>;
  };

  export type $UserPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'User';
    objects: {
      tenant: Prisma.$TenantPayload<ExtArgs>;
      refreshTokens: Prisma.$RefreshTokenPayload<ExtArgs>[];
      otpCodes: Prisma.$OtpCodePayload<ExtArgs>[];
      socialAccounts: Prisma.$SocialAccountPayload<ExtArgs>[];
      userPermissions: Prisma.$UserPermissionPayload<ExtArgs>[];
      grantedPermissions: Prisma.$UserPermissionPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        tenantId: string;
        email: string;
        password: string | null;
        firstName: string;
        lastName: string;
        phone: string | null;
        role: $Enums.UserRole;
        status: $Enums.UserStatus;
        avatarUrl: string | null;
        isMfaEnabled: boolean;
        mfaMethod: $Enums.MfaMethod | null;
        mfaSecret: string | null;
        forcePasswordReset: boolean;
        inviteToken: string | null;
        inviteExpiresAt: Date | null;
        emailVerifiedAt: Date | null;
        lastLoginAt: Date | null;
        passwordChangedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      },
      ExtArgs['result']['user']
    >;
    composites: {};
  };

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> =
    $Result.GetResult<Prisma.$UserPayload, S>;

  type UserCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<UserFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: UserCountAggregateInputType | true;
  };

  export interface UserDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['User'];
      meta: { name: 'User' };
    };
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(
      args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUnique'> | null,
      null,
      ExtArgs
    >;

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(
      args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow'>,
      never,
      ExtArgs
    >;

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(
      args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findFirst'> | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(
      args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findFirstOrThrow'>,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     *
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     *
     */
    findMany<T extends UserFindManyArgs>(
      args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     *
     */
    create<T extends UserCreateArgs>(
      args: SelectSubset<T, UserCreateArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends UserCreateManyArgs>(
      args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(
      args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'createManyAndReturn'>
    >;

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     *
     */
    delete<T extends UserDeleteArgs>(
      args: SelectSubset<T, UserDeleteArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends UserUpdateArgs>(
      args: SelectSubset<T, UserUpdateArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends UserDeleteManyArgs>(
      args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends UserUpdateManyArgs>(
      args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(
      args: SelectSubset<T, UserUpsertArgs<ExtArgs>>,
    ): Prisma__UserClient<
      $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
     **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends UserAggregateArgs>(
      args: Subset<T, UserAggregateArgs>,
    ): Prisma.PrismaPromise<GetUserAggregateType<T>>;

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
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
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
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
      args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetUserGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the User model
     */
    readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    tenant<T extends TenantDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, TenantDefaultArgs<ExtArgs>>,
    ): Prisma__TenantClient<
      | $Result.GetResult<
          Prisma.$TenantPayload<ExtArgs>,
          T,
          'findUniqueOrThrow'
        >
      | Null,
      Null,
      ExtArgs
    >;
    refreshTokens<T extends User$refreshTokensArgs<ExtArgs> = {}>(
      args?: Subset<T, User$refreshTokensArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, 'findMany'>
      | Null
    >;
    otpCodes<T extends User$otpCodesArgs<ExtArgs> = {}>(
      args?: Subset<T, User$otpCodesArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'findMany'> | Null
    >;
    socialAccounts<T extends User$socialAccountsArgs<ExtArgs> = {}>(
      args?: Subset<T, User$socialAccountsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<Prisma.$SocialAccountPayload<ExtArgs>, T, 'findMany'>
      | Null
    >;
    userPermissions<T extends User$userPermissionsArgs<ExtArgs> = {}>(
      args?: Subset<T, User$userPermissionsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<Prisma.$UserPermissionPayload<ExtArgs>, T, 'findMany'>
      | Null
    >;
    grantedPermissions<T extends User$grantedPermissionsArgs<ExtArgs> = {}>(
      args?: Subset<T, User$grantedPermissionsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      | $Result.GetResult<Prisma.$UserPermissionPayload<ExtArgs>, T, 'findMany'>
      | Null
    >;
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
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<'User', 'String'>;
    readonly tenantId: FieldRef<'User', 'String'>;
    readonly email: FieldRef<'User', 'String'>;
    readonly password: FieldRef<'User', 'String'>;
    readonly firstName: FieldRef<'User', 'String'>;
    readonly lastName: FieldRef<'User', 'String'>;
    readonly phone: FieldRef<'User', 'String'>;
    readonly role: FieldRef<'User', 'UserRole'>;
    readonly status: FieldRef<'User', 'UserStatus'>;
    readonly avatarUrl: FieldRef<'User', 'String'>;
    readonly isMfaEnabled: FieldRef<'User', 'Boolean'>;
    readonly mfaMethod: FieldRef<'User', 'MfaMethod'>;
    readonly mfaSecret: FieldRef<'User', 'String'>;
    readonly forcePasswordReset: FieldRef<'User', 'Boolean'>;
    readonly inviteToken: FieldRef<'User', 'String'>;
    readonly inviteExpiresAt: FieldRef<'User', 'DateTime'>;
    readonly emailVerifiedAt: FieldRef<'User', 'DateTime'>;
    readonly lastLoginAt: FieldRef<'User', 'DateTime'>;
    readonly passwordChangedAt: FieldRef<'User', 'DateTime'>;
    readonly createdAt: FieldRef<'User', 'DateTime'>;
    readonly updatedAt: FieldRef<'User', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  };

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  };

  /**
   * User findMany
   */
  export type UserFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Users from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Users.
     */
    skip?: number;
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  };

  /**
   * User create
   */
  export type UserCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>;
  };

  /**
   * User createMany
   */
  export type UserCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * User update
   */
  export type UserUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>;
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>;
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput;
  };

  /**
   * User upsert
   */
  export type UserUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput;
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>;
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>;
  };

  /**
   * User delete
   */
  export type UserDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput;
  };

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput;
  };

  /**
   * User.refreshTokens
   */
  export type User$refreshTokensArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    where?: RefreshTokenWhereInput;
    orderBy?:
      | RefreshTokenOrderByWithRelationInput
      | RefreshTokenOrderByWithRelationInput[];
    cursor?: RefreshTokenWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: RefreshTokenScalarFieldEnum | RefreshTokenScalarFieldEnum[];
  };

  /**
   * User.otpCodes
   */
  export type User$otpCodesArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    where?: OtpCodeWhereInput;
    orderBy?:
      | OtpCodeOrderByWithRelationInput
      | OtpCodeOrderByWithRelationInput[];
    cursor?: OtpCodeWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: OtpCodeScalarFieldEnum | OtpCodeScalarFieldEnum[];
  };

  /**
   * User.socialAccounts
   */
  export type User$socialAccountsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    where?: SocialAccountWhereInput;
    orderBy?:
      | SocialAccountOrderByWithRelationInput
      | SocialAccountOrderByWithRelationInput[];
    cursor?: SocialAccountWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: SocialAccountScalarFieldEnum | SocialAccountScalarFieldEnum[];
  };

  /**
   * User.userPermissions
   */
  export type User$userPermissionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    where?: UserPermissionWhereInput;
    orderBy?:
      | UserPermissionOrderByWithRelationInput
      | UserPermissionOrderByWithRelationInput[];
    cursor?: UserPermissionWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: UserPermissionScalarFieldEnum | UserPermissionScalarFieldEnum[];
  };

  /**
   * User.grantedPermissions
   */
  export type User$grantedPermissionsArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    where?: UserPermissionWhereInput;
    orderBy?:
      | UserPermissionOrderByWithRelationInput
      | UserPermissionOrderByWithRelationInput[];
    cursor?: UserPermissionWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: UserPermissionScalarFieldEnum | UserPermissionScalarFieldEnum[];
  };

  /**
   * User without action
   */
  export type UserDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null;
  };

  /**
   * Model RefreshToken
   */

  export type AggregateRefreshToken = {
    _count: RefreshTokenCountAggregateOutputType | null;
    _min: RefreshTokenMinAggregateOutputType | null;
    _max: RefreshTokenMaxAggregateOutputType | null;
  };

  export type RefreshTokenMinAggregateOutputType = {
    id: string | null;
    userId: string | null;
    token: string | null;
    expiresAt: Date | null;
    ipAddress: string | null;
    userAgent: string | null;
    deviceName: string | null;
    deviceId: string | null;
    isRevoked: boolean | null;
    createdAt: Date | null;
  };

  export type RefreshTokenMaxAggregateOutputType = {
    id: string | null;
    userId: string | null;
    token: string | null;
    expiresAt: Date | null;
    ipAddress: string | null;
    userAgent: string | null;
    deviceName: string | null;
    deviceId: string | null;
    isRevoked: boolean | null;
    createdAt: Date | null;
  };

  export type RefreshTokenCountAggregateOutputType = {
    id: number;
    userId: number;
    token: number;
    expiresAt: number;
    ipAddress: number;
    userAgent: number;
    deviceName: number;
    deviceId: number;
    isRevoked: number;
    createdAt: number;
    _all: number;
  };

  export type RefreshTokenMinAggregateInputType = {
    id?: true;
    userId?: true;
    token?: true;
    expiresAt?: true;
    ipAddress?: true;
    userAgent?: true;
    deviceName?: true;
    deviceId?: true;
    isRevoked?: true;
    createdAt?: true;
  };

  export type RefreshTokenMaxAggregateInputType = {
    id?: true;
    userId?: true;
    token?: true;
    expiresAt?: true;
    ipAddress?: true;
    userAgent?: true;
    deviceName?: true;
    deviceId?: true;
    isRevoked?: true;
    createdAt?: true;
  };

  export type RefreshTokenCountAggregateInputType = {
    id?: true;
    userId?: true;
    token?: true;
    expiresAt?: true;
    ipAddress?: true;
    userAgent?: true;
    deviceName?: true;
    deviceId?: true;
    isRevoked?: true;
    createdAt?: true;
    _all?: true;
  };

  export type RefreshTokenAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which RefreshToken to aggregate.
     */
    where?: RefreshTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?:
      | RefreshTokenOrderByWithRelationInput
      | RefreshTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: RefreshTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` RefreshTokens.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned RefreshTokens
     **/
    _count?: true | RefreshTokenCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: RefreshTokenMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: RefreshTokenMaxAggregateInputType;
  };

  export type GetRefreshTokenAggregateType<
    T extends RefreshTokenAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateRefreshToken]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRefreshToken[P]>
      : GetScalarType<T[P], AggregateRefreshToken[P]>;
  };

  export type RefreshTokenGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: RefreshTokenWhereInput;
    orderBy?:
      | RefreshTokenOrderByWithAggregationInput
      | RefreshTokenOrderByWithAggregationInput[];
    by: RefreshTokenScalarFieldEnum[] | RefreshTokenScalarFieldEnum;
    having?: RefreshTokenScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: RefreshTokenCountAggregateInputType | true;
    _min?: RefreshTokenMinAggregateInputType;
    _max?: RefreshTokenMaxAggregateInputType;
  };

  export type RefreshTokenGroupByOutputType = {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    deviceName: string | null;
    deviceId: string | null;
    isRevoked: boolean;
    createdAt: Date;
    _count: RefreshTokenCountAggregateOutputType | null;
    _min: RefreshTokenMinAggregateOutputType | null;
    _max: RefreshTokenMaxAggregateOutputType | null;
  };

  type GetRefreshTokenGroupByPayload<T extends RefreshTokenGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<RefreshTokenGroupByOutputType, T['by']> & {
          [P in keyof T &
            keyof RefreshTokenGroupByOutputType]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RefreshTokenGroupByOutputType[P]>
            : GetScalarType<T[P], RefreshTokenGroupByOutputType[P]>;
        }
      >
    >;

  export type RefreshTokenSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      token?: boolean;
      expiresAt?: boolean;
      ipAddress?: boolean;
      userAgent?: boolean;
      deviceName?: boolean;
      deviceId?: boolean;
      isRevoked?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['refreshToken']
  >;

  export type RefreshTokenSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      token?: boolean;
      expiresAt?: boolean;
      ipAddress?: boolean;
      userAgent?: boolean;
      deviceName?: boolean;
      deviceId?: boolean;
      isRevoked?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['refreshToken']
  >;

  export type RefreshTokenSelectScalar = {
    id?: boolean;
    userId?: boolean;
    token?: boolean;
    expiresAt?: boolean;
    ipAddress?: boolean;
    userAgent?: boolean;
    deviceName?: boolean;
    deviceId?: boolean;
    isRevoked?: boolean;
    createdAt?: boolean;
  };

  export type RefreshTokenInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type RefreshTokenIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };

  export type $RefreshTokenPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'RefreshToken';
    objects: {
      user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string | null;
        deviceName: string | null;
        deviceId: string | null;
        isRevoked: boolean;
        createdAt: Date;
      },
      ExtArgs['result']['refreshToken']
    >;
    composites: {};
  };

  type RefreshTokenGetPayload<
    S extends boolean | null | undefined | RefreshTokenDefaultArgs,
  > = $Result.GetResult<Prisma.$RefreshTokenPayload, S>;

  type RefreshTokenCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<RefreshTokenFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: RefreshTokenCountAggregateInputType | true;
  };

  export interface RefreshTokenDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['RefreshToken'];
      meta: { name: 'RefreshToken' };
    };
    /**
     * Find zero or one RefreshToken that matches the filter.
     * @param {RefreshTokenFindUniqueArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RefreshTokenFindUniqueArgs>(
      args: SelectSubset<T, RefreshTokenFindUniqueArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<
        Prisma.$RefreshTokenPayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one RefreshToken that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RefreshTokenFindUniqueOrThrowArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RefreshTokenFindUniqueOrThrowArgs>(
      args: SelectSubset<T, RefreshTokenFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<
        Prisma.$RefreshTokenPayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first RefreshToken that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenFindFirstArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RefreshTokenFindFirstArgs>(
      args?: SelectSubset<T, RefreshTokenFindFirstArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<
        Prisma.$RefreshTokenPayload<ExtArgs>,
        T,
        'findFirst'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first RefreshToken that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenFindFirstOrThrowArgs} args - Arguments to find a RefreshToken
     * @example
     * // Get one RefreshToken
     * const refreshToken = await prisma.refreshToken.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RefreshTokenFindFirstOrThrowArgs>(
      args?: SelectSubset<T, RefreshTokenFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<
        Prisma.$RefreshTokenPayload<ExtArgs>,
        T,
        'findFirstOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more RefreshTokens that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RefreshTokens
     * const refreshTokens = await prisma.refreshToken.findMany()
     *
     * // Get first 10 RefreshTokens
     * const refreshTokens = await prisma.refreshToken.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const refreshTokenWithIdOnly = await prisma.refreshToken.findMany({ select: { id: true } })
     *
     */
    findMany<T extends RefreshTokenFindManyArgs>(
      args?: SelectSubset<T, RefreshTokenFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a RefreshToken.
     * @param {RefreshTokenCreateArgs} args - Arguments to create a RefreshToken.
     * @example
     * // Create one RefreshToken
     * const RefreshToken = await prisma.refreshToken.create({
     *   data: {
     *     // ... data to create a RefreshToken
     *   }
     * })
     *
     */
    create<T extends RefreshTokenCreateArgs>(
      args: SelectSubset<T, RefreshTokenCreateArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many RefreshTokens.
     * @param {RefreshTokenCreateManyArgs} args - Arguments to create many RefreshTokens.
     * @example
     * // Create many RefreshTokens
     * const refreshToken = await prisma.refreshToken.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends RefreshTokenCreateManyArgs>(
      args?: SelectSubset<T, RefreshTokenCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many RefreshTokens and returns the data saved in the database.
     * @param {RefreshTokenCreateManyAndReturnArgs} args - Arguments to create many RefreshTokens.
     * @example
     * // Create many RefreshTokens
     * const refreshToken = await prisma.refreshToken.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many RefreshTokens and only return the `id`
     * const refreshTokenWithIdOnly = await prisma.refreshToken.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends RefreshTokenCreateManyAndReturnArgs>(
      args?: SelectSubset<T, RefreshTokenCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$RefreshTokenPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a RefreshToken.
     * @param {RefreshTokenDeleteArgs} args - Arguments to delete one RefreshToken.
     * @example
     * // Delete one RefreshToken
     * const RefreshToken = await prisma.refreshToken.delete({
     *   where: {
     *     // ... filter to delete one RefreshToken
     *   }
     * })
     *
     */
    delete<T extends RefreshTokenDeleteArgs>(
      args: SelectSubset<T, RefreshTokenDeleteArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one RefreshToken.
     * @param {RefreshTokenUpdateArgs} args - Arguments to update one RefreshToken.
     * @example
     * // Update one RefreshToken
     * const refreshToken = await prisma.refreshToken.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends RefreshTokenUpdateArgs>(
      args: SelectSubset<T, RefreshTokenUpdateArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more RefreshTokens.
     * @param {RefreshTokenDeleteManyArgs} args - Arguments to filter RefreshTokens to delete.
     * @example
     * // Delete a few RefreshTokens
     * const { count } = await prisma.refreshToken.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends RefreshTokenDeleteManyArgs>(
      args?: SelectSubset<T, RefreshTokenDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more RefreshTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RefreshTokens
     * const refreshToken = await prisma.refreshToken.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends RefreshTokenUpdateManyArgs>(
      args: SelectSubset<T, RefreshTokenUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one RefreshToken.
     * @param {RefreshTokenUpsertArgs} args - Arguments to update or create a RefreshToken.
     * @example
     * // Update or create a RefreshToken
     * const refreshToken = await prisma.refreshToken.upsert({
     *   create: {
     *     // ... data to create a RefreshToken
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RefreshToken we want to update
     *   }
     * })
     */
    upsert<T extends RefreshTokenUpsertArgs>(
      args: SelectSubset<T, RefreshTokenUpsertArgs<ExtArgs>>,
    ): Prisma__RefreshTokenClient<
      $Result.GetResult<Prisma.$RefreshTokenPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of RefreshTokens.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenCountArgs} args - Arguments to filter RefreshTokens to count.
     * @example
     * // Count the number of RefreshTokens
     * const count = await prisma.refreshToken.count({
     *   where: {
     *     // ... the filter for the RefreshTokens we want to count
     *   }
     * })
     **/
    count<T extends RefreshTokenCountArgs>(
      args?: Subset<T, RefreshTokenCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RefreshTokenCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a RefreshToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends RefreshTokenAggregateArgs>(
      args: Subset<T, RefreshTokenAggregateArgs>,
    ): Prisma.PrismaPromise<GetRefreshTokenAggregateType<T>>;

    /**
     * Group by RefreshToken.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RefreshTokenGroupByArgs} args - Group by arguments.
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
      T extends RefreshTokenGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RefreshTokenGroupByArgs['orderBy'] }
        : { orderBy?: RefreshTokenGroupByArgs['orderBy'] },
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
      args: SubsetIntersection<T, RefreshTokenGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetRefreshTokenGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the RefreshToken model
     */
    readonly fields: RefreshTokenFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RefreshToken.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RefreshTokenClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    user<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow'>
      | Null,
      Null,
      ExtArgs
    >;
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
   * Fields of the RefreshToken model
   */
  interface RefreshTokenFieldRefs {
    readonly id: FieldRef<'RefreshToken', 'String'>;
    readonly userId: FieldRef<'RefreshToken', 'String'>;
    readonly token: FieldRef<'RefreshToken', 'String'>;
    readonly expiresAt: FieldRef<'RefreshToken', 'DateTime'>;
    readonly ipAddress: FieldRef<'RefreshToken', 'String'>;
    readonly userAgent: FieldRef<'RefreshToken', 'String'>;
    readonly deviceName: FieldRef<'RefreshToken', 'String'>;
    readonly deviceId: FieldRef<'RefreshToken', 'String'>;
    readonly isRevoked: FieldRef<'RefreshToken', 'Boolean'>;
    readonly createdAt: FieldRef<'RefreshToken', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * RefreshToken findUnique
   */
  export type RefreshTokenFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * Filter, which RefreshToken to fetch.
     */
    where: RefreshTokenWhereUniqueInput;
  };

  /**
   * RefreshToken findUniqueOrThrow
   */
  export type RefreshTokenFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * Filter, which RefreshToken to fetch.
     */
    where: RefreshTokenWhereUniqueInput;
  };

  /**
   * RefreshToken findFirst
   */
  export type RefreshTokenFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * Filter, which RefreshToken to fetch.
     */
    where?: RefreshTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?:
      | RefreshTokenOrderByWithRelationInput
      | RefreshTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for RefreshTokens.
     */
    cursor?: RefreshTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` RefreshTokens.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of RefreshTokens.
     */
    distinct?: RefreshTokenScalarFieldEnum | RefreshTokenScalarFieldEnum[];
  };

  /**
   * RefreshToken findFirstOrThrow
   */
  export type RefreshTokenFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * Filter, which RefreshToken to fetch.
     */
    where?: RefreshTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?:
      | RefreshTokenOrderByWithRelationInput
      | RefreshTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for RefreshTokens.
     */
    cursor?: RefreshTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` RefreshTokens.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of RefreshTokens.
     */
    distinct?: RefreshTokenScalarFieldEnum | RefreshTokenScalarFieldEnum[];
  };

  /**
   * RefreshToken findMany
   */
  export type RefreshTokenFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * Filter, which RefreshTokens to fetch.
     */
    where?: RefreshTokenWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of RefreshTokens to fetch.
     */
    orderBy?:
      | RefreshTokenOrderByWithRelationInput
      | RefreshTokenOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing RefreshTokens.
     */
    cursor?: RefreshTokenWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` RefreshTokens from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` RefreshTokens.
     */
    skip?: number;
    distinct?: RefreshTokenScalarFieldEnum | RefreshTokenScalarFieldEnum[];
  };

  /**
   * RefreshToken create
   */
  export type RefreshTokenCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * The data needed to create a RefreshToken.
     */
    data: XOR<RefreshTokenCreateInput, RefreshTokenUncheckedCreateInput>;
  };

  /**
   * RefreshToken createMany
   */
  export type RefreshTokenCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many RefreshTokens.
     */
    data: RefreshTokenCreateManyInput | RefreshTokenCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * RefreshToken createManyAndReturn
   */
  export type RefreshTokenCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many RefreshTokens.
     */
    data: RefreshTokenCreateManyInput | RefreshTokenCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * RefreshToken update
   */
  export type RefreshTokenUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * The data needed to update a RefreshToken.
     */
    data: XOR<RefreshTokenUpdateInput, RefreshTokenUncheckedUpdateInput>;
    /**
     * Choose, which RefreshToken to update.
     */
    where: RefreshTokenWhereUniqueInput;
  };

  /**
   * RefreshToken updateMany
   */
  export type RefreshTokenUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update RefreshTokens.
     */
    data: XOR<
      RefreshTokenUpdateManyMutationInput,
      RefreshTokenUncheckedUpdateManyInput
    >;
    /**
     * Filter which RefreshTokens to update
     */
    where?: RefreshTokenWhereInput;
  };

  /**
   * RefreshToken upsert
   */
  export type RefreshTokenUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * The filter to search for the RefreshToken to update in case it exists.
     */
    where: RefreshTokenWhereUniqueInput;
    /**
     * In case the RefreshToken found by the `where` argument doesn't exist, create a new RefreshToken with this data.
     */
    create: XOR<RefreshTokenCreateInput, RefreshTokenUncheckedCreateInput>;
    /**
     * In case the RefreshToken was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RefreshTokenUpdateInput, RefreshTokenUncheckedUpdateInput>;
  };

  /**
   * RefreshToken delete
   */
  export type RefreshTokenDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
    /**
     * Filter which RefreshToken to delete.
     */
    where: RefreshTokenWhereUniqueInput;
  };

  /**
   * RefreshToken deleteMany
   */
  export type RefreshTokenDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which RefreshTokens to delete
     */
    where?: RefreshTokenWhereInput;
  };

  /**
   * RefreshToken without action
   */
  export type RefreshTokenDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the RefreshToken
     */
    select?: RefreshTokenSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RefreshTokenInclude<ExtArgs> | null;
  };

  /**
   * Model OtpCode
   */

  export type AggregateOtpCode = {
    _count: OtpCodeCountAggregateOutputType | null;
    _min: OtpCodeMinAggregateOutputType | null;
    _max: OtpCodeMaxAggregateOutputType | null;
  };

  export type OtpCodeMinAggregateOutputType = {
    id: string | null;
    userId: string | null;
    type: $Enums.OtpType | null;
    code: string | null;
    expiresAt: Date | null;
    usedAt: Date | null;
    createdAt: Date | null;
  };

  export type OtpCodeMaxAggregateOutputType = {
    id: string | null;
    userId: string | null;
    type: $Enums.OtpType | null;
    code: string | null;
    expiresAt: Date | null;
    usedAt: Date | null;
    createdAt: Date | null;
  };

  export type OtpCodeCountAggregateOutputType = {
    id: number;
    userId: number;
    type: number;
    code: number;
    expiresAt: number;
    usedAt: number;
    createdAt: number;
    _all: number;
  };

  export type OtpCodeMinAggregateInputType = {
    id?: true;
    userId?: true;
    type?: true;
    code?: true;
    expiresAt?: true;
    usedAt?: true;
    createdAt?: true;
  };

  export type OtpCodeMaxAggregateInputType = {
    id?: true;
    userId?: true;
    type?: true;
    code?: true;
    expiresAt?: true;
    usedAt?: true;
    createdAt?: true;
  };

  export type OtpCodeCountAggregateInputType = {
    id?: true;
    userId?: true;
    type?: true;
    code?: true;
    expiresAt?: true;
    usedAt?: true;
    createdAt?: true;
    _all?: true;
  };

  export type OtpCodeAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which OtpCode to aggregate.
     */
    where?: OtpCodeWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OtpCodes to fetch.
     */
    orderBy?:
      | OtpCodeOrderByWithRelationInput
      | OtpCodeOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: OtpCodeWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OtpCodes from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OtpCodes.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned OtpCodes
     **/
    _count?: true | OtpCodeCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: OtpCodeMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: OtpCodeMaxAggregateInputType;
  };

  export type GetOtpCodeAggregateType<T extends OtpCodeAggregateArgs> = {
    [P in keyof T & keyof AggregateOtpCode]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOtpCode[P]>
      : GetScalarType<T[P], AggregateOtpCode[P]>;
  };

  export type OtpCodeGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: OtpCodeWhereInput;
    orderBy?:
      | OtpCodeOrderByWithAggregationInput
      | OtpCodeOrderByWithAggregationInput[];
    by: OtpCodeScalarFieldEnum[] | OtpCodeScalarFieldEnum;
    having?: OtpCodeScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: OtpCodeCountAggregateInputType | true;
    _min?: OtpCodeMinAggregateInputType;
    _max?: OtpCodeMaxAggregateInputType;
  };

  export type OtpCodeGroupByOutputType = {
    id: string;
    userId: string;
    type: $Enums.OtpType;
    code: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
    _count: OtpCodeCountAggregateOutputType | null;
    _min: OtpCodeMinAggregateOutputType | null;
    _max: OtpCodeMaxAggregateOutputType | null;
  };

  type GetOtpCodeGroupByPayload<T extends OtpCodeGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<OtpCodeGroupByOutputType, T['by']> & {
          [P in keyof T & keyof OtpCodeGroupByOutputType]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OtpCodeGroupByOutputType[P]>
            : GetScalarType<T[P], OtpCodeGroupByOutputType[P]>;
        }
      >
    >;

  export type OtpCodeSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      type?: boolean;
      code?: boolean;
      expiresAt?: boolean;
      usedAt?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['otpCode']
  >;

  export type OtpCodeSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      type?: boolean;
      code?: boolean;
      expiresAt?: boolean;
      usedAt?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['otpCode']
  >;

  export type OtpCodeSelectScalar = {
    id?: boolean;
    userId?: boolean;
    type?: boolean;
    code?: boolean;
    expiresAt?: boolean;
    usedAt?: boolean;
    createdAt?: boolean;
  };

  export type OtpCodeInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type OtpCodeIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };

  export type $OtpCodePayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'OtpCode';
    objects: {
      user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        userId: string;
        type: $Enums.OtpType;
        code: string;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
      },
      ExtArgs['result']['otpCode']
    >;
    composites: {};
  };

  type OtpCodeGetPayload<
    S extends boolean | null | undefined | OtpCodeDefaultArgs,
  > = $Result.GetResult<Prisma.$OtpCodePayload, S>;

  type OtpCodeCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<OtpCodeFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: OtpCodeCountAggregateInputType | true;
  };

  export interface OtpCodeDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['OtpCode'];
      meta: { name: 'OtpCode' };
    };
    /**
     * Find zero or one OtpCode that matches the filter.
     * @param {OtpCodeFindUniqueArgs} args - Arguments to find a OtpCode
     * @example
     * // Get one OtpCode
     * const otpCode = await prisma.otpCode.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OtpCodeFindUniqueArgs>(
      args: SelectSubset<T, OtpCodeFindUniqueArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<
        Prisma.$OtpCodePayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one OtpCode that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OtpCodeFindUniqueOrThrowArgs} args - Arguments to find a OtpCode
     * @example
     * // Get one OtpCode
     * const otpCode = await prisma.otpCode.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OtpCodeFindUniqueOrThrowArgs>(
      args: SelectSubset<T, OtpCodeFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<
        Prisma.$OtpCodePayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first OtpCode that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtpCodeFindFirstArgs} args - Arguments to find a OtpCode
     * @example
     * // Get one OtpCode
     * const otpCode = await prisma.otpCode.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OtpCodeFindFirstArgs>(
      args?: SelectSubset<T, OtpCodeFindFirstArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'findFirst'> | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first OtpCode that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtpCodeFindFirstOrThrowArgs} args - Arguments to find a OtpCode
     * @example
     * // Get one OtpCode
     * const otpCode = await prisma.otpCode.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OtpCodeFindFirstOrThrowArgs>(
      args?: SelectSubset<T, OtpCodeFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'findFirstOrThrow'>,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more OtpCodes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtpCodeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all OtpCodes
     * const otpCodes = await prisma.otpCode.findMany()
     *
     * // Get first 10 OtpCodes
     * const otpCodes = await prisma.otpCode.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const otpCodeWithIdOnly = await prisma.otpCode.findMany({ select: { id: true } })
     *
     */
    findMany<T extends OtpCodeFindManyArgs>(
      args?: SelectSubset<T, OtpCodeFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a OtpCode.
     * @param {OtpCodeCreateArgs} args - Arguments to create a OtpCode.
     * @example
     * // Create one OtpCode
     * const OtpCode = await prisma.otpCode.create({
     *   data: {
     *     // ... data to create a OtpCode
     *   }
     * })
     *
     */
    create<T extends OtpCodeCreateArgs>(
      args: SelectSubset<T, OtpCodeCreateArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many OtpCodes.
     * @param {OtpCodeCreateManyArgs} args - Arguments to create many OtpCodes.
     * @example
     * // Create many OtpCodes
     * const otpCode = await prisma.otpCode.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends OtpCodeCreateManyArgs>(
      args?: SelectSubset<T, OtpCodeCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many OtpCodes and returns the data saved in the database.
     * @param {OtpCodeCreateManyAndReturnArgs} args - Arguments to create many OtpCodes.
     * @example
     * // Create many OtpCodes
     * const otpCode = await prisma.otpCode.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many OtpCodes and only return the `id`
     * const otpCodeWithIdOnly = await prisma.otpCode.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends OtpCodeCreateManyAndReturnArgs>(
      args?: SelectSubset<T, OtpCodeCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$OtpCodePayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a OtpCode.
     * @param {OtpCodeDeleteArgs} args - Arguments to delete one OtpCode.
     * @example
     * // Delete one OtpCode
     * const OtpCode = await prisma.otpCode.delete({
     *   where: {
     *     // ... filter to delete one OtpCode
     *   }
     * })
     *
     */
    delete<T extends OtpCodeDeleteArgs>(
      args: SelectSubset<T, OtpCodeDeleteArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one OtpCode.
     * @param {OtpCodeUpdateArgs} args - Arguments to update one OtpCode.
     * @example
     * // Update one OtpCode
     * const otpCode = await prisma.otpCode.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends OtpCodeUpdateArgs>(
      args: SelectSubset<T, OtpCodeUpdateArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more OtpCodes.
     * @param {OtpCodeDeleteManyArgs} args - Arguments to filter OtpCodes to delete.
     * @example
     * // Delete a few OtpCodes
     * const { count } = await prisma.otpCode.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends OtpCodeDeleteManyArgs>(
      args?: SelectSubset<T, OtpCodeDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more OtpCodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtpCodeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many OtpCodes
     * const otpCode = await prisma.otpCode.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends OtpCodeUpdateManyArgs>(
      args: SelectSubset<T, OtpCodeUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one OtpCode.
     * @param {OtpCodeUpsertArgs} args - Arguments to update or create a OtpCode.
     * @example
     * // Update or create a OtpCode
     * const otpCode = await prisma.otpCode.upsert({
     *   create: {
     *     // ... data to create a OtpCode
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the OtpCode we want to update
     *   }
     * })
     */
    upsert<T extends OtpCodeUpsertArgs>(
      args: SelectSubset<T, OtpCodeUpsertArgs<ExtArgs>>,
    ): Prisma__OtpCodeClient<
      $Result.GetResult<Prisma.$OtpCodePayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of OtpCodes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtpCodeCountArgs} args - Arguments to filter OtpCodes to count.
     * @example
     * // Count the number of OtpCodes
     * const count = await prisma.otpCode.count({
     *   where: {
     *     // ... the filter for the OtpCodes we want to count
     *   }
     * })
     **/
    count<T extends OtpCodeCountArgs>(
      args?: Subset<T, OtpCodeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OtpCodeCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a OtpCode.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtpCodeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends OtpCodeAggregateArgs>(
      args: Subset<T, OtpCodeAggregateArgs>,
    ): Prisma.PrismaPromise<GetOtpCodeAggregateType<T>>;

    /**
     * Group by OtpCode.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OtpCodeGroupByArgs} args - Group by arguments.
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
      T extends OtpCodeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OtpCodeGroupByArgs['orderBy'] }
        : { orderBy?: OtpCodeGroupByArgs['orderBy'] },
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
      args: SubsetIntersection<T, OtpCodeGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors
      ? GetOtpCodeGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the OtpCode model
     */
    readonly fields: OtpCodeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for OtpCode.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OtpCodeClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    user<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow'>
      | Null,
      Null,
      ExtArgs
    >;
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
   * Fields of the OtpCode model
   */
  interface OtpCodeFieldRefs {
    readonly id: FieldRef<'OtpCode', 'String'>;
    readonly userId: FieldRef<'OtpCode', 'String'>;
    readonly type: FieldRef<'OtpCode', 'OtpType'>;
    readonly code: FieldRef<'OtpCode', 'String'>;
    readonly expiresAt: FieldRef<'OtpCode', 'DateTime'>;
    readonly usedAt: FieldRef<'OtpCode', 'DateTime'>;
    readonly createdAt: FieldRef<'OtpCode', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * OtpCode findUnique
   */
  export type OtpCodeFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * Filter, which OtpCode to fetch.
     */
    where: OtpCodeWhereUniqueInput;
  };

  /**
   * OtpCode findUniqueOrThrow
   */
  export type OtpCodeFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * Filter, which OtpCode to fetch.
     */
    where: OtpCodeWhereUniqueInput;
  };

  /**
   * OtpCode findFirst
   */
  export type OtpCodeFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * Filter, which OtpCode to fetch.
     */
    where?: OtpCodeWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OtpCodes to fetch.
     */
    orderBy?:
      | OtpCodeOrderByWithRelationInput
      | OtpCodeOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for OtpCodes.
     */
    cursor?: OtpCodeWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OtpCodes from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OtpCodes.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of OtpCodes.
     */
    distinct?: OtpCodeScalarFieldEnum | OtpCodeScalarFieldEnum[];
  };

  /**
   * OtpCode findFirstOrThrow
   */
  export type OtpCodeFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * Filter, which OtpCode to fetch.
     */
    where?: OtpCodeWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OtpCodes to fetch.
     */
    orderBy?:
      | OtpCodeOrderByWithRelationInput
      | OtpCodeOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for OtpCodes.
     */
    cursor?: OtpCodeWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OtpCodes from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OtpCodes.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of OtpCodes.
     */
    distinct?: OtpCodeScalarFieldEnum | OtpCodeScalarFieldEnum[];
  };

  /**
   * OtpCode findMany
   */
  export type OtpCodeFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * Filter, which OtpCodes to fetch.
     */
    where?: OtpCodeWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of OtpCodes to fetch.
     */
    orderBy?:
      | OtpCodeOrderByWithRelationInput
      | OtpCodeOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing OtpCodes.
     */
    cursor?: OtpCodeWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` OtpCodes from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` OtpCodes.
     */
    skip?: number;
    distinct?: OtpCodeScalarFieldEnum | OtpCodeScalarFieldEnum[];
  };

  /**
   * OtpCode create
   */
  export type OtpCodeCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * The data needed to create a OtpCode.
     */
    data: XOR<OtpCodeCreateInput, OtpCodeUncheckedCreateInput>;
  };

  /**
   * OtpCode createMany
   */
  export type OtpCodeCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many OtpCodes.
     */
    data: OtpCodeCreateManyInput | OtpCodeCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * OtpCode createManyAndReturn
   */
  export type OtpCodeCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many OtpCodes.
     */
    data: OtpCodeCreateManyInput | OtpCodeCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * OtpCode update
   */
  export type OtpCodeUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * The data needed to update a OtpCode.
     */
    data: XOR<OtpCodeUpdateInput, OtpCodeUncheckedUpdateInput>;
    /**
     * Choose, which OtpCode to update.
     */
    where: OtpCodeWhereUniqueInput;
  };

  /**
   * OtpCode updateMany
   */
  export type OtpCodeUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update OtpCodes.
     */
    data: XOR<OtpCodeUpdateManyMutationInput, OtpCodeUncheckedUpdateManyInput>;
    /**
     * Filter which OtpCodes to update
     */
    where?: OtpCodeWhereInput;
  };

  /**
   * OtpCode upsert
   */
  export type OtpCodeUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * The filter to search for the OtpCode to update in case it exists.
     */
    where: OtpCodeWhereUniqueInput;
    /**
     * In case the OtpCode found by the `where` argument doesn't exist, create a new OtpCode with this data.
     */
    create: XOR<OtpCodeCreateInput, OtpCodeUncheckedCreateInput>;
    /**
     * In case the OtpCode was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OtpCodeUpdateInput, OtpCodeUncheckedUpdateInput>;
  };

  /**
   * OtpCode delete
   */
  export type OtpCodeDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
    /**
     * Filter which OtpCode to delete.
     */
    where: OtpCodeWhereUniqueInput;
  };

  /**
   * OtpCode deleteMany
   */
  export type OtpCodeDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which OtpCodes to delete
     */
    where?: OtpCodeWhereInput;
  };

  /**
   * OtpCode without action
   */
  export type OtpCodeDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the OtpCode
     */
    select?: OtpCodeSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OtpCodeInclude<ExtArgs> | null;
  };

  /**
   * Model SocialAccount
   */

  export type AggregateSocialAccount = {
    _count: SocialAccountCountAggregateOutputType | null;
    _min: SocialAccountMinAggregateOutputType | null;
    _max: SocialAccountMaxAggregateOutputType | null;
  };

  export type SocialAccountMinAggregateOutputType = {
    id: string | null;
    userId: string | null;
    provider: $Enums.SocialProvider | null;
    providerId: string | null;
    email: string | null;
    createdAt: Date | null;
  };

  export type SocialAccountMaxAggregateOutputType = {
    id: string | null;
    userId: string | null;
    provider: $Enums.SocialProvider | null;
    providerId: string | null;
    email: string | null;
    createdAt: Date | null;
  };

  export type SocialAccountCountAggregateOutputType = {
    id: number;
    userId: number;
    provider: number;
    providerId: number;
    email: number;
    createdAt: number;
    _all: number;
  };

  export type SocialAccountMinAggregateInputType = {
    id?: true;
    userId?: true;
    provider?: true;
    providerId?: true;
    email?: true;
    createdAt?: true;
  };

  export type SocialAccountMaxAggregateInputType = {
    id?: true;
    userId?: true;
    provider?: true;
    providerId?: true;
    email?: true;
    createdAt?: true;
  };

  export type SocialAccountCountAggregateInputType = {
    id?: true;
    userId?: true;
    provider?: true;
    providerId?: true;
    email?: true;
    createdAt?: true;
    _all?: true;
  };

  export type SocialAccountAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which SocialAccount to aggregate.
     */
    where?: SocialAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SocialAccounts to fetch.
     */
    orderBy?:
      | SocialAccountOrderByWithRelationInput
      | SocialAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: SocialAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SocialAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SocialAccounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned SocialAccounts
     **/
    _count?: true | SocialAccountCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: SocialAccountMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: SocialAccountMaxAggregateInputType;
  };

  export type GetSocialAccountAggregateType<
    T extends SocialAccountAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateSocialAccount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSocialAccount[P]>
      : GetScalarType<T[P], AggregateSocialAccount[P]>;
  };

  export type SocialAccountGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: SocialAccountWhereInput;
    orderBy?:
      | SocialAccountOrderByWithAggregationInput
      | SocialAccountOrderByWithAggregationInput[];
    by: SocialAccountScalarFieldEnum[] | SocialAccountScalarFieldEnum;
    having?: SocialAccountScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: SocialAccountCountAggregateInputType | true;
    _min?: SocialAccountMinAggregateInputType;
    _max?: SocialAccountMaxAggregateInputType;
  };

  export type SocialAccountGroupByOutputType = {
    id: string;
    userId: string;
    provider: $Enums.SocialProvider;
    providerId: string;
    email: string | null;
    createdAt: Date;
    _count: SocialAccountCountAggregateOutputType | null;
    _min: SocialAccountMinAggregateOutputType | null;
    _max: SocialAccountMaxAggregateOutputType | null;
  };

  type GetSocialAccountGroupByPayload<T extends SocialAccountGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<SocialAccountGroupByOutputType, T['by']> & {
          [P in keyof T &
            keyof SocialAccountGroupByOutputType]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SocialAccountGroupByOutputType[P]>
            : GetScalarType<T[P], SocialAccountGroupByOutputType[P]>;
        }
      >
    >;

  export type SocialAccountSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      provider?: boolean;
      providerId?: boolean;
      email?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['socialAccount']
  >;

  export type SocialAccountSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      provider?: boolean;
      providerId?: boolean;
      email?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['socialAccount']
  >;

  export type SocialAccountSelectScalar = {
    id?: boolean;
    userId?: boolean;
    provider?: boolean;
    providerId?: boolean;
    email?: boolean;
    createdAt?: boolean;
  };

  export type SocialAccountInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type SocialAccountIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
  };

  export type $SocialAccountPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'SocialAccount';
    objects: {
      user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        userId: string;
        provider: $Enums.SocialProvider;
        providerId: string;
        email: string | null;
        createdAt: Date;
      },
      ExtArgs['result']['socialAccount']
    >;
    composites: {};
  };

  type SocialAccountGetPayload<
    S extends boolean | null | undefined | SocialAccountDefaultArgs,
  > = $Result.GetResult<Prisma.$SocialAccountPayload, S>;

  type SocialAccountCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<SocialAccountFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: SocialAccountCountAggregateInputType | true;
  };

  export interface SocialAccountDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['SocialAccount'];
      meta: { name: 'SocialAccount' };
    };
    /**
     * Find zero or one SocialAccount that matches the filter.
     * @param {SocialAccountFindUniqueArgs} args - Arguments to find a SocialAccount
     * @example
     * // Get one SocialAccount
     * const socialAccount = await prisma.socialAccount.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SocialAccountFindUniqueArgs>(
      args: SelectSubset<T, SocialAccountFindUniqueArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<
        Prisma.$SocialAccountPayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one SocialAccount that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SocialAccountFindUniqueOrThrowArgs} args - Arguments to find a SocialAccount
     * @example
     * // Get one SocialAccount
     * const socialAccount = await prisma.socialAccount.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SocialAccountFindUniqueOrThrowArgs>(
      args: SelectSubset<T, SocialAccountFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<
        Prisma.$SocialAccountPayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first SocialAccount that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAccountFindFirstArgs} args - Arguments to find a SocialAccount
     * @example
     * // Get one SocialAccount
     * const socialAccount = await prisma.socialAccount.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SocialAccountFindFirstArgs>(
      args?: SelectSubset<T, SocialAccountFindFirstArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<
        Prisma.$SocialAccountPayload<ExtArgs>,
        T,
        'findFirst'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first SocialAccount that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAccountFindFirstOrThrowArgs} args - Arguments to find a SocialAccount
     * @example
     * // Get one SocialAccount
     * const socialAccount = await prisma.socialAccount.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SocialAccountFindFirstOrThrowArgs>(
      args?: SelectSubset<T, SocialAccountFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<
        Prisma.$SocialAccountPayload<ExtArgs>,
        T,
        'findFirstOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more SocialAccounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAccountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SocialAccounts
     * const socialAccounts = await prisma.socialAccount.findMany()
     *
     * // Get first 10 SocialAccounts
     * const socialAccounts = await prisma.socialAccount.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const socialAccountWithIdOnly = await prisma.socialAccount.findMany({ select: { id: true } })
     *
     */
    findMany<T extends SocialAccountFindManyArgs>(
      args?: SelectSubset<T, SocialAccountFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$SocialAccountPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a SocialAccount.
     * @param {SocialAccountCreateArgs} args - Arguments to create a SocialAccount.
     * @example
     * // Create one SocialAccount
     * const SocialAccount = await prisma.socialAccount.create({
     *   data: {
     *     // ... data to create a SocialAccount
     *   }
     * })
     *
     */
    create<T extends SocialAccountCreateArgs>(
      args: SelectSubset<T, SocialAccountCreateArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<Prisma.$SocialAccountPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many SocialAccounts.
     * @param {SocialAccountCreateManyArgs} args - Arguments to create many SocialAccounts.
     * @example
     * // Create many SocialAccounts
     * const socialAccount = await prisma.socialAccount.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends SocialAccountCreateManyArgs>(
      args?: SelectSubset<T, SocialAccountCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many SocialAccounts and returns the data saved in the database.
     * @param {SocialAccountCreateManyAndReturnArgs} args - Arguments to create many SocialAccounts.
     * @example
     * // Create many SocialAccounts
     * const socialAccount = await prisma.socialAccount.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many SocialAccounts and only return the `id`
     * const socialAccountWithIdOnly = await prisma.socialAccount.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends SocialAccountCreateManyAndReturnArgs>(
      args?: SelectSubset<T, SocialAccountCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$SocialAccountPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a SocialAccount.
     * @param {SocialAccountDeleteArgs} args - Arguments to delete one SocialAccount.
     * @example
     * // Delete one SocialAccount
     * const SocialAccount = await prisma.socialAccount.delete({
     *   where: {
     *     // ... filter to delete one SocialAccount
     *   }
     * })
     *
     */
    delete<T extends SocialAccountDeleteArgs>(
      args: SelectSubset<T, SocialAccountDeleteArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<Prisma.$SocialAccountPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one SocialAccount.
     * @param {SocialAccountUpdateArgs} args - Arguments to update one SocialAccount.
     * @example
     * // Update one SocialAccount
     * const socialAccount = await prisma.socialAccount.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends SocialAccountUpdateArgs>(
      args: SelectSubset<T, SocialAccountUpdateArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<Prisma.$SocialAccountPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more SocialAccounts.
     * @param {SocialAccountDeleteManyArgs} args - Arguments to filter SocialAccounts to delete.
     * @example
     * // Delete a few SocialAccounts
     * const { count } = await prisma.socialAccount.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends SocialAccountDeleteManyArgs>(
      args?: SelectSubset<T, SocialAccountDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more SocialAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAccountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SocialAccounts
     * const socialAccount = await prisma.socialAccount.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends SocialAccountUpdateManyArgs>(
      args: SelectSubset<T, SocialAccountUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one SocialAccount.
     * @param {SocialAccountUpsertArgs} args - Arguments to update or create a SocialAccount.
     * @example
     * // Update or create a SocialAccount
     * const socialAccount = await prisma.socialAccount.upsert({
     *   create: {
     *     // ... data to create a SocialAccount
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SocialAccount we want to update
     *   }
     * })
     */
    upsert<T extends SocialAccountUpsertArgs>(
      args: SelectSubset<T, SocialAccountUpsertArgs<ExtArgs>>,
    ): Prisma__SocialAccountClient<
      $Result.GetResult<Prisma.$SocialAccountPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of SocialAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAccountCountArgs} args - Arguments to filter SocialAccounts to count.
     * @example
     * // Count the number of SocialAccounts
     * const count = await prisma.socialAccount.count({
     *   where: {
     *     // ... the filter for the SocialAccounts we want to count
     *   }
     * })
     **/
    count<T extends SocialAccountCountArgs>(
      args?: Subset<T, SocialAccountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SocialAccountCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a SocialAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends SocialAccountAggregateArgs>(
      args: Subset<T, SocialAccountAggregateArgs>,
    ): Prisma.PrismaPromise<GetSocialAccountAggregateType<T>>;

    /**
     * Group by SocialAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SocialAccountGroupByArgs} args - Group by arguments.
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
      T extends SocialAccountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SocialAccountGroupByArgs['orderBy'] }
        : { orderBy?: SocialAccountGroupByArgs['orderBy'] },
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
      args: SubsetIntersection<T, SocialAccountGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetSocialAccountGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the SocialAccount model
     */
    readonly fields: SocialAccountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SocialAccount.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SocialAccountClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    user<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow'>
      | Null,
      Null,
      ExtArgs
    >;
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
   * Fields of the SocialAccount model
   */
  interface SocialAccountFieldRefs {
    readonly id: FieldRef<'SocialAccount', 'String'>;
    readonly userId: FieldRef<'SocialAccount', 'String'>;
    readonly provider: FieldRef<'SocialAccount', 'SocialProvider'>;
    readonly providerId: FieldRef<'SocialAccount', 'String'>;
    readonly email: FieldRef<'SocialAccount', 'String'>;
    readonly createdAt: FieldRef<'SocialAccount', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * SocialAccount findUnique
   */
  export type SocialAccountFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * Filter, which SocialAccount to fetch.
     */
    where: SocialAccountWhereUniqueInput;
  };

  /**
   * SocialAccount findUniqueOrThrow
   */
  export type SocialAccountFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * Filter, which SocialAccount to fetch.
     */
    where: SocialAccountWhereUniqueInput;
  };

  /**
   * SocialAccount findFirst
   */
  export type SocialAccountFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * Filter, which SocialAccount to fetch.
     */
    where?: SocialAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SocialAccounts to fetch.
     */
    orderBy?:
      | SocialAccountOrderByWithRelationInput
      | SocialAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for SocialAccounts.
     */
    cursor?: SocialAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SocialAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SocialAccounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of SocialAccounts.
     */
    distinct?: SocialAccountScalarFieldEnum | SocialAccountScalarFieldEnum[];
  };

  /**
   * SocialAccount findFirstOrThrow
   */
  export type SocialAccountFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * Filter, which SocialAccount to fetch.
     */
    where?: SocialAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SocialAccounts to fetch.
     */
    orderBy?:
      | SocialAccountOrderByWithRelationInput
      | SocialAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for SocialAccounts.
     */
    cursor?: SocialAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SocialAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SocialAccounts.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of SocialAccounts.
     */
    distinct?: SocialAccountScalarFieldEnum | SocialAccountScalarFieldEnum[];
  };

  /**
   * SocialAccount findMany
   */
  export type SocialAccountFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * Filter, which SocialAccounts to fetch.
     */
    where?: SocialAccountWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SocialAccounts to fetch.
     */
    orderBy?:
      | SocialAccountOrderByWithRelationInput
      | SocialAccountOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing SocialAccounts.
     */
    cursor?: SocialAccountWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SocialAccounts from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SocialAccounts.
     */
    skip?: number;
    distinct?: SocialAccountScalarFieldEnum | SocialAccountScalarFieldEnum[];
  };

  /**
   * SocialAccount create
   */
  export type SocialAccountCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * The data needed to create a SocialAccount.
     */
    data: XOR<SocialAccountCreateInput, SocialAccountUncheckedCreateInput>;
  };

  /**
   * SocialAccount createMany
   */
  export type SocialAccountCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many SocialAccounts.
     */
    data: SocialAccountCreateManyInput | SocialAccountCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * SocialAccount createManyAndReturn
   */
  export type SocialAccountCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many SocialAccounts.
     */
    data: SocialAccountCreateManyInput | SocialAccountCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * SocialAccount update
   */
  export type SocialAccountUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * The data needed to update a SocialAccount.
     */
    data: XOR<SocialAccountUpdateInput, SocialAccountUncheckedUpdateInput>;
    /**
     * Choose, which SocialAccount to update.
     */
    where: SocialAccountWhereUniqueInput;
  };

  /**
   * SocialAccount updateMany
   */
  export type SocialAccountUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update SocialAccounts.
     */
    data: XOR<
      SocialAccountUpdateManyMutationInput,
      SocialAccountUncheckedUpdateManyInput
    >;
    /**
     * Filter which SocialAccounts to update
     */
    where?: SocialAccountWhereInput;
  };

  /**
   * SocialAccount upsert
   */
  export type SocialAccountUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * The filter to search for the SocialAccount to update in case it exists.
     */
    where: SocialAccountWhereUniqueInput;
    /**
     * In case the SocialAccount found by the `where` argument doesn't exist, create a new SocialAccount with this data.
     */
    create: XOR<SocialAccountCreateInput, SocialAccountUncheckedCreateInput>;
    /**
     * In case the SocialAccount was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SocialAccountUpdateInput, SocialAccountUncheckedUpdateInput>;
  };

  /**
   * SocialAccount delete
   */
  export type SocialAccountDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
    /**
     * Filter which SocialAccount to delete.
     */
    where: SocialAccountWhereUniqueInput;
  };

  /**
   * SocialAccount deleteMany
   */
  export type SocialAccountDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which SocialAccounts to delete
     */
    where?: SocialAccountWhereInput;
  };

  /**
   * SocialAccount without action
   */
  export type SocialAccountDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the SocialAccount
     */
    select?: SocialAccountSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SocialAccountInclude<ExtArgs> | null;
  };

  /**
   * Model UserPermission
   */

  export type AggregateUserPermission = {
    _count: UserPermissionCountAggregateOutputType | null;
    _min: UserPermissionMinAggregateOutputType | null;
    _max: UserPermissionMaxAggregateOutputType | null;
  };

  export type UserPermissionMinAggregateOutputType = {
    id: string | null;
    userId: string | null;
    tenantId: string | null;
    permission: string | null;
    effect: $Enums.PermissionEffect | null;
    grantedBy: string | null;
    reason: string | null;
    createdAt: Date | null;
  };

  export type UserPermissionMaxAggregateOutputType = {
    id: string | null;
    userId: string | null;
    tenantId: string | null;
    permission: string | null;
    effect: $Enums.PermissionEffect | null;
    grantedBy: string | null;
    reason: string | null;
    createdAt: Date | null;
  };

  export type UserPermissionCountAggregateOutputType = {
    id: number;
    userId: number;
    tenantId: number;
    permission: number;
    effect: number;
    grantedBy: number;
    reason: number;
    createdAt: number;
    _all: number;
  };

  export type UserPermissionMinAggregateInputType = {
    id?: true;
    userId?: true;
    tenantId?: true;
    permission?: true;
    effect?: true;
    grantedBy?: true;
    reason?: true;
    createdAt?: true;
  };

  export type UserPermissionMaxAggregateInputType = {
    id?: true;
    userId?: true;
    tenantId?: true;
    permission?: true;
    effect?: true;
    grantedBy?: true;
    reason?: true;
    createdAt?: true;
  };

  export type UserPermissionCountAggregateInputType = {
    id?: true;
    userId?: true;
    tenantId?: true;
    permission?: true;
    effect?: true;
    grantedBy?: true;
    reason?: true;
    createdAt?: true;
    _all?: true;
  };

  export type UserPermissionAggregateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which UserPermission to aggregate.
     */
    where?: UserPermissionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UserPermissions to fetch.
     */
    orderBy?:
      | UserPermissionOrderByWithRelationInput
      | UserPermissionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: UserPermissionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UserPermissions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UserPermissions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned UserPermissions
     **/
    _count?: true | UserPermissionCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: UserPermissionMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: UserPermissionMaxAggregateInputType;
  };

  export type GetUserPermissionAggregateType<
    T extends UserPermissionAggregateArgs,
  > = {
    [P in keyof T & keyof AggregateUserPermission]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserPermission[P]>
      : GetScalarType<T[P], AggregateUserPermission[P]>;
  };

  export type UserPermissionGroupByArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    where?: UserPermissionWhereInput;
    orderBy?:
      | UserPermissionOrderByWithAggregationInput
      | UserPermissionOrderByWithAggregationInput[];
    by: UserPermissionScalarFieldEnum[] | UserPermissionScalarFieldEnum;
    having?: UserPermissionScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: UserPermissionCountAggregateInputType | true;
    _min?: UserPermissionMinAggregateInputType;
    _max?: UserPermissionMaxAggregateInputType;
  };

  export type UserPermissionGroupByOutputType = {
    id: string;
    userId: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    grantedBy: string;
    reason: string | null;
    createdAt: Date;
    _count: UserPermissionCountAggregateOutputType | null;
    _min: UserPermissionMinAggregateOutputType | null;
    _max: UserPermissionMaxAggregateOutputType | null;
  };

  type GetUserPermissionGroupByPayload<T extends UserPermissionGroupByArgs> =
    Prisma.PrismaPromise<
      Array<
        PickEnumerable<UserPermissionGroupByOutputType, T['by']> & {
          [P in keyof T &
            keyof UserPermissionGroupByOutputType]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserPermissionGroupByOutputType[P]>
            : GetScalarType<T[P], UserPermissionGroupByOutputType[P]>;
        }
      >
    >;

  export type UserPermissionSelect<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      tenantId?: boolean;
      permission?: boolean;
      effect?: boolean;
      grantedBy?: boolean;
      reason?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
      granter?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['userPermission']
  >;

  export type UserPermissionSelectCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = $Extensions.GetSelect<
    {
      id?: boolean;
      userId?: boolean;
      tenantId?: boolean;
      permission?: boolean;
      effect?: boolean;
      grantedBy?: boolean;
      reason?: boolean;
      createdAt?: boolean;
      user?: boolean | UserDefaultArgs<ExtArgs>;
      granter?: boolean | UserDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['userPermission']
  >;

  export type UserPermissionSelectScalar = {
    id?: boolean;
    userId?: boolean;
    tenantId?: boolean;
    permission?: boolean;
    effect?: boolean;
    grantedBy?: boolean;
    reason?: boolean;
    createdAt?: boolean;
  };

  export type UserPermissionInclude<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
    granter?: boolean | UserDefaultArgs<ExtArgs>;
  };
  export type UserPermissionIncludeCreateManyAndReturn<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    user?: boolean | UserDefaultArgs<ExtArgs>;
    granter?: boolean | UserDefaultArgs<ExtArgs>;
  };

  export type $UserPermissionPayload<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    name: 'UserPermission';
    objects: {
      user: Prisma.$UserPayload<ExtArgs>;
      granter: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: string;
        userId: string;
        tenantId: string;
        permission: string;
        effect: $Enums.PermissionEffect;
        grantedBy: string;
        reason: string | null;
        createdAt: Date;
      },
      ExtArgs['result']['userPermission']
    >;
    composites: {};
  };

  type UserPermissionGetPayload<
    S extends boolean | null | undefined | UserPermissionDefaultArgs,
  > = $Result.GetResult<Prisma.$UserPermissionPayload, S>;

  type UserPermissionCountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = Omit<UserPermissionFindManyArgs, 'select' | 'include' | 'distinct'> & {
    select?: UserPermissionCountAggregateInputType | true;
  };

  export interface UserPermissionDelegate<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > {
    [K: symbol]: {
      types: Prisma.TypeMap<ExtArgs>['model']['UserPermission'];
      meta: { name: 'UserPermission' };
    };
    /**
     * Find zero or one UserPermission that matches the filter.
     * @param {UserPermissionFindUniqueArgs} args - Arguments to find a UserPermission
     * @example
     * // Get one UserPermission
     * const userPermission = await prisma.userPermission.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserPermissionFindUniqueArgs>(
      args: SelectSubset<T, UserPermissionFindUniqueArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<
        Prisma.$UserPermissionPayload<ExtArgs>,
        T,
        'findUnique'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find one UserPermission that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserPermissionFindUniqueOrThrowArgs} args - Arguments to find a UserPermission
     * @example
     * // Get one UserPermission
     * const userPermission = await prisma.userPermission.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserPermissionFindUniqueOrThrowArgs>(
      args: SelectSubset<T, UserPermissionFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<
        Prisma.$UserPermissionPayload<ExtArgs>,
        T,
        'findUniqueOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find the first UserPermission that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPermissionFindFirstArgs} args - Arguments to find a UserPermission
     * @example
     * // Get one UserPermission
     * const userPermission = await prisma.userPermission.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserPermissionFindFirstArgs>(
      args?: SelectSubset<T, UserPermissionFindFirstArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<
        Prisma.$UserPermissionPayload<ExtArgs>,
        T,
        'findFirst'
      > | null,
      null,
      ExtArgs
    >;

    /**
     * Find the first UserPermission that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPermissionFindFirstOrThrowArgs} args - Arguments to find a UserPermission
     * @example
     * // Get one UserPermission
     * const userPermission = await prisma.userPermission.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserPermissionFindFirstOrThrowArgs>(
      args?: SelectSubset<T, UserPermissionFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<
        Prisma.$UserPermissionPayload<ExtArgs>,
        T,
        'findFirstOrThrow'
      >,
      never,
      ExtArgs
    >;

    /**
     * Find zero or more UserPermissions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPermissionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserPermissions
     * const userPermissions = await prisma.userPermission.findMany()
     *
     * // Get first 10 UserPermissions
     * const userPermissions = await prisma.userPermission.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const userPermissionWithIdOnly = await prisma.userPermission.findMany({ select: { id: true } })
     *
     */
    findMany<T extends UserPermissionFindManyArgs>(
      args?: SelectSubset<T, UserPermissionFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<Prisma.$UserPermissionPayload<ExtArgs>, T, 'findMany'>
    >;

    /**
     * Create a UserPermission.
     * @param {UserPermissionCreateArgs} args - Arguments to create a UserPermission.
     * @example
     * // Create one UserPermission
     * const UserPermission = await prisma.userPermission.create({
     *   data: {
     *     // ... data to create a UserPermission
     *   }
     * })
     *
     */
    create<T extends UserPermissionCreateArgs>(
      args: SelectSubset<T, UserPermissionCreateArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<Prisma.$UserPermissionPayload<ExtArgs>, T, 'create'>,
      never,
      ExtArgs
    >;

    /**
     * Create many UserPermissions.
     * @param {UserPermissionCreateManyArgs} args - Arguments to create many UserPermissions.
     * @example
     * // Create many UserPermissions
     * const userPermission = await prisma.userPermission.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends UserPermissionCreateManyArgs>(
      args?: SelectSubset<T, UserPermissionCreateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many UserPermissions and returns the data saved in the database.
     * @param {UserPermissionCreateManyAndReturnArgs} args - Arguments to create many UserPermissions.
     * @example
     * // Create many UserPermissions
     * const userPermission = await prisma.userPermission.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many UserPermissions and only return the `id`
     * const userPermissionWithIdOnly = await prisma.userPermission.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends UserPermissionCreateManyAndReturnArgs>(
      args?: SelectSubset<T, UserPermissionCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<
      $Result.GetResult<
        Prisma.$UserPermissionPayload<ExtArgs>,
        T,
        'createManyAndReturn'
      >
    >;

    /**
     * Delete a UserPermission.
     * @param {UserPermissionDeleteArgs} args - Arguments to delete one UserPermission.
     * @example
     * // Delete one UserPermission
     * const UserPermission = await prisma.userPermission.delete({
     *   where: {
     *     // ... filter to delete one UserPermission
     *   }
     * })
     *
     */
    delete<T extends UserPermissionDeleteArgs>(
      args: SelectSubset<T, UserPermissionDeleteArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<Prisma.$UserPermissionPayload<ExtArgs>, T, 'delete'>,
      never,
      ExtArgs
    >;

    /**
     * Update one UserPermission.
     * @param {UserPermissionUpdateArgs} args - Arguments to update one UserPermission.
     * @example
     * // Update one UserPermission
     * const userPermission = await prisma.userPermission.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends UserPermissionUpdateArgs>(
      args: SelectSubset<T, UserPermissionUpdateArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<Prisma.$UserPermissionPayload<ExtArgs>, T, 'update'>,
      never,
      ExtArgs
    >;

    /**
     * Delete zero or more UserPermissions.
     * @param {UserPermissionDeleteManyArgs} args - Arguments to filter UserPermissions to delete.
     * @example
     * // Delete a few UserPermissions
     * const { count } = await prisma.userPermission.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends UserPermissionDeleteManyArgs>(
      args?: SelectSubset<T, UserPermissionDeleteManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more UserPermissions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPermissionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserPermissions
     * const userPermission = await prisma.userPermission.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends UserPermissionUpdateManyArgs>(
      args: SelectSubset<T, UserPermissionUpdateManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create or update one UserPermission.
     * @param {UserPermissionUpsertArgs} args - Arguments to update or create a UserPermission.
     * @example
     * // Update or create a UserPermission
     * const userPermission = await prisma.userPermission.upsert({
     *   create: {
     *     // ... data to create a UserPermission
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserPermission we want to update
     *   }
     * })
     */
    upsert<T extends UserPermissionUpsertArgs>(
      args: SelectSubset<T, UserPermissionUpsertArgs<ExtArgs>>,
    ): Prisma__UserPermissionClient<
      $Result.GetResult<Prisma.$UserPermissionPayload<ExtArgs>, T, 'upsert'>,
      never,
      ExtArgs
    >;

    /**
     * Count the number of UserPermissions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPermissionCountArgs} args - Arguments to filter UserPermissions to count.
     * @example
     * // Count the number of UserPermissions
     * const count = await prisma.userPermission.count({
     *   where: {
     *     // ... the filter for the UserPermissions we want to count
     *   }
     * })
     **/
    count<T extends UserPermissionCountArgs>(
      args?: Subset<T, UserPermissionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserPermissionCountAggregateOutputType>
        : number
    >;

    /**
     * Allows you to perform aggregations operations on a UserPermission.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPermissionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends UserPermissionAggregateArgs>(
      args: Subset<T, UserPermissionAggregateArgs>,
    ): Prisma.PrismaPromise<GetUserPermissionAggregateType<T>>;

    /**
     * Group by UserPermission.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPermissionGroupByArgs} args - Group by arguments.
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
      T extends UserPermissionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserPermissionGroupByArgs['orderBy'] }
        : { orderBy?: UserPermissionGroupByArgs['orderBy'] },
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
      args: SubsetIntersection<T, UserPermissionGroupByArgs, OrderByArg> &
        InputErrors,
    ): {} extends InputErrors
      ? GetUserPermissionGroupByPayload<T>
      : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the UserPermission model
     */
    readonly fields: UserPermissionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserPermission.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserPermissionClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    user<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow'>
      | Null,
      Null,
      ExtArgs
    >;
    granter<T extends UserDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, UserDefaultArgs<ExtArgs>>,
    ): Prisma__UserClient<
      | $Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, 'findUniqueOrThrow'>
      | Null,
      Null,
      ExtArgs
    >;
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
   * Fields of the UserPermission model
   */
  interface UserPermissionFieldRefs {
    readonly id: FieldRef<'UserPermission', 'String'>;
    readonly userId: FieldRef<'UserPermission', 'String'>;
    readonly tenantId: FieldRef<'UserPermission', 'String'>;
    readonly permission: FieldRef<'UserPermission', 'String'>;
    readonly effect: FieldRef<'UserPermission', 'PermissionEffect'>;
    readonly grantedBy: FieldRef<'UserPermission', 'String'>;
    readonly reason: FieldRef<'UserPermission', 'String'>;
    readonly createdAt: FieldRef<'UserPermission', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * UserPermission findUnique
   */
  export type UserPermissionFindUniqueArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * Filter, which UserPermission to fetch.
     */
    where: UserPermissionWhereUniqueInput;
  };

  /**
   * UserPermission findUniqueOrThrow
   */
  export type UserPermissionFindUniqueOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * Filter, which UserPermission to fetch.
     */
    where: UserPermissionWhereUniqueInput;
  };

  /**
   * UserPermission findFirst
   */
  export type UserPermissionFindFirstArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * Filter, which UserPermission to fetch.
     */
    where?: UserPermissionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UserPermissions to fetch.
     */
    orderBy?:
      | UserPermissionOrderByWithRelationInput
      | UserPermissionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for UserPermissions.
     */
    cursor?: UserPermissionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UserPermissions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UserPermissions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of UserPermissions.
     */
    distinct?: UserPermissionScalarFieldEnum | UserPermissionScalarFieldEnum[];
  };

  /**
   * UserPermission findFirstOrThrow
   */
  export type UserPermissionFindFirstOrThrowArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * Filter, which UserPermission to fetch.
     */
    where?: UserPermissionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UserPermissions to fetch.
     */
    orderBy?:
      | UserPermissionOrderByWithRelationInput
      | UserPermissionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for UserPermissions.
     */
    cursor?: UserPermissionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UserPermissions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UserPermissions.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of UserPermissions.
     */
    distinct?: UserPermissionScalarFieldEnum | UserPermissionScalarFieldEnum[];
  };

  /**
   * UserPermission findMany
   */
  export type UserPermissionFindManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * Filter, which UserPermissions to fetch.
     */
    where?: UserPermissionWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of UserPermissions to fetch.
     */
    orderBy?:
      | UserPermissionOrderByWithRelationInput
      | UserPermissionOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing UserPermissions.
     */
    cursor?: UserPermissionWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` UserPermissions from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` UserPermissions.
     */
    skip?: number;
    distinct?: UserPermissionScalarFieldEnum | UserPermissionScalarFieldEnum[];
  };

  /**
   * UserPermission create
   */
  export type UserPermissionCreateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * The data needed to create a UserPermission.
     */
    data: XOR<UserPermissionCreateInput, UserPermissionUncheckedCreateInput>;
  };

  /**
   * UserPermission createMany
   */
  export type UserPermissionCreateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to create many UserPermissions.
     */
    data: UserPermissionCreateManyInput | UserPermissionCreateManyInput[];
    skipDuplicates?: boolean;
  };

  /**
   * UserPermission createManyAndReturn
   */
  export type UserPermissionCreateManyAndReturnArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * The data used to create many UserPermissions.
     */
    data: UserPermissionCreateManyInput | UserPermissionCreateManyInput[];
    skipDuplicates?: boolean;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * UserPermission update
   */
  export type UserPermissionUpdateArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * The data needed to update a UserPermission.
     */
    data: XOR<UserPermissionUpdateInput, UserPermissionUncheckedUpdateInput>;
    /**
     * Choose, which UserPermission to update.
     */
    where: UserPermissionWhereUniqueInput;
  };

  /**
   * UserPermission updateMany
   */
  export type UserPermissionUpdateManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * The data used to update UserPermissions.
     */
    data: XOR<
      UserPermissionUpdateManyMutationInput,
      UserPermissionUncheckedUpdateManyInput
    >;
    /**
     * Filter which UserPermissions to update
     */
    where?: UserPermissionWhereInput;
  };

  /**
   * UserPermission upsert
   */
  export type UserPermissionUpsertArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * The filter to search for the UserPermission to update in case it exists.
     */
    where: UserPermissionWhereUniqueInput;
    /**
     * In case the UserPermission found by the `where` argument doesn't exist, create a new UserPermission with this data.
     */
    create: XOR<UserPermissionCreateInput, UserPermissionUncheckedCreateInput>;
    /**
     * In case the UserPermission was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserPermissionUpdateInput, UserPermissionUncheckedUpdateInput>;
  };

  /**
   * UserPermission delete
   */
  export type UserPermissionDeleteArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
    /**
     * Filter which UserPermission to delete.
     */
    where: UserPermissionWhereUniqueInput;
  };

  /**
   * UserPermission deleteMany
   */
  export type UserPermissionDeleteManyArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Filter which UserPermissions to delete
     */
    where?: UserPermissionWhereInput;
  };

  /**
   * UserPermission without action
   */
  export type UserPermissionDefaultArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = {
    /**
     * Select specific fields to fetch from the UserPermission
     */
    select?: UserPermissionSelect<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPermissionInclude<ExtArgs> | null;
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

  export const TenantScalarFieldEnum: {
    id: 'id';
    name: 'name';
    slug: 'slug';
    email: 'email';
    phone: 'phone';
    address: 'address';
    country: 'country';
    status: 'status';
    logoUrl: 'logoUrl';
    website: 'website';
    industry: 'industry';
    size: 'size';
    subscriptionId: 'subscriptionId';
    trialEndsAt: 'trialEndsAt';
    createdAt: 'createdAt';
    updatedAt: 'updatedAt';
  };

  export type TenantScalarFieldEnum =
    (typeof TenantScalarFieldEnum)[keyof typeof TenantScalarFieldEnum];

  export const UserScalarFieldEnum: {
    id: 'id';
    tenantId: 'tenantId';
    email: 'email';
    password: 'password';
    firstName: 'firstName';
    lastName: 'lastName';
    phone: 'phone';
    role: 'role';
    status: 'status';
    avatarUrl: 'avatarUrl';
    isMfaEnabled: 'isMfaEnabled';
    mfaMethod: 'mfaMethod';
    mfaSecret: 'mfaSecret';
    forcePasswordReset: 'forcePasswordReset';
    inviteToken: 'inviteToken';
    inviteExpiresAt: 'inviteExpiresAt';
    emailVerifiedAt: 'emailVerifiedAt';
    lastLoginAt: 'lastLoginAt';
    passwordChangedAt: 'passwordChangedAt';
    createdAt: 'createdAt';
    updatedAt: 'updatedAt';
  };

  export type UserScalarFieldEnum =
    (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];

  export const RefreshTokenScalarFieldEnum: {
    id: 'id';
    userId: 'userId';
    token: 'token';
    expiresAt: 'expiresAt';
    ipAddress: 'ipAddress';
    userAgent: 'userAgent';
    deviceName: 'deviceName';
    deviceId: 'deviceId';
    isRevoked: 'isRevoked';
    createdAt: 'createdAt';
  };

  export type RefreshTokenScalarFieldEnum =
    (typeof RefreshTokenScalarFieldEnum)[keyof typeof RefreshTokenScalarFieldEnum];

  export const OtpCodeScalarFieldEnum: {
    id: 'id';
    userId: 'userId';
    type: 'type';
    code: 'code';
    expiresAt: 'expiresAt';
    usedAt: 'usedAt';
    createdAt: 'createdAt';
  };

  export type OtpCodeScalarFieldEnum =
    (typeof OtpCodeScalarFieldEnum)[keyof typeof OtpCodeScalarFieldEnum];

  export const SocialAccountScalarFieldEnum: {
    id: 'id';
    userId: 'userId';
    provider: 'provider';
    providerId: 'providerId';
    email: 'email';
    createdAt: 'createdAt';
  };

  export type SocialAccountScalarFieldEnum =
    (typeof SocialAccountScalarFieldEnum)[keyof typeof SocialAccountScalarFieldEnum];

  export const UserPermissionScalarFieldEnum: {
    id: 'id';
    userId: 'userId';
    tenantId: 'tenantId';
    permission: 'permission';
    effect: 'effect';
    grantedBy: 'grantedBy';
    reason: 'reason';
    createdAt: 'createdAt';
  };

  export type UserPermissionScalarFieldEnum =
    (typeof UserPermissionScalarFieldEnum)[keyof typeof UserPermissionScalarFieldEnum];

  export const SortOrder: {
    asc: 'asc';
    desc: 'desc';
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

  export const QueryMode: {
    default: 'default';
    insensitive: 'insensitive';
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];

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
   * Reference to a field of type 'TenantStatus'
   */
  export type EnumTenantStatusFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'TenantStatus'
  >;

  /**
   * Reference to a field of type 'TenantStatus[]'
   */
  export type ListEnumTenantStatusFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'TenantStatus[]'>;

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
   * Reference to a field of type 'UserRole'
   */
  export type EnumUserRoleFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'UserRole'
  >;

  /**
   * Reference to a field of type 'UserRole[]'
   */
  export type ListEnumUserRoleFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'UserRole[]'
  >;

  /**
   * Reference to a field of type 'UserStatus'
   */
  export type EnumUserStatusFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'UserStatus'
  >;

  /**
   * Reference to a field of type 'UserStatus[]'
   */
  export type ListEnumUserStatusFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'UserStatus[]'
  >;

  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'Boolean'
  >;

  /**
   * Reference to a field of type 'MfaMethod'
   */
  export type EnumMfaMethodFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'MfaMethod'
  >;

  /**
   * Reference to a field of type 'MfaMethod[]'
   */
  export type ListEnumMfaMethodFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'MfaMethod[]'
  >;

  /**
   * Reference to a field of type 'OtpType'
   */
  export type EnumOtpTypeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'OtpType'
  >;

  /**
   * Reference to a field of type 'OtpType[]'
   */
  export type ListEnumOtpTypeFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'OtpType[]'
  >;

  /**
   * Reference to a field of type 'SocialProvider'
   */
  export type EnumSocialProviderFieldRefInput<$PrismaModel> = FieldRefInputType<
    $PrismaModel,
    'SocialProvider'
  >;

  /**
   * Reference to a field of type 'SocialProvider[]'
   */
  export type ListEnumSocialProviderFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'SocialProvider[]'>;

  /**
   * Reference to a field of type 'PermissionEffect'
   */
  export type EnumPermissionEffectFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'PermissionEffect'>;

  /**
   * Reference to a field of type 'PermissionEffect[]'
   */
  export type ListEnumPermissionEffectFieldRefInput<$PrismaModel> =
    FieldRefInputType<$PrismaModel, 'PermissionEffect[]'>;

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

  export type TenantWhereInput = {
    AND?: TenantWhereInput | TenantWhereInput[];
    OR?: TenantWhereInput[];
    NOT?: TenantWhereInput | TenantWhereInput[];
    id?: StringFilter<'Tenant'> | string;
    name?: StringFilter<'Tenant'> | string;
    slug?: StringFilter<'Tenant'> | string;
    email?: StringFilter<'Tenant'> | string;
    phone?: StringNullableFilter<'Tenant'> | string | null;
    address?: StringNullableFilter<'Tenant'> | string | null;
    country?: StringFilter<'Tenant'> | string;
    status?: EnumTenantStatusFilter<'Tenant'> | $Enums.TenantStatus;
    logoUrl?: StringNullableFilter<'Tenant'> | string | null;
    website?: StringNullableFilter<'Tenant'> | string | null;
    industry?: StringNullableFilter<'Tenant'> | string | null;
    size?: StringNullableFilter<'Tenant'> | string | null;
    subscriptionId?: StringNullableFilter<'Tenant'> | string | null;
    trialEndsAt?: DateTimeNullableFilter<'Tenant'> | Date | string | null;
    createdAt?: DateTimeFilter<'Tenant'> | Date | string;
    updatedAt?: DateTimeFilter<'Tenant'> | Date | string;
    users?: UserListRelationFilter;
  };

  export type TenantOrderByWithRelationInput = {
    id?: SortOrder;
    name?: SortOrder;
    slug?: SortOrder;
    email?: SortOrder;
    phone?: SortOrderInput | SortOrder;
    address?: SortOrderInput | SortOrder;
    country?: SortOrder;
    status?: SortOrder;
    logoUrl?: SortOrderInput | SortOrder;
    website?: SortOrderInput | SortOrder;
    industry?: SortOrderInput | SortOrder;
    size?: SortOrderInput | SortOrder;
    subscriptionId?: SortOrderInput | SortOrder;
    trialEndsAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    users?: UserOrderByRelationAggregateInput;
  };

  export type TenantWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      slug?: string;
      email?: string;
      AND?: TenantWhereInput | TenantWhereInput[];
      OR?: TenantWhereInput[];
      NOT?: TenantWhereInput | TenantWhereInput[];
      name?: StringFilter<'Tenant'> | string;
      phone?: StringNullableFilter<'Tenant'> | string | null;
      address?: StringNullableFilter<'Tenant'> | string | null;
      country?: StringFilter<'Tenant'> | string;
      status?: EnumTenantStatusFilter<'Tenant'> | $Enums.TenantStatus;
      logoUrl?: StringNullableFilter<'Tenant'> | string | null;
      website?: StringNullableFilter<'Tenant'> | string | null;
      industry?: StringNullableFilter<'Tenant'> | string | null;
      size?: StringNullableFilter<'Tenant'> | string | null;
      subscriptionId?: StringNullableFilter<'Tenant'> | string | null;
      trialEndsAt?: DateTimeNullableFilter<'Tenant'> | Date | string | null;
      createdAt?: DateTimeFilter<'Tenant'> | Date | string;
      updatedAt?: DateTimeFilter<'Tenant'> | Date | string;
      users?: UserListRelationFilter;
    },
    'id' | 'slug' | 'email'
  >;

  export type TenantOrderByWithAggregationInput = {
    id?: SortOrder;
    name?: SortOrder;
    slug?: SortOrder;
    email?: SortOrder;
    phone?: SortOrderInput | SortOrder;
    address?: SortOrderInput | SortOrder;
    country?: SortOrder;
    status?: SortOrder;
    logoUrl?: SortOrderInput | SortOrder;
    website?: SortOrderInput | SortOrder;
    industry?: SortOrderInput | SortOrder;
    size?: SortOrderInput | SortOrder;
    subscriptionId?: SortOrderInput | SortOrder;
    trialEndsAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: TenantCountOrderByAggregateInput;
    _max?: TenantMaxOrderByAggregateInput;
    _min?: TenantMinOrderByAggregateInput;
  };

  export type TenantScalarWhereWithAggregatesInput = {
    AND?:
      | TenantScalarWhereWithAggregatesInput
      | TenantScalarWhereWithAggregatesInput[];
    OR?: TenantScalarWhereWithAggregatesInput[];
    NOT?:
      | TenantScalarWhereWithAggregatesInput
      | TenantScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'Tenant'> | string;
    name?: StringWithAggregatesFilter<'Tenant'> | string;
    slug?: StringWithAggregatesFilter<'Tenant'> | string;
    email?: StringWithAggregatesFilter<'Tenant'> | string;
    phone?: StringNullableWithAggregatesFilter<'Tenant'> | string | null;
    address?: StringNullableWithAggregatesFilter<'Tenant'> | string | null;
    country?: StringWithAggregatesFilter<'Tenant'> | string;
    status?:
      | EnumTenantStatusWithAggregatesFilter<'Tenant'>
      | $Enums.TenantStatus;
    logoUrl?: StringNullableWithAggregatesFilter<'Tenant'> | string | null;
    website?: StringNullableWithAggregatesFilter<'Tenant'> | string | null;
    industry?: StringNullableWithAggregatesFilter<'Tenant'> | string | null;
    size?: StringNullableWithAggregatesFilter<'Tenant'> | string | null;
    subscriptionId?:
      | StringNullableWithAggregatesFilter<'Tenant'>
      | string
      | null;
    trialEndsAt?:
      | DateTimeNullableWithAggregatesFilter<'Tenant'>
      | Date
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<'Tenant'> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<'Tenant'> | Date | string;
  };

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[];
    OR?: UserWhereInput[];
    NOT?: UserWhereInput | UserWhereInput[];
    id?: StringFilter<'User'> | string;
    tenantId?: StringFilter<'User'> | string;
    email?: StringFilter<'User'> | string;
    password?: StringNullableFilter<'User'> | string | null;
    firstName?: StringFilter<'User'> | string;
    lastName?: StringFilter<'User'> | string;
    phone?: StringNullableFilter<'User'> | string | null;
    role?: EnumUserRoleFilter<'User'> | $Enums.UserRole;
    status?: EnumUserStatusFilter<'User'> | $Enums.UserStatus;
    avatarUrl?: StringNullableFilter<'User'> | string | null;
    isMfaEnabled?: BoolFilter<'User'> | boolean;
    mfaMethod?: EnumMfaMethodNullableFilter<'User'> | $Enums.MfaMethod | null;
    mfaSecret?: StringNullableFilter<'User'> | string | null;
    forcePasswordReset?: BoolFilter<'User'> | boolean;
    inviteToken?: StringNullableFilter<'User'> | string | null;
    inviteExpiresAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    emailVerifiedAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    lastLoginAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    passwordChangedAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    createdAt?: DateTimeFilter<'User'> | Date | string;
    updatedAt?: DateTimeFilter<'User'> | Date | string;
    tenant?: XOR<TenantRelationFilter, TenantWhereInput>;
    refreshTokens?: RefreshTokenListRelationFilter;
    otpCodes?: OtpCodeListRelationFilter;
    socialAccounts?: SocialAccountListRelationFilter;
    userPermissions?: UserPermissionListRelationFilter;
    grantedPermissions?: UserPermissionListRelationFilter;
  };

  export type UserOrderByWithRelationInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    email?: SortOrder;
    password?: SortOrderInput | SortOrder;
    firstName?: SortOrder;
    lastName?: SortOrder;
    phone?: SortOrderInput | SortOrder;
    role?: SortOrder;
    status?: SortOrder;
    avatarUrl?: SortOrderInput | SortOrder;
    isMfaEnabled?: SortOrder;
    mfaMethod?: SortOrderInput | SortOrder;
    mfaSecret?: SortOrderInput | SortOrder;
    forcePasswordReset?: SortOrder;
    inviteToken?: SortOrderInput | SortOrder;
    inviteExpiresAt?: SortOrderInput | SortOrder;
    emailVerifiedAt?: SortOrderInput | SortOrder;
    lastLoginAt?: SortOrderInput | SortOrder;
    passwordChangedAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    tenant?: TenantOrderByWithRelationInput;
    refreshTokens?: RefreshTokenOrderByRelationAggregateInput;
    otpCodes?: OtpCodeOrderByRelationAggregateInput;
    socialAccounts?: SocialAccountOrderByRelationAggregateInput;
    userPermissions?: UserPermissionOrderByRelationAggregateInput;
    grantedPermissions?: UserPermissionOrderByRelationAggregateInput;
  };

  export type UserWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      inviteToken?: string;
      tenantId_email?: UserTenantIdEmailCompoundUniqueInput;
      AND?: UserWhereInput | UserWhereInput[];
      OR?: UserWhereInput[];
      NOT?: UserWhereInput | UserWhereInput[];
      tenantId?: StringFilter<'User'> | string;
      email?: StringFilter<'User'> | string;
      password?: StringNullableFilter<'User'> | string | null;
      firstName?: StringFilter<'User'> | string;
      lastName?: StringFilter<'User'> | string;
      phone?: StringNullableFilter<'User'> | string | null;
      role?: EnumUserRoleFilter<'User'> | $Enums.UserRole;
      status?: EnumUserStatusFilter<'User'> | $Enums.UserStatus;
      avatarUrl?: StringNullableFilter<'User'> | string | null;
      isMfaEnabled?: BoolFilter<'User'> | boolean;
      mfaMethod?: EnumMfaMethodNullableFilter<'User'> | $Enums.MfaMethod | null;
      mfaSecret?: StringNullableFilter<'User'> | string | null;
      forcePasswordReset?: BoolFilter<'User'> | boolean;
      inviteExpiresAt?: DateTimeNullableFilter<'User'> | Date | string | null;
      emailVerifiedAt?: DateTimeNullableFilter<'User'> | Date | string | null;
      lastLoginAt?: DateTimeNullableFilter<'User'> | Date | string | null;
      passwordChangedAt?: DateTimeNullableFilter<'User'> | Date | string | null;
      createdAt?: DateTimeFilter<'User'> | Date | string;
      updatedAt?: DateTimeFilter<'User'> | Date | string;
      tenant?: XOR<TenantRelationFilter, TenantWhereInput>;
      refreshTokens?: RefreshTokenListRelationFilter;
      otpCodes?: OtpCodeListRelationFilter;
      socialAccounts?: SocialAccountListRelationFilter;
      userPermissions?: UserPermissionListRelationFilter;
      grantedPermissions?: UserPermissionListRelationFilter;
    },
    'id' | 'inviteToken' | 'tenantId_email'
  >;

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    email?: SortOrder;
    password?: SortOrderInput | SortOrder;
    firstName?: SortOrder;
    lastName?: SortOrder;
    phone?: SortOrderInput | SortOrder;
    role?: SortOrder;
    status?: SortOrder;
    avatarUrl?: SortOrderInput | SortOrder;
    isMfaEnabled?: SortOrder;
    mfaMethod?: SortOrderInput | SortOrder;
    mfaSecret?: SortOrderInput | SortOrder;
    forcePasswordReset?: SortOrder;
    inviteToken?: SortOrderInput | SortOrder;
    inviteExpiresAt?: SortOrderInput | SortOrder;
    emailVerifiedAt?: SortOrderInput | SortOrder;
    lastLoginAt?: SortOrderInput | SortOrder;
    passwordChangedAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
    _count?: UserCountOrderByAggregateInput;
    _max?: UserMaxOrderByAggregateInput;
    _min?: UserMinOrderByAggregateInput;
  };

  export type UserScalarWhereWithAggregatesInput = {
    AND?:
      | UserScalarWhereWithAggregatesInput
      | UserScalarWhereWithAggregatesInput[];
    OR?: UserScalarWhereWithAggregatesInput[];
    NOT?:
      | UserScalarWhereWithAggregatesInput
      | UserScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'User'> | string;
    tenantId?: StringWithAggregatesFilter<'User'> | string;
    email?: StringWithAggregatesFilter<'User'> | string;
    password?: StringNullableWithAggregatesFilter<'User'> | string | null;
    firstName?: StringWithAggregatesFilter<'User'> | string;
    lastName?: StringWithAggregatesFilter<'User'> | string;
    phone?: StringNullableWithAggregatesFilter<'User'> | string | null;
    role?: EnumUserRoleWithAggregatesFilter<'User'> | $Enums.UserRole;
    status?: EnumUserStatusWithAggregatesFilter<'User'> | $Enums.UserStatus;
    avatarUrl?: StringNullableWithAggregatesFilter<'User'> | string | null;
    isMfaEnabled?: BoolWithAggregatesFilter<'User'> | boolean;
    mfaMethod?:
      | EnumMfaMethodNullableWithAggregatesFilter<'User'>
      | $Enums.MfaMethod
      | null;
    mfaSecret?: StringNullableWithAggregatesFilter<'User'> | string | null;
    forcePasswordReset?: BoolWithAggregatesFilter<'User'> | boolean;
    inviteToken?: StringNullableWithAggregatesFilter<'User'> | string | null;
    inviteExpiresAt?:
      | DateTimeNullableWithAggregatesFilter<'User'>
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | DateTimeNullableWithAggregatesFilter<'User'>
      | Date
      | string
      | null;
    lastLoginAt?:
      | DateTimeNullableWithAggregatesFilter<'User'>
      | Date
      | string
      | null;
    passwordChangedAt?:
      | DateTimeNullableWithAggregatesFilter<'User'>
      | Date
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<'User'> | Date | string;
    updatedAt?: DateTimeWithAggregatesFilter<'User'> | Date | string;
  };

  export type RefreshTokenWhereInput = {
    AND?: RefreshTokenWhereInput | RefreshTokenWhereInput[];
    OR?: RefreshTokenWhereInput[];
    NOT?: RefreshTokenWhereInput | RefreshTokenWhereInput[];
    id?: StringFilter<'RefreshToken'> | string;
    userId?: StringFilter<'RefreshToken'> | string;
    token?: StringFilter<'RefreshToken'> | string;
    expiresAt?: DateTimeFilter<'RefreshToken'> | Date | string;
    ipAddress?: StringNullableFilter<'RefreshToken'> | string | null;
    userAgent?: StringNullableFilter<'RefreshToken'> | string | null;
    deviceName?: StringNullableFilter<'RefreshToken'> | string | null;
    deviceId?: StringNullableFilter<'RefreshToken'> | string | null;
    isRevoked?: BoolFilter<'RefreshToken'> | boolean;
    createdAt?: DateTimeFilter<'RefreshToken'> | Date | string;
    user?: XOR<UserRelationFilter, UserWhereInput>;
  };

  export type RefreshTokenOrderByWithRelationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    token?: SortOrder;
    expiresAt?: SortOrder;
    ipAddress?: SortOrderInput | SortOrder;
    userAgent?: SortOrderInput | SortOrder;
    deviceName?: SortOrderInput | SortOrder;
    deviceId?: SortOrderInput | SortOrder;
    isRevoked?: SortOrder;
    createdAt?: SortOrder;
    user?: UserOrderByWithRelationInput;
  };

  export type RefreshTokenWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      token?: string;
      AND?: RefreshTokenWhereInput | RefreshTokenWhereInput[];
      OR?: RefreshTokenWhereInput[];
      NOT?: RefreshTokenWhereInput | RefreshTokenWhereInput[];
      userId?: StringFilter<'RefreshToken'> | string;
      expiresAt?: DateTimeFilter<'RefreshToken'> | Date | string;
      ipAddress?: StringNullableFilter<'RefreshToken'> | string | null;
      userAgent?: StringNullableFilter<'RefreshToken'> | string | null;
      deviceName?: StringNullableFilter<'RefreshToken'> | string | null;
      deviceId?: StringNullableFilter<'RefreshToken'> | string | null;
      isRevoked?: BoolFilter<'RefreshToken'> | boolean;
      createdAt?: DateTimeFilter<'RefreshToken'> | Date | string;
      user?: XOR<UserRelationFilter, UserWhereInput>;
    },
    'id' | 'token'
  >;

  export type RefreshTokenOrderByWithAggregationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    token?: SortOrder;
    expiresAt?: SortOrder;
    ipAddress?: SortOrderInput | SortOrder;
    userAgent?: SortOrderInput | SortOrder;
    deviceName?: SortOrderInput | SortOrder;
    deviceId?: SortOrderInput | SortOrder;
    isRevoked?: SortOrder;
    createdAt?: SortOrder;
    _count?: RefreshTokenCountOrderByAggregateInput;
    _max?: RefreshTokenMaxOrderByAggregateInput;
    _min?: RefreshTokenMinOrderByAggregateInput;
  };

  export type RefreshTokenScalarWhereWithAggregatesInput = {
    AND?:
      | RefreshTokenScalarWhereWithAggregatesInput
      | RefreshTokenScalarWhereWithAggregatesInput[];
    OR?: RefreshTokenScalarWhereWithAggregatesInput[];
    NOT?:
      | RefreshTokenScalarWhereWithAggregatesInput
      | RefreshTokenScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'RefreshToken'> | string;
    userId?: StringWithAggregatesFilter<'RefreshToken'> | string;
    token?: StringWithAggregatesFilter<'RefreshToken'> | string;
    expiresAt?: DateTimeWithAggregatesFilter<'RefreshToken'> | Date | string;
    ipAddress?:
      | StringNullableWithAggregatesFilter<'RefreshToken'>
      | string
      | null;
    userAgent?:
      | StringNullableWithAggregatesFilter<'RefreshToken'>
      | string
      | null;
    deviceName?:
      | StringNullableWithAggregatesFilter<'RefreshToken'>
      | string
      | null;
    deviceId?:
      | StringNullableWithAggregatesFilter<'RefreshToken'>
      | string
      | null;
    isRevoked?: BoolWithAggregatesFilter<'RefreshToken'> | boolean;
    createdAt?: DateTimeWithAggregatesFilter<'RefreshToken'> | Date | string;
  };

  export type OtpCodeWhereInput = {
    AND?: OtpCodeWhereInput | OtpCodeWhereInput[];
    OR?: OtpCodeWhereInput[];
    NOT?: OtpCodeWhereInput | OtpCodeWhereInput[];
    id?: StringFilter<'OtpCode'> | string;
    userId?: StringFilter<'OtpCode'> | string;
    type?: EnumOtpTypeFilter<'OtpCode'> | $Enums.OtpType;
    code?: StringFilter<'OtpCode'> | string;
    expiresAt?: DateTimeFilter<'OtpCode'> | Date | string;
    usedAt?: DateTimeNullableFilter<'OtpCode'> | Date | string | null;
    createdAt?: DateTimeFilter<'OtpCode'> | Date | string;
    user?: XOR<UserRelationFilter, UserWhereInput>;
  };

  export type OtpCodeOrderByWithRelationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    code?: SortOrder;
    expiresAt?: SortOrder;
    usedAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    user?: UserOrderByWithRelationInput;
  };

  export type OtpCodeWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      AND?: OtpCodeWhereInput | OtpCodeWhereInput[];
      OR?: OtpCodeWhereInput[];
      NOT?: OtpCodeWhereInput | OtpCodeWhereInput[];
      userId?: StringFilter<'OtpCode'> | string;
      type?: EnumOtpTypeFilter<'OtpCode'> | $Enums.OtpType;
      code?: StringFilter<'OtpCode'> | string;
      expiresAt?: DateTimeFilter<'OtpCode'> | Date | string;
      usedAt?: DateTimeNullableFilter<'OtpCode'> | Date | string | null;
      createdAt?: DateTimeFilter<'OtpCode'> | Date | string;
      user?: XOR<UserRelationFilter, UserWhereInput>;
    },
    'id'
  >;

  export type OtpCodeOrderByWithAggregationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    code?: SortOrder;
    expiresAt?: SortOrder;
    usedAt?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    _count?: OtpCodeCountOrderByAggregateInput;
    _max?: OtpCodeMaxOrderByAggregateInput;
    _min?: OtpCodeMinOrderByAggregateInput;
  };

  export type OtpCodeScalarWhereWithAggregatesInput = {
    AND?:
      | OtpCodeScalarWhereWithAggregatesInput
      | OtpCodeScalarWhereWithAggregatesInput[];
    OR?: OtpCodeScalarWhereWithAggregatesInput[];
    NOT?:
      | OtpCodeScalarWhereWithAggregatesInput
      | OtpCodeScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'OtpCode'> | string;
    userId?: StringWithAggregatesFilter<'OtpCode'> | string;
    type?: EnumOtpTypeWithAggregatesFilter<'OtpCode'> | $Enums.OtpType;
    code?: StringWithAggregatesFilter<'OtpCode'> | string;
    expiresAt?: DateTimeWithAggregatesFilter<'OtpCode'> | Date | string;
    usedAt?:
      | DateTimeNullableWithAggregatesFilter<'OtpCode'>
      | Date
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<'OtpCode'> | Date | string;
  };

  export type SocialAccountWhereInput = {
    AND?: SocialAccountWhereInput | SocialAccountWhereInput[];
    OR?: SocialAccountWhereInput[];
    NOT?: SocialAccountWhereInput | SocialAccountWhereInput[];
    id?: StringFilter<'SocialAccount'> | string;
    userId?: StringFilter<'SocialAccount'> | string;
    provider?:
      | EnumSocialProviderFilter<'SocialAccount'>
      | $Enums.SocialProvider;
    providerId?: StringFilter<'SocialAccount'> | string;
    email?: StringNullableFilter<'SocialAccount'> | string | null;
    createdAt?: DateTimeFilter<'SocialAccount'> | Date | string;
    user?: XOR<UserRelationFilter, UserWhereInput>;
  };

  export type SocialAccountOrderByWithRelationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    provider?: SortOrder;
    providerId?: SortOrder;
    email?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    user?: UserOrderByWithRelationInput;
  };

  export type SocialAccountWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      provider_providerId?: SocialAccountProviderProviderIdCompoundUniqueInput;
      AND?: SocialAccountWhereInput | SocialAccountWhereInput[];
      OR?: SocialAccountWhereInput[];
      NOT?: SocialAccountWhereInput | SocialAccountWhereInput[];
      userId?: StringFilter<'SocialAccount'> | string;
      provider?:
        | EnumSocialProviderFilter<'SocialAccount'>
        | $Enums.SocialProvider;
      providerId?: StringFilter<'SocialAccount'> | string;
      email?: StringNullableFilter<'SocialAccount'> | string | null;
      createdAt?: DateTimeFilter<'SocialAccount'> | Date | string;
      user?: XOR<UserRelationFilter, UserWhereInput>;
    },
    'id' | 'provider_providerId'
  >;

  export type SocialAccountOrderByWithAggregationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    provider?: SortOrder;
    providerId?: SortOrder;
    email?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    _count?: SocialAccountCountOrderByAggregateInput;
    _max?: SocialAccountMaxOrderByAggregateInput;
    _min?: SocialAccountMinOrderByAggregateInput;
  };

  export type SocialAccountScalarWhereWithAggregatesInput = {
    AND?:
      | SocialAccountScalarWhereWithAggregatesInput
      | SocialAccountScalarWhereWithAggregatesInput[];
    OR?: SocialAccountScalarWhereWithAggregatesInput[];
    NOT?:
      | SocialAccountScalarWhereWithAggregatesInput
      | SocialAccountScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'SocialAccount'> | string;
    userId?: StringWithAggregatesFilter<'SocialAccount'> | string;
    provider?:
      | EnumSocialProviderWithAggregatesFilter<'SocialAccount'>
      | $Enums.SocialProvider;
    providerId?: StringWithAggregatesFilter<'SocialAccount'> | string;
    email?: StringNullableWithAggregatesFilter<'SocialAccount'> | string | null;
    createdAt?: DateTimeWithAggregatesFilter<'SocialAccount'> | Date | string;
  };

  export type UserPermissionWhereInput = {
    AND?: UserPermissionWhereInput | UserPermissionWhereInput[];
    OR?: UserPermissionWhereInput[];
    NOT?: UserPermissionWhereInput | UserPermissionWhereInput[];
    id?: StringFilter<'UserPermission'> | string;
    userId?: StringFilter<'UserPermission'> | string;
    tenantId?: StringFilter<'UserPermission'> | string;
    permission?: StringFilter<'UserPermission'> | string;
    effect?:
      | EnumPermissionEffectFilter<'UserPermission'>
      | $Enums.PermissionEffect;
    grantedBy?: StringFilter<'UserPermission'> | string;
    reason?: StringNullableFilter<'UserPermission'> | string | null;
    createdAt?: DateTimeFilter<'UserPermission'> | Date | string;
    user?: XOR<UserRelationFilter, UserWhereInput>;
    granter?: XOR<UserRelationFilter, UserWhereInput>;
  };

  export type UserPermissionOrderByWithRelationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    tenantId?: SortOrder;
    permission?: SortOrder;
    effect?: SortOrder;
    grantedBy?: SortOrder;
    reason?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    user?: UserOrderByWithRelationInput;
    granter?: UserOrderByWithRelationInput;
  };

  export type UserPermissionWhereUniqueInput = Prisma.AtLeast<
    {
      id?: string;
      userId_permission?: UserPermissionUserIdPermissionCompoundUniqueInput;
      AND?: UserPermissionWhereInput | UserPermissionWhereInput[];
      OR?: UserPermissionWhereInput[];
      NOT?: UserPermissionWhereInput | UserPermissionWhereInput[];
      userId?: StringFilter<'UserPermission'> | string;
      tenantId?: StringFilter<'UserPermission'> | string;
      permission?: StringFilter<'UserPermission'> | string;
      effect?:
        | EnumPermissionEffectFilter<'UserPermission'>
        | $Enums.PermissionEffect;
      grantedBy?: StringFilter<'UserPermission'> | string;
      reason?: StringNullableFilter<'UserPermission'> | string | null;
      createdAt?: DateTimeFilter<'UserPermission'> | Date | string;
      user?: XOR<UserRelationFilter, UserWhereInput>;
      granter?: XOR<UserRelationFilter, UserWhereInput>;
    },
    'id' | 'userId_permission'
  >;

  export type UserPermissionOrderByWithAggregationInput = {
    id?: SortOrder;
    userId?: SortOrder;
    tenantId?: SortOrder;
    permission?: SortOrder;
    effect?: SortOrder;
    grantedBy?: SortOrder;
    reason?: SortOrderInput | SortOrder;
    createdAt?: SortOrder;
    _count?: UserPermissionCountOrderByAggregateInput;
    _max?: UserPermissionMaxOrderByAggregateInput;
    _min?: UserPermissionMinOrderByAggregateInput;
  };

  export type UserPermissionScalarWhereWithAggregatesInput = {
    AND?:
      | UserPermissionScalarWhereWithAggregatesInput
      | UserPermissionScalarWhereWithAggregatesInput[];
    OR?: UserPermissionScalarWhereWithAggregatesInput[];
    NOT?:
      | UserPermissionScalarWhereWithAggregatesInput
      | UserPermissionScalarWhereWithAggregatesInput[];
    id?: StringWithAggregatesFilter<'UserPermission'> | string;
    userId?: StringWithAggregatesFilter<'UserPermission'> | string;
    tenantId?: StringWithAggregatesFilter<'UserPermission'> | string;
    permission?: StringWithAggregatesFilter<'UserPermission'> | string;
    effect?:
      | EnumPermissionEffectWithAggregatesFilter<'UserPermission'>
      | $Enums.PermissionEffect;
    grantedBy?: StringWithAggregatesFilter<'UserPermission'> | string;
    reason?:
      | StringNullableWithAggregatesFilter<'UserPermission'>
      | string
      | null;
    createdAt?: DateTimeWithAggregatesFilter<'UserPermission'> | Date | string;
  };

  export type TenantCreateInput = {
    id?: string;
    name: string;
    slug: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    country?: string;
    status?: $Enums.TenantStatus;
    logoUrl?: string | null;
    website?: string | null;
    industry?: string | null;
    size?: string | null;
    subscriptionId?: string | null;
    trialEndsAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    users?: UserCreateNestedManyWithoutTenantInput;
  };

  export type TenantUncheckedCreateInput = {
    id?: string;
    name: string;
    slug: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    country?: string;
    status?: $Enums.TenantStatus;
    logoUrl?: string | null;
    website?: string | null;
    industry?: string | null;
    size?: string | null;
    subscriptionId?: string | null;
    trialEndsAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    users?: UserUncheckedCreateNestedManyWithoutTenantInput;
  };

  export type TenantUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    slug?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    address?: NullableStringFieldUpdateOperationsInput | string | null;
    country?: StringFieldUpdateOperationsInput | string;
    status?: EnumTenantStatusFieldUpdateOperationsInput | $Enums.TenantStatus;
    logoUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    website?: NullableStringFieldUpdateOperationsInput | string | null;
    industry?: NullableStringFieldUpdateOperationsInput | string | null;
    size?: NullableStringFieldUpdateOperationsInput | string | null;
    subscriptionId?: NullableStringFieldUpdateOperationsInput | string | null;
    trialEndsAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    users?: UserUpdateManyWithoutTenantNestedInput;
  };

  export type TenantUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    slug?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    address?: NullableStringFieldUpdateOperationsInput | string | null;
    country?: StringFieldUpdateOperationsInput | string;
    status?: EnumTenantStatusFieldUpdateOperationsInput | $Enums.TenantStatus;
    logoUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    website?: NullableStringFieldUpdateOperationsInput | string | null;
    industry?: NullableStringFieldUpdateOperationsInput | string | null;
    size?: NullableStringFieldUpdateOperationsInput | string | null;
    subscriptionId?: NullableStringFieldUpdateOperationsInput | string | null;
    trialEndsAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    users?: UserUncheckedUpdateManyWithoutTenantNestedInput;
  };

  export type TenantCreateManyInput = {
    id?: string;
    name: string;
    slug: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    country?: string;
    status?: $Enums.TenantStatus;
    logoUrl?: string | null;
    website?: string | null;
    industry?: string | null;
    size?: string | null;
    subscriptionId?: string | null;
    trialEndsAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type TenantUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    slug?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    address?: NullableStringFieldUpdateOperationsInput | string | null;
    country?: StringFieldUpdateOperationsInput | string;
    status?: EnumTenantStatusFieldUpdateOperationsInput | $Enums.TenantStatus;
    logoUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    website?: NullableStringFieldUpdateOperationsInput | string | null;
    industry?: NullableStringFieldUpdateOperationsInput | string | null;
    size?: NullableStringFieldUpdateOperationsInput | string | null;
    subscriptionId?: NullableStringFieldUpdateOperationsInput | string | null;
    trialEndsAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type TenantUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    slug?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    address?: NullableStringFieldUpdateOperationsInput | string | null;
    country?: StringFieldUpdateOperationsInput | string;
    status?: EnumTenantStatusFieldUpdateOperationsInput | $Enums.TenantStatus;
    logoUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    website?: NullableStringFieldUpdateOperationsInput | string | null;
    industry?: NullableStringFieldUpdateOperationsInput | string | null;
    size?: NullableStringFieldUpdateOperationsInput | string | null;
    subscriptionId?: NullableStringFieldUpdateOperationsInput | string | null;
    trialEndsAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserCreateInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenant: TenantCreateNestedOneWithoutUsersInput;
    refreshTokens?: RefreshTokenCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionCreateNestedManyWithoutGranterInput;
  };

  export type UserUncheckedCreateInput = {
    id?: string;
    tenantId: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    refreshTokens?: RefreshTokenUncheckedCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeUncheckedCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountUncheckedCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionUncheckedCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionUncheckedCreateNestedManyWithoutGranterInput;
  };

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenant?: TenantUpdateOneRequiredWithoutUsersNestedInput;
    refreshTokens?: RefreshTokenUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUpdateManyWithoutGranterNestedInput;
  };

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    refreshTokens?: RefreshTokenUncheckedUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUncheckedUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUncheckedUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUncheckedUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUncheckedUpdateManyWithoutGranterNestedInput;
  };

  export type UserCreateManyInput = {
    id?: string;
    tenantId: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type RefreshTokenCreateInput = {
    id?: string;
    token: string;
    expiresAt: Date | string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceName?: string | null;
    deviceId?: string | null;
    isRevoked?: boolean;
    createdAt?: Date | string;
    user: UserCreateNestedOneWithoutRefreshTokensInput;
  };

  export type RefreshTokenUncheckedCreateInput = {
    id?: string;
    userId: string;
    token: string;
    expiresAt: Date | string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceName?: string | null;
    deviceId?: string | null;
    isRevoked?: boolean;
    createdAt?: Date | string;
  };

  export type RefreshTokenUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null;
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null;
    isRevoked?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutRefreshTokensNestedInput;
  };

  export type RefreshTokenUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null;
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null;
    isRevoked?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type RefreshTokenCreateManyInput = {
    id?: string;
    userId: string;
    token: string;
    expiresAt: Date | string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceName?: string | null;
    deviceId?: string | null;
    isRevoked?: boolean;
    createdAt?: Date | string;
  };

  export type RefreshTokenUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null;
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null;
    isRevoked?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type RefreshTokenUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null;
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null;
    isRevoked?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OtpCodeCreateInput = {
    id?: string;
    type: $Enums.OtpType;
    code: string;
    expiresAt: Date | string;
    usedAt?: Date | string | null;
    createdAt?: Date | string;
    user: UserCreateNestedOneWithoutOtpCodesInput;
  };

  export type OtpCodeUncheckedCreateInput = {
    id?: string;
    userId: string;
    type: $Enums.OtpType;
    code: string;
    expiresAt: Date | string;
    usedAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type OtpCodeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: EnumOtpTypeFieldUpdateOperationsInput | $Enums.OtpType;
    code?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutOtpCodesNestedInput;
  };

  export type OtpCodeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    type?: EnumOtpTypeFieldUpdateOperationsInput | $Enums.OtpType;
    code?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OtpCodeCreateManyInput = {
    id?: string;
    userId: string;
    type: $Enums.OtpType;
    code: string;
    expiresAt: Date | string;
    usedAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type OtpCodeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: EnumOtpTypeFieldUpdateOperationsInput | $Enums.OtpType;
    code?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OtpCodeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    type?: EnumOtpTypeFieldUpdateOperationsInput | $Enums.OtpType;
    code?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SocialAccountCreateInput = {
    id?: string;
    provider: $Enums.SocialProvider;
    providerId: string;
    email?: string | null;
    createdAt?: Date | string;
    user: UserCreateNestedOneWithoutSocialAccountsInput;
  };

  export type SocialAccountUncheckedCreateInput = {
    id?: string;
    userId: string;
    provider: $Enums.SocialProvider;
    providerId: string;
    email?: string | null;
    createdAt?: Date | string;
  };

  export type SocialAccountUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?:
      | EnumSocialProviderFieldUpdateOperationsInput
      | $Enums.SocialProvider;
    providerId?: StringFieldUpdateOperationsInput | string;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutSocialAccountsNestedInput;
  };

  export type SocialAccountUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    provider?:
      | EnumSocialProviderFieldUpdateOperationsInput
      | $Enums.SocialProvider;
    providerId?: StringFieldUpdateOperationsInput | string;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SocialAccountCreateManyInput = {
    id?: string;
    userId: string;
    provider: $Enums.SocialProvider;
    providerId: string;
    email?: string | null;
    createdAt?: Date | string;
  };

  export type SocialAccountUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?:
      | EnumSocialProviderFieldUpdateOperationsInput
      | $Enums.SocialProvider;
    providerId?: StringFieldUpdateOperationsInput | string;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SocialAccountUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    provider?:
      | EnumSocialProviderFieldUpdateOperationsInput
      | $Enums.SocialProvider;
    providerId?: StringFieldUpdateOperationsInput | string;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserPermissionCreateInput = {
    id?: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    reason?: string | null;
    createdAt?: Date | string;
    user: UserCreateNestedOneWithoutUserPermissionsInput;
    granter: UserCreateNestedOneWithoutGrantedPermissionsInput;
  };

  export type UserPermissionUncheckedCreateInput = {
    id?: string;
    userId: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    grantedBy: string;
    reason?: string | null;
    createdAt?: Date | string;
  };

  export type UserPermissionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutUserPermissionsNestedInput;
    granter?: UserUpdateOneRequiredWithoutGrantedPermissionsNestedInput;
  };

  export type UserPermissionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    grantedBy?: StringFieldUpdateOperationsInput | string;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserPermissionCreateManyInput = {
    id?: string;
    userId: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    grantedBy: string;
    reason?: string | null;
    createdAt?: Date | string;
  };

  export type UserPermissionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserPermissionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    grantedBy?: StringFieldUpdateOperationsInput | string;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
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

  export type EnumTenantStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.TenantStatus | EnumTenantStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.TenantStatus[]
      | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.TenantStatus[]
      | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumTenantStatusFilter<$PrismaModel> | $Enums.TenantStatus;
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

  export type UserListRelationFilter = {
    every?: UserWhereInput;
    some?: UserWhereInput;
    none?: UserWhereInput;
  };

  export type SortOrderInput = {
    sort: SortOrder;
    nulls?: NullsOrder;
  };

  export type UserOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type TenantCountOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    slug?: SortOrder;
    email?: SortOrder;
    phone?: SortOrder;
    address?: SortOrder;
    country?: SortOrder;
    status?: SortOrder;
    logoUrl?: SortOrder;
    website?: SortOrder;
    industry?: SortOrder;
    size?: SortOrder;
    subscriptionId?: SortOrder;
    trialEndsAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type TenantMaxOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    slug?: SortOrder;
    email?: SortOrder;
    phone?: SortOrder;
    address?: SortOrder;
    country?: SortOrder;
    status?: SortOrder;
    logoUrl?: SortOrder;
    website?: SortOrder;
    industry?: SortOrder;
    size?: SortOrder;
    subscriptionId?: SortOrder;
    trialEndsAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type TenantMinOrderByAggregateInput = {
    id?: SortOrder;
    name?: SortOrder;
    slug?: SortOrder;
    email?: SortOrder;
    phone?: SortOrder;
    address?: SortOrder;
    country?: SortOrder;
    status?: SortOrder;
    logoUrl?: SortOrder;
    website?: SortOrder;
    industry?: SortOrder;
    size?: SortOrder;
    subscriptionId?: SortOrder;
    trialEndsAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
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

  export type EnumTenantStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.TenantStatus | EnumTenantStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.TenantStatus[]
      | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.TenantStatus[]
      | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumTenantStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.TenantStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumTenantStatusFilter<$PrismaModel>;
    _max?: NestedEnumTenantStatusFilter<$PrismaModel>;
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

  export type EnumUserRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    not?: NestedEnumUserRoleFilter<$PrismaModel> | $Enums.UserRole;
  };

  export type EnumUserStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>;
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumUserStatusFilter<$PrismaModel> | $Enums.UserStatus;
  };

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type EnumMfaMethodNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.MfaMethod | EnumMfaMethodFieldRefInput<$PrismaModel> | null;
    in?:
      | $Enums.MfaMethod[]
      | ListEnumMfaMethodFieldRefInput<$PrismaModel>
      | null;
    notIn?:
      | $Enums.MfaMethod[]
      | ListEnumMfaMethodFieldRefInput<$PrismaModel>
      | null;
    not?:
      | NestedEnumMfaMethodNullableFilter<$PrismaModel>
      | $Enums.MfaMethod
      | null;
  };

  export type TenantRelationFilter = {
    is?: TenantWhereInput;
    isNot?: TenantWhereInput;
  };

  export type RefreshTokenListRelationFilter = {
    every?: RefreshTokenWhereInput;
    some?: RefreshTokenWhereInput;
    none?: RefreshTokenWhereInput;
  };

  export type OtpCodeListRelationFilter = {
    every?: OtpCodeWhereInput;
    some?: OtpCodeWhereInput;
    none?: OtpCodeWhereInput;
  };

  export type SocialAccountListRelationFilter = {
    every?: SocialAccountWhereInput;
    some?: SocialAccountWhereInput;
    none?: SocialAccountWhereInput;
  };

  export type UserPermissionListRelationFilter = {
    every?: UserPermissionWhereInput;
    some?: UserPermissionWhereInput;
    none?: UserPermissionWhereInput;
  };

  export type RefreshTokenOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type OtpCodeOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type SocialAccountOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type UserPermissionOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type UserTenantIdEmailCompoundUniqueInput = {
    tenantId: string;
    email: string;
  };

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    email?: SortOrder;
    password?: SortOrder;
    firstName?: SortOrder;
    lastName?: SortOrder;
    phone?: SortOrder;
    role?: SortOrder;
    status?: SortOrder;
    avatarUrl?: SortOrder;
    isMfaEnabled?: SortOrder;
    mfaMethod?: SortOrder;
    mfaSecret?: SortOrder;
    forcePasswordReset?: SortOrder;
    inviteToken?: SortOrder;
    inviteExpiresAt?: SortOrder;
    emailVerifiedAt?: SortOrder;
    lastLoginAt?: SortOrder;
    passwordChangedAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    email?: SortOrder;
    password?: SortOrder;
    firstName?: SortOrder;
    lastName?: SortOrder;
    phone?: SortOrder;
    role?: SortOrder;
    status?: SortOrder;
    avatarUrl?: SortOrder;
    isMfaEnabled?: SortOrder;
    mfaMethod?: SortOrder;
    mfaSecret?: SortOrder;
    forcePasswordReset?: SortOrder;
    inviteToken?: SortOrder;
    inviteExpiresAt?: SortOrder;
    emailVerifiedAt?: SortOrder;
    lastLoginAt?: SortOrder;
    passwordChangedAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder;
    tenantId?: SortOrder;
    email?: SortOrder;
    password?: SortOrder;
    firstName?: SortOrder;
    lastName?: SortOrder;
    phone?: SortOrder;
    role?: SortOrder;
    status?: SortOrder;
    avatarUrl?: SortOrder;
    isMfaEnabled?: SortOrder;
    mfaMethod?: SortOrder;
    mfaSecret?: SortOrder;
    forcePasswordReset?: SortOrder;
    inviteToken?: SortOrder;
    inviteExpiresAt?: SortOrder;
    emailVerifiedAt?: SortOrder;
    lastLoginAt?: SortOrder;
    passwordChangedAt?: SortOrder;
    createdAt?: SortOrder;
    updatedAt?: SortOrder;
  };

  export type EnumUserRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUserRoleWithAggregatesFilter<$PrismaModel>
      | $Enums.UserRole;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumUserRoleFilter<$PrismaModel>;
    _max?: NestedEnumUserRoleFilter<$PrismaModel>;
  };

  export type EnumUserStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>;
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUserStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.UserStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumUserStatusFilter<$PrismaModel>;
    _max?: NestedEnumUserStatusFilter<$PrismaModel>;
  };

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
  };

  export type EnumMfaMethodNullableWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?:
        | $Enums.MfaMethod
        | EnumMfaMethodFieldRefInput<$PrismaModel>
        | null;
      in?:
        | $Enums.MfaMethod[]
        | ListEnumMfaMethodFieldRefInput<$PrismaModel>
        | null;
      notIn?:
        | $Enums.MfaMethod[]
        | ListEnumMfaMethodFieldRefInput<$PrismaModel>
        | null;
      not?:
        | NestedEnumMfaMethodNullableWithAggregatesFilter<$PrismaModel>
        | $Enums.MfaMethod
        | null;
      _count?: NestedIntNullableFilter<$PrismaModel>;
      _min?: NestedEnumMfaMethodNullableFilter<$PrismaModel>;
      _max?: NestedEnumMfaMethodNullableFilter<$PrismaModel>;
    };

  export type UserRelationFilter = {
    is?: UserWhereInput;
    isNot?: UserWhereInput;
  };

  export type RefreshTokenCountOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    token?: SortOrder;
    expiresAt?: SortOrder;
    ipAddress?: SortOrder;
    userAgent?: SortOrder;
    deviceName?: SortOrder;
    deviceId?: SortOrder;
    isRevoked?: SortOrder;
    createdAt?: SortOrder;
  };

  export type RefreshTokenMaxOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    token?: SortOrder;
    expiresAt?: SortOrder;
    ipAddress?: SortOrder;
    userAgent?: SortOrder;
    deviceName?: SortOrder;
    deviceId?: SortOrder;
    isRevoked?: SortOrder;
    createdAt?: SortOrder;
  };

  export type RefreshTokenMinOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    token?: SortOrder;
    expiresAt?: SortOrder;
    ipAddress?: SortOrder;
    userAgent?: SortOrder;
    deviceName?: SortOrder;
    deviceId?: SortOrder;
    isRevoked?: SortOrder;
    createdAt?: SortOrder;
  };

  export type EnumOtpTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.OtpType | EnumOtpTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumOtpTypeFilter<$PrismaModel> | $Enums.OtpType;
  };

  export type OtpCodeCountOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    code?: SortOrder;
    expiresAt?: SortOrder;
    usedAt?: SortOrder;
    createdAt?: SortOrder;
  };

  export type OtpCodeMaxOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    code?: SortOrder;
    expiresAt?: SortOrder;
    usedAt?: SortOrder;
    createdAt?: SortOrder;
  };

  export type OtpCodeMinOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    type?: SortOrder;
    code?: SortOrder;
    expiresAt?: SortOrder;
    usedAt?: SortOrder;
    createdAt?: SortOrder;
  };

  export type EnumOtpTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OtpType | EnumOtpTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumOtpTypeWithAggregatesFilter<$PrismaModel> | $Enums.OtpType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumOtpTypeFilter<$PrismaModel>;
    _max?: NestedEnumOtpTypeFilter<$PrismaModel>;
  };

  export type EnumSocialProviderFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.SocialProvider
      | EnumSocialProviderFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    not?: NestedEnumSocialProviderFilter<$PrismaModel> | $Enums.SocialProvider;
  };

  export type SocialAccountProviderProviderIdCompoundUniqueInput = {
    provider: $Enums.SocialProvider;
    providerId: string;
  };

  export type SocialAccountCountOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    provider?: SortOrder;
    providerId?: SortOrder;
    email?: SortOrder;
    createdAt?: SortOrder;
  };

  export type SocialAccountMaxOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    provider?: SortOrder;
    providerId?: SortOrder;
    email?: SortOrder;
    createdAt?: SortOrder;
  };

  export type SocialAccountMinOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    provider?: SortOrder;
    providerId?: SortOrder;
    email?: SortOrder;
    createdAt?: SortOrder;
  };

  export type EnumSocialProviderWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.SocialProvider
      | EnumSocialProviderFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumSocialProviderWithAggregatesFilter<$PrismaModel>
      | $Enums.SocialProvider;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumSocialProviderFilter<$PrismaModel>;
    _max?: NestedEnumSocialProviderFilter<$PrismaModel>;
  };

  export type EnumPermissionEffectFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.PermissionEffect
      | EnumPermissionEffectFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumPermissionEffectFilter<$PrismaModel>
      | $Enums.PermissionEffect;
  };

  export type UserPermissionUserIdPermissionCompoundUniqueInput = {
    userId: string;
    permission: string;
  };

  export type UserPermissionCountOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    tenantId?: SortOrder;
    permission?: SortOrder;
    effect?: SortOrder;
    grantedBy?: SortOrder;
    reason?: SortOrder;
    createdAt?: SortOrder;
  };

  export type UserPermissionMaxOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    tenantId?: SortOrder;
    permission?: SortOrder;
    effect?: SortOrder;
    grantedBy?: SortOrder;
    reason?: SortOrder;
    createdAt?: SortOrder;
  };

  export type UserPermissionMinOrderByAggregateInput = {
    id?: SortOrder;
    userId?: SortOrder;
    tenantId?: SortOrder;
    permission?: SortOrder;
    effect?: SortOrder;
    grantedBy?: SortOrder;
    reason?: SortOrder;
    createdAt?: SortOrder;
  };

  export type EnumPermissionEffectWithAggregatesFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.PermissionEffect
      | EnumPermissionEffectFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumPermissionEffectWithAggregatesFilter<$PrismaModel>
      | $Enums.PermissionEffect;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumPermissionEffectFilter<$PrismaModel>;
    _max?: NestedEnumPermissionEffectFilter<$PrismaModel>;
  };

  export type UserCreateNestedManyWithoutTenantInput = {
    create?:
      | XOR<UserCreateWithoutTenantInput, UserUncheckedCreateWithoutTenantInput>
      | UserCreateWithoutTenantInput[]
      | UserUncheckedCreateWithoutTenantInput[];
    connectOrCreate?:
      | UserCreateOrConnectWithoutTenantInput
      | UserCreateOrConnectWithoutTenantInput[];
    createMany?: UserCreateManyTenantInputEnvelope;
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[];
  };

  export type UserUncheckedCreateNestedManyWithoutTenantInput = {
    create?:
      | XOR<UserCreateWithoutTenantInput, UserUncheckedCreateWithoutTenantInput>
      | UserCreateWithoutTenantInput[]
      | UserUncheckedCreateWithoutTenantInput[];
    connectOrCreate?:
      | UserCreateOrConnectWithoutTenantInput
      | UserCreateOrConnectWithoutTenantInput[];
    createMany?: UserCreateManyTenantInputEnvelope;
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[];
  };

  export type StringFieldUpdateOperationsInput = {
    set?: string;
  };

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
  };

  export type EnumTenantStatusFieldUpdateOperationsInput = {
    set?: $Enums.TenantStatus;
  };

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
  };

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
  };

  export type UserUpdateManyWithoutTenantNestedInput = {
    create?:
      | XOR<UserCreateWithoutTenantInput, UserUncheckedCreateWithoutTenantInput>
      | UserCreateWithoutTenantInput[]
      | UserUncheckedCreateWithoutTenantInput[];
    connectOrCreate?:
      | UserCreateOrConnectWithoutTenantInput
      | UserCreateOrConnectWithoutTenantInput[];
    upsert?:
      | UserUpsertWithWhereUniqueWithoutTenantInput
      | UserUpsertWithWhereUniqueWithoutTenantInput[];
    createMany?: UserCreateManyTenantInputEnvelope;
    set?: UserWhereUniqueInput | UserWhereUniqueInput[];
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[];
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[];
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[];
    update?:
      | UserUpdateWithWhereUniqueWithoutTenantInput
      | UserUpdateWithWhereUniqueWithoutTenantInput[];
    updateMany?:
      | UserUpdateManyWithWhereWithoutTenantInput
      | UserUpdateManyWithWhereWithoutTenantInput[];
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[];
  };

  export type UserUncheckedUpdateManyWithoutTenantNestedInput = {
    create?:
      | XOR<UserCreateWithoutTenantInput, UserUncheckedCreateWithoutTenantInput>
      | UserCreateWithoutTenantInput[]
      | UserUncheckedCreateWithoutTenantInput[];
    connectOrCreate?:
      | UserCreateOrConnectWithoutTenantInput
      | UserCreateOrConnectWithoutTenantInput[];
    upsert?:
      | UserUpsertWithWhereUniqueWithoutTenantInput
      | UserUpsertWithWhereUniqueWithoutTenantInput[];
    createMany?: UserCreateManyTenantInputEnvelope;
    set?: UserWhereUniqueInput | UserWhereUniqueInput[];
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[];
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[];
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[];
    update?:
      | UserUpdateWithWhereUniqueWithoutTenantInput
      | UserUpdateWithWhereUniqueWithoutTenantInput[];
    updateMany?:
      | UserUpdateManyWithWhereWithoutTenantInput
      | UserUpdateManyWithWhereWithoutTenantInput[];
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[];
  };

  export type TenantCreateNestedOneWithoutUsersInput = {
    create?: XOR<
      TenantCreateWithoutUsersInput,
      TenantUncheckedCreateWithoutUsersInput
    >;
    connectOrCreate?: TenantCreateOrConnectWithoutUsersInput;
    connect?: TenantWhereUniqueInput;
  };

  export type RefreshTokenCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          RefreshTokenCreateWithoutUserInput,
          RefreshTokenUncheckedCreateWithoutUserInput
        >
      | RefreshTokenCreateWithoutUserInput[]
      | RefreshTokenUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | RefreshTokenCreateOrConnectWithoutUserInput
      | RefreshTokenCreateOrConnectWithoutUserInput[];
    createMany?: RefreshTokenCreateManyUserInputEnvelope;
    connect?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
  };

  export type OtpCodeCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          OtpCodeCreateWithoutUserInput,
          OtpCodeUncheckedCreateWithoutUserInput
        >
      | OtpCodeCreateWithoutUserInput[]
      | OtpCodeUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OtpCodeCreateOrConnectWithoutUserInput
      | OtpCodeCreateOrConnectWithoutUserInput[];
    createMany?: OtpCodeCreateManyUserInputEnvelope;
    connect?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
  };

  export type SocialAccountCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          SocialAccountCreateWithoutUserInput,
          SocialAccountUncheckedCreateWithoutUserInput
        >
      | SocialAccountCreateWithoutUserInput[]
      | SocialAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SocialAccountCreateOrConnectWithoutUserInput
      | SocialAccountCreateOrConnectWithoutUserInput[];
    createMany?: SocialAccountCreateManyUserInputEnvelope;
    connect?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
  };

  export type UserPermissionCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutUserInput,
          UserPermissionUncheckedCreateWithoutUserInput
        >
      | UserPermissionCreateWithoutUserInput[]
      | UserPermissionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutUserInput
      | UserPermissionCreateOrConnectWithoutUserInput[];
    createMany?: UserPermissionCreateManyUserInputEnvelope;
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
  };

  export type UserPermissionCreateNestedManyWithoutGranterInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutGranterInput,
          UserPermissionUncheckedCreateWithoutGranterInput
        >
      | UserPermissionCreateWithoutGranterInput[]
      | UserPermissionUncheckedCreateWithoutGranterInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutGranterInput
      | UserPermissionCreateOrConnectWithoutGranterInput[];
    createMany?: UserPermissionCreateManyGranterInputEnvelope;
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
  };

  export type RefreshTokenUncheckedCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          RefreshTokenCreateWithoutUserInput,
          RefreshTokenUncheckedCreateWithoutUserInput
        >
      | RefreshTokenCreateWithoutUserInput[]
      | RefreshTokenUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | RefreshTokenCreateOrConnectWithoutUserInput
      | RefreshTokenCreateOrConnectWithoutUserInput[];
    createMany?: RefreshTokenCreateManyUserInputEnvelope;
    connect?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
  };

  export type OtpCodeUncheckedCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          OtpCodeCreateWithoutUserInput,
          OtpCodeUncheckedCreateWithoutUserInput
        >
      | OtpCodeCreateWithoutUserInput[]
      | OtpCodeUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OtpCodeCreateOrConnectWithoutUserInput
      | OtpCodeCreateOrConnectWithoutUserInput[];
    createMany?: OtpCodeCreateManyUserInputEnvelope;
    connect?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
  };

  export type SocialAccountUncheckedCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          SocialAccountCreateWithoutUserInput,
          SocialAccountUncheckedCreateWithoutUserInput
        >
      | SocialAccountCreateWithoutUserInput[]
      | SocialAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SocialAccountCreateOrConnectWithoutUserInput
      | SocialAccountCreateOrConnectWithoutUserInput[];
    createMany?: SocialAccountCreateManyUserInputEnvelope;
    connect?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
  };

  export type UserPermissionUncheckedCreateNestedManyWithoutUserInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutUserInput,
          UserPermissionUncheckedCreateWithoutUserInput
        >
      | UserPermissionCreateWithoutUserInput[]
      | UserPermissionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutUserInput
      | UserPermissionCreateOrConnectWithoutUserInput[];
    createMany?: UserPermissionCreateManyUserInputEnvelope;
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
  };

  export type UserPermissionUncheckedCreateNestedManyWithoutGranterInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutGranterInput,
          UserPermissionUncheckedCreateWithoutGranterInput
        >
      | UserPermissionCreateWithoutGranterInput[]
      | UserPermissionUncheckedCreateWithoutGranterInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutGranterInput
      | UserPermissionCreateOrConnectWithoutGranterInput[];
    createMany?: UserPermissionCreateManyGranterInputEnvelope;
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
  };

  export type EnumUserRoleFieldUpdateOperationsInput = {
    set?: $Enums.UserRole;
  };

  export type EnumUserStatusFieldUpdateOperationsInput = {
    set?: $Enums.UserStatus;
  };

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean;
  };

  export type NullableEnumMfaMethodFieldUpdateOperationsInput = {
    set?: $Enums.MfaMethod | null;
  };

  export type TenantUpdateOneRequiredWithoutUsersNestedInput = {
    create?: XOR<
      TenantCreateWithoutUsersInput,
      TenantUncheckedCreateWithoutUsersInput
    >;
    connectOrCreate?: TenantCreateOrConnectWithoutUsersInput;
    upsert?: TenantUpsertWithoutUsersInput;
    connect?: TenantWhereUniqueInput;
    update?: XOR<
      XOR<
        TenantUpdateToOneWithWhereWithoutUsersInput,
        TenantUpdateWithoutUsersInput
      >,
      TenantUncheckedUpdateWithoutUsersInput
    >;
  };

  export type RefreshTokenUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          RefreshTokenCreateWithoutUserInput,
          RefreshTokenUncheckedCreateWithoutUserInput
        >
      | RefreshTokenCreateWithoutUserInput[]
      | RefreshTokenUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | RefreshTokenCreateOrConnectWithoutUserInput
      | RefreshTokenCreateOrConnectWithoutUserInput[];
    upsert?:
      | RefreshTokenUpsertWithWhereUniqueWithoutUserInput
      | RefreshTokenUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: RefreshTokenCreateManyUserInputEnvelope;
    set?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    disconnect?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    delete?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    connect?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    update?:
      | RefreshTokenUpdateWithWhereUniqueWithoutUserInput
      | RefreshTokenUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | RefreshTokenUpdateManyWithWhereWithoutUserInput
      | RefreshTokenUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: RefreshTokenScalarWhereInput | RefreshTokenScalarWhereInput[];
  };

  export type OtpCodeUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          OtpCodeCreateWithoutUserInput,
          OtpCodeUncheckedCreateWithoutUserInput
        >
      | OtpCodeCreateWithoutUserInput[]
      | OtpCodeUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OtpCodeCreateOrConnectWithoutUserInput
      | OtpCodeCreateOrConnectWithoutUserInput[];
    upsert?:
      | OtpCodeUpsertWithWhereUniqueWithoutUserInput
      | OtpCodeUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: OtpCodeCreateManyUserInputEnvelope;
    set?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    disconnect?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    delete?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    connect?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    update?:
      | OtpCodeUpdateWithWhereUniqueWithoutUserInput
      | OtpCodeUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | OtpCodeUpdateManyWithWhereWithoutUserInput
      | OtpCodeUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: OtpCodeScalarWhereInput | OtpCodeScalarWhereInput[];
  };

  export type SocialAccountUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          SocialAccountCreateWithoutUserInput,
          SocialAccountUncheckedCreateWithoutUserInput
        >
      | SocialAccountCreateWithoutUserInput[]
      | SocialAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SocialAccountCreateOrConnectWithoutUserInput
      | SocialAccountCreateOrConnectWithoutUserInput[];
    upsert?:
      | SocialAccountUpsertWithWhereUniqueWithoutUserInput
      | SocialAccountUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: SocialAccountCreateManyUserInputEnvelope;
    set?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
    disconnect?:
      | SocialAccountWhereUniqueInput
      | SocialAccountWhereUniqueInput[];
    delete?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
    connect?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
    update?:
      | SocialAccountUpdateWithWhereUniqueWithoutUserInput
      | SocialAccountUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | SocialAccountUpdateManyWithWhereWithoutUserInput
      | SocialAccountUpdateManyWithWhereWithoutUserInput[];
    deleteMany?:
      | SocialAccountScalarWhereInput
      | SocialAccountScalarWhereInput[];
  };

  export type UserPermissionUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutUserInput,
          UserPermissionUncheckedCreateWithoutUserInput
        >
      | UserPermissionCreateWithoutUserInput[]
      | UserPermissionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutUserInput
      | UserPermissionCreateOrConnectWithoutUserInput[];
    upsert?:
      | UserPermissionUpsertWithWhereUniqueWithoutUserInput
      | UserPermissionUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: UserPermissionCreateManyUserInputEnvelope;
    set?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    disconnect?:
      | UserPermissionWhereUniqueInput
      | UserPermissionWhereUniqueInput[];
    delete?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    update?:
      | UserPermissionUpdateWithWhereUniqueWithoutUserInput
      | UserPermissionUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | UserPermissionUpdateManyWithWhereWithoutUserInput
      | UserPermissionUpdateManyWithWhereWithoutUserInput[];
    deleteMany?:
      | UserPermissionScalarWhereInput
      | UserPermissionScalarWhereInput[];
  };

  export type UserPermissionUpdateManyWithoutGranterNestedInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutGranterInput,
          UserPermissionUncheckedCreateWithoutGranterInput
        >
      | UserPermissionCreateWithoutGranterInput[]
      | UserPermissionUncheckedCreateWithoutGranterInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutGranterInput
      | UserPermissionCreateOrConnectWithoutGranterInput[];
    upsert?:
      | UserPermissionUpsertWithWhereUniqueWithoutGranterInput
      | UserPermissionUpsertWithWhereUniqueWithoutGranterInput[];
    createMany?: UserPermissionCreateManyGranterInputEnvelope;
    set?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    disconnect?:
      | UserPermissionWhereUniqueInput
      | UserPermissionWhereUniqueInput[];
    delete?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    update?:
      | UserPermissionUpdateWithWhereUniqueWithoutGranterInput
      | UserPermissionUpdateWithWhereUniqueWithoutGranterInput[];
    updateMany?:
      | UserPermissionUpdateManyWithWhereWithoutGranterInput
      | UserPermissionUpdateManyWithWhereWithoutGranterInput[];
    deleteMany?:
      | UserPermissionScalarWhereInput
      | UserPermissionScalarWhereInput[];
  };

  export type RefreshTokenUncheckedUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          RefreshTokenCreateWithoutUserInput,
          RefreshTokenUncheckedCreateWithoutUserInput
        >
      | RefreshTokenCreateWithoutUserInput[]
      | RefreshTokenUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | RefreshTokenCreateOrConnectWithoutUserInput
      | RefreshTokenCreateOrConnectWithoutUserInput[];
    upsert?:
      | RefreshTokenUpsertWithWhereUniqueWithoutUserInput
      | RefreshTokenUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: RefreshTokenCreateManyUserInputEnvelope;
    set?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    disconnect?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    delete?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    connect?: RefreshTokenWhereUniqueInput | RefreshTokenWhereUniqueInput[];
    update?:
      | RefreshTokenUpdateWithWhereUniqueWithoutUserInput
      | RefreshTokenUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | RefreshTokenUpdateManyWithWhereWithoutUserInput
      | RefreshTokenUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: RefreshTokenScalarWhereInput | RefreshTokenScalarWhereInput[];
  };

  export type OtpCodeUncheckedUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          OtpCodeCreateWithoutUserInput,
          OtpCodeUncheckedCreateWithoutUserInput
        >
      | OtpCodeCreateWithoutUserInput[]
      | OtpCodeUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | OtpCodeCreateOrConnectWithoutUserInput
      | OtpCodeCreateOrConnectWithoutUserInput[];
    upsert?:
      | OtpCodeUpsertWithWhereUniqueWithoutUserInput
      | OtpCodeUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: OtpCodeCreateManyUserInputEnvelope;
    set?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    disconnect?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    delete?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    connect?: OtpCodeWhereUniqueInput | OtpCodeWhereUniqueInput[];
    update?:
      | OtpCodeUpdateWithWhereUniqueWithoutUserInput
      | OtpCodeUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | OtpCodeUpdateManyWithWhereWithoutUserInput
      | OtpCodeUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: OtpCodeScalarWhereInput | OtpCodeScalarWhereInput[];
  };

  export type SocialAccountUncheckedUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          SocialAccountCreateWithoutUserInput,
          SocialAccountUncheckedCreateWithoutUserInput
        >
      | SocialAccountCreateWithoutUserInput[]
      | SocialAccountUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | SocialAccountCreateOrConnectWithoutUserInput
      | SocialAccountCreateOrConnectWithoutUserInput[];
    upsert?:
      | SocialAccountUpsertWithWhereUniqueWithoutUserInput
      | SocialAccountUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: SocialAccountCreateManyUserInputEnvelope;
    set?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
    disconnect?:
      | SocialAccountWhereUniqueInput
      | SocialAccountWhereUniqueInput[];
    delete?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
    connect?: SocialAccountWhereUniqueInput | SocialAccountWhereUniqueInput[];
    update?:
      | SocialAccountUpdateWithWhereUniqueWithoutUserInput
      | SocialAccountUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | SocialAccountUpdateManyWithWhereWithoutUserInput
      | SocialAccountUpdateManyWithWhereWithoutUserInput[];
    deleteMany?:
      | SocialAccountScalarWhereInput
      | SocialAccountScalarWhereInput[];
  };

  export type UserPermissionUncheckedUpdateManyWithoutUserNestedInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutUserInput,
          UserPermissionUncheckedCreateWithoutUserInput
        >
      | UserPermissionCreateWithoutUserInput[]
      | UserPermissionUncheckedCreateWithoutUserInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutUserInput
      | UserPermissionCreateOrConnectWithoutUserInput[];
    upsert?:
      | UserPermissionUpsertWithWhereUniqueWithoutUserInput
      | UserPermissionUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: UserPermissionCreateManyUserInputEnvelope;
    set?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    disconnect?:
      | UserPermissionWhereUniqueInput
      | UserPermissionWhereUniqueInput[];
    delete?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    update?:
      | UserPermissionUpdateWithWhereUniqueWithoutUserInput
      | UserPermissionUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?:
      | UserPermissionUpdateManyWithWhereWithoutUserInput
      | UserPermissionUpdateManyWithWhereWithoutUserInput[];
    deleteMany?:
      | UserPermissionScalarWhereInput
      | UserPermissionScalarWhereInput[];
  };

  export type UserPermissionUncheckedUpdateManyWithoutGranterNestedInput = {
    create?:
      | XOR<
          UserPermissionCreateWithoutGranterInput,
          UserPermissionUncheckedCreateWithoutGranterInput
        >
      | UserPermissionCreateWithoutGranterInput[]
      | UserPermissionUncheckedCreateWithoutGranterInput[];
    connectOrCreate?:
      | UserPermissionCreateOrConnectWithoutGranterInput
      | UserPermissionCreateOrConnectWithoutGranterInput[];
    upsert?:
      | UserPermissionUpsertWithWhereUniqueWithoutGranterInput
      | UserPermissionUpsertWithWhereUniqueWithoutGranterInput[];
    createMany?: UserPermissionCreateManyGranterInputEnvelope;
    set?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    disconnect?:
      | UserPermissionWhereUniqueInput
      | UserPermissionWhereUniqueInput[];
    delete?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    connect?: UserPermissionWhereUniqueInput | UserPermissionWhereUniqueInput[];
    update?:
      | UserPermissionUpdateWithWhereUniqueWithoutGranterInput
      | UserPermissionUpdateWithWhereUniqueWithoutGranterInput[];
    updateMany?:
      | UserPermissionUpdateManyWithWhereWithoutGranterInput
      | UserPermissionUpdateManyWithWhereWithoutGranterInput[];
    deleteMany?:
      | UserPermissionScalarWhereInput
      | UserPermissionScalarWhereInput[];
  };

  export type UserCreateNestedOneWithoutRefreshTokensInput = {
    create?: XOR<
      UserCreateWithoutRefreshTokensInput,
      UserUncheckedCreateWithoutRefreshTokensInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutRefreshTokensInput;
    connect?: UserWhereUniqueInput;
  };

  export type UserUpdateOneRequiredWithoutRefreshTokensNestedInput = {
    create?: XOR<
      UserCreateWithoutRefreshTokensInput,
      UserUncheckedCreateWithoutRefreshTokensInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutRefreshTokensInput;
    upsert?: UserUpsertWithoutRefreshTokensInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutRefreshTokensInput,
        UserUpdateWithoutRefreshTokensInput
      >,
      UserUncheckedUpdateWithoutRefreshTokensInput
    >;
  };

  export type UserCreateNestedOneWithoutOtpCodesInput = {
    create?: XOR<
      UserCreateWithoutOtpCodesInput,
      UserUncheckedCreateWithoutOtpCodesInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutOtpCodesInput;
    connect?: UserWhereUniqueInput;
  };

  export type EnumOtpTypeFieldUpdateOperationsInput = {
    set?: $Enums.OtpType;
  };

  export type UserUpdateOneRequiredWithoutOtpCodesNestedInput = {
    create?: XOR<
      UserCreateWithoutOtpCodesInput,
      UserUncheckedCreateWithoutOtpCodesInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutOtpCodesInput;
    upsert?: UserUpsertWithoutOtpCodesInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutOtpCodesInput,
        UserUpdateWithoutOtpCodesInput
      >,
      UserUncheckedUpdateWithoutOtpCodesInput
    >;
  };

  export type UserCreateNestedOneWithoutSocialAccountsInput = {
    create?: XOR<
      UserCreateWithoutSocialAccountsInput,
      UserUncheckedCreateWithoutSocialAccountsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutSocialAccountsInput;
    connect?: UserWhereUniqueInput;
  };

  export type EnumSocialProviderFieldUpdateOperationsInput = {
    set?: $Enums.SocialProvider;
  };

  export type UserUpdateOneRequiredWithoutSocialAccountsNestedInput = {
    create?: XOR<
      UserCreateWithoutSocialAccountsInput,
      UserUncheckedCreateWithoutSocialAccountsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutSocialAccountsInput;
    upsert?: UserUpsertWithoutSocialAccountsInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutSocialAccountsInput,
        UserUpdateWithoutSocialAccountsInput
      >,
      UserUncheckedUpdateWithoutSocialAccountsInput
    >;
  };

  export type UserCreateNestedOneWithoutUserPermissionsInput = {
    create?: XOR<
      UserCreateWithoutUserPermissionsInput,
      UserUncheckedCreateWithoutUserPermissionsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutUserPermissionsInput;
    connect?: UserWhereUniqueInput;
  };

  export type UserCreateNestedOneWithoutGrantedPermissionsInput = {
    create?: XOR<
      UserCreateWithoutGrantedPermissionsInput,
      UserUncheckedCreateWithoutGrantedPermissionsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutGrantedPermissionsInput;
    connect?: UserWhereUniqueInput;
  };

  export type EnumPermissionEffectFieldUpdateOperationsInput = {
    set?: $Enums.PermissionEffect;
  };

  export type UserUpdateOneRequiredWithoutUserPermissionsNestedInput = {
    create?: XOR<
      UserCreateWithoutUserPermissionsInput,
      UserUncheckedCreateWithoutUserPermissionsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutUserPermissionsInput;
    upsert?: UserUpsertWithoutUserPermissionsInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutUserPermissionsInput,
        UserUpdateWithoutUserPermissionsInput
      >,
      UserUncheckedUpdateWithoutUserPermissionsInput
    >;
  };

  export type UserUpdateOneRequiredWithoutGrantedPermissionsNestedInput = {
    create?: XOR<
      UserCreateWithoutGrantedPermissionsInput,
      UserUncheckedCreateWithoutGrantedPermissionsInput
    >;
    connectOrCreate?: UserCreateOrConnectWithoutGrantedPermissionsInput;
    upsert?: UserUpsertWithoutGrantedPermissionsInput;
    connect?: UserWhereUniqueInput;
    update?: XOR<
      XOR<
        UserUpdateToOneWithWhereWithoutGrantedPermissionsInput,
        UserUpdateWithoutGrantedPermissionsInput
      >,
      UserUncheckedUpdateWithoutGrantedPermissionsInput
    >;
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

  export type NestedEnumTenantStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.TenantStatus | EnumTenantStatusFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.TenantStatus[]
      | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.TenantStatus[]
      | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumTenantStatusFilter<$PrismaModel> | $Enums.TenantStatus;
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

  export type NestedEnumTenantStatusWithAggregatesFilter<$PrismaModel = never> =
    {
      equals?:
        | $Enums.TenantStatus
        | EnumTenantStatusFieldRefInput<$PrismaModel>;
      in?:
        | $Enums.TenantStatus[]
        | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
      notIn?:
        | $Enums.TenantStatus[]
        | ListEnumTenantStatusFieldRefInput<$PrismaModel>;
      not?:
        | NestedEnumTenantStatusWithAggregatesFilter<$PrismaModel>
        | $Enums.TenantStatus;
      _count?: NestedIntFilter<$PrismaModel>;
      _min?: NestedEnumTenantStatusFilter<$PrismaModel>;
      _max?: NestedEnumTenantStatusFilter<$PrismaModel>;
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

  export type NestedEnumUserRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    not?: NestedEnumUserRoleFilter<$PrismaModel> | $Enums.UserRole;
  };

  export type NestedEnumUserStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>;
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    not?: NestedEnumUserStatusFilter<$PrismaModel> | $Enums.UserStatus;
  };

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolFilter<$PrismaModel> | boolean;
  };

  export type NestedEnumMfaMethodNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.MfaMethod | EnumMfaMethodFieldRefInput<$PrismaModel> | null;
    in?:
      | $Enums.MfaMethod[]
      | ListEnumMfaMethodFieldRefInput<$PrismaModel>
      | null;
    notIn?:
      | $Enums.MfaMethod[]
      | ListEnumMfaMethodFieldRefInput<$PrismaModel>
      | null;
    not?:
      | NestedEnumMfaMethodNullableFilter<$PrismaModel>
      | $Enums.MfaMethod
      | null;
  };

  export type NestedEnumUserRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserRole | EnumUserRoleFieldRefInput<$PrismaModel>;
    in?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserRole[] | ListEnumUserRoleFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUserRoleWithAggregatesFilter<$PrismaModel>
      | $Enums.UserRole;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumUserRoleFilter<$PrismaModel>;
    _max?: NestedEnumUserRoleFilter<$PrismaModel>;
  };

  export type NestedEnumUserStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.UserStatus | EnumUserStatusFieldRefInput<$PrismaModel>;
    in?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    notIn?: $Enums.UserStatus[] | ListEnumUserStatusFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumUserStatusWithAggregatesFilter<$PrismaModel>
      | $Enums.UserStatus;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumUserStatusFilter<$PrismaModel>;
    _max?: NestedEnumUserStatusFilter<$PrismaModel>;
  };

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>;
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedBoolFilter<$PrismaModel>;
    _max?: NestedBoolFilter<$PrismaModel>;
  };

  export type NestedEnumMfaMethodNullableWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?: $Enums.MfaMethod | EnumMfaMethodFieldRefInput<$PrismaModel> | null;
    in?:
      | $Enums.MfaMethod[]
      | ListEnumMfaMethodFieldRefInput<$PrismaModel>
      | null;
    notIn?:
      | $Enums.MfaMethod[]
      | ListEnumMfaMethodFieldRefInput<$PrismaModel>
      | null;
    not?:
      | NestedEnumMfaMethodNullableWithAggregatesFilter<$PrismaModel>
      | $Enums.MfaMethod
      | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedEnumMfaMethodNullableFilter<$PrismaModel>;
    _max?: NestedEnumMfaMethodNullableFilter<$PrismaModel>;
  };

  export type NestedEnumOtpTypeFilter<$PrismaModel = never> = {
    equals?: $Enums.OtpType | EnumOtpTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumOtpTypeFilter<$PrismaModel> | $Enums.OtpType;
  };

  export type NestedEnumOtpTypeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.OtpType | EnumOtpTypeFieldRefInput<$PrismaModel>;
    in?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    notIn?: $Enums.OtpType[] | ListEnumOtpTypeFieldRefInput<$PrismaModel>;
    not?: NestedEnumOtpTypeWithAggregatesFilter<$PrismaModel> | $Enums.OtpType;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumOtpTypeFilter<$PrismaModel>;
    _max?: NestedEnumOtpTypeFilter<$PrismaModel>;
  };

  export type NestedEnumSocialProviderFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.SocialProvider
      | EnumSocialProviderFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    not?: NestedEnumSocialProviderFilter<$PrismaModel> | $Enums.SocialProvider;
  };

  export type NestedEnumSocialProviderWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.SocialProvider
      | EnumSocialProviderFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.SocialProvider[]
      | ListEnumSocialProviderFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumSocialProviderWithAggregatesFilter<$PrismaModel>
      | $Enums.SocialProvider;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumSocialProviderFilter<$PrismaModel>;
    _max?: NestedEnumSocialProviderFilter<$PrismaModel>;
  };

  export type NestedEnumPermissionEffectFilter<$PrismaModel = never> = {
    equals?:
      | $Enums.PermissionEffect
      | EnumPermissionEffectFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumPermissionEffectFilter<$PrismaModel>
      | $Enums.PermissionEffect;
  };

  export type NestedEnumPermissionEffectWithAggregatesFilter<
    $PrismaModel = never,
  > = {
    equals?:
      | $Enums.PermissionEffect
      | EnumPermissionEffectFieldRefInput<$PrismaModel>;
    in?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    notIn?:
      | $Enums.PermissionEffect[]
      | ListEnumPermissionEffectFieldRefInput<$PrismaModel>;
    not?:
      | NestedEnumPermissionEffectWithAggregatesFilter<$PrismaModel>
      | $Enums.PermissionEffect;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedEnumPermissionEffectFilter<$PrismaModel>;
    _max?: NestedEnumPermissionEffectFilter<$PrismaModel>;
  };

  export type UserCreateWithoutTenantInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    refreshTokens?: RefreshTokenCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionCreateNestedManyWithoutGranterInput;
  };

  export type UserUncheckedCreateWithoutTenantInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    refreshTokens?: RefreshTokenUncheckedCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeUncheckedCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountUncheckedCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionUncheckedCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionUncheckedCreateNestedManyWithoutGranterInput;
  };

  export type UserCreateOrConnectWithoutTenantInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutTenantInput,
      UserUncheckedCreateWithoutTenantInput
    >;
  };

  export type UserCreateManyTenantInputEnvelope = {
    data: UserCreateManyTenantInput | UserCreateManyTenantInput[];
    skipDuplicates?: boolean;
  };

  export type UserUpsertWithWhereUniqueWithoutTenantInput = {
    where: UserWhereUniqueInput;
    update: XOR<
      UserUpdateWithoutTenantInput,
      UserUncheckedUpdateWithoutTenantInput
    >;
    create: XOR<
      UserCreateWithoutTenantInput,
      UserUncheckedCreateWithoutTenantInput
    >;
  };

  export type UserUpdateWithWhereUniqueWithoutTenantInput = {
    where: UserWhereUniqueInput;
    data: XOR<
      UserUpdateWithoutTenantInput,
      UserUncheckedUpdateWithoutTenantInput
    >;
  };

  export type UserUpdateManyWithWhereWithoutTenantInput = {
    where: UserScalarWhereInput;
    data: XOR<
      UserUpdateManyMutationInput,
      UserUncheckedUpdateManyWithoutTenantInput
    >;
  };

  export type UserScalarWhereInput = {
    AND?: UserScalarWhereInput | UserScalarWhereInput[];
    OR?: UserScalarWhereInput[];
    NOT?: UserScalarWhereInput | UserScalarWhereInput[];
    id?: StringFilter<'User'> | string;
    tenantId?: StringFilter<'User'> | string;
    email?: StringFilter<'User'> | string;
    password?: StringNullableFilter<'User'> | string | null;
    firstName?: StringFilter<'User'> | string;
    lastName?: StringFilter<'User'> | string;
    phone?: StringNullableFilter<'User'> | string | null;
    role?: EnumUserRoleFilter<'User'> | $Enums.UserRole;
    status?: EnumUserStatusFilter<'User'> | $Enums.UserStatus;
    avatarUrl?: StringNullableFilter<'User'> | string | null;
    isMfaEnabled?: BoolFilter<'User'> | boolean;
    mfaMethod?: EnumMfaMethodNullableFilter<'User'> | $Enums.MfaMethod | null;
    mfaSecret?: StringNullableFilter<'User'> | string | null;
    forcePasswordReset?: BoolFilter<'User'> | boolean;
    inviteToken?: StringNullableFilter<'User'> | string | null;
    inviteExpiresAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    emailVerifiedAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    lastLoginAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    passwordChangedAt?: DateTimeNullableFilter<'User'> | Date | string | null;
    createdAt?: DateTimeFilter<'User'> | Date | string;
    updatedAt?: DateTimeFilter<'User'> | Date | string;
  };

  export type TenantCreateWithoutUsersInput = {
    id?: string;
    name: string;
    slug: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    country?: string;
    status?: $Enums.TenantStatus;
    logoUrl?: string | null;
    website?: string | null;
    industry?: string | null;
    size?: string | null;
    subscriptionId?: string | null;
    trialEndsAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type TenantUncheckedCreateWithoutUsersInput = {
    id?: string;
    name: string;
    slug: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    country?: string;
    status?: $Enums.TenantStatus;
    logoUrl?: string | null;
    website?: string | null;
    industry?: string | null;
    size?: string | null;
    subscriptionId?: string | null;
    trialEndsAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type TenantCreateOrConnectWithoutUsersInput = {
    where: TenantWhereUniqueInput;
    create: XOR<
      TenantCreateWithoutUsersInput,
      TenantUncheckedCreateWithoutUsersInput
    >;
  };

  export type RefreshTokenCreateWithoutUserInput = {
    id?: string;
    token: string;
    expiresAt: Date | string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceName?: string | null;
    deviceId?: string | null;
    isRevoked?: boolean;
    createdAt?: Date | string;
  };

  export type RefreshTokenUncheckedCreateWithoutUserInput = {
    id?: string;
    token: string;
    expiresAt: Date | string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceName?: string | null;
    deviceId?: string | null;
    isRevoked?: boolean;
    createdAt?: Date | string;
  };

  export type RefreshTokenCreateOrConnectWithoutUserInput = {
    where: RefreshTokenWhereUniqueInput;
    create: XOR<
      RefreshTokenCreateWithoutUserInput,
      RefreshTokenUncheckedCreateWithoutUserInput
    >;
  };

  export type RefreshTokenCreateManyUserInputEnvelope = {
    data: RefreshTokenCreateManyUserInput | RefreshTokenCreateManyUserInput[];
    skipDuplicates?: boolean;
  };

  export type OtpCodeCreateWithoutUserInput = {
    id?: string;
    type: $Enums.OtpType;
    code: string;
    expiresAt: Date | string;
    usedAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type OtpCodeUncheckedCreateWithoutUserInput = {
    id?: string;
    type: $Enums.OtpType;
    code: string;
    expiresAt: Date | string;
    usedAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type OtpCodeCreateOrConnectWithoutUserInput = {
    where: OtpCodeWhereUniqueInput;
    create: XOR<
      OtpCodeCreateWithoutUserInput,
      OtpCodeUncheckedCreateWithoutUserInput
    >;
  };

  export type OtpCodeCreateManyUserInputEnvelope = {
    data: OtpCodeCreateManyUserInput | OtpCodeCreateManyUserInput[];
    skipDuplicates?: boolean;
  };

  export type SocialAccountCreateWithoutUserInput = {
    id?: string;
    provider: $Enums.SocialProvider;
    providerId: string;
    email?: string | null;
    createdAt?: Date | string;
  };

  export type SocialAccountUncheckedCreateWithoutUserInput = {
    id?: string;
    provider: $Enums.SocialProvider;
    providerId: string;
    email?: string | null;
    createdAt?: Date | string;
  };

  export type SocialAccountCreateOrConnectWithoutUserInput = {
    where: SocialAccountWhereUniqueInput;
    create: XOR<
      SocialAccountCreateWithoutUserInput,
      SocialAccountUncheckedCreateWithoutUserInput
    >;
  };

  export type SocialAccountCreateManyUserInputEnvelope = {
    data: SocialAccountCreateManyUserInput | SocialAccountCreateManyUserInput[];
    skipDuplicates?: boolean;
  };

  export type UserPermissionCreateWithoutUserInput = {
    id?: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    reason?: string | null;
    createdAt?: Date | string;
    granter: UserCreateNestedOneWithoutGrantedPermissionsInput;
  };

  export type UserPermissionUncheckedCreateWithoutUserInput = {
    id?: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    grantedBy: string;
    reason?: string | null;
    createdAt?: Date | string;
  };

  export type UserPermissionCreateOrConnectWithoutUserInput = {
    where: UserPermissionWhereUniqueInput;
    create: XOR<
      UserPermissionCreateWithoutUserInput,
      UserPermissionUncheckedCreateWithoutUserInput
    >;
  };

  export type UserPermissionCreateManyUserInputEnvelope = {
    data:
      | UserPermissionCreateManyUserInput
      | UserPermissionCreateManyUserInput[];
    skipDuplicates?: boolean;
  };

  export type UserPermissionCreateWithoutGranterInput = {
    id?: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    reason?: string | null;
    createdAt?: Date | string;
    user: UserCreateNestedOneWithoutUserPermissionsInput;
  };

  export type UserPermissionUncheckedCreateWithoutGranterInput = {
    id?: string;
    userId: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    reason?: string | null;
    createdAt?: Date | string;
  };

  export type UserPermissionCreateOrConnectWithoutGranterInput = {
    where: UserPermissionWhereUniqueInput;
    create: XOR<
      UserPermissionCreateWithoutGranterInput,
      UserPermissionUncheckedCreateWithoutGranterInput
    >;
  };

  export type UserPermissionCreateManyGranterInputEnvelope = {
    data:
      | UserPermissionCreateManyGranterInput
      | UserPermissionCreateManyGranterInput[];
    skipDuplicates?: boolean;
  };

  export type TenantUpsertWithoutUsersInput = {
    update: XOR<
      TenantUpdateWithoutUsersInput,
      TenantUncheckedUpdateWithoutUsersInput
    >;
    create: XOR<
      TenantCreateWithoutUsersInput,
      TenantUncheckedCreateWithoutUsersInput
    >;
    where?: TenantWhereInput;
  };

  export type TenantUpdateToOneWithWhereWithoutUsersInput = {
    where?: TenantWhereInput;
    data: XOR<
      TenantUpdateWithoutUsersInput,
      TenantUncheckedUpdateWithoutUsersInput
    >;
  };

  export type TenantUpdateWithoutUsersInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    slug?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    address?: NullableStringFieldUpdateOperationsInput | string | null;
    country?: StringFieldUpdateOperationsInput | string;
    status?: EnumTenantStatusFieldUpdateOperationsInput | $Enums.TenantStatus;
    logoUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    website?: NullableStringFieldUpdateOperationsInput | string | null;
    industry?: NullableStringFieldUpdateOperationsInput | string | null;
    size?: NullableStringFieldUpdateOperationsInput | string | null;
    subscriptionId?: NullableStringFieldUpdateOperationsInput | string | null;
    trialEndsAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type TenantUncheckedUpdateWithoutUsersInput = {
    id?: StringFieldUpdateOperationsInput | string;
    name?: StringFieldUpdateOperationsInput | string;
    slug?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    address?: NullableStringFieldUpdateOperationsInput | string | null;
    country?: StringFieldUpdateOperationsInput | string;
    status?: EnumTenantStatusFieldUpdateOperationsInput | $Enums.TenantStatus;
    logoUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    website?: NullableStringFieldUpdateOperationsInput | string | null;
    industry?: NullableStringFieldUpdateOperationsInput | string | null;
    size?: NullableStringFieldUpdateOperationsInput | string | null;
    subscriptionId?: NullableStringFieldUpdateOperationsInput | string | null;
    trialEndsAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type RefreshTokenUpsertWithWhereUniqueWithoutUserInput = {
    where: RefreshTokenWhereUniqueInput;
    update: XOR<
      RefreshTokenUpdateWithoutUserInput,
      RefreshTokenUncheckedUpdateWithoutUserInput
    >;
    create: XOR<
      RefreshTokenCreateWithoutUserInput,
      RefreshTokenUncheckedCreateWithoutUserInput
    >;
  };

  export type RefreshTokenUpdateWithWhereUniqueWithoutUserInput = {
    where: RefreshTokenWhereUniqueInput;
    data: XOR<
      RefreshTokenUpdateWithoutUserInput,
      RefreshTokenUncheckedUpdateWithoutUserInput
    >;
  };

  export type RefreshTokenUpdateManyWithWhereWithoutUserInput = {
    where: RefreshTokenScalarWhereInput;
    data: XOR<
      RefreshTokenUpdateManyMutationInput,
      RefreshTokenUncheckedUpdateManyWithoutUserInput
    >;
  };

  export type RefreshTokenScalarWhereInput = {
    AND?: RefreshTokenScalarWhereInput | RefreshTokenScalarWhereInput[];
    OR?: RefreshTokenScalarWhereInput[];
    NOT?: RefreshTokenScalarWhereInput | RefreshTokenScalarWhereInput[];
    id?: StringFilter<'RefreshToken'> | string;
    userId?: StringFilter<'RefreshToken'> | string;
    token?: StringFilter<'RefreshToken'> | string;
    expiresAt?: DateTimeFilter<'RefreshToken'> | Date | string;
    ipAddress?: StringNullableFilter<'RefreshToken'> | string | null;
    userAgent?: StringNullableFilter<'RefreshToken'> | string | null;
    deviceName?: StringNullableFilter<'RefreshToken'> | string | null;
    deviceId?: StringNullableFilter<'RefreshToken'> | string | null;
    isRevoked?: BoolFilter<'RefreshToken'> | boolean;
    createdAt?: DateTimeFilter<'RefreshToken'> | Date | string;
  };

  export type OtpCodeUpsertWithWhereUniqueWithoutUserInput = {
    where: OtpCodeWhereUniqueInput;
    update: XOR<
      OtpCodeUpdateWithoutUserInput,
      OtpCodeUncheckedUpdateWithoutUserInput
    >;
    create: XOR<
      OtpCodeCreateWithoutUserInput,
      OtpCodeUncheckedCreateWithoutUserInput
    >;
  };

  export type OtpCodeUpdateWithWhereUniqueWithoutUserInput = {
    where: OtpCodeWhereUniqueInput;
    data: XOR<
      OtpCodeUpdateWithoutUserInput,
      OtpCodeUncheckedUpdateWithoutUserInput
    >;
  };

  export type OtpCodeUpdateManyWithWhereWithoutUserInput = {
    where: OtpCodeScalarWhereInput;
    data: XOR<
      OtpCodeUpdateManyMutationInput,
      OtpCodeUncheckedUpdateManyWithoutUserInput
    >;
  };

  export type OtpCodeScalarWhereInput = {
    AND?: OtpCodeScalarWhereInput | OtpCodeScalarWhereInput[];
    OR?: OtpCodeScalarWhereInput[];
    NOT?: OtpCodeScalarWhereInput | OtpCodeScalarWhereInput[];
    id?: StringFilter<'OtpCode'> | string;
    userId?: StringFilter<'OtpCode'> | string;
    type?: EnumOtpTypeFilter<'OtpCode'> | $Enums.OtpType;
    code?: StringFilter<'OtpCode'> | string;
    expiresAt?: DateTimeFilter<'OtpCode'> | Date | string;
    usedAt?: DateTimeNullableFilter<'OtpCode'> | Date | string | null;
    createdAt?: DateTimeFilter<'OtpCode'> | Date | string;
  };

  export type SocialAccountUpsertWithWhereUniqueWithoutUserInput = {
    where: SocialAccountWhereUniqueInput;
    update: XOR<
      SocialAccountUpdateWithoutUserInput,
      SocialAccountUncheckedUpdateWithoutUserInput
    >;
    create: XOR<
      SocialAccountCreateWithoutUserInput,
      SocialAccountUncheckedCreateWithoutUserInput
    >;
  };

  export type SocialAccountUpdateWithWhereUniqueWithoutUserInput = {
    where: SocialAccountWhereUniqueInput;
    data: XOR<
      SocialAccountUpdateWithoutUserInput,
      SocialAccountUncheckedUpdateWithoutUserInput
    >;
  };

  export type SocialAccountUpdateManyWithWhereWithoutUserInput = {
    where: SocialAccountScalarWhereInput;
    data: XOR<
      SocialAccountUpdateManyMutationInput,
      SocialAccountUncheckedUpdateManyWithoutUserInput
    >;
  };

  export type SocialAccountScalarWhereInput = {
    AND?: SocialAccountScalarWhereInput | SocialAccountScalarWhereInput[];
    OR?: SocialAccountScalarWhereInput[];
    NOT?: SocialAccountScalarWhereInput | SocialAccountScalarWhereInput[];
    id?: StringFilter<'SocialAccount'> | string;
    userId?: StringFilter<'SocialAccount'> | string;
    provider?:
      | EnumSocialProviderFilter<'SocialAccount'>
      | $Enums.SocialProvider;
    providerId?: StringFilter<'SocialAccount'> | string;
    email?: StringNullableFilter<'SocialAccount'> | string | null;
    createdAt?: DateTimeFilter<'SocialAccount'> | Date | string;
  };

  export type UserPermissionUpsertWithWhereUniqueWithoutUserInput = {
    where: UserPermissionWhereUniqueInput;
    update: XOR<
      UserPermissionUpdateWithoutUserInput,
      UserPermissionUncheckedUpdateWithoutUserInput
    >;
    create: XOR<
      UserPermissionCreateWithoutUserInput,
      UserPermissionUncheckedCreateWithoutUserInput
    >;
  };

  export type UserPermissionUpdateWithWhereUniqueWithoutUserInput = {
    where: UserPermissionWhereUniqueInput;
    data: XOR<
      UserPermissionUpdateWithoutUserInput,
      UserPermissionUncheckedUpdateWithoutUserInput
    >;
  };

  export type UserPermissionUpdateManyWithWhereWithoutUserInput = {
    where: UserPermissionScalarWhereInput;
    data: XOR<
      UserPermissionUpdateManyMutationInput,
      UserPermissionUncheckedUpdateManyWithoutUserInput
    >;
  };

  export type UserPermissionScalarWhereInput = {
    AND?: UserPermissionScalarWhereInput | UserPermissionScalarWhereInput[];
    OR?: UserPermissionScalarWhereInput[];
    NOT?: UserPermissionScalarWhereInput | UserPermissionScalarWhereInput[];
    id?: StringFilter<'UserPermission'> | string;
    userId?: StringFilter<'UserPermission'> | string;
    tenantId?: StringFilter<'UserPermission'> | string;
    permission?: StringFilter<'UserPermission'> | string;
    effect?:
      | EnumPermissionEffectFilter<'UserPermission'>
      | $Enums.PermissionEffect;
    grantedBy?: StringFilter<'UserPermission'> | string;
    reason?: StringNullableFilter<'UserPermission'> | string | null;
    createdAt?: DateTimeFilter<'UserPermission'> | Date | string;
  };

  export type UserPermissionUpsertWithWhereUniqueWithoutGranterInput = {
    where: UserPermissionWhereUniqueInput;
    update: XOR<
      UserPermissionUpdateWithoutGranterInput,
      UserPermissionUncheckedUpdateWithoutGranterInput
    >;
    create: XOR<
      UserPermissionCreateWithoutGranterInput,
      UserPermissionUncheckedCreateWithoutGranterInput
    >;
  };

  export type UserPermissionUpdateWithWhereUniqueWithoutGranterInput = {
    where: UserPermissionWhereUniqueInput;
    data: XOR<
      UserPermissionUpdateWithoutGranterInput,
      UserPermissionUncheckedUpdateWithoutGranterInput
    >;
  };

  export type UserPermissionUpdateManyWithWhereWithoutGranterInput = {
    where: UserPermissionScalarWhereInput;
    data: XOR<
      UserPermissionUpdateManyMutationInput,
      UserPermissionUncheckedUpdateManyWithoutGranterInput
    >;
  };

  export type UserCreateWithoutRefreshTokensInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenant: TenantCreateNestedOneWithoutUsersInput;
    otpCodes?: OtpCodeCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionCreateNestedManyWithoutGranterInput;
  };

  export type UserUncheckedCreateWithoutRefreshTokensInput = {
    id?: string;
    tenantId: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    otpCodes?: OtpCodeUncheckedCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountUncheckedCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionUncheckedCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionUncheckedCreateNestedManyWithoutGranterInput;
  };

  export type UserCreateOrConnectWithoutRefreshTokensInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutRefreshTokensInput,
      UserUncheckedCreateWithoutRefreshTokensInput
    >;
  };

  export type UserUpsertWithoutRefreshTokensInput = {
    update: XOR<
      UserUpdateWithoutRefreshTokensInput,
      UserUncheckedUpdateWithoutRefreshTokensInput
    >;
    create: XOR<
      UserCreateWithoutRefreshTokensInput,
      UserUncheckedCreateWithoutRefreshTokensInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutRefreshTokensInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutRefreshTokensInput,
      UserUncheckedUpdateWithoutRefreshTokensInput
    >;
  };

  export type UserUpdateWithoutRefreshTokensInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenant?: TenantUpdateOneRequiredWithoutUsersNestedInput;
    otpCodes?: OtpCodeUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUpdateManyWithoutGranterNestedInput;
  };

  export type UserUncheckedUpdateWithoutRefreshTokensInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    otpCodes?: OtpCodeUncheckedUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUncheckedUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUncheckedUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUncheckedUpdateManyWithoutGranterNestedInput;
  };

  export type UserCreateWithoutOtpCodesInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenant: TenantCreateNestedOneWithoutUsersInput;
    refreshTokens?: RefreshTokenCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionCreateNestedManyWithoutGranterInput;
  };

  export type UserUncheckedCreateWithoutOtpCodesInput = {
    id?: string;
    tenantId: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    refreshTokens?: RefreshTokenUncheckedCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountUncheckedCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionUncheckedCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionUncheckedCreateNestedManyWithoutGranterInput;
  };

  export type UserCreateOrConnectWithoutOtpCodesInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutOtpCodesInput,
      UserUncheckedCreateWithoutOtpCodesInput
    >;
  };

  export type UserUpsertWithoutOtpCodesInput = {
    update: XOR<
      UserUpdateWithoutOtpCodesInput,
      UserUncheckedUpdateWithoutOtpCodesInput
    >;
    create: XOR<
      UserCreateWithoutOtpCodesInput,
      UserUncheckedCreateWithoutOtpCodesInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutOtpCodesInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutOtpCodesInput,
      UserUncheckedUpdateWithoutOtpCodesInput
    >;
  };

  export type UserUpdateWithoutOtpCodesInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenant?: TenantUpdateOneRequiredWithoutUsersNestedInput;
    refreshTokens?: RefreshTokenUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUpdateManyWithoutGranterNestedInput;
  };

  export type UserUncheckedUpdateWithoutOtpCodesInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    refreshTokens?: RefreshTokenUncheckedUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUncheckedUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUncheckedUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUncheckedUpdateManyWithoutGranterNestedInput;
  };

  export type UserCreateWithoutSocialAccountsInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenant: TenantCreateNestedOneWithoutUsersInput;
    refreshTokens?: RefreshTokenCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionCreateNestedManyWithoutGranterInput;
  };

  export type UserUncheckedCreateWithoutSocialAccountsInput = {
    id?: string;
    tenantId: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    refreshTokens?: RefreshTokenUncheckedCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeUncheckedCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionUncheckedCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionUncheckedCreateNestedManyWithoutGranterInput;
  };

  export type UserCreateOrConnectWithoutSocialAccountsInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutSocialAccountsInput,
      UserUncheckedCreateWithoutSocialAccountsInput
    >;
  };

  export type UserUpsertWithoutSocialAccountsInput = {
    update: XOR<
      UserUpdateWithoutSocialAccountsInput,
      UserUncheckedUpdateWithoutSocialAccountsInput
    >;
    create: XOR<
      UserCreateWithoutSocialAccountsInput,
      UserUncheckedCreateWithoutSocialAccountsInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutSocialAccountsInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutSocialAccountsInput,
      UserUncheckedUpdateWithoutSocialAccountsInput
    >;
  };

  export type UserUpdateWithoutSocialAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenant?: TenantUpdateOneRequiredWithoutUsersNestedInput;
    refreshTokens?: RefreshTokenUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUpdateManyWithoutGranterNestedInput;
  };

  export type UserUncheckedUpdateWithoutSocialAccountsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    refreshTokens?: RefreshTokenUncheckedUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUncheckedUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUncheckedUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUncheckedUpdateManyWithoutGranterNestedInput;
  };

  export type UserCreateWithoutUserPermissionsInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenant: TenantCreateNestedOneWithoutUsersInput;
    refreshTokens?: RefreshTokenCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionCreateNestedManyWithoutGranterInput;
  };

  export type UserUncheckedCreateWithoutUserPermissionsInput = {
    id?: string;
    tenantId: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    refreshTokens?: RefreshTokenUncheckedCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeUncheckedCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountUncheckedCreateNestedManyWithoutUserInput;
    grantedPermissions?: UserPermissionUncheckedCreateNestedManyWithoutGranterInput;
  };

  export type UserCreateOrConnectWithoutUserPermissionsInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutUserPermissionsInput,
      UserUncheckedCreateWithoutUserPermissionsInput
    >;
  };

  export type UserCreateWithoutGrantedPermissionsInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    tenant: TenantCreateNestedOneWithoutUsersInput;
    refreshTokens?: RefreshTokenCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionCreateNestedManyWithoutUserInput;
  };

  export type UserUncheckedCreateWithoutGrantedPermissionsInput = {
    id?: string;
    tenantId: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    refreshTokens?: RefreshTokenUncheckedCreateNestedManyWithoutUserInput;
    otpCodes?: OtpCodeUncheckedCreateNestedManyWithoutUserInput;
    socialAccounts?: SocialAccountUncheckedCreateNestedManyWithoutUserInput;
    userPermissions?: UserPermissionUncheckedCreateNestedManyWithoutUserInput;
  };

  export type UserCreateOrConnectWithoutGrantedPermissionsInput = {
    where: UserWhereUniqueInput;
    create: XOR<
      UserCreateWithoutGrantedPermissionsInput,
      UserUncheckedCreateWithoutGrantedPermissionsInput
    >;
  };

  export type UserUpsertWithoutUserPermissionsInput = {
    update: XOR<
      UserUpdateWithoutUserPermissionsInput,
      UserUncheckedUpdateWithoutUserPermissionsInput
    >;
    create: XOR<
      UserCreateWithoutUserPermissionsInput,
      UserUncheckedCreateWithoutUserPermissionsInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutUserPermissionsInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutUserPermissionsInput,
      UserUncheckedUpdateWithoutUserPermissionsInput
    >;
  };

  export type UserUpdateWithoutUserPermissionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenant?: TenantUpdateOneRequiredWithoutUsersNestedInput;
    refreshTokens?: RefreshTokenUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUpdateManyWithoutGranterNestedInput;
  };

  export type UserUncheckedUpdateWithoutUserPermissionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    refreshTokens?: RefreshTokenUncheckedUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUncheckedUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUncheckedUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUncheckedUpdateManyWithoutGranterNestedInput;
  };

  export type UserUpsertWithoutGrantedPermissionsInput = {
    update: XOR<
      UserUpdateWithoutGrantedPermissionsInput,
      UserUncheckedUpdateWithoutGrantedPermissionsInput
    >;
    create: XOR<
      UserCreateWithoutGrantedPermissionsInput,
      UserUncheckedCreateWithoutGrantedPermissionsInput
    >;
    where?: UserWhereInput;
  };

  export type UserUpdateToOneWithWhereWithoutGrantedPermissionsInput = {
    where?: UserWhereInput;
    data: XOR<
      UserUpdateWithoutGrantedPermissionsInput,
      UserUncheckedUpdateWithoutGrantedPermissionsInput
    >;
  };

  export type UserUpdateWithoutGrantedPermissionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    tenant?: TenantUpdateOneRequiredWithoutUsersNestedInput;
    refreshTokens?: RefreshTokenUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUpdateManyWithoutUserNestedInput;
  };

  export type UserUncheckedUpdateWithoutGrantedPermissionsInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    refreshTokens?: RefreshTokenUncheckedUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUncheckedUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUncheckedUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUncheckedUpdateManyWithoutUserNestedInput;
  };

  export type UserCreateManyTenantInput = {
    id?: string;
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    phone?: string | null;
    role?: $Enums.UserRole;
    status?: $Enums.UserStatus;
    avatarUrl?: string | null;
    isMfaEnabled?: boolean;
    mfaMethod?: $Enums.MfaMethod | null;
    mfaSecret?: string | null;
    forcePasswordReset?: boolean;
    inviteToken?: string | null;
    inviteExpiresAt?: Date | string | null;
    emailVerifiedAt?: Date | string | null;
    lastLoginAt?: Date | string | null;
    passwordChangedAt?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };

  export type UserUpdateWithoutTenantInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    refreshTokens?: RefreshTokenUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUpdateManyWithoutGranterNestedInput;
  };

  export type UserUncheckedUpdateWithoutTenantInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    refreshTokens?: RefreshTokenUncheckedUpdateManyWithoutUserNestedInput;
    otpCodes?: OtpCodeUncheckedUpdateManyWithoutUserNestedInput;
    socialAccounts?: SocialAccountUncheckedUpdateManyWithoutUserNestedInput;
    userPermissions?: UserPermissionUncheckedUpdateManyWithoutUserNestedInput;
    grantedPermissions?: UserPermissionUncheckedUpdateManyWithoutGranterNestedInput;
  };

  export type UserUncheckedUpdateManyWithoutTenantInput = {
    id?: StringFieldUpdateOperationsInput | string;
    email?: StringFieldUpdateOperationsInput | string;
    password?: NullableStringFieldUpdateOperationsInput | string | null;
    firstName?: StringFieldUpdateOperationsInput | string;
    lastName?: StringFieldUpdateOperationsInput | string;
    phone?: NullableStringFieldUpdateOperationsInput | string | null;
    role?: EnumUserRoleFieldUpdateOperationsInput | $Enums.UserRole;
    status?: EnumUserStatusFieldUpdateOperationsInput | $Enums.UserStatus;
    avatarUrl?: NullableStringFieldUpdateOperationsInput | string | null;
    isMfaEnabled?: BoolFieldUpdateOperationsInput | boolean;
    mfaMethod?:
      | NullableEnumMfaMethodFieldUpdateOperationsInput
      | $Enums.MfaMethod
      | null;
    mfaSecret?: NullableStringFieldUpdateOperationsInput | string | null;
    forcePasswordReset?: BoolFieldUpdateOperationsInput | boolean;
    inviteToken?: NullableStringFieldUpdateOperationsInput | string | null;
    inviteExpiresAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    emailVerifiedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    lastLoginAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    passwordChangedAt?:
      | NullableDateTimeFieldUpdateOperationsInput
      | Date
      | string
      | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type RefreshTokenCreateManyUserInput = {
    id?: string;
    token: string;
    expiresAt: Date | string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceName?: string | null;
    deviceId?: string | null;
    isRevoked?: boolean;
    createdAt?: Date | string;
  };

  export type OtpCodeCreateManyUserInput = {
    id?: string;
    type: $Enums.OtpType;
    code: string;
    expiresAt: Date | string;
    usedAt?: Date | string | null;
    createdAt?: Date | string;
  };

  export type SocialAccountCreateManyUserInput = {
    id?: string;
    provider: $Enums.SocialProvider;
    providerId: string;
    email?: string | null;
    createdAt?: Date | string;
  };

  export type UserPermissionCreateManyUserInput = {
    id?: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    grantedBy: string;
    reason?: string | null;
    createdAt?: Date | string;
  };

  export type UserPermissionCreateManyGranterInput = {
    id?: string;
    userId: string;
    tenantId: string;
    permission: string;
    effect: $Enums.PermissionEffect;
    reason?: string | null;
    createdAt?: Date | string;
  };

  export type RefreshTokenUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null;
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null;
    isRevoked?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type RefreshTokenUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null;
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null;
    isRevoked?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type RefreshTokenUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    token?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    ipAddress?: NullableStringFieldUpdateOperationsInput | string | null;
    userAgent?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceName?: NullableStringFieldUpdateOperationsInput | string | null;
    deviceId?: NullableStringFieldUpdateOperationsInput | string | null;
    isRevoked?: BoolFieldUpdateOperationsInput | boolean;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OtpCodeUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: EnumOtpTypeFieldUpdateOperationsInput | $Enums.OtpType;
    code?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OtpCodeUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: EnumOtpTypeFieldUpdateOperationsInput | $Enums.OtpType;
    code?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type OtpCodeUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    type?: EnumOtpTypeFieldUpdateOperationsInput | $Enums.OtpType;
    code?: StringFieldUpdateOperationsInput | string;
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SocialAccountUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?:
      | EnumSocialProviderFieldUpdateOperationsInput
      | $Enums.SocialProvider;
    providerId?: StringFieldUpdateOperationsInput | string;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SocialAccountUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?:
      | EnumSocialProviderFieldUpdateOperationsInput
      | $Enums.SocialProvider;
    providerId?: StringFieldUpdateOperationsInput | string;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SocialAccountUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    provider?:
      | EnumSocialProviderFieldUpdateOperationsInput
      | $Enums.SocialProvider;
    providerId?: StringFieldUpdateOperationsInput | string;
    email?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserPermissionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    granter?: UserUpdateOneRequiredWithoutGrantedPermissionsNestedInput;
  };

  export type UserPermissionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    grantedBy?: StringFieldUpdateOperationsInput | string;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserPermissionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    grantedBy?: StringFieldUpdateOperationsInput | string;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserPermissionUpdateWithoutGranterInput = {
    id?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
    user?: UserUpdateOneRequiredWithoutUserPermissionsNestedInput;
  };

  export type UserPermissionUncheckedUpdateWithoutGranterInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type UserPermissionUncheckedUpdateManyWithoutGranterInput = {
    id?: StringFieldUpdateOperationsInput | string;
    userId?: StringFieldUpdateOperationsInput | string;
    tenantId?: StringFieldUpdateOperationsInput | string;
    permission?: StringFieldUpdateOperationsInput | string;
    effect?:
      | EnumPermissionEffectFieldUpdateOperationsInput
      | $Enums.PermissionEffect;
    reason?: NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  /**
   * Aliases for legacy arg types
   */
  /**
   * @deprecated Use TenantCountOutputTypeDefaultArgs instead
   */
  export type TenantCountOutputTypeArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = TenantCountOutputTypeDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use UserCountOutputTypeDefaultArgs instead
   */
  export type UserCountOutputTypeArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = UserCountOutputTypeDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use TenantDefaultArgs instead
   */
  export type TenantArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = TenantDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use UserDefaultArgs instead
   */
  export type UserArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = UserDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use RefreshTokenDefaultArgs instead
   */
  export type RefreshTokenArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = RefreshTokenDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use OtpCodeDefaultArgs instead
   */
  export type OtpCodeArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = OtpCodeDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use SocialAccountDefaultArgs instead
   */
  export type SocialAccountArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = SocialAccountDefaultArgs<ExtArgs>;
  /**
   * @deprecated Use UserPermissionDefaultArgs instead
   */
  export type UserPermissionArgs<
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
  > = UserPermissionDefaultArgs<ExtArgs>;

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
