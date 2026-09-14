import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {products,productBySlug,productRelations,productPorts,productEffectParameters,measurementsForParameter} from "@/lib/data";
import {Badge} from "@/components/Badge";
import {ProductImage} from "@/components/ProductImage";
import {mmToIn,pretty} from "@/lib/format";
import type {Port,EffectParameter} from "@/lib/types";

export function generateStaticParams(){return products.map(p=>({slug:p.slug}))}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const{slug}=await params;
  const p=productBySlug(slug);
  return p?{
    title:`${p.brand} ${p.name} Specs & Compatibility`,
    description:`Power, dimensions, connections, compatibility, and verified specifications for ${p.brand} ${p.name}.`
  }:{title:'Gear not found'}
}

export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const{slug}=await params;
  const p=productBySlug(slug);
  if(!p)notFound();

  const rel=productRelations(p.id);
  const io=productPorts(p.id);
  const paramsData=productEffectParameters(p.id);
  const groups=groupPorts(io);

  return <main className="shell page">
    <Link className="back" href="/gear">← Back to gear</Link>

    <div className="productHero">
      <div>
        <div className="eyebrow">{p.brand}</div>
        <h1>{p.name}</h1>
        <div className="cardMeta">
          <span className="chip">{p.category}</span>
          <Badge value={p.verification_status}/>
          {p.verified_at&&<span className="chip">verified {p.verified_at}</span>}
        </div>
      </div>
      {p.manufacturer_url&&<a className="button ghost" href={p.manufacturer_url} target="_blank" rel="noreferrer">Manufacturer ↗</a>}
    </div>

    <div style={{marginTop:22}}><ProductImage product={p} variant="hero"/></div>

    {p.description&&<p className="lead" style={{marginTop:24}}>{p.description}</p>}

    {paramsData.length>0&&<section className="section">
      <div className="sectionHead">
        <div>
          <span className="kicker">EFFECT PARAMETERS</span>
          <h2>Controls and ranges</h2>
        </div>
        <p>{paramsData.length} structured parameter{paramsData.length===1?'':'s'}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:8}}>
        {paramsData.map(param=><ParameterRow param={param} key={param.id}/>)}
      </div>
    </section>}

    <section className="detailGrid">
      <div className="panel">
        <h2>Specifications</h2>
        <div className="specGrid">
          <Spec k="Voltage" v={p.voltage_v?`${p.voltage_v} V`:null}/>
          <Spec k="Current" v={p.current_ma?`${p.current_ma} mA`:null}/>
          <Spec k="Polarity" v={p.polarity}/>
          <Spec k="Power connector" v={p.power_connector}/>
          <Spec k="Width" v={p.width_mm?`${p.width_mm} mm / ${mmToIn(p.width_mm)} in`:null}/>
          <Spec k="Depth" v={p.depth_mm?`${p.depth_mm} mm / ${mmToIn(p.depth_mm)} in`:null}/>
          <Spec k="Height" v={p.height_mm?`${p.height_mm} mm / ${mmToIn(p.height_mm)} in`:null}/>
          <Spec k="Weight" v={p.weight_g?`${p.weight_g} g`:null}/>
        </div>
        {p.power_notes&&<p className="note">{p.power_notes}</p>}
      </div>

      <div className="panel">
        <h2>Data confidence</h2>
        <p>{p.verification_status==='verified'?'Technical data for this product has been reviewed in SignalChainDB.':'Detailed technical research for this product is still incomplete.'}</p>
        <div style={{fontSize:32,fontWeight:900,letterSpacing:'-.04em',color:'var(--lime)',marginTop:18,textTransform:'capitalize'}}>{pretty(p.verification_status)}</div>
        <span className="muted small">research status</span>
      </div>
    </section>

    {io.length>0&&<section className="section">
      <div className="sectionHead">
        <div>
          <span className="kicker">CONNECTIONS</span>
          <h2>Ports and jacks</h2>
        </div>
        <p>{io.length} structured connection group{io.length===1?'':'s'}</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
        {groups.map(group=><div className="panel" key={group.name}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14}}>
            <h3 style={{margin:0,fontSize:20}}>{group.name}</h3>
            <span className="chip">{group.ports.length} group{group.ports.length===1?'':'s'}</span>
          </div>
          <div style={{display:'grid',gap:8}}>
            {group.ports.map(port=><PortRow port={port} key={port.id}/>) }
          </div>
        </div>)}
      </div>
    </section>}

    <section className="section">
      <div className="sectionHead" style={{marginBottom:12}}>
        <div><span className="kicker">COMPATIBILITY</span><h2>Works with</h2></div>
        <span className="chip">{rel.length} relationship{rel.length===1?'':'s'}</span>
      </div>
      {rel.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:8}}>
        {rel.map(r=>{
          const outbound=r.source_id===p.id;
          return <article key={r.id} style={{padding:'11px 12px',background:'#0c1013',border:'1px solid var(--line)',borderRadius:11}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
              <div style={{minWidth:0}}>
                <div className="eyebrow" style={{marginBottom:4}}>{pretty(r.compatibility_type)}</div>
                <h3 style={{margin:'0 0 5px',fontSize:16,lineHeight:1.25}}><Link href={`/gear/${outbound?r.target_slug:r.source_slug}`}>{outbound?`${r.target_brand} ${r.target_name}`:`${r.source_brand} ${r.source_name}`}</Link></h3>
              </div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'flex-end',flexShrink:0}}><Badge value={r.status}/><Badge value={r.confidence}/></div>
            </div>
            {r.requirements&&<p className="muted small" style={{margin:'5px 0 0',lineHeight:1.4}}>{r.requirements}</p>}
          </article>
        })}
      </div>:<p className="empty">No researched relationships yet.</p>}
    </section>
  </main>
}

function ParameterRow({param}:{param:EffectParameter}){
  const measurements=measurementsForParameter(param.id);
  const range=param.display_value
    ? param.display_value
    : measurements.length>0
      ? null
      : param.enum_values?.length
        ? param.enum_values.join(' · ')
        : param.min_value!=null&&param.max_value!=null
          ? `${param.min_value}–${param.max_value}${param.unit?` ${param.unit}`:''}`
          : null;

  const method=param.quantification_method==='manufacturer_midi'
    ?'Manufacturer MIDI mapping'
    :param.quantification_method==='normalized_control'
      ?'Normalized knob travel'
      :'Manufacturer setting';

  const measurementValue=(m:any)=>{
    if(m.value!=null)return `${m.value} ${m.unit}`;
    if(m.min_value!=null&&m.max_value!=null)return `${m.min_value}–${m.max_value} ${m.unit}`;
    return null;
  };

  return <div className="panel" style={{padding:'13px 14px'}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
      <div>
        <div className="eyebrow" style={{marginBottom:4}}>{pretty(param.parameter_family)}</div>
        <h3 style={{margin:0,fontSize:18}}>{param.name}</h3>
      </div>
      <span className="chip">{pretty(param.control_type)}</span>
    </div>

    {measurements.length>0&&<div style={{marginTop:12,display:'grid',gap:7}}>
      {measurements.map(m=><div key={m.id} style={{padding:'9px 10px',background:'#0c1013',border:'1px solid var(--line)',borderRadius:9}}>
        <div className="muted small">{m.metric_name}</div>
        <div style={{fontSize:18,fontWeight:900,marginTop:2}}>{measurementValue(m)}</div>
        {m.conditions&&<div className="muted small" style={{marginTop:3}}>{m.conditions}</div>}
      </div>)}
    </div>}

    {range&&<div style={{fontSize:17,fontWeight:800,marginTop:10}}>{range}</div>}
    <div className="muted small" style={{marginTop:5}}>{method}</div>
    {param.notes&&<div className="muted small" style={{marginTop:7,lineHeight:1.45}}>{param.notes}</div>}
    {param.midi_cc!=null&&<div className="muted small" style={{marginTop:7}}>MIDI CC {param.midi_cc}</div>}
  </div>
}

function PortRow({port}:{port:Port}){
  const traits=[
    port.connector,
    port.midi_type,
    port.balanced!=null?(port.balanced?'Balanced':'Unbalanced'):null,
    port.stereo!=null?(port.stereo?'Stereo':'Mono'):null,
  ].filter(Boolean);

  return <div style={{padding:'12px 13px',background:'#0c1013',border:'1px solid var(--line)',borderRadius:11}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
      <b>{port.quantity}× {port.port_type}</b>
      <span className="chip" style={{flexShrink:0}}>{port.direction?pretty(port.direction):'connection'}</span>
    </div>
    {traits.length>0&&<div className="muted small" style={{marginTop:6}}>{traits.join(' · ')}</div>}
    {port.notes&&<div className="muted small" style={{marginTop:6,lineHeight:1.45}}>{port.notes}</div>}
  </div>
}

function groupPorts(ports:Port[]){
  const order=['Audio','Control','MIDI & Digital','Other'];
  const buckets=new Map<string,Port[]>(order.map(x=>[x,[]]));
  for(const port of ports){
    const t=(port.port_type||'').toLowerCase();
    const c=(port.connector||'').toLowerCase();
    const haystack=`${t} ${c}`;
    let group='Other';
    if(/expression|footswitch|control|pedal|toe|omniport|\bexp\b|\bfs\b/.test(t))group='Control';
    else if(/midi|usb|digital|spdif|s\/pdif|aes|adat|variax|l6 link/.test(haystack))group='MIDI & Digital';
    else if(/audio|instrument|guitar|mic|line|send|return|headphone|main|monitor|xlr|stereo|aux|\binput\b|\boutput\b/.test(haystack))group='Audio';
    buckets.get(group)!.push(port);
  }
  return order.map(name=>({name,ports:buckets.get(name)!})).filter(g=>g.ports.length>0);
}

function Spec({k,v}:{k:string;v:string|null|undefined}){return <div className="spec"><span>{k}</span><b>{v||'Not researched yet'}</b></div>}
