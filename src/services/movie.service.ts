import { MovieRepository } from "../repository/movies.repository";
import { createConnection } from "mysql2";

export async function getMovieByName(nodeConfig: string, name: string){
  const node = createConnection(nodeConfig);
  const movies = MovieRepository(node);
  const { rows } = await movies.findByName(name);  
}

