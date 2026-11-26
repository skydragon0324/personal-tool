# Frontend Deployment on RHEL 8

This guide deploys the project's Next.js frontend as a `systemd` service on RHEL 8. It assumes that:

- The FastAPI backend is already running as a service on `127.0.0.1:8000`.
- The repository is installed at `/opt/personal-tool`.
- The application is served publicly as `https://tasks.example.com`.
- A non-root service account named `personal-tool` owns the application files.
- NGINX terminates HTTPS and acts as the public reverse proxy.

Replace these example paths, account names, ports, and hostnames with the values used on the server.

## Deployment architecture

```text
Browser
   |
   | HTTPS :443
   v
NGINX
   |-- /api/*  -> FastAPI on 127.0.0.1:8000
   `-- /*      -> Next.js on 127.0.0.1:3000
```

Only NGINX should be exposed publicly. Do not open ports `3000` or `8000` in `firewalld` when all components run on the same server.

## 1. Check the Node.js installation

Display the installed versions and executable locations:

```bash
node --version
npm --version
command -v node
command -v npm
```

Record the absolute Node.js path. The example service below uses `/usr/bin/node`; change it if `command -v node` returns another path.

> **Security note:** This repository currently uses Next.js 12.3.4 and contains compatibility code for Node.js 12.16. Node.js 12 is end-of-life and no longer receives security updates. Use the runtime on which the application is currently verified only as a short-term measure. Plan and test an upgrade of Next.js and Node.js together before exposing the application to untrusted traffic. Do not change the production Node.js major version without running the full test and build process.

## 2. Configure the public application URL

Using one public origin for both the frontend and API simplifies cookies, CSRF protection, and CORS. In this example, both are available through `https://tasks.example.com`, while NGINX forwards `/api/` requests to FastAPI.

Create or update `/opt/personal-tool/frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=https://tasks.example.com
```

`NEXT_PUBLIC_API_URL` is embedded in the browser bundle during `npm run build`. Rebuild the frontend whenever this value changes.

Update `/opt/personal-tool/backend/.env` to match the public URL:

```dotenv
PUBLIC_BASE_URL=https://tasks.example.com
CORS_ORIGINS=https://tasks.example.com
ENVIRONMENT=production
COOKIE_SECURE=true
```

Keep all existing database, upload, session, and other backend settings. Restart the backend service after changing its environment:

```bash
sudo systemctl restart personal-tool-backend
sudo systemctl status personal-tool-backend
```

Replace `personal-tool-backend` with the actual backend service name.

### Separate frontend and backend hostnames

If the API is intentionally exposed at a different origin, use its public HTTPS address instead:

```dotenv
# frontend/.env.local
NEXT_PUBLIC_API_URL=https://api.example.com
```

The backend must then allow the frontend origin:

```dotenv
PUBLIC_BASE_URL=https://api.example.com
CORS_ORIGINS=https://tasks.example.com
ENVIRONMENT=production
COOKIE_SECURE=true
```

## 3. Install dependencies and build

Run the installation and build as the non-root deployment account:

```bash
cd /opt/personal-tool/frontend
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Do not use `npm run dev` in production.

Ensure the service account can read the application and write to the Next.js build/cache directory:

```bash
sudo chown -R personal-tool:personal-tool /opt/personal-tool
```

If the repository is intentionally owned by another deployment account, grant the service account only the required read access and write access to `frontend/.next` instead of changing ownership recursively.

## 4. Test the production server manually

From `/opt/personal-tool/frontend`, run:

```bash
npm run start -- -H 127.0.0.1 -p 3000
```

In another terminal, verify that it responds:

```bash
curl -I http://127.0.0.1:3000
```

Stop the manual process with `Ctrl+C` before enabling the service.

## 5. Create the frontend systemd service

Create `/etc/systemd/system/personal-tool-frontend.service`:

```ini
[Unit]
Description=Personal Tool Next.js Frontend
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=personal-tool
Group=personal-tool
WorkingDirectory=/opt/personal-tool/frontend
Environment=NODE_ENV=production

# This is equivalent to the repository's npm start script and preserves its
# Node.js compatibility flag. Replace /usr/bin/node if Node is elsewhere.
ExecStart=/usr/bin/node --experimental-modules /opt/personal-tool/frontend/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000

Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

If Node.js was installed through NVM, do not rely on `.bashrc` or `.profile`; `systemd` does not load an interactive shell. Put the absolute Node.js path returned by `command -v node` in `ExecStart`.

Validate and enable the service:

```bash
sudo chmod 644 /etc/systemd/system/personal-tool-frontend.service
sudo systemd-analyze verify /etc/systemd/system/personal-tool-frontend.service
sudo systemctl daemon-reload
sudo systemctl enable --now personal-tool-frontend
```

Check its status and local endpoint:

```bash
sudo systemctl status personal-tool-frontend
curl -I http://127.0.0.1:3000
```

Follow its logs with:

```bash
sudo journalctl -u personal-tool-frontend -f
```

## 6. Configure NGINX

Add the following locations to the HTTPS `server` block for `tasks.example.com`. Preserve the server's existing certificate and TLS configuration.

```nginx
# The backend currently allows uploads up to 10 MiB. Leave a small amount of
# room for multipart request overhead.
client_max_body_size 11m;

location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The `proxy_pass` values intentionally have no trailing path. Requests such as `/api/v1/health` must reach FastAPI with the same path.

### SELinux

On an SELinux-enforcing RHEL system, allow NGINX to connect to the local application services:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

Validate and reload NGINX:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
```

## 7. Configure the firewall

If the HTTPS service is not already allowed, expose HTTP/HTTPS for NGINX:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

Do not add public firewall rules for ports `3000` or `8000` when NGINX and the application services run on the same host.

## 8. Verify the complete deployment

Test each layer in order:

```bash
# Next.js directly on the server
curl -I http://127.0.0.1:3000

# FastAPI directly on the server
curl -fsS http://127.0.0.1:8000/api/v1/health

# Frontend through NGINX and TLS
curl -I https://tasks.example.com/

# Backend through NGINX and TLS
curl -fsS https://tasks.example.com/api/v1/health
```

In a browser, also verify:

1. Login and logout.
2. Creating or editing a task.
3. A request that changes data, confirming CSRF handling works.
4. File and image uploads.
5. Direct navigation to a route such as `/boards`.
6. A full page refresh on a board route.

Useful diagnostics:

```bash
sudo systemctl status personal-tool-frontend
sudo journalctl -u personal-tool-frontend --since "30 minutes ago"
sudo journalctl -u nginx --since "30 minutes ago"
sudo nginx -t
getenforce
```

## 9. Deploy frontend updates

The simple update procedure below causes a short frontend outage but avoids changing `node_modules` or `.next` while the server is using them:

```bash
sudo systemctl stop personal-tool-frontend

cd /opt/personal-tool
git pull --ff-only

cd frontend
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build

sudo systemctl start personal-tool-frontend
sudo systemctl status personal-tool-frontend
curl -I http://127.0.0.1:3000
```

For deployments requiring no downtime, build each release in a separate versioned directory and switch a `current` symlink only after the build succeeds.

## 10. Troubleshooting

### The service reports `node: No such file or directory`

Use the absolute result of `command -v node` in `ExecStart`. This commonly occurs when Node.js was installed through NVM.

### The service starts manually but fails under systemd

Check permissions and logs:

```bash
sudo -u personal-tool test -r /opt/personal-tool/frontend/package.json
sudo -u personal-tool test -w /opt/personal-tool/frontend/.next
sudo journalctl -u personal-tool-frontend -n 100 --no-pager
```

Also confirm that `WorkingDirectory`, `User`, `Group`, and the Node.js path are correct.

### NGINX returns `502 Bad Gateway`

Confirm that the local services are listening:

```bash
sudo ss -lntp | grep -E ':3000|:8000'
curl -I http://127.0.0.1:3000
curl -fsS http://127.0.0.1:8000/api/v1/health
```

If the local requests work but NGINX still returns `502`, verify SELinux:

```bash
getenforce
getsebool httpd_can_network_connect
sudo ausearch -m AVC -ts recent
```

### The browser calls `localhost:8000`

The frontend was built with an incorrect or missing `NEXT_PUBLIC_API_URL`. Correct `.env.local`, rebuild, and restart:

```bash
cd /opt/personal-tool/frontend
npm run build
sudo systemctl restart personal-tool-frontend
```

### Authentication works over HTTP but not HTTPS

Verify that the public URLs use `https://`, `ENVIRONMENT=production`, and `COOKIE_SECURE=true`. Confirm that NGINX forwards `X-Forwarded-Proto $scheme`.

### Frontend changes do not appear

Running `git pull` is not sufficient. Next.js production output must be rebuilt:

```bash
cd /opt/personal-tool/frontend
npm ci
npm run build
sudo systemctl restart personal-tool-frontend
```

## References

- [Next.js self-hosting guide](https://nextjs.org/docs/pages/guides/self-hosting)
- [Next.js deployment guide](https://nextjs.org/docs/app/getting-started/deploying)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [RHEL 8 systemd unit-file documentation](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html/using_systemd_unit_files_to_customize_and_optimize_your_system/assembly_working-with-systemd-unit-files_working-with-systemd)
- [RHEL 8 NGINX and reverse-proxy documentation](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html-single/deploying_different_types_of_servers/index)
