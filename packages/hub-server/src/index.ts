import { createApp } from "./app.js";

const dbPath = process.env.DB_PATH ?? "./hub.sqlite";
const { app } = createApp(dbPath);

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`hub-server listening on :${port}`);
});
