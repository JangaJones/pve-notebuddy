## Static Deployment 

<img src="https://rentcpanel.com/assets/front/assets/bdix_hosting.gif" align="right" height="180" alt="Static Hosting GIF" />

PVE NoteBuddy is Static & Client-Side. 

For Static Use, run the `main` Branch to Deploy the Contents to run on a Static WEB Server or Static Hosting Platform.

### $\color{Blue}\large{\textsf{Deploy to a Static WEB Server}}$

### Option 1: 
Clone the Repository and Serve the Project Directory with your preferred Static Hosting Solution:

```bash
git clone --branch main https://github.com/JangaJones/pve-notebuddy.git
```

### Option 2: 
Download the Repository Source File and Extract the Project Directory and Serve with your preferred Static Hosting Solution :

```
wget https://github.com/JangaJones/pve-notebuddy/releases
```

```
tar xvf pve-notebuddy-(VERSION NUMBER).tar
```

### $\color{Blue}\large{\textsf{Static WEB Server Configuration Files:}}$
<!-- ########################################## Start of APACHE HTTP Configuration File ########################################## -->
<details>
<summary><b>APACHE HTTP<img src="/resources/apache.svg" height="25" alt="Apache Logo" /></b></summary>
  
1. Disable the Default Site: `a2dissite 000-default.conf` 

2. Restart Apache: `systemctl restart apache2` 

3. Copy and Save Apache Configuration File as notebuddy.conf: `/etc/apache2/sites-available/notebuddy.conf`
   
```
<VirtualHost *:80>
    ServerName (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)
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

4. Update the Variable in the Apache Configuration File notebuddy.conf: `/etc/apache2/sites-available/notebuddy.conf`<br>
<b>NOTE:</b> (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST).

5. Copy NoteBuddy WEB Content Folder to:<br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

7. Enable Site Configuration: `a2ensite yoursite.conf`

8. Restart Apache: `systemctl restart apache2`

9. Access URL: `http://(LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)`
</details>
<!-- ########################################## End of APACHE HTTP Configuration File ########################################## -->

<!-- ########################################## Start of APACHE HTTPS Configuration File ########################################## -->

<details>      
<summary><b>APACHE HTTPS <img src="/resources/apache.svg" height="25" alt="Apache Logo" /></b></summary>
  
1. Disable the Default Site: `a2dissite 000-default.conf` 

2. Restart Apache: `systemctl restart apache2` 

3. Copy and Save Apache Configuration File as notebuddy.conf: `/etc/apache2/sites-available/notebuddy.conf`

```
<VirtualHost *:80>
    ServerName (PUBLIC DOMAIN NAME OR PUBLIC DOMAIN SERVER IP ADDRESS)
    Redirect permanent / https://(PUBLIC DOMAIN NAME OR PUBLIC DOMAIN SERVER IP ADDRESS)/
</VirtualHost>

<VirtualHost *:443>
    ServerName (PUBLIC DOMAIN NAME OR PUBLIC DOMAIN SERVER IP ADDRESS)
    DocumentRoot /var/www/html

    SSLEngine on
    SSLCertificateFile /etc/ssl/certificate.crt
    SSLCertificateKeyFile /etc/ssl/private.key
    # If you have a CA Bundle, include it:
    # SSLCertificateChainFile /etc/ssl/ca-bundle.crt

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

4. Update the Variable in the Apache Configuration File notebuddy.conf: `/etc/apache2/sites-available/notebuddy.conf`<br>
<b>NOTE:</b> (PUBLIC DOMAIN NAME OR PUBLIC DOMAIN SERVER IP ADDRESS).

5. Copy NoteBuddy WEB Content Folder to:<br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

7. Create a SSL Directory: `mkdir /etc/ssl/`<br>
<b>NOTE:</b> Apache by Default does not create a Default /etc/ssl/ Directory.

8. Add SSL Certificate and Private Key:<br>
   `/etc/ssl/certificate.crt`<br>
   `/etc/ssl/private.key`

   Add CA Bundle(SSLCertificateChainFile) if included: `SSLCertificateChainFile /etc/ssl/ca-bundle.crt`<br>
   <b>NOTE:</b> UnComment the Line and Add the ca-bundled.crt.

9. Enable SSL Module: `a2enmod ssl`      

10. Enable Site Configuration: `a2ensite yoursite.conf`      

11. Restart Apache: `systemctl restart apache2`

12. Access URL: `https://(PUBLIC DOMAIN NAME OR Public Domain SERVER IP ADDRESS)`
</details>
<!-- ########################################## End of APACHE HTTPS Configuration File ########################################## -->

<!-- ########################################## Start of APACHE HTTPS Configuration File ########################################## -->
<!-- ########################################## Self Signed Certificate Generated Manually ########################################## -->
<details>
<summary><b>APACHE HTTPS - Self Signed Certificate <img src="/resources/apache.svg" height="25" alt="Apache Logo" /></b></summary>
    
1. Create Self Signed SSL Directory: `mkdir /etc/ssl/selfcerts/`<br> 
<b>NOTE:</b> Apache by Default does not create a Default /etc/ssl/ Directory.

2. Generate Self Signed Certificate:<br>
`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/selfcerts/selfsigned.key -out /etc/ssl/selfcerts/selfsigned.crt`<br>
<b>NOTE:</b> All One Line Command.<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
There will be Prompts to Enter Information; you can fill out the Information or leave the Information blank.

2. Disable the Default Site: `a2dissite 000-default.conf` 

3. Restart Apache: `systemctl restart apache2` 

4. Copy and Save Apache Configuration File as notebuddy.conf: `/etc/apache2/sites-available/notebuddy.conf`

```
<VirtualHost *:80>
    ServerName (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)
    Redirect permanent / https://(LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)/
</VirtualHost>

<VirtualHost *:443>
    ServerName (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)
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

5. Update the Variables in the Apache Configuration File notebuddy.conf: `/etc/apache2/sites-available/notebuddy.conf`<br>
   <b>NOTE:</b> (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST).

6. Copy NoteBuddy WEB Content Folder to:<br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

8. Enable SSL Module: `a2enmod ssl`      

9. Enable Site Configuration: `a2ensite yoursite.conf`      

10. Restart Apache: `systemctl restart apache2`  

11. Access URL: `https://(LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)`
</details>
<!-- ########################################## Self Signed Certificate Generated Manually ########################################## -->
<!-- ############################################ End of APACHE Configuration File ############################################ -->

<!-- ############################################ Start of CADDY HTTP Configuration File ########################################### -->

<details>
<summary><b>CADDY HTTP <img src="/resources/caddy.svg" height="25" alt="Caddy Logo" /></b></summary><br>                                                                                             

1. Copy and Save Caddy Configuration File as notebuddyconfig: `/etc/caddy/notebuddyconfig`
    
```
{
    # Global Options - If Needed.
}

(LOCALHOST DOMAIN NAME OR Server IP Address OR LOCALHOST) {
    root * /var/www/html
    file_server
    tls off
}
```
2. Update the Variable in the Caddy Configuration File: `/etc/caddy/notebuddyconfig`
   <br>
   <b>NOTE:</b> (LOCALHOST DOMAIN NAME OR Server IP Address).

3. Create a WEB Content Directory: `/var/www/html/`<br>
<b>NOTE:</b> Caddy does not create a Default WEB Content Directory.

4. Copy NoteBuddy WEB Content Folder to: <br>
5. `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

6. Restart Caddy: `systemctl restart caddy`

7. Access URL: `http://(LOCALHOST DOMAIN NAME OR Server IP Address OR LOCALHOST)`
</details>
<!-- ############################################ End of CADDY HTTP Configuration File ########################################### -->

<!-- ############################################ Start of CADDY HTTPS Configuration File ########################################### -->
<details>
<summary><b>CADDY HTTPS <img src="/resources/caddy.svg" height="25" alt="Caddy Logo" /></b></summary><br>

1. Copy and Save Caddy Configuration File as notebuddyconfig: `/etc/caddy/notebuddyconfig`
    
```
{
    # Global Options - If Needed.
}

(PUBLIC DOMAIN NAME OR SERVER DOMAIN IP ADDRESS) {
    root * /var/www/html
    file_server
}
```

2. Update the Variable in the Caddy Configuration File: `/etc/caddy/notebuddyconfig`<br>
<b>NOTE:</b> (PUBLIC DOMAIN NAME OR PUBLIC DOMAIN SERVER IP ADDRESS).                                                      

3. Create a WEB Content Directory: `/var/www/html/`<br>
<b>NOTE:</b> Caddy does not create a Default WEB Content Directory.

4. Copy NoteBuddy WEB Content Folder to:<br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

6. Restart Caddy: `systemctl restart caddy`

7. Access URL: `https://(PUBLIC DOMAIN NAME OR SERVER DOMAIN IP ADDRESS)`
</details>
<!-- ############################################ End of CADDY HTTPS Configuration File ########################################### -->

<!-- ############################################ Start of CADDY Configuration File ########################################### -->
<!-- ########################################## Self Signed Certificate Generated Manually ########################################## -->
<details>
<summary><b>CADDY - Self Signed Certificate <img src="/resources/caddy.svg" height="25" alt="Caddy Logo" /></b></summary>

### Option 1: 
Development Mode<br>

1. Copy and Save Caddy Configuration File as notebuddyconfig: `/etc/cadddy/notebuddyconfig`<br>
<b>NOTE:</b> The <b>tls internal</b> Command Flag instructs Caddy to Generate a Self-Signed Certificate for use.

```
  (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST) {
    root * /var/www/html
    file_server
    tls internal
}
```

2. Update the Variable in the Caddy Configuration File: `/etc/cadddy/notebuddyconfig`<br>
<b>NOTE:</b></b> (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST).

3. Create a WEB Content Directory: `/var/www/html/`<br>
<b>NOTE:</b> Caddy does not create a Default WEB Content Directory.

4. Copy NoteBuddy WEB Content Folder to: <br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

6. Restart Caddy: `systemctl restart caddy`

7. Access URL: `https://(LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)`

### Option 2: 
Self-Signed Certificate Generated Manually<br>

1. Copy and Save Caddy Configuration File as notebuddyconfig: `/etc/cadddy/notebuddyconfig`<br>

```
(LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST) {
    root * /var/www/html
    file_server
    tls /etc/caddy/selfcerts/cert.pem etc/caddy/selfcerts/key.pem
}
```

2. Create Self Certification Directory: `mkdir -p /etc/caddy/selfcerts/`<br>

3. Generate Self Signed Certificate:<br>
`openssl req -x509 -newkey rsa:4096 -keyout /etc/caddy/selfcerts/key.pem -out /etc/caddy/selfcerts/cert.pem -days 365 -nodes -subj "/CN=localhost"`<br>
<b>NOTE:</b> All One Line Command.<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
There will be Prompts to Enter Information; you can fill out the Information or leave the Information blank.

4. Update the Variable in the Caddy Configuration File: `/etc/cadddy/notebuddyconfig`<br>
   <b>NOTE:</b> (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST).

5. Create a WEB Content Directory: `/var/www/html/`<br>
<b>NOTE:</b> Caddy does not create a Default WEB Content Directory.

6. Copy NoteBuddy WEB Content Folder to: <br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

8. Add Self Signed SSL Certificate and Private Key:<br>
   `/etc/caddy/selfcerts/cert.pem`<br>
   `/etc/caddy/selfcerts/key.pem`
   
9. Restart Caddy: `systemctl restart caddy`

10. Access URL: `https://(LOCALHOST DOMAIN NAME OR SERVER IP ADDRESSS OR LOCALHOST)`
</details>
<!-- ########################################## Self Signed Certificate Generated Manually ########################################## -->
<!-- ############################################ End of CADDY Configuration File ########################################### -->

<!-- ############################################ Start of NGINX HTTP Configuration File ########################################### -->
<details>
<summary><b>NGINX HTTP <img src="/resources/nginx.svg" height="25" alt="Nginx Logo" /></b></summary>

1. Disable the Default Site: `unlink /etc/nginx/sites-enabled/default` 

2. Restart Restart: `systemctl restart nginx`

3. Copy and Save Nginx Configuration File as notebuddyconfig: `/etc/nginx/sites-available/notebuddyconfig`

```
server {
    listen 80;
    server_name (LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST); 

    root /var/www/html;           # Directory containing index.html
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

4. Update the Variable in the Apache Configuration File: `/etc/nginx/sites-available/notebuddyconfig`<br>
   <b>NOTE:</b> (LOCALHOST DOMAIN NAME or SEVER IP ADDRESS OR LOCALHOST).

5. Copy NoteBuddy WEB Content Folder to: <br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/`

7. Create a Symbolic Link in /etc/nginx/sites-enabled/ to Enable the Site:<br>
   `ln -s /etc/nginx/sites-available/notebuddyconfig /etc/nginx/sites-enabled/`

8. Test configuration:` nginx -t`

9. Restart Nginx: `systemctl restart nginx`

10. Access URL: `http://(LOCALHOST DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)` 
</details>
<!-- ############################################ End of NGINX HTTP Configuration File ########################################### -->

<!-- ############################################ Start of NGINX HTTPS Configuration File ########################################### -->
<details>
<summary><b>NGINX HTTPS <img src="/resources/nginx.svg" height="25" alt="Nginx Logo" /></b></summary>

1. Disable the Default Site: `unlink /etc/nginx/sites-enabled/default` 

2. Restart Restart: `systemctl restart nginx`

3. Copy and Save Nginx Configuration File as notebuddyconfig: `/etc/nginx/sites-available/notebuddyconfig`

```
server {
    listen 80;
    server_name (PUBLIC DOMAIN NAME OR SERVER DOMAIN IP ADDRESS);
    return 301 https://$host$request_uri;  # Redirect all HTTP to HTTPS
}

server {
    listen 443 ssl;
    server_name (PUBLIC DOMAIN NAME OR SERVER DOMAIN IP ADDRESS);

    ssl_certificate /etc/ssl/fullchain.pem;     # Path to your SSL certificate
    ssl_certificate_key /etc/ssl/privkey.pem;   # Path to your SSL key

    root /var/www/html;           # Directory containing index.html
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

4. Update the Variables in the Apache Configuration File: `/etc/nginx/sites-available/notebuddyconfig`<br>
<b>NOTE:</b> (PUBLIC DOMAIN NAME OR PUBLIC DOMAIN SERVER IP ADDRESS).

5. Add SSL Certificate and Private Key:<br>
   `/etc/ssl/fullchain.pem`<br>
   `/etc/ssl/privkey.pem`

6. Copy NoteBuddy WEB Content Folder to: <br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/` 

7. Create a Symbolic Link in /etc/nginx/sites-enabled/ to Enable the Site:<br>
   `ln -s /etc/nginx/sites-available/notebuddyconfig /etc/nginx/sites-enabled/`

8. Test configuration: `nginx -t`

9. Restart Nginx: `systemctl restart nginx`

10. Access URL: `https://(PUBLIC DOMAIN NAME OR PUBLIC DOMAIN SERVER IP ADDRESS)`
</details>
<!-- ############################################ End of NGINX HTTPS Configuration File ########################################### -->

<!-- ############################################ Start of NGINX HTTPS Configuration File ########################################### -->
<!-- ########################################## Self Signed Certificate Generated Manually ########################################## -->
<details>
<summary><b>NGINX HTTPS - Self Signed Certificate <img src="/resources/nginx.svg" height="25" alt="Nginx Logo" /></b></summary>

1. Disable the Default Site: `unlink /etc/nginx/sites-enabled/default` 

2. Restart Restart: `systemctl restart nginx`

3. Copy and Save Nginx Configuration File as notebuddyconfig: `/etc/nginx/sites-available/notebuddyconfig`

```
server {
    listen 80;
    server_name (LOCAL DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST);
    return 301 https://$host$request_uri;  # Redirect HTTP to HTTPS
}

server {
    listen 443 ssl;
    server_name (LOCAL DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST);

    ssl_certificate /etc/ssl/selfcerts/selfsigned.crt;
    ssl_certificate_key /etc/ssl/selfcerts/private/selfsigned.key;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

4. Create Self Certification Directory: `mkdir /etc/ssl/selfcerts/`

5. Generate Self Signed Certificate:<br>
`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/selfcerts/selfsigned.key -out /etc/ssl/selfcerts/selfsigned.crt`<br>
<b>NOTE:</b>There will be Prompts to Enter Information; you can fill out the Information or leave the Information blank.

6. Update the Variables in the Apache Configuration File: `/etc/nginx/sites-available/notebuddyconfig`<br>
<b>NOTE:</b> (LOCAL DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST).

7. Add SSL Certificate and Private Key:<br>
   `/etc/ssl/fullchain.pem`<br>
   `/etc/ssl/privkey.pem`

8. Copy NoteBuddy WEB Content Folder to: <br>
   `cp -r /pve-notebuddy-(VERSION NUMBER)/pve-notebuddy-(VERSION NUMBER)/ /var/www/html/` 

10. Create a Symbolic Link in /etc/nginx/sites-enabled/ to Enable the Site:<br>
   `ln -s /etc/nginx/sites-available/notebuddyconfig /etc/nginx/sites-enabled/`

11. Test configuration: `nginx -t`

12. Restart Nginx: `systemctl restart nginx`

13. Access URL: `https://(LOCAL DOMAIN NAME OR SERVER IP ADDRESS OR LOCALHOST)`
</details>          
<!-- ############################################ End of NGINX Configuration File ########################################### -->

### $\color{Blue}\large{\textsf{Any Simple Static Host Platform:}}$
- GitHub Pages
- Netlify
- Tiiny.host
- Vercel
- Amazon AWS Amplify
- Google Cloud Storage
- CloudFlare Pages
- DigitalOcean App Platform
- Azure Static WEB Apps
- FireBase Hosting
- InfinityFree
- Render
- Surge.sh
  
