import mongoose, { Schema } from "mongoose";

interface IAdmin {
  password: string;
}

const AdminSchema = new Schema<IAdmin>({
  password: { type: String, required: true },
});
export default mongoose.model<IAdmin>("Admin", AdminSchema);
