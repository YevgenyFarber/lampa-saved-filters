// Mock-Lampa check of save / edit / clone / delete. Run: node test.js
const assert = require('assert'); const fs = require('fs');
const store = {}; let shown = null, pushed = [], inputs = [];
global.window = { appready: false };
global.setTimeout = f => f();
const L = { nochoice: 'Не выбрано', title_filter: 'Фильтр' };
// fake built-in filter module (module-level data like content_filter/data.js)
const data = {
  type: {title:'Тип', items:[{title:'Фильмы',cat:'movie',selected:true},{title:'Сериалы',cat:'tv'}]},
  rating: {title:'Рейтинг', items:[{title:'Любой'},{title:'от 6',start:6},{title:'от 8',start:8}]},
  genres_movie: {title:'Жанр', items:[{title:'Комедия',checkbox:true},{title:'Драма',checkbox:true}]},
  genres_tv: {title:'Жанр', items:[{title:'Детектив',checkbox:true},{title:'Драма',checkbox:true}]},
};
function sub(g){ const s=g.items.filter(i=>i.selected||i.checked).map(i=>i.title); g.subtitle = s.length? s.join(', '):'Не выбрано'; }
function query(){ const cat=data.type.items.find(i=>i.selected).cat; const r=data.rating.items.find(i=>i.selected&&i.start);
  const g=data['genres_'+cat].items.filter(i=>i.checked).map(i=>i.title); return `discover/${cat}?r=${r?r.start:''}&g=${g.join(',')}`; }
function main(){ for (const k in data) sub(data[k]); const cat=data.type.items.find(i=>i.selected).cat;
  Lampa.Select.show({title:'Фильтр', items:[{title:'Начать поиск',search:true},data.type,data.rating,data['genres_'+cat]],
    onSelect(a){ if(a.search) Lampa.Activity.push({component:'category_full',url:query(),source:'tmdb'}); }}); }
global.$ = () => ({ on(){}, length:1, eq(){return this}, after(){}, append(){}, trigger(){ main(); } });
global.Lampa = {
  Lang: { add(){}, translate: k => L[k] || k },
  Storage: { get: k => store[k] || [], set: (k,v) => store[k] = JSON.parse(JSON.stringify(v)) },
  Select: { show(p){ shown = p; } },
  Activity: { push(o){ pushed.push(o); }, replace(o){ pushed.push(o); } },
  Input: { edit(p, cb){ inputs.push(p.value); cb(next.shift()); } },
  Controller: { toggle(){} }, Noty: { show(){} }, Listener: { follow(){} },
};
let next = [];
eval(fs.readFileSync(__dirname + '/saved_filters.js', 'utf8'));
const pick = (title) => shown.items.find(i => i.title === title);

// 1. user sets Фильмы + от 6 + Комедия, saves as "A"
data.rating.items[1].selected = true; data.genres_movie.items[0].checked = true;
main(); next = ['A']; shown.onSelect(pick('saved_filters_save'));
assert.equal(inputs.at(-1), '', 'new filter name starts empty');
assert.equal(store.saved_filters[0].url, 'discover/movie?r=6&g=Комедия');

// 2. user messes the filter: Сериалы, от 8, Детектив
data.type.items.forEach(i=>i.selected=false); data.type.items[1].selected=true;
data.rating.items.forEach(i=>i.selected=false); data.rating.items[2].selected=true;
data.genres_tv.items[0].checked = true;

// 3. Мои фильтры -> A -> Изменить: restores movie, rebuilds genre list, restores Комедия
main(); shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items[0]); shown.onSelect(shown.items.find(i=>i.act==='edit'));
assert.equal(shown.title, 'Фильтр');
assert.equal(pick('Жанр'), data.genres_movie, 'genre list rebuilt for movie');
assert.equal(data.rating.subtitle, 'от 6'); assert.equal(data.genres_movie.subtitle, 'Комедия');
assert.ok(pick('saved_filters_save').subtitle.includes('A'));

// 4. edit: add Драма, save as new name "B" -> clone
data.genres_movie.items[1].checked = true; main(); next = ['B']; shown.onSelect(pick('saved_filters_save'));
assert.equal(inputs.at(-1), 'A', 'name prefilled with edited filter');
assert.equal(store.saved_filters.length, 2);
assert.equal(store.saved_filters[1].url, 'discover/movie?r=6&g=Комедия,Драма');
assert.equal(store.saved_filters[0].url, 'discover/movie?r=6&g=Комедия', 'original A untouched');

// 5. edit B, keep name -> update in place
main(); shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items[1]); shown.onSelect(shown.items.find(i=>i.act==='edit'));
data.rating.items.forEach(i=>i.selected=false); data.rating.items[2].selected=true; main();
next = ['B']; shown.onSelect(pick('saved_filters_save'));
assert.equal(store.saved_filters.length, 2); assert.equal(store.saved_filters[1].url, 'discover/movie?r=8&g=Комедия,Драма');

// 6. delete A
main(); shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items[0]); shown.onSelect(shown.items.find(i=>i.act==='delete'));
assert.deepEqual(store.saved_filters.map(f=>f.name), ['B']);
console.log('OK');
// 7. click applies directly, old saves (no state) show Edit with a hint
main(); shown.onSelect(pick('saved_filters_title')); shown.onSelect(shown.items[0]);
assert.equal(pushed.at(-1).url, store.saved_filters[0].url); assert.equal(pushed.at(-1).title, 'B');
store.saved_filters.push({name:'old', url:'discover/movie?x', source:'tmdb'});
main(); shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items[1]);
assert.equal(shown.items.find(i=>i.act==='edit').subtitle, 'saved_filters_old');
console.log('OK click/long');
