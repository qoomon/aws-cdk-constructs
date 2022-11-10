// Adds body field to http.IncomingMessage
async function parseJsonBody(res) {
    return new Promise((resolve, reject) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve(body));
    }).then(body => res.body = body ? JSON.parse(body) : undefined);
}
