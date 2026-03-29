import bcrypt from "bcrypt";

// Run this once to get your hash, then delete this script.
export async function generateHash() {
  const myPassword = "KaakkoHuththo26";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(myPassword, salt);
  console.log("Put this in your .env file:", hash);
}
