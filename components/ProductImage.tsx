import type {CSSProperties} from "react";
import type {Product} from "@/lib/types";

export function ProductImage({product,variant="card"}:{product:Product;variant?:"card"|"hero"}){
  const label=`${product.brand} ${product.name}`;
  const className=`productImage productImage--${variant}`;
  const isHero=variant==="hero";

  const figureStyle:CSSProperties=isHero?{
    background:"transparent",
    border:0,
    borderRadius:0,
    overflow:"visible",
    aspectRatio:"auto",
  }:{};

  const imageStyle:CSSProperties=isHero?{
    width:"auto",
    maxWidth:"100%",
    height:"auto",
    maxHeight:340,
    margin:"0 auto",
    objectFit:"contain",
    borderRadius:10,
    filter:"drop-shadow(0 18px 28px rgba(0,0,0,.28))",
  }:{
    width:"calc(100% - 32px)",
    height:"calc(100% - 32px)",
    margin:16,
    objectFit:"contain",
    borderRadius:10,
  };

  const captionStyle:CSSProperties={
    justifyContent:"center",
    gap:10,
    padding:0,
    marginTop:9,
    background:"transparent",
    borderTop:0,
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
