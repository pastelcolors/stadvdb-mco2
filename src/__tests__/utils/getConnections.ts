import { after1980NodePool, before1980NodePool, centralNodePool, centralNodePool2 } from "../../config/db";
import { getConnection } from "../../utils/queries";

// Helper function to establish connections
export async function getConnections() {
  const mainConnection = await getConnection(centralNodePool, "mainPool");
  const shardConnection = await getConnection(after1980NodePool, "shardPool");
  const mainConnection2 = await getConnection(centralNodePool2, "shardPool");

  return { mainConnection, shardConnection, mainConnection2 };
}
