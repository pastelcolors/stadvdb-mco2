import express from "express";
import { MovieRepository } from "./repository/movies.repository";
import { centralNode } from "./config/db";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", async (req, res) => {
  const movies = MovieRepository(centralNode);
  const { rows } = await movies.findAll();

  return res.send(rows);
});

const server = app.listen(PORT, () =>
  console.log(`🚀 Server ready at: http://localhost:${PORT}`)
);
