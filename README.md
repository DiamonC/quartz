API Documentation can be found on the **wiki page**. If you're a developer interested in contributing, make sure you're on our `next` branch to see the code for the next update.

# Quartz

Quartz is a backend for Arth Panel, a lightweight self-hosted Minecraft server panel. Quartz is made with Node and Express.

## Dependencies
- Required: A Linux operating system such as Ubuntu Server.
- Required: `zip` command, used in modpacks and folder downloads.
- Required: `curl` command, used in mods, plugins, etc.
- Reccomended: Docker, needed for security if you port forward.
- Optional: `screen` command for running in the background.
- Optional: `convert` command for server icons.

- Make sure that docker commands can be run without root permissions. To do this on Ubuntu, run `sudo usermod -aG docker $USER` and restart your computer.

## How to run

1. Grab the source code with `git clone https://github.com/ArthTechnologies/quartz`
2. Install the packages with `npm i`
3. Use `node setup` for quick setup.
4. Run with `node run` or `sh start.sh` (If you have screen installed)

You can update quartz by running `git pull` command inside your quartz folder.

# Getting started

- `config.txt` is where you can configure settings and provide API keys.

### Non-provider mode
This mode does not feature accounts or payment systems. This is perfect if you are just running your own servers and aren’t letting people outside your network access the panel.

In quick setup, be sure to make sure provider mode is off. Right now, we highly recommend enabling docker mode and [getting that setup](https://docs.docker.com/engine/install/).

After you ensure docker is working, and follow the “how to run” steps, setup [Observer](https://github.com/arthmc/observer). You should be able to start up a server with observer now after setting it up and pointing it to this node.

### Provider mode
This mode features a robust account system allowing for discord and email-based accounts, and stripe payment integration. This is meant for a full-on hosting service and is used by Arth Hosting. Due to its complexity we haven't made a setup guide yet. You can play around with `config.txt` which explains some settings.


# Contributing

Make sure to run `git checkout next` to switch to the next branch, where future updates are being worked on.

### Check out our frontend, [Observer](https://github.com/arthmc/observer).
