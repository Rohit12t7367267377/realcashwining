# Security architecture

- Administrative generic writes use strict, per-entity editable-field schemas; this prevents callers from modifying server-owned fields.
- Premium teaching and library actions verify active, current membership on the server and through resource RLS; browser subscription flags are not authority.
- Knowledge provider tests use deployment-owned origin/secret bindings and reject redirects; credentials must never follow requester-selected destinations.
- Notes chat treats browser conversation history as untrusted student context, never as verified assistant messages.
- Browser profile edits cannot change managed account fields; wallet membership purchases use an authenticated atomic database operation to preserve legitimate purchases.
- XP records are owner-scoped; the authenticated Hall of Fame action projects only public ranking fields so private reward counters stay private.