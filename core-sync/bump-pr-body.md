Move the core pin from `{{OLD}}` to `{{NEW}}` ({{KIND}}).

- Core changes: [{{OLD}}...{{NEW}}]({{COMPARE_URL}})
- Regenerated bindings: {{GENERATED}}
- E2E runs against `{{IMAGE}}`
- Files copied from core:
{{FIXTURES}}

## Proto changes

{{PROTO_DIFF}}

## Before merging

- CI and E2E must pass. If the SDK needs changes for this core version, push them to this branch.
- Pre-release pins are not released; a newer pre-release proposal replaces this one.
