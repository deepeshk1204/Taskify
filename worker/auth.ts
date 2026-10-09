import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose'
import clerkJwks from './jwks.json'

const jwks = createLocalJWKSet(clerkJwks as JSONWebKeySet)

export function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? error.cause.message : ''
    return [error.name, error.message, cause].filter(Boolean).join(' | ')
  }
  return String(error)
}

export async function tenantIdFromSession(token: string, allowedParties: string[]): Promise<string> {
  const { payload } = await jwtVerify(token, jwks, {
    clockTolerance: 15,
  })

  if (typeof payload.azp === 'string' && allowedParties.length > 0 && !allowedParties.includes(payload.azp)) {
    throw new Error(`azp not allowed: ${payload.azp}`)
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('token missing sub')
  }
  return payload.sub
}
