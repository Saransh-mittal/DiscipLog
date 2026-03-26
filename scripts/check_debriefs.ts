import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  if (!process.env.MONGODB_URI) {
    console.log("No MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const debriefs = await mongoose.connection.collection('weeklydebriefs').find({}).toArray();
  console.log("Found debriefs:", debriefs.length);
  if (debriefs.length > 0) {
    console.log("First debrief:", JSON.stringify(debriefs[0], null, 2));
  }

  const logs = await mongoose.connection.collection('logentries').find({}).toArray();
  console.log("Total logs:", logs.length);
  process.exit(0);
}

run().catch(console.error);
