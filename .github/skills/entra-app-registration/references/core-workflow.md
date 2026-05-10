# Core Entra App-Registration Workflow

> Loaded by `entra-app-registration` SKILL.md when the agent is doing the
> end-to-end app-registration walkthrough. The SKILL.md keeps a 5-step
> summary; this file holds the per-step procedure with portal + CLI + IaC
> branches.

## Step 1: Register the Application

Create an app registration in the Azure portal or using Azure CLI.

**Portal Method:**

1. Navigate to Azure Portal → Microsoft Entra ID → App registrations
2. Click "New registration"
3. Provide name, supported account types, and redirect URI
4. Click "Register"

**CLI Method:** See [`cli-commands.md`](./cli-commands.md)
**IaC Method:** See [`BICEP-EXAMPLE.bicep`](./BICEP-EXAMPLE.bicep)

It's highly recommended to use IaC to manage Entra app registrations if you already use IaC
in your project, need a scalable solution for managing many app registrations, or need
fine-grained audit history of configuration changes.

## Step 2: Configure Authentication

Set up authentication settings based on your application type.

- **Web Apps**: Add redirect URIs, enable ID tokens if needed
- **SPAs**: Add redirect URIs, enable implicit grant flow if necessary
- **Mobile/Desktop**: Use `http://localhost` or custom URI scheme
- **Services**: No redirect URI needed for client credentials flow

## Step 3: Configure API Permissions

Grant your application permission to access Microsoft APIs or your own APIs.

**Common Microsoft Graph Permissions:**

- `User.Read` — Read user profile
- `User.ReadWrite.All` — Read and write all users
- `Directory.Read.All` — Read directory data
- `Mail.Send` — Send mail as a user

**Details:** See [`api-permissions.md`](./api-permissions.md)

## Step 4: Create Client Credentials (if needed)

For confidential client applications (web apps, services), create a client secret,
certificate, or federated identity credential.

**Client Secret:**

- Navigate to "Certificates & secrets"
- Create new client secret
- Copy the value immediately (only shown once)
- Store securely (Key Vault recommended)

**Certificate:** For production environments, use certificates instead of secrets for
enhanced security. Upload certificate via "Certificates & secrets" section.

**Federated Identity Credential:** For dynamically authenticating the confidential client
to the Entra platform.

## Step 5: Implement OAuth Flow

Integrate the OAuth flow into your application code.

**See:**

- [`oauth-flows.md`](./oauth-flows.md) — OAuth 2.0 flow details
- [`console-app-example.md`](./console-app-example.md) — Console app implementation
