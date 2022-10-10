# Observer

Quartz is a backend for Arth Panel, an open-source & self-hosted minecraft server panel. Quartz is meant to be run as a docker container, and is made with Rust.



# How to Run

Quartz is intended to be run as a docker contaner. The frontend, Observer, will need to run as well (preferrably also as a docker container) in order for the panel to function. Docker images are not available yet.

## Current State
Quartz only has basic auth so far and no account system, or server system, and is thus still in early developnment


## Why Arth Panel?
The main difference between an alternative like pufferpanel or pterodactyl is that it's meant to work in a way so that if an issue were to occur, you could easily just SSH into the machine and run the jar directly in a folder, so you know that your server's uptime is not dependant on a panel someone else made working flawlessly.  


## Contributing

Contributions are very much appreciated! Feel free to contribute, preferably something on the to-do list. Feel free to open up an issue if you have questions about planned features, API specifications, frontend, etc.

# To-do list
❌ Basic Database that stores details about servers.  
❌ Basic API that provides details about servers to frontend.  
❌ Basic Account system w/ Discord and ability for more in the future.  
❌ Basic handling of running and stopping jarfiles with quartz  
❌ Webhook communication with frontend for terminal  
