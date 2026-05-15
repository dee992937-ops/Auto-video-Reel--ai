# Security Specification - AutoReelApp

## Data Invariants
1. A project must belong to a single user (`userId`).
2. Users can only read, write, update, or delete their own projects and templates.
3. Timestamps (`createdAt`, `updatedAt`) must be managed by the server.
4. Field sizes must be constrained (e.g., project names < 100 chars).

## The "Dirty Dozen" Payloads (Red Team Payloads)
1. **Identity Spoofing**: Creating a project with `userId` of another user.
2. **Unauthorized Read**: Attempting to `get` a project document ID belonging to another user.
3. **Blanket Read**: Attempting a `list` query without a `where` clause on `userId`.
4. **State Poisoning**: Updating a `createdAt` timestamp after creation.
5. **Shadow Field Injection**: Adding an `isAdmin: true` field to a project document.
6. **ID Length Attack**: Sending a 2MB string as a document ID.
7. **Type Mismatch**: Sending a Number instead of an Object for `formData`.
8. **Malicious Update**: Attempting to change the `userId` of an existing project.
9. **Relational Orphan**: (Not applicable here as no complex relations exist yet).
10. **Excessive Storage**: Sending a project name that is 1MB long.
11. **Verification Bypass**: Attempting to write without an authenticated session.
12. **Query Scraping**: Attempting to list all projects in the collection.

## Test Runner logic (Conceptual)
Verify `PERMISSION_DENIED` for all unauthorized access attempts in `firestore.rules`.
