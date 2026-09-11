<!-- ref:global-rules-v1 -->

# Global Rules

> **MANDATORY**: Before any deployment action, read and apply the entire
> [canonical Global Rules](../../apex-azure-prepare/references/global-rules.md).
> Do not proceed if that reference cannot be loaded. This delegation is not a substitute for loading it.

## Rule 1: Destructive Actions Require User Confirmation

Apply canonical Rule 1 and all its sections below from the required load above.

### What is Destructive?

All canonical destructive categories apply.

### How to Confirm

Use the canonical `ask_user` confirmation procedure.

### No Exceptions

All canonical no-exception rules apply.

## Rule 2: Never Assume Subscription or Location

Apply canonical Rule 2 with mandatory [confirmation reuse](../../apex-azure-prepare/references/azure-context.md#confirmation-reuse):
read and apply that section; reuse unchanged confirmed context for the same project/environment,
and re-ask when missing or invalidated. Reuse does not waive current readiness checks,
deployment approval, or individual destructive-action confirmation.

Complete the local [Pre-Deploy Checklist](pre-deploy-checklist.md); do not substitute a prepare checklist.
