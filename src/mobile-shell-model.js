// Mobile routes, provider filters and catalogue pagination (no fabricated prices).
export function shellRoute(name){
 const page=['chart','watchlist','explore','alerts','objects','menu'].includes(name)?name:'chart';
 return {page,tab:page==='objects'?'chart':page,sidebar:['watchlist','alerts','objects'].includes(page)?page:null};
}
export function marketFilter(filter,provider,favorite){return filter==='ALL'||(filter==='FAVORITES'?favorite===true:filter===provider)}
export function mergeCatalogPage(previous,next){
 const result=new Map();
 for(const item of [...previous,...next])if(item&&typeof item.id==='string'&&/^(BINANCE|BIQUOTE|CTRADER):/.test(item.id))result.set(item.id,item);
 return [...result.values()];
}
