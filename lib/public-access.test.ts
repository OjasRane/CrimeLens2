import { describe, it, expect, vi } from "vitest";
import { getPublicCase, safeReturnPath, networkStorageKey } from "./public-access";
import { getInvestigation, clearPrivateInvestigations, replaceInvestigation } from "@/data/investigations/registry";
import { createBlankWorkspace } from "./network-workspace-types";
import { duplicateGraphWorkspace } from "./network-workspace-persistence";
import { loadAuthorizedProfile } from "./crimelens-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("public snapshot boundary",()=>{
  it("allows exactly the two bundled cases without authentication",()=>{
    expect(getPublicCase("demo")?.type).toBe("DEMO");
    expect(getPublicCase("mumbai-2611")?.type).toBe("HISTORICAL");
    for(const id of ["private", "../demo", "Demo", "demo?isDemo=true", "__proto__"]) expect(getPublicCase(id)).toBeNull();
  });
  it("never substitutes demo data for a missing private case",()=>{expect(()=>getInvestigation("missing-private")).toThrow();});
  it("clears private registries while retaining canonical snapshots",()=>{
    const demo=getPublicCase("demo")!;
    replaceInvestigation({...demo,id:"empty-private",type:"PRIVATE",map:{...demo.map,locations:[],routes:[]},graph:{nodes:[],links:[],filters:[]},timeline:{...demo.timeline,events:[]},facts:[],casualtyLedger:[]});
    clearPrivateInvestigations();
    expect(()=>getInvestigation("empty-private")).toThrow();
    expect(getPublicCase("demo")).toBe(demo);
  });
});
describe("return paths and cache boundaries",()=>{
  it.each(["//evil.test", "https://evil.test", "/\\evil.test", "/%2f%2fevil.test", "/enroll", "/cases\n"])("rejects unsafe destination %s",value=>expect(safeReturnPath(value)).toBe("/cases"));
  it("keeps the intended internal action",()=>expect(safeReturnPath("/cases/new?view=evidence")).toBe("/cases/new?view=evidence"));
  it("isolates users and cases without claiming legacy keys",()=>{
    expect(networkStorageKey("user-a","case-a")).not.toBe(networkStorageKey("user-b","case-a"));
    expect(networkStorageKey("user-a","case-a")).not.toBe(networkStorageKey("user-a","case-b"));
    expect(networkStorageKey("user-a","demo")).not.toBe("crimelens-network-workspaces:demo");
  });
});
it("duplicates reasoning records without copying database identities or modifying the source",()=>{
  const original=createBlankWorkspace("private-case");
  original.nodes=[{id:crypto.randomUUID(),type:"note",label:"A question",origin:"manual",verificationStatus:"hypothesis",description:"",metadata:{},position:{x:0,y:0}}];
  const snapshot=JSON.stringify(original);
  const duplicate=duplicateGraphWorkspace(original);
  expect(duplicate.id).not.toBe(original.id);
  expect(duplicate.nodes[0].id).not.toBe(original.nodes[0].id);
  expect(duplicate.investigationId).toBe(original.investigationId);
  expect(JSON.stringify(original)).toBe(snapshot);
});
it("provisions a missing profile through the trusted RPC, then reads its actual result",async()=>{
  const profile={user_id:"user",agent_id:"server-issued",display_name:"Name",role:"investigator",clearance:"standard",active:true};
  const maybeSingle=vi.fn().mockResolvedValueOnce({data:null,error:null}).mockResolvedValueOnce({data:profile,error:null});
  const rpc=vi.fn().mockResolvedValue({error:null});
  const client={from:()=>({select:()=>({eq:()=>({maybeSingle})})}),rpc} as unknown as SupabaseClient;
  expect(await loadAuthorizedProfile(client,"user",true)).toEqual(profile);
  expect(rpc).toHaveBeenCalledWith("complete_public_onboarding");
});
it("does not report onboarding success after an RPC rejection",async()=>{
  const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),rpc:async()=>({error:{message:"Unverified"}})} as unknown as SupabaseClient;
  await expect(loadAuthorizedProfile(client,"user",true)).rejects.toThrow("Verified registration");
});
