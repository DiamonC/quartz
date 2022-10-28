[![Get at Docker Hub](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/r/arthmc/quartz)
# Quartz 

Quartz is a backend for Arth Panel, an open-source & self-hosted minecraft server panel. Quartz is meant to be run as a docker container, and is made with Node. For testing purposes, there is an instance of quartz you can use at https://api.arthmc.xyz/

## How to Run

1. Download the image from docker hub with the command `sudo docker pull arthmc/quartz:latest`
2. Run the image with `sudo docker run -p 4000:4000 arthmc/quartz:latest`. To change the port, replace the first 4000 with the port number you want.

# Contributing

- Make sure you install the pagackes by running `npm i`
- To run the code, enter the command `node run`

## Contributing Guidelines

- Please format your code with Prettier VSCode extension, or an alternative that achieves the same results.  

### Check out our [frontend](https://github.com/arthmc/observer)'s progress  


## Why Arth Panel?
The main difference between an alternative like pufferpanel or pterodactyl is that it's meant to work in a way so that if an issue were to occur, you could easily just SSH into the machine and run the jar directly in a folder, so you know that your server's uptime is not dependant on a panel someone else made working flawlessly.  


# To-do list 
🔨 Temporary endpoints to further the developnment of frontend  
❌ Basic Database that stores details about servers.  
❌ Basic API that provides details about servers to frontend.  
❌ Basic Account system w/ Discord and ability for more in the future.  
❌ Basic handling of running and stopping jarfiles with quartz  
❌ Webhook communication with frontend for terminal  
