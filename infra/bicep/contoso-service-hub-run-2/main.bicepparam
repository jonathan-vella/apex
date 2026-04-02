// main.bicepparam — Contoso Service Hub Run-2
// Default values for development environment
// Apply to: main.bicep

using './main.bicep'

// Environment — controls sizing, retention, and budget amounts
param env = 'dev'

// Azure region — swedencentral is the mandatory EU-compliant default (LIVE-001)
param location = 'swedencentral'

// Deploy foundation phase only; change to 'data', 'edge', 'platform', or 'all' as needed.
// Phases are cumulative: foundation always deploys; platform also includes data and edge.
param deployPhase = 'foundation'

// ─────────────────────── Governance tag parameters ────────────────────────────
// All 9 tags below are REQUIRED by LIVE-002 and LIVE-003 (Deny effect on RG creation).
// Update values to match your team's tagging standards before deployment.

param owner             = 'Contoso'
param costCenter        = 'CC-PLATFORM'
param application       = 'contoso-service-hub'
param workload          = 'platform-engineering'
param sla               = 'tier-2'
param backupPolicy      = 'daily-7d'
param maintWindow       = 'sat-02:00-04:00'
param technicalContact  = 'platform-ops@contoso.com'

// Budget alert recipients — receives Forecast 80%/100%/120% notifications
param budgetContactEmails = [
  'platform-ops@contoso.com'
]

// Management VM SSH public key — bootstrap key for dry-run and non-production validation.
// Override with an operator-controlled public key before any real platform deployment.
param vmSshPublicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDTvvwWR3KtBPYq9XyXLm7kP7uHOdGWK7dAh4Fd0dmsCEkxOnPrLL2Nm4KK1AIijOjLjcIrNM4P6miFrwpghkv2TeRMG/hApfYCsYlYkb2YGFsw22Yj/Ts3gc5pp4pqVUYvrrw3zRL3DZmpPROs7EtLCMzC0kQblg5FormXH3tT+9703p3PIg6NBJRA1XxtXvWKmPT7NSHybQlSBpcpLVEtE3CEudKZnignxDsBXtWK6BeKsf/UBr1yp4EBantepAtJZN3m4Rw2QVev/vuHlC19eizQXkPv9DmlznmapKx6CpmRYN3CZaEa552EU6mErDt80k1cfqmazNXvRGulPCmfxLyuwH6Rnd96yJ1tv24+q2WOYb2qe7uF1rQ5mciwd2donHTy/m5ik3ir0t3/n4SrHqbYtTGiYLim1Em8JU6w4bpG8klSeNrJqYktnam4Tkdz1O6WtxLY0PZqbTj0o6M+14fm09AsxMYcL37D8Vt1zGFkoUlkkPoDS3mQ9++pNqZK82gvBuv0FjTLmPwS+mZMQm8EDDlBmzMGmXUWjYKmiKyjSZwLRX5YPvOSwm+lzjvdEdE5zmHnqzXv2ze5ApGb0gMSQRZXfnAnkAjyPy3edf9poJK+Jf2L8VHKi4hqc6fxEnMUDW/Ydpt06QaDR0l4YLPMKDtOy74j+QUp6F0KwQ== contoso-e2e-bootstrap'

// Management VM admin username — must not be a reserved OS username (admin, root, etc.)
param vmAdminUsername = 'azureuser'
