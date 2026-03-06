## Static Deployment

PVE NoteBuddy is Static & Client-Side. 

For Static Use, run the `main` Branch to Deploy the Contents to run on a Static WEB Server.

### $\color{Blue}\large{\textsf{Deploy to a Static WEB Server}}$

Clone the Repository and Serve the Project Directory with your preferred Static Hosting Solution.

```bash
git clone --branch main https://github.com/JangaJones/pve-notebuddy.git
```

Configuration Files:
<!-- Start of APACHE Configuration File -->
<details>
<summary>APACHE</summary>
HTTP Configuration File:

```
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    ServerName yourdomain.com
    DocumentRoot /var/www/html

    # Directory settings
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    # Ensure index.html is served by default
    DirectoryIndex index.html

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

Save this configuration to a file, e.g., /etc/apache2/sites-available/000-default.conf or create a new file like /etc/apache2/sites-available/mywebsite.conf.
Replace yourdomain.com with your actual domain or server IP.
In /var/www/html put your index.html.
Enable Site Configuration: a2ensite yoursite.conf      
Reload Apache: systemctl reload apache2
Access URL: https://(Localhost or IP Address)

HTTPS Configuration File:

```
<VirtualHost *:80>
    ServerName yourdomain.com
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerAdmin webmaster@localhost
    ServerName yourdomain.com
    DocumentRoot /var/www/html

    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    # If you have a CA bundle, include it:
    # SSLCertificateChainFile /path/to/your/ca-bundle.crt

    # Directory permissions
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    DirectoryIndex index.html

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

Replace yourdomain.com with your actual domain.
Replace /path/to/your/certificate.crt and /path/to/your/private.key with the actual paths to your SSL certificate and private key.
Enable SSL Module: a2enmod ssl      
Enable Site Configuration: a2ensite yoursite.conf      
Reload Apache: systemctl reload apache2
Access URL: https://( Domain Name)
      
- Self Signed Certificate Generated Manually:<br>
`mkdir -p /etc/ssl/mycerts`<br>
`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/selfcerts/selfsigned.key -out /etc/ssl/selfcerts/selfsigned.crt`<br>
There will be Prompts to Enter Information; you can fill the Information or leave the Information blank.

```
<VirtualHost *:80>
    ServerName yourdomain.com
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com
    DocumentRoot /var/www/html

    SSLEngine on
    SSLCertificateFile /etc/ssl/selfcerts/selfsigned.crt
    SSLCertificateKeyFile /etc/ssl/selfcerts/selfsigned.key

    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    DirectoryIndex index.html

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

Enable SSL Module: a2enmod ssl      
Enable Site Configuration: a2ensite yoursite.conf      
Reload Apache: systemctl reload apache2  
Access URL: https://(Localhost or IP Address)
</details>
<!-- End of APACHE Configuration File -->

<!-- Start of CADDY Configuration File -->
<details>
<summary>CADDY</summary>
Caddy Automatically Enables HTTPS and obtains Certificates Natively.

 All HTTP Requests are Automatically Redirected to HTTPS Natively.
 
```
{
    # Global Options - If Needed.
}

yourdomain.com {
    root * /path/to/your/directory
    file_server
}
```

No Domain Name:
- Option 1: Development Mode
  tls internal instructs Caddy to Generate a Self-Signed Certificate for use.

```
  localhost {
    root * /path/to/your/directory
    file_server
    tls internal
}
```

Access URL: https://(Localhost or IP Address)


- Opton 2: Self-Signed Certificate Generated Manually
Create Self Certification Directory: mkdir -p /etc/caddy/selfcerts/
`openssl req -x509 -newkey rsa:4096 -keyout /etc/caddy/selfcerts/key.pem -out /etc/caddy/selfcerts/cert.pem -days 365 -nodes -subj "/CN=localhost"`

```
localhost {
    root * /path/to/your/directory
    file_server
    tls /path/to/cert.pem /path/to/key.pem
}
```
Replace /path/to/cert.pem and /path/to/key.pem with the paths to your generated files.
</details>
<!-- End of CADDY Configuration File -->

<!-- Start of NGINX Configuration File -->
<details>
<summary>NGINX</summary>
HTTP Configration File:

```
server {
    listen 80;
    server_name your_domain.com;  # Replace with your domain or IP

    root /var/www/html;           # Directory containing index.html
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Save this configuration in a file, e.g., /etc/nginx/sites-available/your_site.conf.
In /var/www/html and place your index.html inside.
Create a symbolic link in /etc/nginx/sites-enabled/: ln -s /etc/nginx/sites-available/your_site.conf /etc/nginx/sites-enabled/

HTTPS Configuration File:

```
server {
    listen 80;
    server_name your_domain.com;
    return 301 https://$host$request_uri;  # Redirect all HTTP to HTTPS
}

server {
    listen 443 ssl;
    server_name your_domain.com;

    ssl_certificate /path/to/fullchain.pem;     # Path to your SSL certificate
    ssl_certificate_key /path/to/privkey.pem;   # Path to your SSL key

    root /var/www/html;           # Directory containing index.html
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Replace your_domain.com with your actual domain.
Replace /path/to/fullchain.pem and /path/to/privkey.pem with the actual paths to your SSL certificate and key files.

Setup steps:

Save this configuration to /etc/nginx/sites-available/your_site.conf.
In /var/www/html and put your index.html there.
Enable the site:  ln -s /etc/nginx/sites-available/your_site.conf /etc/nginx/sites-enabled/
Test configuration: nginx -t
Reload Nginx: systemctl reload nginx

- Self Signed Certificate Generated Manually:<br>
`mkdir -p /etc/ssl/certs`<br> 
`mkdir `/etc/ssl/private`<br>
`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/selfcerts/selfsigned.key -out /etc/ssl/selfcerts/selfsigned.crt`<br>
There will be Prompts to Enter Information; you can fill the Information or leave the Information blank.

```
server {
    listen 80;
    server_name your_domain.com;
    return 301 https://$host$request_uri;  # Redirect HTTP to HTTPS
}

server {
    listen 443 ssl;
    server_name your_domain.com;

    ssl_certificate /etc/ssl/certs/selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/selfsigned.key;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Replace your_domain.com with your actual domain.
Replace /etc/ssl/certs/ and /etc/ssl/private/ with the actual paths to your Self Signed Certificate .crt and .key Files.

Setup steps:

Save this configuration to /etc/nginx/sites-available/your_site.conf. 
In /var/www/html and put your index.html there.
Enable the site:  ln -s /etc/nginx/sites-available/your_site.conf /etc/nginx/sites-enabled/
Test configuration: nginx -t
Reload Nginx: systemctl reload nginx
</details>          
<!-- End of NGINX Configuration File -->

- Any Simple Static File Host
