
#!/bin/bash
# VPS Setup and Deployment Script for Fatopago App (AlmaLinux/Rocky/RHEL 9)

# Variables
APP_NAME="fatopago"
DOMAIN="fatopago.com"
REPO_URL="https://github.com/yuriwinchest/fatopago.git"
TARGET_DIR="/var/www/$APP_NAME"

# Enable strict error handling
set -e

echo "Server Detected: AlmaLinux/RHEL"
echo "Starting Deployment..."

# 1. Update System & Install EPEL (for Certbot)
echo "Updating system packages..."
dnf update -y
dnf install -y epel-release
dnf install -y git curl unzip tar policycoreutils-python-utils

# 2. Install Node.js 20
echo "Installing Node.js 20..."
dnf module reset nodejs -y || true
dnf module enable nodejs:22 -y || dnf module enable nodejs:20 -y
dnf install -y nodejs npm

# 3. Install PM2
echo "Installing PM2..."
npm install -g pm2

# 4. Install Nginx
echo "Installing Nginx..."
dnf install -y nginx

# 5. Install Certbot
echo "Installing Certbot..."
dnf install -y certbot python3-certbot-nginx

# 6. Setup Directory
echo "Setting up Application Directory..."
mkdir -p $TARGET_DIR

# Extract app
if [ -f "app.tar" ]; then
    echo "Extracting application..."
    tar -xvf app.tar -C $TARGET_DIR
else
    echo "ERROR: app.tar not found in root directory!"
    exit 1
fi

# 7. Install Dependencies & Build
cd $TARGET_DIR
echo "Installing npm dependencies..."
rm -rf node_modules package-lock.json
npm install

echo "Building application..."
npm run build

# 8. Configure Nginx
echo "Configuring Nginx..."
NGINX_CONF="/etc/nginx/conf.d/$DOMAIN.conf"
cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root /var/www/$APP_NAME/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API Proxy (if backend is running on port 3000, uncomment below)
    # location /api {
    #     proxy_pass http://localhost:3000;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade \$http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host \$host;
    #     proxy_cache_bypass \$http_upgrade;
    # }
}
EOF

# Remove default server if it exists/conflicts
rm -f /etc/nginx/conf.d/default.conf

# 9. Permissions & SELinux (Crucial for RHEL)
echo "Fixing Permissions and SELinux contexts..."
chown -R nginx:nginx /var/www/$APP_NAME
chmod -R 755 /var/www/$APP_NAME
# Allow Nginx to connect to network (for proxy) and serve files
setsebool -P httpd_can_network_connect 1
# Update context for web files
semanage fcontext -a -t httpd_sys_content_t "/var/www/$APP_NAME(/.*)?" || true
restorecon -Rv /var/www/$APP_NAME || true

# 10. Start Services
echo "Starting Services..."
systemctl enable --now nginx
systemctl restart nginx

# 11. Firewall
echo "Configuring Firewall..."
if systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
else
    echo "Firewalld not running, skipping."
fi

# 12. SSL Certificate
echo "Setting up SSL..."
# Using --test-cert first is good practice, but for auto-deploy we go live if domain points
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect || echo "WARNING: Certbot failed. DNS might not be propagated yet. Run certbot manually later."

echo "Deployment Finished Successfully!"
