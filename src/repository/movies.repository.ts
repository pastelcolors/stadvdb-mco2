import {
  Connection,
  FieldPacket,
  OkPacket,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";

type QueryResult = {
  rows:
    | RowDataPacket[]
    | RowDataPacket[][]
    | OkPacket[]
    | OkPacket
    | ResultSetHeader;
  fields: FieldPacket[];
};

export function MovieRepository(node: Connection) {
  function findAll(): Promise<QueryResult> {
    return new Promise((resolve, reject) =>
      node.query("SELECT * FROM movies LIMIT 10", (err, rows, fields) => {
        if (err) return reject(err);
        return resolve({ rows, fields });
      })
    );
  }
  return { findAll };
}
