# Project Architecture & Context

## Architecture Summary
- **Backend**: NestJS framework with Prisma ORM and PostgreSQL database.
- **Mobile**: React Native 0.85 using Expo 56 and Expo Router.
- **Package Manager**: npm

## Context & Rules
- **Stack**: NestJS, Prisma, PostgreSQL, React Native (Expo).
- **Package ID (Temporary)**: `com.testcompany.wholesaleapp`
- **Secrets**: Use placeholder `<REPLACE_ME_XXX>` for any real secrets.
- **Language**: Persian (Farsi) for user-facing texts.
- **Audit Rule**: Always audit before implementation and document in `RELEASE-PROGRESS.md`.

## Security Conventions

### API & Validation
- **DTOs**: Every `@Body()` must use a class-based DTO with `class-validator` decorators. Inline types or interfaces for request bodies are strictly forbidden.
- **Mass Assignment Protection**: Never pass dynamic keys (e.g., `[field]: value`) directly from a request body into Prisma data objects without explicit whitelisting. Use DTOs or manual mapping.
- **Whitelist Validation**: The `ValidationPipe` is enabled globally with `whitelist: true` and `forbidNonWhitelisted: true`.

### Profile Change Flow (Sensitive Fields)
- **Sensitive Fields**: `storeName`, `nationalCode`, `landline`, `businessType`.
- **Workflow**: 
    1. User submits request via `POST /auth/profile/sensitive-change`.
    2. Request is saved in `ProfileChangeRequest` with `PENDING` status.
    3. Admin reviews and approves/rejects via `/admin/profile-changes`.
    4. Upon approval, the `Customer` record is updated automatically.
- **Security**: The `approveChange` service method performs a second-layer check to ensure the field being updated is strictly within the `SensitiveField` enum.
- **Atomic State Transitions**: Any status transition on approval-flow records (e.g., ProfileChangeRequest) MUST be performed inside the transaction via `updateMany` with the expected current status in the `where` clause (e.g., `{ id, status: 'PENDING' }`). Checking status with a prior `findUnique` alone is forbidden — it creates a TOCTOU (Time-of-check to time-of-use) race condition.

### File Uploads (Banners)
- **Security**: All public file names are generated using `randomUUID()` to prevent guessing.
- **Sanitization**: `path.basename()` is used on all filename inputs to prevent Path Traversal attacks.
- **Validation**:
    - Max Size: 6MB.
    - Types: JPEG, PNG, WebP.
    - Storage: Root `uploads/banners` with forced prefix check.

## Work Status
- [x] Section 1: Client
    - [x] Audit: EAS config, expo-updates, Force Update
    - [x] Implementation: EAS config, Package ID, Force Update (API + Client), OTA Updates
- [x] Section 2: Backend
    - [x] Audit: Pagination, IDOR, Environment variables, Hardcoded secrets
    - [x] Implementation: Pagination, IDOR fixes, Scheduled Backups, Release Checklist
- [x] Section 3: New Features
    - [x] Banner Management System
    - [x] Profile Editing (Normal & Sensitive)

## Reports
- Audit reports and implementation details are documented in `RELEASE-PROGRESS.md`.
