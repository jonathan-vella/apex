<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# AppInsights Instrumentation Guide (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

- User asks **how** to instrument (guidance, patterns, examples)
- User needs SDK setup instructions
- azure-prepare invokes this skill during research phase
- User wants to understand App Insights concepts

## When to Use azure-prepare Instead

- User says "add telemetry to my app"
- User says "add App Insights"
- User wants to modify their project
- Any request to change/add components

## Prerequisites

The app in the workspace must be one of these kinds

- An ASP.NET Core app hosted in Azure
- A Node.js app hosted in Azure

## Guidelines

### Collect context information

Find out the (programming language, application framework, hosting) tuple of the application the user is trying to add telemetry support in. This determines how the application can be instrumented. Read the source code to make an educated guess. Confirm with the user on anything you don't know. You must always ask the user where the application is hosted (e.g. on a personal computer, in an Azure App Service as code, in an Azure App Service as container, in an Azure Container App, etc.).

### Prefer auto-instrument if possible

> _See SKILL.md for full content._

## SDK Quick References

- **OpenTelemetry Distro**: [Python](references/sdk/azure-monitor-opentelemetry-py.md) | [TypeScript](references/sdk/azure-monitor-opentelemetry-ts.md)
- **OpenTelemetry Exporter**: [Python](references/sdk/azure-monitor-opentelemetry-exporter-py.md) | [Java](references/sdk/azure-monitor-opentelemetry-exporter-java.md)
