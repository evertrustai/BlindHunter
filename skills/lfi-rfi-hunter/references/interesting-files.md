# LFI-RFI Hunter — Interesting Files Database

## Prioritized by Impact

### TIER 1 — INSTANT CRITICAL (Secrets, Credentials, Cloud, RCE)

| File Path | What It Reveals |
|-----------|-----------------|
| `/var/www/html/.env` | Laravel/WordPress app keys, DB creds, AWS keys |
| `/var/www/html/wp-config.php` | WordPress DB credentials, salts |
| `/var/www/html/config.php` | Application configuration, DB creds |
| `/var/www/html/database.php` | Database connection credentials |
| `/var/www/html/.git/config` | Git remote URL (may contain creds) |
| `/root/.ssh/id_rsa` | Root SSH private key |
| `/home/[USER]/.ssh/id_rsa` | User SSH private key |
| `/proc/self/environ` | Environment variables (session tokens, API keys, DB_PASS) |
| `/var/run/secrets/kubernetes.io/serviceaccount/token` | K8s service account token |
| `/etc/kubernetes/admin.conf` | Kubernetes cluster admin config |
| `~/.aws/credentials` | AWS access keys |
| `~/.aws/config` | AWS config with region, keys |
| `~/.gcloud/credentials.db` | GCloud credentials |
| `~/.docker/config.json` | Docker registry auth tokens |
| `C:\inetpub\wwwroot\web.config` | IIS app pool creds, connection strings |

### TIER 2 — HIGH IMPACT (Source Code, Configs, System Files)

| File Path | What It Reveals |
|-----------|-----------------|
| `index.php` | Main app source code logic |
| `/var/www/html/index.php` | Main application entry point |
| `/var/www/html/admin/config.php` | Admin panel config |
| `/etc/shadow` | Password hashes (if readable — very rare) |
| `/etc/passwd` | User enumeration |
| `/etc/hostname` | Server hostname (verification target) |
| `/etc/apache2/apache2.conf` | Apache server config |
| `/etc/nginx/nginx.conf` | Nginx server config |
| `/etc/php.ini` | PHP configuration |
| `/etc/my.cnf` | MySQL config (may contain creds) |
| `/etc/httpd/conf/httpd.conf` | Apache HTTP config |
| `/proc/self/cmdline` | Running process command |
| `/proc/self/fd/23` | Apache/Nginx access log (log poisoning) |
| `/root/.bash_history` | Root command history |
| `/home/[USER]/.bash_history` | User command history |
| `.git/config` | Git config |
| `wp-config.php` | WordPress config |
| `config.php` | App config |

### TIER 3 — MEDIUM IMPACT (Logs, Sessions, System Info)

| File Path | What It Reveals |
|-----------|-----------------|
| `/var/log/apache2/access.log` | Apache access log (log poisoning → RCE) |
| `/var/log/apache2/error.log` | Apache error log |
| `/var/log/nginx/access.log` | Nginx access log (log poisoning → RCE) |
| `/var/log/nginx/error.log` | Nginx error log |
| `/var/log/auth.log` | SSH auth log (log poisoning) |
| `/var/log/mail.log` | Mail log (log poisoning) |
| `/var/log/messages` | System messages |
| `/var/log/syslog` | Syslog |
| `/proc/version` | Kernel version |
| `/proc/mounts` | Mounted filesystems |
| `/proc/self/fd/N` | File descriptors (useful for logs) |
| `/etc/issue` | OS release info |
| `/etc/hosts` | Hostname resolution |
| `/etc/resolv.conf` | DNS configuration |
| `/var/log/dpkg.log` | Package installation log |
| `/var/log/installer/syslog` | Installation log |

## Per-Technology Interesting Files

### Apache
```
/etc/apache2/apache2.conf
/etc/apache2/ports.conf
/etc/apache2/sites-available/000-default.conf
/etc/apache2/sites-enabled/000-default.conf
/etc/httpd/conf/httpd.conf
/etc/httpd/conf.d/ssl.conf
/usr/local/apache2/conf/httpd.conf
/var/log/apache2/access.log
/var/log/apache2/error.log
/var/log/httpd/access_log
/var/log/httpd/error_log
```

### Nginx
```
/etc/nginx/nginx.conf
/etc/nginx/sites-available/default
/etc/nginx/sites-enabled/default
/etc/nginx/conf.d/default.conf
/etc/nginx/conf.d/ssl.conf
/usr/local/nginx/conf/nginx.conf
/var/log/nginx/access.log
/var/log/nginx/error.log
```

### PHP
```
/etc/php.ini
/etc/php/php.ini
/etc/php5/apache2/php.ini
/etc/php5/cli/php.ini
/etc/php7/apache2/php.ini
/etc/php7/cli/php.ini
/etc/php8/apache2/php.ini
/usr/local/lib/php.ini
/var/log/php-fpm/error.log
```

### Laravel
```
.env
.env.example
.env.production
.env.local
.env.staging
.env.testing
storage/logs/laravel.log
storage/oauth-private.key
storage/oauth-public.key
config/app.php
config/database.php
config/auth.php
```

### WordPress
```
wp-config.php
wp-config-sample.php
wp-content/debug.log
wp-content/plugins/[plugin-name]/[file].php
wp-content/themes/[theme-name]/[file].php
wp-content/uploads/[year]/[month]/[file]
wp-admin/includes/file.php
```

### Docker
```
/var/run/docker.sock
/var/lib/docker/containers/**/config.v2.json
/var/lib/docker/containers/**/hostname
/var/lib/docker/containers/**/resolv.conf
/var/lib/docker/containers/**/*-json.log
/hostfs/etc/passwd
/hostfs/proc/1/environ
/.dockerenv
```

### Kubernetes
```
/var/run/secrets/kubernetes.io/serviceaccount/token
/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
/var/run/secrets/kubernetes.io/serviceaccount/namespace
/run/secrets/kubernetes.io/serviceaccount/token
/etc/kubernetes/admin.conf
/etc/kubernetes/kubelet.conf
/etc/kubernetes/controller-manager.conf
/etc/kubernetes/scheduler.conf
/etc/kubernetes/pki/ca.crt
/etc/kubernetes/pki/ca.key
/etc/kubernetes/pki/apiserver.crt
/etc/kubernetes/pki/apiserver.key
```

### Node.js
```
.env
.env.production
.env.local
.env.example
package.json
server.js
app.js
index.js
/config.js
/database.js
GoogleService-Info.plist (Firebase)
google-services.json (Firebase)
```

### Python/Django
```
.env
settings.py
settings_local.py
config.py
local_settings.py
manage.py
db.sqlite3
requirements.txt
```

### Java/Spring Boot
```
application.properties
application.yml
application-dev.properties
application-prod.properties
bootstrap.properties
BOOT-INF/classes/application.properties
WEB-INF/web.xml
WEB-INF/applicationContext.xml
```

### Ruby on Rails
```
config/database.yml
config/secrets.yml
config/credentials.yml.enc
config/master.key
config/storage.yml
config/application.rb
```

### Grafana
```
/etc/grafana/grafana.ini
/var/lib/grafana/grafana.db
/var/log/grafana/grafana.log
/public/plugins/../../../etc/passwd
/api/dashboards/uid/../../../etc/passwd
```

### GitLab
```
/etc/gitlab/gitlab.rb
/var/log/gitlab/gitlab-rails/production.log
/var/opt/gitlab/gitlab-rails/config/database.yml
```

### AWS-specific
```
~/.aws/credentials
~/.aws/config
/root/.aws/credentials
http://169.254.169.254/latest/meta-data/iam/security-credentials/
```
