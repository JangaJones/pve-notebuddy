# Security Policy

## Supported Versions

The project is currently maintained on the latest stable release line only.

| Version | Supported          |
| ------- | ------------------ |
| 1.3 and later  | :white_check_mark: |
| 1.2 and earlier  | :x:                |

Please upgrade to the latest release before reporting a vulnerability unless you can reproduce the issue on the current supported version.

## Reporting a Vulnerability

If you believe you have found a security vulnerability in **pve-notebuddy**, please **do not open a public GitHub issue**.

Please use one of the following reporting channels:

1. **GitHub Private Vulnerability Reporting** (preferred, if enabled for this repository)
2. **Direct maintainer contact** via the repository owner profile if private reporting is not available

When reporting a vulnerability, please include as much of the following information as possible:

* A clear description of the issue
* Affected version(s)
* Steps to reproduce
* Proof-of-concept or payload, if applicable
* Impact assessment
* Any suggested remediation or mitigation

## What to Expect

The maintainer will try to:

* Acknowledge receipt of the report within **7 days**
* Triage and validate the report as quickly as possible
* Keep the reporter informed about major status changes when practical
* Release a fix before public disclosure whenever possible

Please note that response times may vary depending on report quality, project availability, and issue complexity.

## Disclosure Policy

Please allow a reasonable amount of time for investigation, remediation, and release coordination before publicly disclosing a vulnerability.

The general process is:

1. Receive and validate the report
2. Assess impact and affected versions
3. Develop and test a fix
4. Release a patched version
5. Publish a security advisory and/or release notes

## Scope

This repository is a client-side static web application. Security issues of interest may include, for example:

* Cross-site scripting (XSS)
* Unsafe HTML or URL handling
* Import/export parsing issues
* Supply-chain or dependency-related risks
* Browser-side trust boundary violations

Reports that are purely theoretical, non-reproducible, or require unrealistic user/environment assumptions may be closed as informational.

## Out of Scope

The following are generally out of scope unless they demonstrate meaningful security impact:

* Feature requests
* UI/UX issues without security impact
* Missing best practices without an exploitable condition
* Reports against unsupported versions only
* Issues caused exclusively by local browser extensions, modified environments, or third-party tooling not controlled by this project

## Safe Harbor

Good-faith security research and responsible disclosure are appreciated.

Please:

* Avoid violating privacy
* Avoid destructive testing
* Avoid accessing, modifying, or deleting data that you do not own
* Avoid public disclosure before a fix is available

## Security Updates

Security fixes may be announced through:

* GitHub Security Advisories
* Release notes
* Changelog entries

Users should always update to the latest supported version to receive security fixes.

