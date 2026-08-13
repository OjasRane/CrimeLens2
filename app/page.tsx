import { redirect } from "next/navigation";
import { PasskeyTerminal } from "@/components/passkey-terminal";

export default function Home() {
  if (process.env.NODE_ENV === "development") {
    redirect("/workspace");
  }

  return <PasskeyTerminal />;
}
