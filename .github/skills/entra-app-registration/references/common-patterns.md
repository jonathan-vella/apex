<!-- ref:entra-common-patterns-v1 -->

# Common Entra App Registration Patterns

## Pattern 1: First-Time App Registration

Walk user through their first app registration step-by-step.

**Required information:**

- Application name
- Application type (web, SPA, mobile, service)
- Redirect URIs (if applicable)
- Required permissions

**Script:** [`first-app-registration.md`](first-app-registration.md)

## Pattern 2: Console Application with User Authentication

Create a .NET/Python/Node.js console app that authenticates users.

**Required information:**

- Programming language (C#, Python, JavaScript, etc.)
- Authentication library (MSAL recommended)
- Required permissions

**Example:** [`console-app-example.md`](console-app-example.md)

## Pattern 3: Service-to-Service Authentication

Set up daemon/service authentication without user interaction.

**Required information:**

- Service/app name
- Target API/resource
- Whether to use secret or certificate

**Implementation:** Use Client Credentials flow — [`oauth-flows.md#client-credentials-flow`](oauth-flows.md#client-credentials-flow)

## Entra Key Concepts (Reference)

| Concept                     | Description                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| **App Registration**        | Configuration that allows an app to use Microsoft identity platform |
| **Application (Client) ID** | Unique identifier for your application                              |
| **Tenant ID**               | Unique identifier for your Azure AD tenant/directory                |
| **Client Secret**           | Password for the application (confidential clients only)            |
| **Redirect URI**            | URL where authentication responses are sent                         |
| **API Permissions**         | Access scopes your app requests                                     |
| **Service Principal**       | Identity created in your tenant when you register an app            |

## Application Types

| Type                      | Use Case                      |
| ------------------------- | ----------------------------- |
| **Web Application**       | Server-side apps, APIs        |
| **Single Page App (SPA)** | JavaScript/React/Angular apps |
| **Daemon/Service**        | Background services, APIs     |
