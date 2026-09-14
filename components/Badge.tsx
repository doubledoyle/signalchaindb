import {pretty} from "@/lib/format";
export function Badge({value}:{value:string}){return <span className={`badge badge-${value}`}>{pretty(value)}</span>}