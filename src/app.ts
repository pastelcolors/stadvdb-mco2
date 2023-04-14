import express from "express";

import TestsRouter from "./routes/tests.route";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/", TestsRouter);

const server = app.listen(PORT, () =>
  console.log(`🚀 Server ready at: http://localhost:${PORT}`)
);
