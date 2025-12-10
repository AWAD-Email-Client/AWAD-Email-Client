import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/email-dashboard";

    await mongoose.connect(mongoURI);

    console.log("✅ MongoDB connected successfully");

    mongoose.connection.on("error", (error) => {
      console.error("MongoDB connection error:", error);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    console.log("\n⚠️  App will continue without MongoDB persistence.");
    console.log("📝 To enable MongoDB:");
    console.log(
      "   1. Install MongoDB: https://www.mongodb.com/try/download/community"
    );
    console.log("   2. Start MongoDB service");
    console.log(
      "   3. Or use MongoDB Atlas: https://www.mongodb.com/cloud/atlas"
    );
    console.log("   4. Set MONGODB_URI in .env file\n");
    // Don't exit process, allow app to continue with limited functionality
  }
};

export const isMongoDBConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export default connectDB;
