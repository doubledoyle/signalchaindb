import type {Metadata} from "next";
import {products,compatibility,powerOutputs} from "@/lib/data";
import {RigBuilder} from "@/components/RigBuilder";
export const metadata:Metadata={title:"Rig Builder"};
export default function Page(){return <main className="shell page"><div className="pageIntro"><span className="kicker">BETA</span><h1>Build My Rig.</h1><p>Add your gear and start validating the system as a whole. This is the first pass at the feature that turns SignalChainDB from a database into a tool musicians keep coming back to.</p></div><div className="panel"><RigBuilder products={products} relations={compatibility} powerOutputs={powerOutputs}/></div></main>}
