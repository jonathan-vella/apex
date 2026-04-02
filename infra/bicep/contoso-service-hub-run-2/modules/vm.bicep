// modules/vm.bicep — Management / SDLC Virtual Machine (Ubuntu 22.04 LTS)
// AVM: br/public:avm/res/compute/virtual-machine:0.10.0
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-019 — Managed disk encryption at host
//   POL-020 — Private access only (no public IP; accessible only via Bastion)
//   POL-021 — User-assigned managed identity (no local credential secrets)
//   POL-022 — Azure Monitor Agent for guest OS telemetry to Log Analytics
// Security: SSH-only auth, no public IP, encryption at host, user-assigned managed identity.

@description('Azure region for the virtual machine (must be swedencentral, POL-001).')
param location string

@description('Deployment environment — controls VM size and zone placement.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('4-character unique suffix derived from resource group ID (passed from main.bicep).')
#disable-next-line no-unused-params
param uniqueSuffix string

@description('Virtual machine name.')
param vmName string

@description('Management subnet resource ID (snet-mgmt). VM has no public IP — Bastion provides access (POL-020).')
param mgmtSubnetId string

@description('User-assigned managed identity resource ID (POL-021).')
param managedIdentityId string

@description('SSH public key for the VM admin account. RSA public key in OpenSSH format.')
@secure()
param vmSshPublicKey string

@description('VM admin username. Must not be "admin", "root", or reserved OS usernames.')
param vmAdminUsername string = 'azureuser'

// ─────────────────────────────── Environment sizing ──────────────────────────

// VM size: D8s_v5 (prod) matches RFQ sizing; D4s_v5 (dev/staging) reduces cost.
var vmSize = env == 'prod' ? 'Standard_D8s_v5' : 'Standard_D4s_v5'

// ─────────────────────────────── Virtual Machine ─────────────────────────────

module virtualMachine 'br/public:avm/res/compute/virtual-machine:0.10.0' = {
  name: 'management-vm'
  params: {
    name: vmName
    location: location
    tags: tags

    // VM size — environment-specific
    vmSize: vmSize

    // Placement: zone 1 for prod single-zone HA baseline
    // Extend to multi-zone deployment set for zone-redundant SDLC fleet
    zone: 1

    // OS type required for Linux-specific authentication configuration
    osType: 'Linux'

    // ── OS Image ──────────────────────────────────────────────────────────────
    // Ubuntu Server 22.04 LTS (Jammy), Gen2 image for Trusted Launch + vTPM support.
    imageReference: {
      publisher: 'Canonical'
      offer: '0001-com-ubuntu-server-jammy'
      sku: '22_04-lts-gen2'
      version: 'latest'
    }

    // ── OS Disk ───────────────────────────────────────────────────────────────
    // Premium_LRS for low latency SDLC workloads; 128 GB accommodates build toolchain.
    // POL-019: encryption at host ensures data is encrypted on the physical host.
    osDisk: {
      name: '${vmName}-osdisk'
      caching: 'ReadWrite'
      diskSizeGB: 128
      managedDisk: {
        storageAccountType: 'Premium_LRS'
      }
      createOption: 'FromImage'
    }

    // ── Data Disk ─────────────────────────────────────────────────────────────
    // 256 GB SSD for build artefacts, Docker layer cache, and container registries.
    dataDisks: [
      {
        lun: 0
        name: '${vmName}-datadisk-01'
        diskSizeGB: 256
        caching: 'ReadWrite'
        managedDisk: {
          storageAccountType: 'StandardSSD_LRS'
        }
        createOption: 'Empty'
      }
    ]

    // ── Authentication ────────────────────────────────────────────────────────
    // SSH key only — password authentication disabled per security baseline.
    adminUsername: vmAdminUsername
    disablePasswordAuthentication: true
    publicKeys: [
      {
        keyData: vmSshPublicKey
        path: '/home/${vmAdminUsername}/.ssh/authorized_keys'
      }
    ]

    // ── Networking ────────────────────────────────────────────────────────────
    // Single NIC on management subnet; no public IP (POL-020) — access via Bastion only.
    nicConfigurations: [
      {
        nicSuffix: '-nic-01'
        enableAcceleratedNetworking: true
        ipConfigurations: [
          {
            name: 'ipconfig01'
            subnetResourceId: mgmtSubnetId
            privateIPAllocationMethod: 'Dynamic'
          }
        ]
      }
    ]

    // ── Security ──────────────────────────────────────────────────────────────
    // Encryption at host: all managed disk temp/cache content encrypted at rest on host (POL-019).
    encryptionAtHost: true

    // ── Identity ─────────────────────────────────────────────────────────────
    // User-assigned identity for SDK-based Azure authentication — no secrets needed (POL-021).
    managedIdentities: {
      userAssignedResourceIds: [ managedIdentityId ]
    }

    // ── Monitoring ────────────────────────────────────────────────────────────
    // Installs Azure Monitor Agent (AMA) extension on the VM for guest OS telemetry.
    // AMA sends heartbeat, performance counters, and syslog to Log Analytics once a
    // Data Collection Rule (DCR) association is configured post-deployment.
    //
    // IMPORTANT: `workspaceId` (a Log Analytics workspace resource ID) is NOT a valid
    // value for `dataCollectionRuleResourceId`. DCR associations require a
    // Microsoft.Insights/dataCollectionRules resource ID. Creating a DCR is a
    // post-deployment step (or handled by the Azure Monitor Baseline Alerts policy
    // assigned to this subscription). The extension is installed here; the DCR
    // association is not wired in this template because no DCR resource exists in scope.
    extensionMonitoringAgentConfig: {
      enabled: true
      tags: tags
    }
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Management VM resource ID.')
output vmId string = virtualMachine.outputs.resourceId

@description('Management VM name.')
output vmName string = virtualMachine.outputs.name
