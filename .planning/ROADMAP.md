# Roadmap: Starye — 个人内容中台

## Milestones

- ✅ **v1.0 部署可用、日常使用态** — Phases 1-5 shipped 2026-07-11. [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 存储成本控制与代码/文件整理** — Phases 6-10 shipped 2026-07-13. [Archive](milestones/v1.1-ROADMAP.md)
- ⚠ **v1.2 Cloudflare 账户/域名切换与全链路发布验证** — archived 2026-07-29 by override closeout. [Archive](milestones/v1.2-ROADMAP.md)
- ⚠ **v1.3 后台爬虫任务与内容运维** — Phases 16-19 shipped 2026-08-04 by override closeout. [Archive](milestones/v1.3-ROADMAP.md)
- ✅ **v1.4 播放可用性与生产自愈闭环** — Phases 20-24 shipped 2026-08-10. [Archive](milestones/v1.4-ROADMAP.md)
- ✅ **v1.5 爬虫运管与内容可用性闭环** — Phases 25-28 shipped 2026-08-22. [Archive](milestones/v1.5-ROADMAP.md)

## Current Focus

v1.5 MVP 已完成并部署。下一步通过 `$gsd-new-milestone` 定义新的需求周期。

## v1.5 Delivered

- 统一 crawler task/run/attempt/provider 控制面，支持受控任务 CRUD、归档、取消、重试、审计和幂等回调。
- 建立视频 direct/magnet 可用性检查、revision/CAS observation/current projection、受控修复和 receipt/readback 链路。
- 建立漫画 source chapter snapshot、缺章/重复/顺序诊断、终态区分和 targeted repair 保护。
- 建立章节图片页身份、数量/顺序检查、有界图片探测、脱敏逐页 observation、定向修复和 Reader projection。
- 完成 canonical Gateway 本地 fresh tuple 验收，并完成同一 v1.5 SHA 的生产部署、D1 migration、API/Pages workflows 与生产 Manga Crawl。

## Verification

- Phase 25-28: 4/4 complete, 23/23 plans complete, all phase verification artifacts passed.
- Automated suites: API 625, crawler 181, Dashboard 161, Comic App 15; type-check, lint, build and migration regression passed.
- Production SHA: `184e2941863a30640536aa97c35e798f84cf5144`.
- Production Manga Crawl: workflow `32536822682`, D1 run `9ee3320b-4726-4b3a-9d51-a2c6de9c972d`, provider `github-actions`, successful.
- Production chapter/page readback: `790-34389`, 25/25 page observations `available`; browser decoded the same source image at `720x9074`.
- Production Reader UI remains bounded by the current browser's unauthenticated R18 state; the complete Reader tuple is recorded in the Phase 28 local Gateway verification artifact.

## Archives

- [v1.5 requirements](milestones/v1.5-REQUIREMENTS.md)
- [v1.5 milestone audit](milestones/v1.5-MILESTONE-AUDIT.md)
- [v1.5 phase artifacts](milestones/v1.5-phases/)
