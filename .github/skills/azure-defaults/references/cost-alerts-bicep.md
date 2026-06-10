<!-- ref:cost-alerts-bicep-v1 -->

# Cost Alerts — Bicep Snippets

Loaded on-demand by 06b-Bicep CodeGen at Wave 4. See
`cost-alerts-baseline.md` for the contract these snippets satisfy.

> Module version numbers are placeholders (`<latest-stable>`) — resolve
> at plan time via MCR lookup; never hardcode from this file.

## 1. Budget — RG scope (AVM preferred)

```bicep
// Preferred — AVM pattern module (resolve version live at plan time)
module budget 'br/public:avm/ptn/cost-management/budget:<latest-stable>' = {
  name: 'cost-budget'
  scope: resourceGroup()
  params: {
    name: 'budget-${project}'
    amount: budgetAmountUsd
    timeGrain: 'Monthly'
    category: 'Cost'
    contactRoles: ['Owner']
    contactGroups: [actionGroup.outputs.resourceId]
    notifications: [
      { thresholdType: 'Actual',   threshold: 80,  operator: 'GreaterThan' }
      { thresholdType: 'Actual',   threshold: 100, operator: 'GreaterThanOrEqualTo' }
      { thresholdType: 'Actual',   threshold: 125, operator: 'GreaterThan' }
      { thresholdType: 'Forecasted', threshold: 100, operator: 'GreaterThan' }
      { thresholdType: 'Forecasted', threshold: 125, operator: 'GreaterThan' }
    ]
  }
}
```

If the AVM pattern module does not exist for the chosen scope at plan
time, fall back to raw resource **with an exception record** in the
plan (see `cost-alerts-baseline.md` → "Raw resource exception record"):

```bicep
// Raw fallback — only with exception record in plan
resource budgetRaw 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-${project}'
  properties: {
    category: 'Cost'
    amount: budgetAmountUsd
    timeGrain: 'Monthly'
    timePeriod: { startDate: '2026-05-01' }
    notifications: {
      Actual_GreaterThan_80_Percent:        { enabled: true, operator: 'GreaterThan',          threshold: 80,  contactRoles: ['Owner'], contactGroups: [ag.id] }
      Actual_GreaterThanOrEqualTo_100:      { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, contactRoles: ['Owner'], contactGroups: [ag.id], thresholdType: 'Actual' }
      Actual_GreaterThan_125_Percent:       { enabled: true, operator: 'GreaterThan',          threshold: 125, contactRoles: ['Owner'], contactGroups: [ag.id] }
      Forecasted_GreaterThan_100_Percent:   { enabled: true, operator: 'GreaterThan',          threshold: 100, contactRoles: ['Owner'], contactGroups: [ag.id], thresholdType: 'Forecasted' }
      Forecasted_GreaterThan_125_Percent:   { enabled: true, operator: 'GreaterThan',          threshold: 125, contactRoles: ['Owner'], contactGroups: [ag.id], thresholdType: 'Forecasted' }
    }
  }
}
```

## 2. Budget — subscription scope

Use `targetScope = 'subscription'` for the module file and either the
AVM sub-scope pattern module (preferred) or
`Microsoft.Consumption/budgets` at subscription scope.

## 3. Budget — management-group scope

Use `targetScope = 'managementGroup'` and the AVM MG-scope pattern
module (preferred). AVM coverage for MG scope is currently thin —
exception record is often required.

## 4. Action Group — `create` mode (AVM)

```bicep
module actionGroup 'br/public:avm/res/insights/action-group:<latest-stable>' = if (costActionGroupMode == 'create') {
  name: 'cost-action-group'
  scope: resourceGroup()
  params: {
    name: 'ag-cost-${project}'
    groupShortName: actionGroupShortName  // <=12 chars, default 'cost${suffix}'
    enabled: true
    emailReceivers: [for email in costAlertEmails: {
      name: replace(email, '@', '_at_')
      emailAddress: email
      useCommonAlertSchema: true
    }]
    tags: tags
  }
}
```

## 5. Action Group — `existing` mode

```bicep
// When cost_action_group_mode == 'existing'
resource existingAg 'Microsoft.Insights/actionGroups@2023-01-01' existing = if (costActionGroupMode == 'existing') {
  name: existingActionGroupName       // parsed from existing_action_group_id
  scope: resourceGroup(existingAgRgName)
}

// Compose a single ID expression downstream:
var actionGroupId = costActionGroupMode == 'existing' ? existingAg.id : actionGroup.outputs.resourceId
```

## 6. Cost Anomaly Alert (subscription-scoped)

### Hard prerequisites (provider validation will reject otherwise)

All four constraints are enforced by `Microsoft.CostManagement` at
`what-if` / deployment time. Violating any of them blocks the entire
subscription deployment.

1. **Subscription scope only.** `kind: 'InsightAlert'` is **not**
   accepted at resource-group scope. Declare the resource in a
   dedicated module file with `targetScope = 'subscription'` and call
   it from `main.bicep` with `scope: subscription()`. **Do not** place
   it inside an RG-scoped foundation/wave module — the provider
   returns `InvalidInsightAlertRequestScope`.
2. **`properties.displayName` ≤ 25 characters.** The provider hard-
   limits this field; long environment/project concatenations
   (`'Cost Anomaly Alert — ${project} ${environment}'`) overflow and
   return `InvalidScheduledActionDisplayName`. Use a short fixed
   pattern such as `'CostAnomaly-${project}'` and cap `project` to
   ≤ 12 characters in `01-requirements`.
3. **`properties.viewId` must be SCOPE-MATCHED to the scheduled action.**
   For a subscription-scoped `InsightAlert`, prefix the built-in view
   path with the subscription resource ID (`${subscription().id}`). A
   **bare** `/providers/Microsoft.CostManagement/views/...` path is
   rejected at apply with `InvalidView` ("specify either a private view
   ID or a view ID with the same scope under the same scope as the
   scheduled action") — even though it builds, lints, and passes
   what-if. Microsoft's anomaly-alert guidance uses the
   `ms:DailyAnomalyByResourceGroup` view with a `/scope/providers/...`
   prefix. Verified-working value (deployed + confirmed `status: Enabled`):
   - `${subscription().id}/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup`
4. **`schedule.endDate` must be a near-future UTC datetime.** The
   provider rejects `endDate` values more than ~1 year after
   `startDate` and rejects non-midnight times for `InsightAlert`
   (must be `T00:00:00Z`). Compute the window at deploy time rather
   than hard-coding `2099-12-31T23:59:59Z`:

   ```bicep
   param utcNowDate string = utcNow('yyyy-MM-dd')
   var anomalyStartDate = '${utcNowDate}T00:00:00Z'
   var anomalyEndDate   = '${dateTimeAdd(utcNowDate, 'P1Y', 'yyyy-MM-dd')}T00:00:00Z'
   ```

### Canonical snippet

```bicep
// File: modules/cost-anomaly.bicep
// REQUIRED — declare at the top of the module file:
targetScope = 'subscription'

param project string
param costAlertEmails array
param senderEmail string
param utcNowDate string = utcNow('yyyy-MM-dd')

var anomalyStartDate = '${utcNowDate}T00:00:00Z'
var anomalyEndDate   = '${dateTimeAdd(utcNowDate, 'P1Y', 'yyyy-MM-dd')}T00:00:00Z'

// API minimum 2022-10-01; 2024-08-01 is current GA (see baseline reference).
resource anomaly 'Microsoft.CostManagement/scheduledActions@2024-08-01' = {
  name: 'anomaly-${project}'                            // unique per subscription
  kind: 'InsightAlert'                                  // subscription scope only
  properties: {
    displayName: 'CostAnomaly-${project}'               // MUST be ≤ 25 chars
    status: 'Enabled'
    viewId: '${subscription().id}/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup' // scope-matched
    schedule: {
      frequency: 'Daily'
      hourOfDay: 7
      daysOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
      startDate: anomalyStartDate                       // T00:00:00Z aligned
      endDate:   anomalyEndDate                         // ≤ 1 year after startDate
    }
    notification: {
      to: costAlertEmails
      subject: '[Anomaly] ${project} daily cost spike'
    }
    notificationEmail: senderEmail
  }
}
```

Call site in `main.bicep`:

```bicep
module costAnomaly 'modules/cost-anomaly.bicep' = {
  name: 'cost-anomaly'
  scope: subscription()       // NOT resourceGroup(...) — provider rejects RG scope
  params: {
    project: project
    costAlertEmails: costAlertEmails
    senderEmail: senderEmail
  }
}
```

RG-scope anomaly is **deferred** — there is no current
`Microsoft.CostManagement/scheduledActions` shape that targets a
resource group.

## Gotchas

- Notification *count* is the binding constraint, not the dict-key
  naming. Stay at 5.
- `contactRoles: ['Owner']` resolves to RBAC `Owner` at the budget
  scope **at evaluation time**, not at deploy time. Adding/removing
  Owner role assignments takes effect on next budget evaluation
  without redeploying.
- The `existing` keyword requires the resource to exist at
  compile/what-if time, not just deploy time. Preflight discovery in
  Planner Phase 4 is what makes this safe.
- `scheduledActions` `name` must be unique per subscription; prefix
  with project to avoid collisions.
- The four §6 hard prerequisites (sub-scope only, displayName ≤ 25,
  scope-matched `viewId`, ≤ 1-year UTC-midnight `endDate`) are
  **provider-side**: `bicep build` + `bicep lint` will not catch
  them. They surface only at `az deployment sub what-if` /
  `az deployment sub create`. The 10-Challenger adversarial check
  D-5 must verify all four before handoff to 07b-Bicep Deploy.
