import { Router } from "express";
import {
  IsolationLevels,
  aggregateRanks,
  createMovie,
  deleteMovie,
  getMovieById,
  getMovies,
  searchMovie,
  updateMovie,
} from "../utils/queries";

const router = Router();

router.get("/movies/report/:agg", async (req, res) => {
  const agg = req.params.agg ?? "";
  console.log(`Getting report: ${agg}`);
  const report = await aggregateRanks(agg as string);
  console.log("Finished getting report");
  res.status(200).send(report);
});

router.get("/movies/search", async (req, res) => {
  const search = req.query.search ?? "";
  console.log(`Searching movie: ${search}`);
  const movie = await searchMovie(search as string);
  console.log("Finished searching movie");
  res.status(200).send(movie);
});

router.get("/movies", async (req, res) => {
  try {
    console.log("Getting movies");
    const movies = await getMovies();
    console.log("Finished getting movies");
    return res.status(200).send(movies);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

router.post("/movies", async (req, res) => {
  try {
    const movie = req.body;
    const isolationLevel = req.query.isolationLevel ?? "REPEATABLE READ";
    const createdMovie = await createMovie(
      movie,
      isolationLevel as IsolationLevels
    );
    res.status(200).send(createdMovie);
  } catch (err) {
    res.status(500).send({ error: "Network error" });
  }
});

router.put("/movies", async (req, res) => {
  try {
    const movie = req.body;
    const isolationLevel = req.query.isolationLevel ?? "REPEATABLE READ";
    const updatedMovie = await updateMovie(
      movie,
      isolationLevel as IsolationLevels
    );
    res.status(200).send(updatedMovie);
  } catch (err) {
    res.status(500).send({ error: "Network error" });
  }
});

router.delete("/movie/:id", async (req, res) => {
  const id = req.params.id;
  const isolationLevel = req.query.isolationLevel ?? "REPEATABLE READ";
  const deleted = await deleteMovie(id, isolationLevel as IsolationLevels);
  res.status(200).send(deleted);
});

router.get("/movies/:id", async (req, res) => {
  const id = req.params.id;
  console.log(`Getting movie with id: ${id}`);
  const movie = await getMovieById(id);
  console.log(movie);
  res.status(200).send(movie);
});

export default router;
