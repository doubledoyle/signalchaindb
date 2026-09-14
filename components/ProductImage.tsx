import type {Product} from "@/lib/types";

export function ProductImage({product,variant="card"}:{product:Product;variant?:"card"|"hero"}){
  const label=`${product.brand} ${product.name}`;
  const className=`productImage productImage--${variant}`;

  if(product.image_url){
    return <figure className={className}>
      <img src={product.image_url} alt={label} loading={variant==="card"?"lazy":"eager"}/>
      {variant==="hero"&&(product.image_credit||product.image_source)&&<figcaption>
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
