import { redirect } from "next/navigation";

// Redirect on the server so the first load is a normal page request for /today. The workspace
// layout then sends signed-out users to /login.
export default function HomePage() {
  redirect("/today");
}
