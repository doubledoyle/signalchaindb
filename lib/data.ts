import raw from "@/data/signalchain.json";
import generatedProductImages from "@/data/product-images.generated.json";
import earthQuakerEnriched from "@/data/earthquaker-enriched.generated.json";
import jhsEnriched from "@/data/jhs-enriched.generated.json";
import {productImages} from "@/data/product-images";
import {earthQuakerProducts} from "@/data/earthquaker-products";
import type {Product,Compatibility,Source,PowerSupplyOutput,Port,EffectParameter,ParameterMeasurement} from "./types";

const earthQuakerProductData=(earthQuakerEnriched.products || []) as Array<Partial<Product>&{slug:string}>;
const earthQuakerProductMap=new Map(earthQuakerProductData.map(product=>[product.slug,product]));
const earthQuakerImages=(earthQuakerEnriched.images || {}) as Record<string,{image_url?:string;image_source?:string;image_credit?:string}>;

const jhsProducts=(jhsEnriched.products || []) as Product[];
const jhsImages=(jhsEnriched.images || {}) as Record<string,{image_url?:string;image_source?:string;image_credit?:string}>;

const specialImageOverrides:Record<string,{image_url?:string;image_source?:string;image_credit?:string}>={
  "earthquaker-avalanche-run":{
    image_url:"https://images.squarespace-cdn.com/content/v1/57cebe2c03596e075fca5f24/1544033064540-9DLWD9Y81ZUENBFL62IW/Avalanche-Run.jpg",
    image_source:"https://www.earthquakerdevices.com/avalanche-run",
    image_credit:"EarthQuaker Devices"
  },
  "earthquaker-gary":{
    image_url:"https://media.sweetwater.com/m/products/image/8a8f5204beRIGEAReC750nZKSiMDXPNuoXZ0SFUj.jpg?ha=8a8f5204be1da4a000c215ce33c4ac5206e5c9b8&quality=82&width=750",
    image_source:"https://www.sweetwater.com/store/detail/Gary--earthquaker-devices-gary-automatic-pulse-width-modulation-fuzz-overdrive-pedal",
    image_credit:"EarthQuaker Devices / Sweetwater"
  },
  "earthquaker-fuzz-master-general-legacy-reissue":{
    image_url:"https://images.squarespace-cdn.com/content/v1/57cebe2c03596e075fca5f24/1480115994487-QNTRKSPU8V0OXKD1RECW/Fuzz-Master-General-2.jpg",
    image_source:"https://www.earthquakerdevices.com/fuzz-master-general",
    image_credit:"EarthQuaker Devices"
  },
  "earthquaker-hizumitas":{
    image_url:"https://images.squarespace-cdn.com/content/v1/57cebe2c03596e075fca5f24/1629217579784-K9S24HMCHRSI91VQO5VR/Hizumitas-Fuzz-Sustainar.jpg",
    image_source:"https://www.earthquakerdevices.com/hizumitas",
    image_credit:"EarthQuaker Devices"
  },
  "boss-md-500":{
    image_url:"https://media.guitarcenter.com/is/image/MMGS7/J82771000000000-01-600x600.jpg",
    image_source:"https://www.guitarcenter.com/BOSS/MD-500-Modulation-Effects-Pedal-1500000093309.gc",
    image_credit:"BOSS / Guitar Center"
  },
  "boss-rv-500":{
    image_url:"https://m.media-amazon.com/images/I/81Md4r4yOrL._AC_SL1218_.jpg",
    image_source:"https://manuals.plus/asin/B072XMT5B4",
    image_credit:"BOSS / Amazon"
  },
  "eventide-powermax":{
    image_url:"https://media.sweetwater.com/m/products/image/869185118fLiEVB7oiNuk1xZPhsF5PNXojXo0esy.jpg?ha=869185118ffd5da8a9760c1cd67a53508f824161&quality=82&width=750",
    image_source:"https://www.sweetwater.com/store/detail/PowerMAXV2--eventide-powermax-v2-7-pedal-universal-power-supply-by-cioks",
    image_credit:"Eventide / Sweetwater"
  },
  "eventide-powermini":{
    image_url:"https://media.sweetwater.com/m/products/image/af1f3b2a42XeE397VutwQTNBRZSJ4qCGNBkdEINZ.jpg?ha=af1f3b2a4233b78496228adf886fd073e719aeda&quality=82&width=750",
    image_source:"https://www.sweetwater.com/store/detail/PowerMini--eventide-powermini-compact-universal-power-supply-by-cioks",
    image_credit:"Eventide / Sweetwater"
  },
  "eventide-tesla":{
    image_url:"https://media.sweetwater.com/m/products/image/e8ac8fd67cSgIPPhe16AMYR0gZs9icj2g3lHrXno.jpg?ha=e8ac8fd67ce4b5695381ddbbe795be3074e4493c&quality=82&width=750",
    image_source:"https://www.sweetwater.com/store/detail/Barn3TeslaTap--barn3-tesla-tap-momentary-footswitch-silver",
    image_credit:"Barn3 / Sweetwater"
  }
};

const baseProducts=[...(raw.products as Product[]),...earthQuakerProducts,...jhsProducts];
const generatedImages=generatedProductImages as Record<string,{image_url?:string;image_source?:string;image_credit?:string}>;

export const products=baseProducts.map(product=>({
  ...product,
  ...earthQuakerProductMap.get(product.slug),
  ...generatedImages[product.slug],
  ...earthQuakerImages[product.slug],
  ...jhsImages[product.slug],
  ...productImages[product.slug],
  ...specialImageOverrides[product.slug]
}));

export const compatibility=raw.compatibility as Compatibility[];
export const sources=[
  ...(raw.sources as Source[]),
  ...((earthQuakerEnriched.sources || []) as Source[]),
  ...((jhsEnriched.sources || []) as Source[])
];
export const powerOutputs=(raw.power_outputs || []) as PowerSupplyOutput[];
export const ports=(raw.ports || []) as Port[];
export const effectParameters=[
  ...(((raw as any).effect_parameters || []) as EffectParameter[]),
  ...((earthQuakerEnriched.effect_parameters || []) as EffectParameter[]),
  ...((jhsEnriched.effect_parameters || []) as EffectParameter[])
];
export const parameterMeasurements=((raw as any).parameter_measurements || []) as ParameterMeasurement[];
export const brands=raw.brands;
export const categories=raw.categories;
export const productBySlug=(slug:string)=>products.find(p=>p.slug===slug);
export const productSources=(id:number)=>sources.filter(s=>s.product_id===id);
export const productRelations=(id:number)=>compatibility.filter(r=>r.source_id===id||r.target_id===id);
export const productPorts=(id:number)=>ports.filter(p=>p.product_id===id);
export const productEffectParameters=(id:number)=>effectParameters.filter(p=>p.product_id===id);
export const measurementsForParameter=(id:number)=>parameterMeasurements.filter(m=>m.parameter_id===id);
export const stats={products:products.length,brands:new Set(products.map(p=>p.brand)).size,relations:compatibility.length,verified:products.filter(p=>p.verification_status==='verified').length,sources:sources.length};
