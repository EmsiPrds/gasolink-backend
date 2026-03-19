import { model, Schema, type InferSchemaType } from "mongoose";
import { UpdateLogStatusValues } from "./enums";

const UpdateLogSchema = new Schema(
  {
    module: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: UpdateLogStatusValues, required: true, index: true },
    message: { type: String, required: true },
    timestamp: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true },
);

UpdateLogSchema.index({ module: 1, timestamp: -1 });

export type UpdateLogDoc = InferSchemaType<typeof UpdateLogSchema>;

export const UpdateLog = model("UpdateLog", UpdateLogSchema);

