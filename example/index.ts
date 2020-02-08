import http from 'http'
import { promises } from 'fs'
import { join } from 'path'

http.createServer(async (req, res) => {
    if (req.url === '/html.html' && req.method === 'GET') {
        res.statusCode = 200
        res.write((
            await promises
            .readFile(join(__dirname, 'html.html'), { encoding: 'utf8' }))
            .split("{{headers}}")
            .join(JSON.stringify(req.headers, null, 4)
        ))
        res.end()
    } else if (req.method === 'POST') {
        res.setHeader(
            'Content-Type',
            'application/json'
        )
        res.setHeader(
            'Set-Cookie',
            `user_session=session; path=/; expires=Sat, 15 Feb ${new Date().getFullYear() + 1} 17:43:34 -0000; HttpOnly`
        )
        res.write(JSON.stringify({ ok: true }))
        res.end()
    } else {
        res.end()
    }
}).listen(8080, () => {
    console.log('Listening on http://localhost:8080')
})
