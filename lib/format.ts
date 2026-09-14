export const pretty=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
export const mmToIn=(mm?:number|null)=>mm==null?null:(mm/25.4).toFixed(2);
export const productLabel=(brand:string,name:string)=>`${brand} ${name}`;