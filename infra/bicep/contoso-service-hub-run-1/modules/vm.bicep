// modules/vm.bicep
// Phase 4 — Utility Virtual Machine (Ubuntu 22.04 LTS, no public IP)
// AVM: br/public:avm/res/compute/virtual-machine:0.22.0
// Governance:
//   - EU location enforced (allowed-eu-locations policy)
//   - Mandatory 4 tags (required-tags policy)
//   - No public IP (private VNet only via snet-compute)
//   - Encryption at host enabled (managed disk encryption)
//   - User-assigned managed identity (no local credentials for Azure services)
//   - Password authentication disabled (SSH key-only)

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('User-assigned managed identity resource ID.')
param identityId string

@description('Compute subnet resource ID (snet-compute) for the VM NIC.')
param subnetComputeId string

@description('SSH public key data for the azureuser account. Must be a valid RSA public key in OpenSSH format.')
@secure()
param vmSshPublicKey string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived configuration ───────────────────────

// CAF naming: vm-{project}-{env}
// Linux VM names max 64 chars; must not start/end hyphens.
var vmName = 'vm-${projectName}-${environment}'

// VM size: Standard_D8s_v5 (prod) to match RFQ; Standard_D4s_v5 (dev/staging).
var vmSize = environment == 'prod' ? 'Standard_D8s_v5' : 'Standard_D4s_v5'

// ─────────────────────────────── Virtual Machine ─────────────────────────────

module virtualMachine 'br/public:avm/res/compute/virtual-machine:0.22.0' = {
  name: 'virtual-machine'
  params: {
    name: vmName
    location: location
    vmSize: vmSize
    osType: 'Linux'

    // ── OS configuration ──────────────────────────────────────────────────────
    // Ubuntu 22.04 LTS (Jammy), Gen2 image for Trusted Launch support.
    imageReference: {
      publisher: 'Canonical'
      offer: '0001-com-ubuntu-server-jammy'
      sku: '22_04-lts-gen2'
      version: 'latest'
    }
    osDisk: {
      caching: 'ReadWrite'
      diskSizeGB: 128
      managedDisk: {
        storageAccountType: 'Premium_LRS'
      }
    }

    // ── Authentication ─────────────────────────────────────────────────────────
    // SSH key only — password authentication disabled per security baseline.
    adminUsername: 'azureuser'
    disablePasswordAuthentication: true
    publicKeys: [
      {
        keyData: vmSshPublicKey
        path: '/home/azureuser/.ssh/authorized_keys'
      }
    ]

    // ── Networking ────────────────────────────────────────────────────────────
    // Single NIC on compute subnet, no public IP.
    nicConfigurations: [
      {
        nicSuffix: '-nic-01'
        ipConfigurations: [
          {
            name: 'ipconfig01'
            subnetResourceId: subnetComputeId
            privateIPAllocationMethod: 'Dynamic'
          }
        ]
      }
    ]

    // ── Security ──────────────────────────────────────────────────────────────
    // Encryption at host encrypts all managed disk data at rest on host.
    encryptionAtHost: true

    // ── Availability zone ─────────────────────────────────────────────────────
    // Zone 1 provides single-zone HA baseline; extend to multi-zone for HA.
    availabilityZone: 1

    // ── Identity ─────────────────────────────────────────────────────────────
    // User-assigned identity for Azure SDK authentication (no secrets needed).
    managedIdentities: {
      userAssignedResourceIds: [identityId]
    }

    // ── Monitoring ────────────────────────────────────────────────────────────
    // Azure Monitor agent (AMA) sends guest OS metrics/logs to Log Analytics.
    extensionMonitoringAgentConfig: {
      enabled: true
    }

    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Utility VM resource ID.')
output vmId string = virtualMachine.outputs.resourceId

@description('Utility VM name.')
output vmName string = virtualMachine.outputs.name
