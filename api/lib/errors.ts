import { Data } from 'effect'

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string
}> {}

export class AuthError extends Data.TaggedError('AuthError')<{
  readonly message: string
}> {}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string
  readonly code?: string
}> {}

export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly message: string
}> {}
