import { redirect } from "next/navigation";

export default function DemoRedirect() {
  redirect("/projects/derbenevskaya?tab=summary");
}
