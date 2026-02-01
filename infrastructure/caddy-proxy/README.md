# Proxy Server Setup (Caddy + Node.js)

This folder contains the configuration for your **Custom Domain Proxy Server**.
You should deploy this on a small Linux VM (e.g., Linode Nanode, DigitalOcean Droplet, or GCP e2-micro).

## Architecture
1.  **Caddy:** Listens on port 80/443. Handles SSL automatically (Let's Encrypt).
2.  **Router.js:** A Node.js script running on localhost:3000. It checks your main backend to see which site to serve, then proxies the content from Google Cloud Storage.

## Deployment Steps

### 1. Provision a VM
*   **OS:** Ubuntu 22.04 LTS (Recommended)
*   **Firewall:** Allow ports 80 (HTTP), 443 (HTTPS), and 22 (SSH).

### 2. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install Caddy
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 4. Setup the Router
1.  Copy `router.js` and `package.json` to `/var/www/router`.
2.  Run `npm install`.
3.  Create a systemd service to keep it running:
    *   `sudo nano /etc/systemd/system/router.service`
    *   Paste the following:
        ```ini
        [Unit]
        Description=Node.js Router
        After=network.target

        [Service]
        User=root
        WorkingDirectory=/var/www/router
        ExecStart=/usr/bin/node router.js
        Restart=always
        Environment=BACKEND_API=https://YOUR_BACKEND_URL.run.app

        [Install]
        WantedBy=multi-user.target
        ```
    *   `sudo systemctl enable router`
    *   `sudo systemctl start router`

### 5. Setup Caddy
1.  Copy `Caddyfile` to `/etc/caddy/Caddyfile`.
2.  Reload Caddy: `sudo systemctl reload caddy`.

## How it Works
1.  User visits `myshop.com`.
2.  Caddy receives request.
3.  Caddy asks `router.js` (localhost:3000): "Who is this?"
4.  `router.js` asks your Main Backend: "Who owns myshop.com?"
5.  Main Backend says: "Project ID 123".
6.  `router.js` fetches `storage.googleapis.com/.../123/index.html` and returns it to Caddy.
7.  Caddy serves it to the user with SSL.
