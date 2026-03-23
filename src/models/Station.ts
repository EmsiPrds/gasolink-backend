import mongoose, { Schema, Document } from "mongoose";

export interface IStation extends Document {
  name: string;
  brand: string;
  location: {
    type: string;
    coordinates: number[];
  };
  address: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const StationSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    address: { type: String },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" }
  },
  { timestamps: true }
);

StationSchema.index({ location: "2dsphere" });

export default mongoose.models.Station || mongoose.model<IStation>("Station", StationSchema);
