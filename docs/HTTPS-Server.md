# Running GHAS-Compliance with HTTPS Server
In order to meet compliance needs of enterprises that require the traffic to the app to be encrypted, we have provided an alternate way to run the app. This is done by a running a standalone `nodejs` server as an https server and integrating that with the `Probot`'s middleware. The server is provided in `httpsapp.js` file. 

`Note:` The design approach is: instead of using the Probot's http handling to receive and verify events from GitHub, you can receive it in an HTTPS server directly. The server should support loading of `Probot`'s Express-style middleware or Node's http middleware ((request, response) => { ... }). You can use `createNodeMiddleware` method for that; for more information refer to probot [docs](https://probot.github.io/docs/development/#use-createnodemiddleware).



To run `GHAS Compliance` app as HTTPS, you should bring your `cert` and `private key`, and provide the path values for them in the .env file (it could be relative or full path for the cert files). The env variables needed are below:
key | path
-- | --
TLS_KEY_PATH | /etc/ghas-compliance/ssl/your-private-key.pem
TLS_CERT_PATH | /etc/ghas-compliance/ssl/your-cert.pem

We have modified the `Dockerfile` file to run the app using the custom HTTPS Server instead of the `probot` app, i.e instead of using CMD  `npm start`, it will run CMD `node httpsapp.js`. 


## Running the app in Docker

- Change directory to inside the code base
  - `cd ghas-compliance/`
- Build the container
  - `sudo docker build -t ghas-compliance .`
- This process should complete successfully and you will then have a **Docker** container ready for deployment

### Run the Docker container
Once the container has been successfully built, you can deploy it and start utilizing it. 

`IMPORTANT:` When running in Docker mount the volume which had the SSL certs and pass that location as the env variables shown above.

These are the several ways to interact with the HTTPS app in Docker:


### Start Docker container Detached in background
- Start the container detached with port assigned (*Assuming port 3000 for the webhook*)
  - `sudo docker run --rm --detach --interactive -p 443:3000 --env-file .env --volume /Users/decyjphr/projects/node/probot/ghas-compliance/certs:/etc/ghas-compliance/ssl --name ghas-compliance ghas-compliance`
- You should now have the container running in the background and can validate it running with the command:
  - `sudo docker ps`
- This should show the `ghas-compliance` alive and running.

### Start Docker container attached in forground (Debug)
- If you need to run the container in interactive mode to validate connectivity and functionality:
  - `sudo docker run --tty  --interactive -p 443:3000 --env-file .env --volume /Users/decyjphr/projects/node/probot/ghas-compliance/certs:/etc/ghas-compliance/ssl --name ghas-compliance ghas-compliance  bash`
- You will now have the log of the container showing to your terminal, and can validate connectivity and functionality.

### Connect to running Docker container (Debug)
- If you need to connect to the container thats already running, you can run the following command:
  - `sudo docker exec -it ghas-compliance /bin/sh`
- You will now be inside the running **Docker** container and can perform any troubleshooting needed.

