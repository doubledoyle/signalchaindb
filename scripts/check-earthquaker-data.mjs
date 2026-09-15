import data from '../data/earthquaker-enriched.generated.json' with {type:'json'};

const unique=(arr,key)=>new Set(arr.map(x=>x[key])).size===arr.length;
if(data.fetched_products!==46) throw new Error(`Expected 46 fetched products, got ${data.fetched_products}`);
if(Object.keys(data.images||{}).length!==46) throw new Error('Expected images for all 46 EarthQuaker products');
if(!unique(data.products,'slug')) throw new Error('Duplicate EarthQuaker product slugs');
if(!unique(data.effect_parameters,'id')) throw new Error('Duplicate EarthQuaker parameter ids');
if(data.effect_parameters.length<150) throw new Error('Unexpectedly low control count');
for(const p of data.products){
  if(!p.slug||!p.manufacturer_url) throw new Error('Product enrichment missing slug or manufacturer URL');
  if(p.voltage_v!=null && p.voltage_v!==9) throw new Error(`Unexpected voltage for ${p.slug}`);
}
console.log(`EarthQuaker QA: ${data.fetched_products} products, ${Object.keys(data.images).length} images, ${data.effect_parameters.length} controls, ${data.sources.length} sources`);
