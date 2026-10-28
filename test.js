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
  Storage: { get: k => store[k] || [], set: (k,v) => store[k] = JSON.parse(JSON.stringify(v)), field: () => 'tmdb' },
  Select: { show(p){ shown = p; } },
  Activity: { push(o){ pushed.push(o); }, replace(o){ pushed.push(o); } },
  Input: { edit(p, cb){ inputs.push(p.value); pushesAtInput = pushed.length; cb(next.shift()); } },
  Controller: { toggle(){} }, Noty: { show(){} }, Listener: { follow(){} },
};
let next = [], pushesAtInput = -1;
eval(fs.readFileSync(__dirname + '/saved_filters.js', 'utf8'));
const NEW = '&sort_by=primary_release_date.desc&primary_release_date.lte=' + new Date().toISOString().slice(0, 10);
const pick = (title) => shown.items.find(i => i.title === title);

// 1. user sets Фильмы + от 6 + Комедия, saves as "A"
data.rating.items[1].selected = true; data.genres_movie.items[0].checked = true;
main(); next = ['A']; shown.onSelect(pick('saved_filters_save'));
assert.equal(inputs.at(-1), '', 'new filter name starts empty');
assert.equal(pushed.length, pushesAtInput + 1, 'name asked BEFORE the search (dialog after results load gets stuck)');
assert.equal(store.saved_filters[0].url, 'discover/movie?r=6&g=Комедия' + NEW);

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
assert.equal(store.saved_filters[1].url, 'discover/movie?r=6&g=Комедия,Драма' + NEW);
assert.equal(store.saved_filters[0].url, 'discover/movie?r=6&g=Комедия' + NEW, 'original A untouched');

// 5. edit B, keep name -> update in place
main(); shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items[1]); shown.onSelect(shown.items.find(i=>i.act==='edit'));
data.rating.items.forEach(i=>i.selected=false); data.rating.items[2].selected=true; main();
next = ['B']; shown.onSelect(pick('saved_filters_save'));
assert.equal(store.saved_filters.length, 2); assert.equal(store.saved_filters[1].url, 'discover/movie?r=8&g=Комедия,Драма' + NEW);

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
// 8. True crime keyword: added to search + save, restored by Edit, not re-added when opening a saved filter
const kwPick = (...names) => { pick('saved_filters_keyword').items.forEach(i=>i.checked=names.includes(i.title)); };
main(); kwPick('True crime'); main();
shown.onSelect(pick('Начать поиск'));
assert.ok(pushed.at(-1).url.endsWith('&with_keywords=33722' + NEW), 'search gets the keyword');
next = ['TC']; shown.onSelect(pick('saved_filters_save'));
const tc = store.saved_filters.find(f=>f.name==='TC');
assert.equal(tc.url.match(/with_keywords/g).length, 1); assert.deepEqual(tc.state['saved_filters_keyword'], ['True crime']);
main(); kwPick(); main();
shown.onSelect(pick('saved_filters_title')); shown.onSelect(shown.items.find(i=>i.title==='TC'));
assert.equal(pushed.at(-1).url, tc.url, 'opening saved filter does not add the keyword twice');
main(); shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items.find(i=>i.title==='TC')); shown.onSelect(shown.items.find(i=>i.act==='edit'));
assert.equal(pick('saved_filters_keyword').subtitle, 'True crime', 'Edit restores the keyword');
kwPick(); main(); shown.onSelect(pick('Начать поиск'));
assert.ok(!pushed.at(-1).url.includes('with_keywords'), 'no keyword when set to any');
console.log('OK keyword');
// 9. streaming provider + keyword combine; saved and restored
const prPick = (title) => { const g = pick('saved_filters_streaming'); g.items.forEach(i=>i.selected=i.title===title); };
main(); kwPick('True crime'); prPick('Netflix'); main(); shown.onSelect(pick('Начать поиск'));
assert.ok(pushed.at(-1).url.endsWith('&with_keywords=33722&with_watch_providers=8&watch_region=US' + NEW), pushed.at(-1).url);
main(); kwPick(); prPick('Paramount+'); main(); next = ['P']; shown.onSelect(pick('saved_filters_save'));
assert.ok(store.saved_filters.find(f=>f.name==='P').url.endsWith('&with_watch_providers=2303|2616&watch_region=US' + NEW));
prPick('filter_any'); main();
shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items.find(i=>i.title==='P')); shown.onSelect(shown.items.find(i=>i.act==='edit'));
assert.equal(pick('saved_filters_streaming').subtitle, 'Paramount+', 'Edit restores the provider');
console.log('OK streaming');
// 10. several keywords: match all (AND, main tag each) vs any (OR, every tag); match choice saved
const matchPick = (n) => { const g = pick('saved_filters_match'); g.items.forEach((i,k)=>i.selected=k===n); };
prPick('filter_any');
main(); kwPick('Interrogation'); main(); shown.onSelect(pick('Начать поиск'));
assert.ok(pushed.at(-1).url.endsWith('&with_keywords=15271|166582' + NEW), 'single keyword keeps all its tags: ' + pushed.at(-1).url);
main(); kwPick('True crime', 'Interrogation'); matchPick(0); main(); shown.onSelect(pick('Начать поиск'));
assert.ok(pushed.at(-1).url.endsWith('&with_keywords=33722,15271' + NEW), pushed.at(-1).url);
main(); matchPick(1); main(); next = ['OR']; shown.onSelect(pick('saved_filters_save'));
assert.ok(store.saved_filters.find(f=>f.name==='OR').url.endsWith('&with_keywords=33722|15271|166582' + NEW));
main(); kwPick(); matchPick(0); main();
shown.onSelect(pick('saved_filters_title')); shown.onLong(shown.items.find(i=>i.title==='OR')); shown.onSelect(shown.items.find(i=>i.act==='edit'));
assert.equal(pick('saved_filters_keyword').subtitle, 'True crime, Interrogation'); assert.equal(pick('saved_filters_match').subtitle, 'saved_filters_match_any');
console.log('OK match');
// 11. sort: newest first by default, oldest / popular selectable; old saves without sort open newest first; TMDB-only
const sortPick = (n) => { const g = pick('saved_filters_sort'); g.items.forEach((i,k)=>i.selected=k===n); };
kwPick(); main(); assert.equal(pick('saved_filters_sort').subtitle, 'saved_filters_sort_new', 'newest first is the default');
sortPick(1); main(); shown.onSelect(pick('Начать поиск'));
assert.ok(pushed.at(-1).url.endsWith('&sort_by=primary_release_date.asc'), pushed.at(-1).url);
sortPick(2); main(); next = ['POP']; shown.onSelect(pick('saved_filters_save'));
assert.ok(store.saved_filters.find(f=>f.name==='POP').url.endsWith('&sort_by=popularity.desc'));
data.type.items.forEach(i=>i.selected=i.cat==='tv'); sortPick(0); main(); shown.onSelect(pick('Начать поиск'));
assert.ok(pushed.at(-1).url.includes('&sort_by=first_air_date.desc&first_air_date.lte='), 'tv sorts by first air date');
main(); shown.onSelect(pick('saved_filters_title')); shown.onSelect(shown.items.find(i=>i.title==='old'));
assert.equal(pushed.at(-1).url, 'discover/movie?x' + NEW, 'old save opens newest first');
main(); shown.onSelect(pick('saved_filters_title')); shown.onSelect(shown.items.find(i=>i.title==='POP'));
assert.equal(pushed.at(-1).url, store.saved_filters.find(f=>f.name==='POP').url, 'saved sort kept');
Lampa.Storage.field = () => 'cub'; main(); assert.equal(pick('saved_filters_sort'), undefined, 'CUB has its own sort');
console.log('OK sort');
