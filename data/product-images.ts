export type ProductImageMetadata={
  image_url:string;
  image_source:string;
  image_credit:string;
};

export const productImages:Record<string,ProductImageMetadata>={
  "line-6-hx-stomp":{
    image_url:"https://line6.com/data/6/0a020a416aec6006fc5095d0f/image/png",
    image_source:"https://line6.com/hx-stomp/",
    image_credit:"Line 6"
  },
  "line-6-hx-stomp-xl":{
    image_url:"https://l6c-acdn2.line6.net/data/6/0a020a3fdbdb5fce39c5260a7/image/png/r17673_r17673_front.png",
    image_source:"https://line6.com/hx-stomp-xl/",
    image_credit:"Line 6"
  },
  "gx-10":{
    image_url:"https://static.roland.com/products/gx-10/image/gx-10_hero.jpg",
    image_source:"https://www.boss.info/us/products/gx-10/",
    image_credit:"BOSS / Roland"
  },
  "gt-1000core":{
    image_url:"https://static.roland.com/products/gt-1000core/images/gt-1000core_hero.jpg",
    image_source:"https://www.boss.info/us/products/gt-1000core/",
    image_credit:"BOSS / Roland"
  },
  "boss-ir-2":{
    image_url:"https://static.roland.com/products/ir-2/image/ir-2_hero.jpg",
    image_source:"https://www.boss.info/us/products/ir-2/",
    image_credit:"BOSS / Roland"
  },
  "boss-gx-100":{
    image_url:"https://static.roland.com/products/gx-100/images/gx-100_hero.jpg",
    image_source:"https://www.boss.info/us/products/gx-100/",
    image_credit:"BOSS / Roland"
  },
  "boss-ir-200":{
    image_url:"https://static.roland.com/products/ir-200/images/ir-200_hero.jpg",
    image_source:"https://www.boss.info/us/products/ir-200/",
    image_credit:"BOSS / Roland"
  }
};
