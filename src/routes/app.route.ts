import { Router } from "express";
import {
  createMovie,
  deleteMovie,
  getMovie,
  getMovies,
  updateMovie,
} from "../utils/queries";

const router = Router();

router.get("/movies/:id", async (req, res) => {
  const id = req.params.id;
  console.log(`Getting movie with id: ${id}`);
  const movie = await getMovie(id);
  console.log(movie);
  res.status(200).send(movie);
});

router.get("/movies", async (req, res) => {
  try {
    console.log("Getting movies");
    const ITEMS_PER_PAGE = Number(req.query.itemsPerPage) || 10;
    const page = Number(req.query.page);
    const offset = (page - 1) * ITEMS_PER_PAGE;
    const movies = await getMovies(offset);
    console.log("Finished getting movies");
    console.log(movies);
    return res.status(200).send(movies);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

router.post("/movies", async (req, res) => {
  const movie = req.body;
  const createdMovie = await createMovie(movie);
  res.status(200).send(createdMovie);
});

router.put("/movies", async (req, res) => {
  const movie = req.body;
  const updatedMovie = await updateMovie(movie);
  res.status(200).send(updatedMovie);
});

router.delete("/movie/:id", async (req, res) => {
  const id = req.params.id;
  const deleted = await deleteMovie(id);
  res.status(200).send(deleted);
});

export default router;
