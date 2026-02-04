# Baseline Bicep Templates

> **Archived**: 2026-02-04
> **Purpose**: Quality comparison baseline for Bicep code validation

## Contents

This folder contains the original Bicep templates generated during initial agent-testing validation.
Use these as a **quality reference** when validating new Bicep code output.

## Quality Comparison Checklist

When comparing new Bicep output to baseline:

- [ ] Uses Azure Verified Modules (AVM) where available
- [ ] Consistent parameter naming (camelCase)
- [ ] Required tags on all resources
- [ ] `uniqueSuffix` pattern for globally unique names
- [ ] Proper module dependencies (`dependsOn`)
- [ ] Security defaults (HTTPS, TLS 1.2, no public access)
- [ ] Passes `bicep lint` without errors

## Do Not Modify

⚠️ **This folder is read-only reference material.**
Do not edit files in this folder - they serve as the quality baseline.
