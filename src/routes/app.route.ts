import { Router } from "express";
import {
  createMovie,
  deleteMovie,
  getMovie,
  updateMovie,
} from "../utils/queries";

const router = Router();

router.get("/movie/:id", async (req, res) => {
  const id = req.params.id;
  const movie = await getMovie(id);
  res.status(200).send(movie);
});

router.post("/movie", async (req, res) => {
  const movie = req.body;
  const createdMovie = await createMovie(movie);
  res.status(200).send(createdMovie);
});

router.put("/movie", async (req, res) => {
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
