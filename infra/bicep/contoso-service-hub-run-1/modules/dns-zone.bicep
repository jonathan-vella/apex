// modules/dns-zone.bicep
// Phase 1 — Public DNS zone for externally routable service endpoints
// AVM: br/public:avm/res/network/dns-zone:0.5.4
// Governance: mandatory tags; DNS zones are global (EU location constraint N/A)

@description('Public DNS zone name (e.g. dev.contoso-svchub.com).')
param dnsZoneName string

@description('Resource tags applied to all resources in this module.')
param tags object

// ──────────────────────────────── Public DNS Zone ─────────────────────────────
// Public DNS zones are always global resources — location is always 'global'

module dnsZone 'br/public:avm/res/network/dns-zone:0.5.4' = {
  name: 'public-dns-zone'
  params: {
    name: dnsZoneName
    location: 'global'
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Public DNS zone resource ID.')
output dnsZoneId string = dnsZone.outputs.resourceId

@description('Public DNS zone name.')
output dnsZoneName string = dnsZone.outputs.name

@description('Name server records for the public DNS zone — delegate from registrar.')
output nameServers array = dnsZone.outputs.nameServers
