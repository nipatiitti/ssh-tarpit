import net from 'net'

const PORT = process.env.PORT || 2222
const TIMEOUT = Number(process.env.TIMEOUT || 10000)

const clients = new Map<net.Socket, { banner: string; startedTime: number }>()

// Infinite generator used for the for await loop
function* infinite() {
    while (true) {
        yield 0
    }
}

async function handleConnection(connection: net.Socket) {
    const startedTime = Date.now()
    clients.set(connection, { banner: '', startedTime })

    const handleDelete = () => {
        clients.delete(connection)
    }

    connection.on('close', handleDelete)
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
