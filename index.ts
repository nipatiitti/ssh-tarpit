import fs from 'fs'
import net from 'net'

const PORT = process.env.PORT || 22
const TIMEOUT = Number(process.env.TIMEOUT || 10000)

const clients = new Map<net.Socket, { banner: string; startedTime: number }>()

const logfile = fs.createWriteStream(`logs/${Date.now()}_log.txt`, { flags: 'a' })

// Infinite generator used for the for await loop
function* infinite() {
    while (true) {
        yield 0
    }
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

async function handleConnection(connection: net.Socket) {
    const startedTime = Date.now()
    clients.set(connection, { banner: '', startedTime })
    let deleted = false

    const handleDelete = () => {
        if (deleted) {
            return
        }
        generateLog(connection)
        clients.delete(connection)
        deleted = true
    }

    connection.on('end', handleDelete)

    connection.once('data', async (data) => {
        const banner = data.toString().trim()
        clients.set(connection, { banner, startedTime })

        if (banner === 'status') {
            handleDelete()
            const connections = await new Promise<number>((res) => {
                server.getConnections((err, count) => {
                    res(count)
                })
            })
            const message = JSON.stringify({
                status: 'ok',
                clients: Array.from(clients.keys()).map((socket) => {
                    const data = clients.get(socket)
                    return {
                        banner: data?.banner || '',
                        ip: socket.remoteAddress,
                        family: socket.remoteFamily,
                        port: socket.remotePort,
                        startedTime: data?.startedTime || 0,
                    }
                }),
                totalClients: connections - 1, // -1 because the current connection is not counted
                uptime: process.uptime(),
            })
            connection.end(message)
        }
    })

    for await (const _ of infinite()) {
        // Check if the client is still connected
        if (connection.destroyed) {
            handleDelete()
            return
        }

        connection.write(`${Math.floor(Math.random() * 4_294_967_296)}\r\n`)

        await new Promise((resolve) => setTimeout(resolve, TIMEOUT))
    }
}

const server = net.createServer(handleConnection)

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
})
