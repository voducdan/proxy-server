// khai bao thu vien
var http = require('http');
const fs = require('fs')
const JSON = require('circular-json')
const zlib = require('zlib');
const path = require('path')
const cache = require('memory-cache')
const Readable = require('stream').Readable;
// khoi tao proxy server
http.createServer(onRequest).listen(8888)

function staticServe(client_req, client_res) {
    const staticPath = './static'
    const resolvePath = path.resolve(staticPath)
    console.log('res ' + resolvePath)
    const normalizePath = path.normalize(client_req.url).replace(/^(\.\.[\/\\])+/, '')
    console.log('nor ' + normalizePath)
    const fileLoc = path.join(resolvePath, normalizePath)
    console.log('file' + fileLoc)
}

function onRequest(client_req, client_res) {

    console.log('serve: ' + client_req.url)
    // doc file black_list.conf de xem url vua nhap co hop le khong
    let block = fs.readFileSync('./black_lists.conf', 'utf8').split('\r\n')

    // doc lai file neu co thay doi
    fs.watchFile('black_lists.conf', (cur, pre) => {
        block = fs.readFileSync('./black_lists.conf', 'utf8').split('\r\n')
    })

    // neu url vua nhap co trong black_list thi tra ve 403
    if (block.indexOf(client_req.url) !== -1) {
        client_res.writeHead(403);
        client_res.end('This url has been blocked')

        // nguoc lai
    } else {
        start = new Date()
        if (cache.get(client_req.url)) {
            console.log(client_req.url)
            console.log('cache hit')
            // const stream = new Readable();
            client_res.writeHead(200)

            // console.log(cache.get(client_req.url))
            client_res.write(cache.get(client_req.url))
            client_res.end()
        } else {
            var options = {
                hostname: client_req.headers['host'],
                port: client_req.port,
                path: client_req.url,
                method: client_req.method,
                headers: client_req.headers
            };
            // gui request toi server ma user muon
            let buffer = ''
            let proxy = http.request(options, function (res) {
                client_res.writeHead(res.statusCode, res.headers)
                // console.log(res.headers)
                if (res.headers["content-encoding"] === 'gzip') {
                    const gunzip = zlib.createGunzip();
                    res.pipe(gunzip);
                    gunzip.on('data', async function (chunk) {
                        const reqUrl = client_req.url
                        // if (reqUrl.match(/\.(ico|jpg|jpeg|png|gif|svg|js|css|php)/) === null) {
                        buffer += chunk
                        // }
                    }).on("end", function () {
                        cache.put(client_req.url, buffer)
                        // console.log('buffer: ' + client_req.url + '  ' + buffer)
                        client_res.end()
                    }).on("error", function (e) {
                        console.log(e)
                        client_res.writeHead(500)
                    }).on('error', function (e) {
                        console.log(e)
                        client_res.writeHead(500)
                    })
                } else {
                    res.on('data', data => {
                        fs.writeFileSync('data.txt', data.toString())
                    }).on('end', () => {})
                    res.on('error', err => {
                        console.log(err)
                    })
                }
                res.pipe(client_res, {
                    end: true
                });
            });
            client_req.pipe(proxy, {
                end: true
            });
        }
    }
    fs.writeFileSync('json.txt', cache.exportJson())
}
// // page for testing
// // http://www.washington.edu/
// // http://example.com
// // http://www.mit.edu/
// // http://cbslocal.com/
// // http://go.com/
// // http://digg.com/