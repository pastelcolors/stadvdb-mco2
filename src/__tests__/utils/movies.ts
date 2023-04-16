import { IsolationLevels, Movie } from "../../utils/queries";

export const sampleMovies: Movie[] = [
  {
  "id": "39fb4a19-d298-11ed-a5cb-00155d052813",
  "name": "Melanie Darrow",
  "year": 1997,
  "rank": null,
  "actor1_first_name": "Bruce (I)",
  "actor1_last_name": "Abbott",
  "actor2_first_name": "Shawn",
  "actor2_last_name": "Ashmore",
  "actor3_first_name": "Jonathan",
  "actor3_last_name": "Banks"
  },
  {
  "id": "39fb4afc-d298-11ed-a5cb-00155d052813",
  "name": "Melanie van der Straaten",
  "year": 1982,
  "rank": null,
  "actor1_first_name": "Erich",
  "actor1_last_name": "Brauer",
  "actor2_first_name": "Kurt",
  "actor2_last_name": "Böwe",
  "actor3_first_name": "Gerd Michael",
  "actor3_last_name": "Henneberg"
  },
  {
  "id": "39fb4db8-d298-11ed-a5cb-00155d052813",
  "name": "Melanios letzte Liebe",
  "year": 1991,
  "rank": null,
  "actor1_first_name": "Rolf",
  "actor1_last_name": "Hoppe",
  "actor2_first_name": "Joachim",
  "actor2_last_name": "Lätsch",
  "actor3_first_name": "Arno",
  "actor3_last_name": "Wyzniewski"
  },
  {
  "id": "39fb4e5b-d298-11ed-a5cb-00155d052813",
  "name": "Melankholicheskij vals",
  "year": 1990,
  "rank": null,
  "actor1_first_name": "Georgi",
  "actor1_last_name": "Morozyuk",
  "actor2_first_name": "Nikolai",
  "actor2_last_name": "Polishchuk",
  "actor3_first_name": "Oleg",
  "actor3_last_name": "Savkin"
  }
]

export const isolationLevelMovieKV: { [key in IsolationLevels]: Movie } = {
  "READ UNCOMMITTED": sampleMovies[0],
  "READ COMMITTED": sampleMovies[1],
  "REPEATABLE READ": sampleMovies[2],
  "SERIALIZABLE": sampleMovies[3]
};