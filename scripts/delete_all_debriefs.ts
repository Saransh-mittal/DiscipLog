import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const res = await mongoose.connection.collection('weeklydebriefs').deleteMany({});
  console.log(`Deleted ${res.deletedCount} debriefs`);
  process.exit(0);
}
run().catch(console.error);
