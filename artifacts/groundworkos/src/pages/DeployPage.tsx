import { useState } from "react";
import {
  Copy,
  Check,
  Server,
  Shield,
  Zap,
  Globe,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import { Panel } from "../components/ui/Panel";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div
      className="relative rounded-lg overflow-hidden my-3"
      style={{ backgroundColor: "#181410", border: "1px solid #2a2520" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: "#201c18",
          borderBottom: "1px solid #2a2520",
        }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest font-mono"
          style={{ color: "#7a7469" }}
        >
          {lang}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded transition-colors hover:bg-[#2a2520]"
          style={{ color: copied ? "#2a6e45" : "#7a7469" }}
        >
          {copied ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="px-4 py-3 text-sm overflow-x-auto leading-relaxed"
        style={{ color: "#e8e4dd", fontFamily: "'JetBrains Mono', monospace" }}
      >
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-mono"
          style={{ backgroundColor: "#e8f3f7", color: "#1b5e78" }}
        >
          {n}
        </div>
      </div>
      <div className="flex-1 pb-8" style={{ borderLeft: "none" }}>
        <h3
          className="text-base font-semibold mb-3 mt-0.5"
          style={{
            color: "#181410",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed mb-3" style={{ color: "#4a4540" }}>
      {children}
    </p>
  );
}

function Note({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warn";
}) {
  const colors =
    type === "warn"
      ? {
          bg: "#fff8f0",
          border: "rgba(181,105,24,0.25)",
          icon: "#b56918",
          text: "#7a4a0a",
        }
      : {
          bg: "#e8f3f7",
          border: "rgba(27,94,120,0.2)",
          icon: "#1b5e78",
          text: "#0f3d52",
        };
  return (
    <div
      className="flex gap-3 p-3.5 rounded-lg my-3 text-sm leading-relaxed"
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
      }}
    >
      {type === "warn" ? (
        <AlertTriangle
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          style={{ color: colors.icon }}
        />
      ) : (
        <Shield
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          style={{ color: colors.icon }}
        />
      )}
      <div>{children}</div>
    </div>
  );
}

type Section = "server" | "app" | "nginx" | "ssl" | "pm2" | "env";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "server", label: "Server Setup", icon: <Server className="w-4 h-4" /> },
  { id: "app", label: "App Deployment", icon: <Zap className="w-4 h-4" /> },
  { id: "nginx", label: "Nginx Proxy", icon: <Globe className="w-4 h-4" /> },
  {
    id: "ssl",
    label: "Let's Encrypt SSL",
    icon: <Shield className="w-4 h-4" />,
  },
  {
    id: "pm2",
    label: "PM2 Process Manager",
    icon: <Terminal className="w-4 h-4" />,
  },
  {
    id: "env",
    label: "Environment & Secrets",
    icon: <Terminal className="w-4 h-4" />,
  },
];

export function DeployPage() {
  const [section, setSection] = useState<Section>("server");

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1
          className="text-xl font-semibold"
          style={{
            color: "#181410",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Oracle ARM A1 Deployment Guide
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#7a7469" }}>
          nginx reverse proxy · PM2 process manager · Let's Encrypt SSL — Oracle
          Cloud Always Free tier (Ampere A1)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <Panel>
              <nav className="space-y-0.5">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
                    style={
                      section === s.id
                        ? {
                            backgroundColor: "#e8f3f7",
                            color: "#1b5e78",
                            fontWeight: 500,
                          }
                        : { color: "#4a4540" }
                    }
                  >
                    <span
                      style={{
                        color: section === s.id ? "#1b5e78" : "#7a7469",
                      }}
                    >
                      {s.icon}
                    </span>
                    {s.label}
                  </button>
                ))}
              </nav>
            </Panel>
          </div>
        </div>

        <div className="lg:col-span-3">
          <Panel>
            {section === "server" && (
              <div>
                <h2
                  className="text-lg font-semibold mb-1"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Oracle ARM A1 Server Setup
                </h2>
                <p className="text-sm mb-6" style={{ color: "#7a7469" }}>
                  Provision and harden your Oracle Cloud Always Free Ampere A1
                  instance.
                </p>

                <Note>
                  Oracle's Always Free tier includes 4 OCPUs + 24 GB RAM on ARM
                  — more than enough for GroundworkOS.
                </Note>

                <Step n={1} title="Provision the instance">
                  <P>
                    In Oracle Cloud Console → Compute → Instances → Create
                    instance:
                  </P>
                  <ul
                    className="text-sm space-y-1 mb-3 pl-4 list-disc"
                    style={{ color: "#4a4540" }}
                  >
                    <li>
                      Shape: <strong>VM.Standard.A1.Flex</strong> — 2 OCPUs, 12
                      GB RAM
                    </li>
                    <li>
                      Image: <strong>Canonical Ubuntu 22.04</strong> (aarch64)
                    </li>
                    <li>Boot volume: 50 GB</li>
                    <li>Upload your SSH public key</li>
                  </ul>
                  <P>Note your instance's public IP address.</P>
                </Step>

                <Step n={2} title="Open firewall ports">
                  <P>
                    In the OCI Console → Networking → VCN → Security Lists, add{" "}
                    <strong>Ingress Rules</strong>:
                  </P>
                  <CodeBlock
                    lang="text"
                    code={`
TCP  0.0.0.0/0  :80    HTTP
TCP  0.0.0.0/0  :443   HTTPS
TCP  your-ip/32 :22    SSH (restrict to your IP)
                  `}
                  />
                  <P>Also open the OS-level firewall on the instance:</P>
                  <CodeBlock
                    code={`
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
                  `}
                  />
                </Step>

                <Step n={3} title="Initial server hardening">
                  <CodeBlock
                    code={`
ssh ubuntu@YOUR_SERVER_IP

# Update packages
sudo apt update && sudo apt upgrade -y

# Create deploy user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh

# Disable root SSH login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
                  `}
                  />
                </Step>

                <Step n={4} title="Install Node.js 20 LTS + pnpm">
                  <CodeBlock
                    code={`
# Switch to deploy user
sudo su - deploy

# Install Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # v20.x.x
npm -v

# Install pnpm globally
npm install -g pnpm

# Install PM2 globally
npm install -g pm2
                  `}
                  />
                </Step>

                <Step n={5} title="Install PostgreSQL 16">
                  <CodeBlock
                    code={`
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql <<SQL
CREATE USER groundwork WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE groundworkos OWNER groundwork;
GRANT ALL PRIVILEGES ON DATABASE groundworkos TO groundwork;
SQL
                  `}
                  />
                </Step>
              </div>
            )}

            {section === "app" && (
              <div>
                <h2
                  className="text-lg font-semibold mb-1"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Application Deployment
                </h2>
                <p className="text-sm mb-6" style={{ color: "#7a7469" }}>
                  Clone, build, and initialise GroundworkOS on your server.
                </p>

                <Step n={1} title="Clone the repository">
                  <CodeBlock
                    code={`
sudo su - deploy
cd /home/deploy

git clone https://github.com/YOUR_USERNAME/groundworkos.git
cd groundworkos
                  `}
                  />
                </Step>

                <Step n={2} title="Install dependencies">
                  <CodeBlock
                    code={`
pnpm install --frozen-lockfile
                  `}
                  />
                </Step>

                <Step n={3} title="Build the frontend">
                  <CodeBlock
                    code={`
# Build the React app (outputs to artifacts/groundworkos/dist/)
pnpm --filter @workspace/groundworkos run build

# Verify build output
ls artifacts/groundworkos/dist/
                  `}
                  />
                </Step>

                <Step n={4} title="Run database migrations">
                  <CodeBlock
                    code={`
# Set DATABASE_URL temporarily for migration
export DATABASE_URL="postgresql://groundwork:STRONG_PASSWORD_HERE@localhost:5432/groundworkos"

# Push schema with drizzle-kit
cd lib/db
pnpm run db:push
cd ../..
                  `}
                  />
                  <Note>
                    If db:push hangs on TTY prompt, run it with:{" "}
                    <code
                      className="text-xs font-mono px-1 py-0.5 rounded"
                      style={{ backgroundColor: "#d9d4ce" }}
                    >
                      echo yes | pnpm run db:push
                    </code>
                  </Note>
                </Step>

                <Step n={5} title="Create the .env file">
                  <P>
                    See the <strong>Environment & Secrets</strong> section for
                    the full list of required variables.
                  </P>
                  <CodeBlock
                    code={`
cp .env.example .env.production
nano .env.production   # fill in all values
                  `}
                  />
                </Step>
              </div>
            )}

            {section === "nginx" && (
              <div>
                <h2
                  className="text-lg font-semibold mb-1"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Nginx Reverse Proxy
                </h2>
                <p className="text-sm mb-6" style={{ color: "#7a7469" }}>
                  Route HTTP traffic to the API server and serve the built
                  frontend.
                </p>

                <Step n={1} title="Install nginx">
                  <CodeBlock
                    code={`
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
                  `}
                  />
                </Step>

                <Step n={2} title="Create site config">
                  <CodeBlock
                    code={`
sudo nano /etc/nginx/sites-available/groundworkos
                  `}
                  />
                  <CodeBlock
                    lang="nginx"
                    code={`
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP → HTTPS (uncomment after SSL is configured)
    # return 301 https://$host$request_uri;

    # Frontend — serve built React app
    root /home/deploy/groundworkos/artifacts/groundworkos/dist;
    index index.html;

    # API requests → Express server
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # SPA fallback — all other paths serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
                  `}
                  />
                </Step>

                <Step n={3} title="Enable and test">
                  <CodeBlock
                    code={`
# Enable the site
sudo ln -s /etc/nginx/sites-available/groundworkos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
                  `}
                  />
                </Step>
              </div>
            )}

            {section === "ssl" && (
              <div>
                <h2
                  className="text-lg font-semibold mb-1"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Let's Encrypt SSL with Certbot
                </h2>
                <p className="text-sm mb-6" style={{ color: "#7a7469" }}>
                  Free, auto-renewing TLS certificate for your domain.
                </p>

                <Note>
                  Your domain's DNS A record must point to the server IP before
                  running Certbot.
                </Note>

                <Step n={1} title="Install Certbot">
                  <CodeBlock
                    code={`
sudo apt install -y certbot python3-certbot-nginx
                  `}
                  />
                </Step>

                <Step n={2} title="Obtain certificate">
                  <CodeBlock
                    code={`
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com \
  --email admin@yourdomain.com --agree-tos --no-eff-email
                  `}
                  />
                  <P>
                    Certbot automatically edits your nginx config to add HTTPS
                    and redirect HTTP → HTTPS.
                  </P>
                </Step>

                <Step n={3} title="Verify auto-renewal">
                  <CodeBlock
                    code={`
# Test renewal (dry-run)
sudo certbot renew --dry-run

# Certbot installs a systemd timer — verify it's active
sudo systemctl status certbot.timer
                  `}
                  />
                </Step>

                <Step n={4} title="Final nginx HTTPS config (after Certbot)">
                  <P>
                    Certbot will have modified your config. The resulting file
                    should look similar to:
                  </P>
                  <CodeBlock
                    lang="nginx"
                    code={`
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    root /home/deploy/groundworkos/artifacts/groundworkos/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
                  `}
                  />
                </Step>
              </div>
            )}

            {section === "pm2" && (
              <div>
                <h2
                  className="text-lg font-semibold mb-1"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  PM2 Process Manager
                </h2>
                <p className="text-sm mb-6" style={{ color: "#7a7469" }}>
                  Keep the API server alive across reboots and crashes.
                </p>

                <Step n={1} title="Create the PM2 ecosystem file">
                  <CodeBlock
                    code={`
nano /home/deploy/groundworkos/ecosystem.config.cjs
                  `}
                  />
                  <CodeBlock
                    lang="javascript"
                    code={`
module.exports = {
  apps: [
    {
      name: 'groundworkos-api',
      script: 'artifacts/api-server/src/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx/esm',
      cwd: '/home/deploy/groundworkos',
      env_file: '.env.production',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: '/home/deploy/logs/api-error.log',
      out_file:   '/home/deploy/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
                  `}
                  />
                </Step>

                <Step n={2} title="Create log directory and start">
                  <CodeBlock
                    code={`
mkdir -p /home/deploy/logs

cd /home/deploy/groundworkos
pm2 start ecosystem.config.cjs

# Verify it's running
pm2 status
pm2 logs groundworkos-api --lines 50
                  `}
                  />
                </Step>

                <Step n={3} title="Save and enable startup on reboot">
                  <CodeBlock
                    code={`
# Save current process list
pm2 save

# Generate and enable systemd startup script
pm2 startup systemd -u deploy --hp /home/deploy

# Copy and run the command it prints, e.g.:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
                  `}
                  />
                </Step>

                <Step n={4} title="Useful PM2 commands">
                  <CodeBlock
                    code={`
pm2 status                        # List all processes
pm2 logs groundworkos-api         # Tail live logs
pm2 restart groundworkos-api      # Restart after code change
pm2 reload groundworkos-api       # Zero-downtime reload
pm2 stop groundworkos-api         # Stop process
pm2 monit                         # Live CPU/memory monitor
                  `}
                  />
                </Step>
              </div>
            )}

            {section === "env" && (
              <div>
                <h2
                  className="text-lg font-semibold mb-1"
                  style={{
                    color: "#181410",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Environment Variables & Secrets
                </h2>
                <p className="text-sm mb-6" style={{ color: "#7a7469" }}>
                  All required and optional environment variables for
                  production.
                </p>

                <Note type="warn">
                  Never commit{" "}
                  <code
                    className="text-xs font-mono px-1 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(181,105,24,0.15)" }}
                  >
                    .env.production
                  </code>{" "}
                  to version control. Add it to{" "}
                  <code
                    className="text-xs font-mono px-1 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(181,105,24,0.15)" }}
                  >
                    .gitignore
                  </code>
                  .
                </Note>

                <CodeBlock
                  lang="bash"
                  code={`
# ─── Database ─────────────────────────────────────────────────
DATABASE_URL="postgresql://groundwork:STRONG_PASSWORD@localhost:5432/groundworkos"

# ─── Clerk Auth ───────────────────────────────────────────────
CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."

# ─── API Server ───────────────────────────────────────────────
PORT=3001
NODE_ENV=production
VITE_API_URL="https://yourdomain.com/api"

# ─── Email (Resend) ───────────────────────────────────────────
RESEND_API_KEY="re_..."

# ─── Xero Integration (optional) ─────────────────────────────
XERO_CLIENT_ID="..."
XERO_CLIENT_SECRET="..."
XERO_REDIRECT_URI="https://yourdomain.com/api/xero/callback"

# ─── Object Storage ───────────────────────────────────────────
DEFAULT_OBJECT_STORAGE_BUCKET_ID="..."
PRIVATE_OBJECT_DIR="/home/deploy/groundworkos-uploads"
PUBLIC_OBJECT_SEARCH_PATHS="/home/deploy/groundworkos-uploads/public"
                `}
                />

                <Step n={1} title="Deployment checklist">
                  <div className="space-y-2">
                    {[
                      "DNS A record → server IP",
                      "Certbot certificate obtained",
                      "DATABASE_URL set and migrations run",
                      "CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from production Clerk application",
                      "Clerk allowed origins includes https://yourdomain.com",
                      "PM2 process running and saved",
                      "nginx config tested and reloaded",
                      "RESEND_API_KEY set (for invoice/quote email sending)",
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm"
                        style={{ color: "#4a4540" }}
                      >
                        <div
                          className="w-4 h-4 rounded border flex-shrink-0 mt-0.5"
                          style={{ border: "1px solid #d9d4ce" }}
                        />
                        {item}
                      </div>
                    ))}
                  </div>
                </Step>

                <Step n={2} title="Zero-downtime redeploy script">
                  <P>
                    Create{" "}
                    <code
                      className="text-xs font-mono px-1 py-0.5 rounded"
                      style={{ backgroundColor: "#eeeae4" }}
                    >
                      /home/deploy/redeploy.sh
                    </code>{" "}
                    for future updates:
                  </P>
                  <CodeBlock
                    code={`
#!/bin/bash
set -e

cd /home/deploy/groundworkos

echo ">>> Pulling latest code..."
git pull origin main

echo ">>> Installing dependencies..."
pnpm install --frozen-lockfile

echo ">>> Building frontend..."
pnpm --filter @workspace/groundworkos run build

echo ">>> Running migrations..."
cd lib/db && pnpm run db:push && cd ../..

echo ">>> Reloading API server..."
pm2 reload groundworkos-api

echo ">>> Done. Reloading nginx..."
sudo systemctl reload nginx

echo "✓ Redeployment complete"
                  `}
                  />
                  <CodeBlock
                    code={`
chmod +x /home/deploy/redeploy.sh

# Run it:
./redeploy.sh
                  `}
                  />
                </Step>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
