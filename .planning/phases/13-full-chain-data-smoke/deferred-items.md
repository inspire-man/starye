# Deferred Items

- [ ] Repair the pre-existing missing Git object `20e2714bb69ba9055ab73b261b275777394dac48` (historical path `apps/dashboard/src/views/PostEditor.vue`) in a dedicated repository-maintenance task.
  - Discovered while committing Phase 13 Plan 07; automatic Git maintenance reported the missing blob, while normal commits remained possible with automatic GC disabled.
  - Out of scope because repairing or rewriting shared history is unrelated to the provenance plan and risks concurrent/user work.
