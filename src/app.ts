import express from "express";

import MovieRouter from "./routes/movies.route";
import ViewRouter from "./routes/views.route";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


app.use("/movies", MovieRouter);
app.use("/", ViewRouter);

const server = app.listen(PORT, () =>
  console.log(`🚀 Server ready at: http://localhost:${PORT}`)
);
