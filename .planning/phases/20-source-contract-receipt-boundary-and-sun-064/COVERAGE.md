# API Coverage - Phase 20 Internal Boundary

> Phase 20 defines and consumes internal Starye API contracts. No external API, SDK, or provider service configuration is introduced in this phase. The matrix records the internal surfaces detected by the seal-time gate and the explicitly deferred provider surface.

| capability | decision | reason |
|---|---|---|
| public movie readiness DTO | INTEGRATE | |
| admin crawler task readiness DTO | INTEGRATE | |
| controlled movie sync readback | INTEGRATE | |
| third-party provider API | OPT-OUT | Provider dispatch is scoped to Phase 23, not Phase 20 |
