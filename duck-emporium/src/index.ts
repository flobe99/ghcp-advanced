import { createDefaultServer } from "./server";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "127.0.0.1";

const server = createDefaultServer();

server.listen(port, host, () => {
    console.log(`Duck Emporium API listening on http://${host}:${port}`);
});
