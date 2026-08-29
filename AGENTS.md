# AGENTS.md

## Commits

Use Conventional Commits.

Allowed format:

- `fix: ...`
- `feat: ...`
- `test: ...`
- `refactor: ...`
- `chore: ...`
- `docs: ...`

Do not use scopes in parentheses.

Good:

- `fix: handle missing session on logout`
- `test: add auth endpoint e2e coverage`

Bad:

- `fix(auth): handle missing session on logout`
- `test(auth): add endpoint coverage`

Keep commits small and logically separated.

Do not mix production code changes and test-only changes in the same commit when they can be separated.

Before committing:

1. Inspect the full git diff.
2. Group changes by logical purpose.
3. Propose the commit message.
4. Stage only files belonging to that commit.
5. Commit them separately.

## Tests

### Unit / service tests

Keep unit tests close to the module:

src/modules/<module>/spec/

Example:

src/modules/auth/spec/auth.service.spec.ts
src/modules/auth/spec/auth.controller.spec.ts

### E2E tests

Keep E2E tests under the root `test/` directory.

Use one folder and one E2E file per module:

test/
auth/
auth.e2e-spec.ts
users/
users.e2e-spec.ts
sessions/
sessions.e2e-spec.ts

One module = one E2E spec file.

Example:

`test/auth/auth.e2e-spec.ts` contains all auth endpoint E2E tests:

- register
- login
- refresh
- logout
- me

E2E tests should exercise the real Nest application stack and real database behavior unless explicitly requested otherwise.

Do not replace E2E dependencies with mocked services.

When changing backend behavior:

- update/add relevant unit tests;
- update/add relevant E2E coverage;
- do not change production behavior only to make a test pass.
