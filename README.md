# mannix-portfolio

Source for my personal portfolio site, plus the pipeline that deploys it to my homelab on every push.

**Live:** https://portfolio-site.tail8c489d.ts.net/
**Backup (GitHub Pages):** https://mannixgr.github.io/mannix-portfolio/

The site itself is three static pages (home, projects, experience) sharing one stylesheet and script. The more interesting part is how it gets published: a push to `main` joins a private network as a locked-down CI node and syncs the files into a container in my homelab, with no ports opened on my router.

## How it's deployed

```
git push to main
  -> GitHub Actions runner
  -> joins my tailnet (Tailscale OAuth client, ephemeral node tagged tag:ci)
  -> SSH as `deploy` to a Debian LXC container on my Proxmox host
  -> rsync into the web root
  -> served by Caddy
  -> exposed publicly through Tailscale Funnel
```

The workflow is in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Security design

- **No open router ports.** Public traffic arrives through Tailscale Funnel. The CI runner reaches the server over the tailnet.
- **Least-privilege CI node.** A Tailscale ACL grant lets `tag:ci` reach exactly one host on port 22 and nothing else.
- **No-shell deploy user.** The `deploy` user's key is restricted in `authorized_keys` to a wrapper script that only permits an rsync server command ending at the web root. Anything else is rejected.
- **Pinned host key.** The workflow trusts only the server key stored in a secret and uses `StrictHostKeyChecking=yes`, so it can't be pointed at an impostor.
- **Minimal token permissions.** The workflow requests `contents: read` only.
- **No overlapping deploys.** A concurrency group queues runs instead of cancelling a deploy mid-sync.

### Required repository secrets

| Secret | Purpose |
| --- | --- |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID (scoped to `tag:ci`) |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret |
| `DEPLOY_SSH_KEY` | Private key for the restricted `deploy` user |
| `DEPLOY_KNOWN_HOSTS` | Server host key, from `ssh-keyscan -t ed25519 <host>` |

### A note on `rsync --delete`

The sync uses `--delete`, so the web root is an exact mirror of this repo. Anything on the server that isn't in the repo is removed. If you change the destination path, preview with `--dry-run` first. `.git*` and `.github` are excluded from the sync.

## What broke along the way

Getting this working took four separate fixes: a wrong deploy path, empty secrets, a missing `rsync` binary in the minimal container, and a protocol error from a hardcoded forced command. The full write-up, including the errors and the fixes, is here:

[What broke & how I fixed it](https://github.com/Mannixgr/Homelab/blob/main/docs/2026-09-deploy-pipeline.md)

## Repository contents

| File | What it is |
| --- | --- |
| `index.html` | Home: hero, summary and the project picker |
| `projects.html` | Full project write-ups with diagrams |
| `experience.html` | Experience, skills and education |
| `styles.css` | Shared styles for all pages |
| `site.js` | Shared scripts (hero network, project picker, diagram animation, scroll reveal) |
| `hybridhomelab.drawio.svg` | Architecture diagram for the Enterprise Hybrid AWS project |
| `homelab-network.svg` | Homelab network diagram |
| `og-image.png` | Social preview image |
| `.github/workflows/deploy.yml` | Deploy pipeline |

## Run it locally

No build step. Serve the folder and open the page:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Related

- [Homelab](https://github.com/Mannixgr/Homelab): configs, diagrams, and write-ups for the network and server this runs on
- [enterprise-hybrid-aws](https://github.com/Mannixgr/enterprise-hybrid-aws): Terraform and GitHub Actions OIDC on AWS
- [CloudGuard](https://github.com/Mannixgr/CloudGuard): AWS operations and cost-governance platform (early development)
