<!--
SYNC IMPACT REPORT (temporary; remove before commit)
Version change: TEMPLATE (unfilled) -> 1.0.0
Reason: initial adoption of the constitution. No prior filled version exists; the file was an unfilled template.
Modified principles: all five principle slots filled (were placeholders).
Added sections: Security Requirements, Development Workflow (filled from template slots 2 and 3).
Removed sections: none.
Deferred TODOs: TODO(PROJECT_NAME), TODO(RATIFICATION_DATE), TODO(GUIDANCE_FILE). No README or project name source was found in the repo.
-->

# TODO(PROJECT_NAME) Constitution

## Core Principles

### I. Secure by Default
Every feature, configuration, and default value MUST be secure out of the box. Insecure options MUST be explicit, opt-in, and documented with their risk. Access MUST be denied unless explicitly granted (fail closed). Errors MUST NOT grant access or expose internal state.
Rationale: insecure defaults are the most common cause of exposure in practice; users rarely change them.

### II. Least Privilege
Code, services, accounts, and tokens MUST request only the permissions they need for the task. Dependencies and components MUST NOT receive ambient authority they do not use. Privileged operations MUST be isolated and narrowly scoped.
Rationale: limiting the blast radius of a compromise is cheaper than preventing every compromise.

### III. Validate at Trust Boundaries
All input crossing a trust boundary (network, user, file, environment, third-party response) MUST be validated against an explicit allow-list of expected form, type, length, and range before use. Output MUST be encoded for its destination context (HTML, SQL, shell, URL, log). Parsers and deserializers MUST NOT execute or instantiate untrusted content.
Rationale: injection and deserialization flaws arise where untrusted data crosses into an interpreter.

### IV. Secrets and Data Protection
Secrets (credentials, keys, tokens) MUST NOT be committed to source control, hard-coded, or written to logs. Secrets MUST be loaded from a managed secret store or environment at runtime. Sensitive data MUST be encrypted in transit and at rest where stored. Cryptography MUST use vetted, current libraries and algorithms; custom cryptography is prohibited.
Rationale: leaked secrets and home-grown cryptography are both high-impact and hard to revoke.

### V. Verified, Auditable Changes
Every security-relevant control (authentication, authorization, input validation, crypto) MUST have automated tests that fail when the control is removed. Dependencies MUST be pinned and checked for known vulnerabilities before release. Security-relevant events (authentication, authorization denials, configuration changes) MUST be logged without secrets or unnecessary personal data.
Rationale: security controls that are not tested tend to regress silently; audit trails support detection and investigation.

## Security Requirements

- Authentication and authorization MUST be enforced server-side on every protected operation; client-side checks are advisory only.
- Transport MUST use TLS; plaintext protocols MUST NOT be used for sensitive data.
- Dependencies MUST be sourced from trusted registries, pinned, and reviewed when added or upgraded.
- Security headers, CSRF protection, and rate limiting MUST be applied to any externally reachable web interface.
- Threat modeling MUST be performed for new externally exposed features before implementation.

## Development Workflow

- Changes touching authentication, authorization, input handling, cryptography, or secrets MUST receive a security-focused code review before merge.
- Build and test pipelines MUST run security checks (static analysis, dependency vulnerability scanning) and MUST block merge on failures at high or critical severity, unless an exception is recorded with an owner and an expiry date.
- Insecure shortcuts (disabled checks, skipped validation, debug backdoors) MUST NOT be merged to main branches.

## Governance

This constitution supersedes other practices. Any conflicting guidance MUST be revised to comply with it.

Amendments MUST be proposed in writing, reviewed by the maintainers, and recorded with the reasoning and a migration plan for affected code. Versioning follows semantic versioning: MAJOR for removing or redefining a principle in a backward-incompatible way; MINOR for adding a principle or section or materially expanding guidance; PATCH for clarifications and wording fixes.

All pull requests and reviews MUST verify compliance with this constitution. Any added complexity or exception to a principle MUST be justified in the pull request description and recorded.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date unknown; confirm with the project owner | **Last Amended**: 2026-11-21
