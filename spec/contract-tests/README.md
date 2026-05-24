# Contract Tests

Package-local tests currently consume `spec/fixtures` directly.

Add orchestration-level tests here when a contract requires multiple packages to run in one
process or when the test should not be owned by a single package.
