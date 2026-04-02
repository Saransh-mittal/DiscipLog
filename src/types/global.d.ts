declare global {
  interface Mongoose {
    conn: Awaited<ReturnType<typeof mongoose.connect>> | null;
    promise: Promise<Awaited<ReturnType<typeof mongoose.connect>>> | null;
  }
}
