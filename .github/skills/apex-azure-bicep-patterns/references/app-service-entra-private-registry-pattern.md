<!-- ref:app-service-entra-private-registry-v1 -->

# App Service with a Private Registry and Entra Sign-in

Verified against Microsoft Learn on 2026-10-15 (VNet integration, routing, Entra
authentication, point-in-time restore). AVM gaps were observed at the module
versions named below; re-check them against the current MCR release before
relying on them.

## Private container registry pull

- Pulling from a registry behind a private endpoint needs the app VNet integrated and image
  pull routed through it. Set `outboundVnetRouting.imagePullTraffic = true`; `allTraffic = true`
  already covers it. The legacy `vnetImagePullEnabled` property and the
  `WEBSITE_PULL_IMAGE_OVER_VNET` app setting still work. Prefer the site property: Azure Policy can audit it.
- Configuration traffic is public by default. Key Vault references fall back to the VNet
  integration when the vault blocks public access. Managed identity token acquisition is
  public unless `outboundVnetRouting.managedIdentityTraffic = true` or `allTraffic = true`.
- The integration subnet needs outbound 443 to Entra and registry endpoints the NSG or routes allow.
- Order the registry and Key Vault private endpoints and DNS links before the apps that consume them.

## Certificateless Entra sign-in (workforce tenants only)

- Create a federated identity credential on the app registration that trusts the app's
  user-assigned managed identity.
- Add the slot-sticky app setting `OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID` with the managed
  identity's **client ID** (not the app registration's), and set the provider's
  `clientSecretSettingName` to that setting name.
- Assign that identity to this app only; sharing it widens access to the app registration.
- The federated credential lives on the app registration, so it is created outside the platform
  deployment. Sequence it after the identity exists and before the app serves traffic.
- If sign-in ownership sits with another team, the platform deploys none of the above.

## Known AVM gaps (observed on nordic-foods)

| Module                    | Version observed | Gap                                                                |
| ------------------------- | ---------------- | ------------------------------------------------------------------ |
| `avm/res/web/site`        | 0.24.0           | No input for `authsettingsV2`; use a raw `config` child resource   |
| `avm/res/sql/server`      | 0.22.1           | No server-level diagnostic settings (database level only)          |

A raw resource here needs a `### Raw Resource Exceptions` record in the plan.

## Storage point-in-time restore

The restore retention period must be at least one day less than the blob soft delete
retention. With 30-day soft delete, restore days are at most 29.
