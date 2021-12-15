# SSH-tarpit

It listens for incoming ssh connections and then just leaves them hanging effectively working as a tarpit.

Inspiration for this project was from [this article](https://nullprogram.com/blog/2019/03/22/).

## Installation

You can use the docker-compose to run it.

    docker-compose -f "docker-compose.yml" up -d --build

Or then with yarn:

    yarn install
    yarn start

The tarpit has 2 environment variables:

-   `PORT`: [default: 22] the port to listen to (remember to update Dockerfile and docker-compose).
-   `TIMEOUT`: [default: 10000 (10s)] the timeout in milliseconds between tcp responses.

## Usage

It does most of it's work silently without need anything but if you want to see whats going on you can use the following command to get the current status of the tarpit:

    echo status | ncat <host> <port>
