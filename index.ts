import fs from 'fs'
import net from 'net'

const PORT = process.env.PORT || 22
const HTTP_PORT = process.env.PORT || 8080
const TIMEOUT = Number(process.env.TIMEOUT || 10000)

const clients = new Map<net.Socket, { banner: string; startedTime: number }>()

const logfile = fs.createWriteStream(`logs/${Date.now()}_log.txt`, { flags: 'a' })

// Infinite generator used for the for await loop
function* infinite() {
    while (true) {
        yield 0
    }
}

function generateHTTPResponse(message: string) {
    return `HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: ${message.length}\r\n\r\n${message}`
}

function generateLog(socket: net.Socket) {
    const data = clients.get(socket)
    if (!data) {
        return
    }

    const { banner, startedTime } = data
    const today = new Date().toISOString()
    const message = `[${today}],${socket.remoteAddress},${socket.remotePort},${banner},${startedTime},${Date.now()}\n`
    logfile.write(message)
}

async function generateStatus(connection: net.Socket) {
    const connections = await new Promise<number>((res) => {
        server.getConnections((err, count) => {
            res(count)
        })
    })
    const message = JSON.stringify({
        status: 'ok',
        clients: Array.from(clients.keys())
            .filter((item) => item !== connection)
            .map((socket) => {
                const data = clients.get(socket)
                return {
                    banner: data?.banner || '',
                    ip: socket.remoteAddress,
                    family: socket.remoteFamily,
                    port: socket.remotePort,
                    startedTime: data?.startedTime || 0,
                }
            }),
        totalClients: Math.max(connections - 1, 0),
        uptime: process.uptime(),
    })
    return message
}

async function handleConnection(connection: net.Socket) {
    const startedTime = Date.now()
    clients.set(connection, { banner: '', startedTime })
    let deleted = false
    let statusConnection = false
    let processed = false

    setTimeout(() => {
        processed = true
    }, 2000) // Set processed true if the client doesn't send any data in 2 seconds, so we can try keeping the tcp alive

    const handleDelete = () => {
        clients.delete(connection)

        if (deleted || statusConnection) {
            return
        }

        generateLog(connection)
        deleted = true
    }

    connection.on('end', handleDelete)

    connection.on('error', (err) => {
        console.log(`[${new Date().toISOString()}] ClientError ${err.message}`)
        handleDelete()
    })

    connection.once('data', async (data) => {
        const banner = data.toString().trim()
        clients.set(connection, { banner, startedTime })

        if (banner === 'status') {
            statusConnection = true
            handleDelete()
            const message = await generateStatus(connection)
            connection.end(message)
        } else if (banner.includes('GET')) {
            statusConnection = true
            handleDelete()
            const message = await generateStatus(connection)
            const http = generateHTTPResponse(message)
            connection.end(http)
        }

        processed = true
    })

    for await (const _ of infinite()) {
        // Check if the client is still connected
        if (connection.destroyed) {
            handleDelete()
            return
        }

        if (processed) connection.write(`${Math.floor(Math.random() * 4_294_967_296)}\r\n`)

        await new Promise((resolve) => setTimeout(resolve, TIMEOUT))
    }
}

const server = net.createServer(handleConnection)
const httpServer = net.createServer(handleConnection)

server.on('error', (err) => {
    console.log(`[${new Date().toISOString()}] TCPServerError ${err.message}`)
})

httpServer.on('error', (err) => {
    console.log(`[${new Date().toISOString()}] HTTPServerError ${err.message}`)
})

server.listen(PORT, () => {
    console.log(`TCP Server listening on port ${PORT}`)
})

httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Server listening on port ${PORT}`)
})
