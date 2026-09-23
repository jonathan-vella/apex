# Unable to SSH into the VM

Use for Linux VM SSH failures.

## Symptoms -> Solutions

| Symptom | Action | Docs |
| --- | --- | --- |
| connection refused on 22 | Check sshd running/listening and port config | [SSH overview] |
| connection timed out | Check power state, public IP, NSG, routes | [SSH overview] |
| permission denied publickey/password | Verify user, key, password auth; reset key/password | [SSH detail] |
| host key verification failed | Remove stale `known_hosts` entry | [SSH detail] |
| server closed connection | Check disk, PAM, sshd config | [SSH detail] |
| hangs with no response | Check firewall, routes, NIC | [SSH overview] |
| Debian-specific failure | Check Debian networking/sshd doc | [Debian] |
| SELinux blocks sshd | Fix the SELinux policy or file contexts; don't switch the VM to permissive mode | [SELinux] |
| Entra ID SSH denied | Assign VM Admin/User Login role | [SSH overview] |
| VM not booting/UEFI failure | Use boot diagnostics and repair VM | [UEFI] |

## Quick Commands

> Commands use VM agent/extensions. Run [Pre-Flight Safety Checks](cannot-connect-to-vm.md#pre-flight-safety-checks) first.
> Password resets use the portal's **Reset password** blade; never pass a password on a command line.

```bash
az vm user reset-ssh --name <vm> -g <rg>
az vm user update --name <vm> -g <rg> -u <user> --ssh-key-value "<ssh-public-key>"
az vm run-command invoke --name <vm> -g <rg> --command-id RunShellScript \
  --scripts "systemctl status sshd; getenforce"
az vm run-command invoke --name <vm> -g <rg> --command-id RunShellScript \
  --scripts "grep -i denied /var/log/audit/audit.log | tail -n 20"
```

[SSH overview]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/troubleshoot-ssh-connection
[SSH detail]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/detailed-troubleshoot-ssh-connection
[Debian]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/cannot-connect-debian-linux
[SELinux]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/linux-selinux-troubleshooting
[UEFI]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/azure-linux-vm-uefi-boot-failures