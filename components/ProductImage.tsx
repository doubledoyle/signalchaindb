import type {CSSProperties} from "react";
import type {Product} from "@/lib/types";

export function ProductImage({product,variant="card"}:{product:Product;variant?:"card"|"hero"}){
  const label=`${product.brand} ${product.name}`;
  const className=`productImage productImage--${variant}`;
  const isHero=variant==="hero";
  const isStudio=Boolean(product.image_url?.startsWith("/products/studio/"));

  const figureStyle:CSSProperties=isHero?{
    background:isStudio?"linear-gradient(145deg,#1d2328,#0a0d10)":"transparent",
    border:isStudio?"1px solid rgba(255,255,255,.08)":0,
    borderRadius:isStudio?18:0,
    overflow:isStudio?"hidden":"visible",
    aspectRatio:"auto",
    boxShadow:isStudio?"0 28px 70px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.04)":"none",
  }:isStudio?{
    background:"linear-gradient(145deg,#1d2328,#0a0d10)",
  }:{};

  const imageStyle:CSSProperties=isHero?{
    width:isStudio?"100%":"auto",
    maxWidth:"100%",
    height:"auto",
    maxHeight:isStudio?390:340,
    margin:"0 auto",
    objectFit:"contain",
    borderRadius:isStudio?0:10,
    filter:isStudio?"none":"drop-shadow(0 18px 28px rgba(0,0,0,.28))",
  }:isStudio?{
    width:"100%",
    height:"100%",
    margin:0,
    objectFit:"cover",
    borderRadius:0,
  }:{
    width:"calc(100% - 32px)",
    height:"calc(100% - 32px)",
    margin:16,
    objectFit:"contain",
    borderRadius:10,
    filter:"drop-shadow(0 14px 22px rgba(0,0,0,.22))",
  };

  const captionStyle:CSSProperties={
    justifyContent:"center",
    gap:10,
    padding:isStudio?"9px 12px":0,
    marginTop:isStudio?0:9,
    background:isStudio?"rgba(5,7,9,.82)":"transparent",
    borderTop:isStudio?"1px solid rgba(255,255,255,.06)":0,
    fontSize:10,
    opacity:.72,
  };

  if(product.image_url){
    return <figure className={className} style={figureStyle}>
      <img src={product.image_url} alt={label} loading={isHero?"eager":"lazy"} style={imageStyle}/>
      {isHero&&(product.image_credit||product.image_source)&&<figcaption style={captionStyle}>
        {product.image_credit&&<span>{product.image_credit}</span>}
        {product.image_source&&<a href={product.image_source} target="_blank" rel="noreferrer">Source ↗</a>}
      </figcaption>}
    </figure>
  }

  return <div className={`${className} productImage--placeholder`} aria-label={`${label} image not added yet`}>
    <span>{product.brand}</span>
    <strong>{product.name}</strong>
    <small>Image coming soon</small>
  </div>
}
