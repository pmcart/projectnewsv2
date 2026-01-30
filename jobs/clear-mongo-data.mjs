// clear-global-db.mjs
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'global';

const client = new MongoClient(MONGO_URI);

(async () => {
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const collections = await db.listCollections().toArray();

    for (const c of collections) {
      const result = await db.collection(c.name).deleteMany({});
      console.log(`Cleared ${result.deletedCount} documents from ${c.name}`);
    }

    console.log("✅ All collections in 'global' have been cleared.");
  } catch (err) {
    console.error("Error:", err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();
