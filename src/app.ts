import express from "express";

import TestsRouter from "./routes";
import AppRouter from "./routes/app.route";
import { recoverFromLogs } from "./utils/queries";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/", TestsRouter);
app.use("/api", recoverFromLogs, AppRouter);

const server = app.listen(PORT, () =>
  console.log(`🚀 Server ready at: http://localhost:${PORT}`)
);
