// khai bao thu vien
var http = require('http');
const fs = require('fs')
const JSON = require('circular-json')
const zlib = require('zlib');
const path = require('path')
const cache = require('memory-cache')
const Readable = require('stream').Readable;
// khoi tao proxy server
let mode = process.argv[2]
let userUrl =process.argv[3]

let blackList = fs.readFileSync('black_lists.conf', 'utf8').split('\r\n')
if(mode !== undefined){
    if(mode === 'allow'){
        if(blackList.indexOf(userUrl) !== -1){
            blackList.splice(blackList.indexOf(userUrl), 1)
            fs.writeFileSync('black_lists.conf',blackList.join('\r\n'))
            console.log('Allow url success')
        }
        else {
            console.log('This url has not been blocked')
        }
    }
    else {
        if(blackList.indexOf(userUrl) !== -1){
            console.log('This url already has been blocked')
        }
        else {
            blackList.push(userUrl)
            fs.writeFileSync('black_lists.conf', blackList.join('\r\n'))
            console.log('Block url success')
        }
    }
}

http.createServer(onRequest).listen(8888)


function onRequest(client_req, client_res) {

    console.log('serve: ' + client_req.url)
    
    // doc file black_list.conf de xem url vua nhap co hop le khong
    let block = fs.readFileSync('black_lists.conf', 'utf8').split('\r\n')

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
        // kiem tra url vua nhap da co trong cache chua
        if (cache.get(client_req.url)) {
            // neu url co trong cache tra ve client ma khong gui request len server
            console.log(client_req.url)
            console.log('cache hit')

            client_res.writeHead(200)
            client_res.write(cache.get(client_req.url))
            client_res.end()
        // neu chua co trong cache
        } else {
            // lay thong tin url ma user nhap
            var options = {
                hostname: client_req.headers['host'],
                port: client_req.port,
                path: client_req.url,
                method: client_req.method,
                headers: client_req.headers
            };
            let buffer = '' // lay du lieu tu server de luu vao cache
            // gui request toi server ma user muon
            // thong tin la thong tin lay o tren
            let proxy = http.request(options, function (res) {
                // tra ve client header va status ma server phan hoi
                client_res.writeHead(res.statusCode, res.headers)
                // du lieu tra ve proxy co the bi nen lai => can giai nen 
                if (res.headers["content-encoding"] === 'gzip') {
                    const gunzip = zlib.createGunzip();
                    res.pipe(gunzip);
                    // bat su kien data de lay du lieu
                    gunzip.on('data', async function (chunk) {
                        const reqUrl = client_req.url
                        buffer += chunk
                    }).on("end", function () {
                        cache.put(client_req.url, buffer)
                        // console.log('buffer: ' + client_req.url + '  ' + buffer)
                        client_res.end()
                    }).on("error", function (e) {
                        console.log(e)
                        client_res.writeHead(500)
                    // bat su kien error khi co loi
                    }).on('error', function (e) {
                        console.log(e)
                        client_res.writeHead(500)
                    })
                } else {
                    // neu du lieu khong bi nen thi co the lam truc tiep
                    res.on('data', async function (chunk) {
                        const reqUrl = client_req.url
                        buffer += chunk
                    }).on("end", function () {
                        cache.put(client_req.url, buffer)
                        // console.log('buffer: ' + client_req.url + '  ' + buffer)
                        client_res.end()
                    }).on("error", function (e) {
                        console.log(e)
                        client_res.writeHead(500)
                    // bat su kien error khi co loi
                    }).on('error', function (e) {
                        console.log(e)
                        client_res.writeHead(500)
                    })
                }
                // server tra ve du lieu dang stream, truyen stream nay vao bien client_res de tra ve cho client
                res.pipe(client_res, {
                    end: true
                });
            });
            //goi ham va truyen gia tri vao proxy
            client_req.pipe(proxy, {
                end: true
            });
        }
    }
}
// // page for testing
// // http://www.washington.edu/
// // http://example.com
// // http://www.mit.edu/
// // http://cbslocal.com/
// // http://go.com/
// // http://digg.com/