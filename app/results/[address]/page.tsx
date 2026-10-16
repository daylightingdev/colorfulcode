import { redirect } from "next/navigation";

export default function ResultsRedirect({
  params,
}: {
  params: { address: string };
}) {
  redirect(`/?address=${params.address}`);
}
