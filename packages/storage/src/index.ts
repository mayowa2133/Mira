/**
 * Private object storage.
 *
 * Shared because both the API (which issues upload targets and serves signed
 * reads) and the worker (which reads an original and writes derivatives) must
 * agree exactly on how a storage key is built, scoped to a user, and signed.
 * Two implementations of that would be two chances to disagree about who owns
 * an object — which is the one thing this module exists to get right (SEC-4).
 */
export * from './storage.js';
