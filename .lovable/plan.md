# Enable Lovable AI

## What will change
- Keep the existing Guru.AI, question generation, recommendations, photo doubt, voice, and retrieval experiences intact.
- Replace outdated model identifiers with currently supported Lovable AI defaults.
- Upgrade the shared server-side AI connection so errors remain visible and requests follow the gateway's supported streaming behavior.
- Keep the AI key server-only and preserve existing admin feature switches.

## Verification
- Make one real AI request through the configured gateway.
- Check the existing app’s AI-facing code for stale model references.
- Run the project’s automated validation.

## Boundaries
- No database migration or schema change.
- No backend connection, authentication, navigation, or existing feature removal.
- No publishing.
