import { AuthenticatedWorkspace } from "@/components/authenticated-workspace";
import { PrivateCases } from "@/components/private-cases";
export default function NewCasePage(){return <AuthenticatedWorkspace><PrivateCases creating/></AuthenticatedWorkspace>;}
