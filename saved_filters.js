(function () {
    'use strict';

    // Lampa's built-in Filter (menu -> Фильтр) ends in an activity
    // {component:'category_full', source, url:'discover/...' | '?cat=...'}.
    // We save that activity (to reopen in one push) plus the menu choices (to edit/clone).
    // The filter menu's groups are Lampa's module-level objects, so setting
    // selected/checked on them is what the built-in menu itself does.
    var STORAGE_KEY = 'saved_filters';

    var ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M17 14l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4L17 14z" fill="currentColor"/>' +
        '</svg>';

    var pendingSave = null;    // {summary, state} while "save & search" waits for the filter's activity
    var pendingRestore = null; // saved filter to load into the filter menu on its next open
    var editingName = '';      // name of the filter being edited, prefilled on save
    var pendingQuery = '';     // TMDB discover params to add to the search the filter is about to run
    var pendingSort = '';      // sort_by for that search ('date' becomes the movie/tv release-date field)

    // Options Lampa's filter lacks: TMDB has no "true crime" genre (only a keyword) and no streaming-service genre.
    // Kept module-level like Lampa's own groups so the choice survives the menu being rebuilt.
    // shortcut: streaming availability is for the US catalogue (watch_region=US); add a region option if that's wrong.
    function provider(title, ids) { return { title: title, query: 'with_watch_providers=' + ids + '&watch_region=US' }; }
    var keywordGroup = { lang: 'saved_filters_keyword', items: [
        { title: 'True crime', checkbox: true, ids: ['33722'] },
        { title: 'Interrogation', checkbox: true, ids: ['15271', '166582'] }] }; // interrogation | police interrogation
    var matchGroup = { lang: 'saved_filters_match', items: [{ lang: 'saved_filters_match_all', and: true }, { lang: 'saved_filters_match_any' }] };
    var streamingGroup = { lang: 'saved_filters_streaming', items: [{ lang: 'filter_any' },
        provider('Netflix', '8'), provider('Amazon Prime Video', '9'), provider('Disney+', '337'),
        provider('HBO Max', '1899'), provider('Apple TV+', '350'), provider('Hulu', '15'),
        provider('Paramount+', '2303|2616'), provider('Peacock', '386|387')] };
    // Lampa's TMDB filter has no sort (TMDB defaults to popularity); CUB has its own Sort, so this one is TMDB-only.
    var sortGroup = { lang: 'saved_filters_sort', tmdb: true, items: [
        { lang: 'saved_filters_sort_new', sort: 'date.desc' },
        { lang: 'saved_filters_sort_old', sort: 'date.asc' },
        { lang: 'saved_filters_sort_popular', sort: 'popularity.desc' }] };
    var extraGroups = [keywordGroup, matchGroup, streamingGroup, sortGroup];

    // Saves made before sorting existed have no sort_by, so they also get the newest-first default.
    function sortQuery(url, sort) {
        if (url.indexOf('discover') !== 0 || url.indexOf('sort_by=') >= 0) return '';
        var field = url.indexOf('discover/movie') === 0 ? 'primary_release_date' : 'first_air_date';
        var query = '&sort_by=' + sort.replace('date', field);
        // Newest first would otherwise start with announced, unreleased titles.
        if (sort === 'date.desc' && url.indexOf(field + '.lte') < 0) {
            query += '&' + field + '.lte=' + new Date().toISOString().slice(0, 10);
        }
        return query;
    }

    function extraQuery() {
        var kws = keywordGroup.items.filter(function (i) { return i.checked; });
        // shortcut: TMDB can't express A AND (B OR C), so "all" uses each keyword's main tag only.
        var and = matchGroup.items[0].selected && kws.length > 1;
        var query = kws.length ? '&with_keywords=' + kws.map(function (i) { return and ? i.ids[0] : i.ids.join('|'); }).join(and ? ',' : '|') : '';
        var service = streamingGroup.items.find(function (i) { return i.selected && i.query; });
        return query + (service ? '&' + service.query : '');
    }

    function t(key) { return Lampa.Lang.translate(key); }

    function load() { return Lampa.Storage.get(STORAGE_KEY, '[]') || []; }
    function store(list) { Lampa.Storage.set(STORAGE_KEY, list); }

    function open(f) {
        Lampa.Activity.push({
            url: f.url + sortQuery(f.url, 'date.desc'),
            title: f.name,
            component: 'category_full',
            source: f.source,
            card_type: true,
            page: 1
        });
    }

    function openFilterMenu() {
        var item = $('.menu .menu__item[data-action="filter"]');
        if (!item.length) return false;
        item.eq(0).trigger('hover:enter');
        return true;
    }

    // ---- filter menu state ---------------------------------------------------

    function groupsOf(items) {
        return items.filter(function (g) { return g.items && !g.sf_save && !g.sf_list; });
    }

    // ponytail: keyed by translated titles; switching Lampa's language breaks Edit for older saves (Open still works).
    function snapshot(groups) {
        var state = {};
        groups.forEach(function (g) {
            state[g.title] = g.items.filter(function (i) { return i.selected || i.checked; })
                .map(function (i) { return i.title; });
        });
        return state;
    }

    function apply(groups, state) {
        groups.forEach(function (g) {
            var picked = state[g.title];
            if (!picked) return;
            g.items.forEach(function (i) {
                var on = picked.indexOf(i.title) >= 0;
                if (i.checkbox) i.checked = on;
                else i.selected = on;
            });
        });
    }

    // Same as the built-in selected(): "Комедия, Драма" or "Не выбрано".
    function refreshSubtitles(groups) {
        groups.forEach(function (g) {
            var titles = g.items.filter(function (i) { return i.selected || i.checked; })
                .map(function (i) { return i.title; });
            g.subtitle = titles.length ? titles.join(', ') : t('nochoice');
        });
    }

    function summarize(groups) {
        var none = t('nochoice');
        return groups.filter(function (g) { return g.subtitle && g.subtitle !== none; })
            .map(function (g) { return g.subtitle; }).join(', ');
    }

    // movie / tv decides which genre list the filter menu shows.
    function kind(groups) {
        var type = groups.find(function (g) { return g.items.some(function (i) { return i.cat; }); });
        var cur = type && type.items.find(function (i) { return i.selected; });
        return cur && cur.cat.indexOf('movie') >= 0 ? 'movie' : 'tv';
    }

    // ---- saved list ----------------------------------------------------------

    function showList(onBack) {
        var list = load();
        var items = list.map(function (f, i) {
            return { title: f.name, subtitle: f.summary || f.source, index: i };
        });

        if (!items.length) items.push({ title: t('saved_filters_empty'), subtitle: t('saved_filters_hint'), empty: true });

        Lampa.Select.show({
            title: t('saved_filters_title'),
            items: items,
            onBack: onBack,
            onSelect: function (a) {
                if (a.empty) onBack();
                else open(list[a.index]);
            },
            // Long press (OK held) = Open / Edit / Delete.
            onLong: function (a) {
                if (a.index !== undefined) showActions(list, a.index, onBack);
            }
        });
    }

    function showActions(list, index, onBack) {
        var f = list[index];
        var items = [{ title: t('saved_filters_open'), act: 'open' }];
        items.push({ title: t('saved_filters_edit'), subtitle: t(f.state ? 'saved_filters_edit_hint' : 'saved_filters_old'), act: 'edit' });
        items.push({ title: t('saved_filters_delete'), act: 'delete' });

        Lampa.Select.show({
            title: f.name,
            items: items,
            onBack: function () { showList(onBack); },
            onSelect: function (a) {
                if (a.act === 'open') open(f);
                else if (a.act === 'edit') {
                    if (!f.state) return Lampa.Noty.show(t('saved_filters_old'));
                    pendingRestore = f;
                    if (!openFilterMenu()) { pendingRestore = null; Lampa.Noty.show(t('saved_filters_no_menu')); }
                }
                else {
                    list.splice(index, 1);
                    store(list);
                    Lampa.Noty.show(t('saved_filters_deleted'));
                    showList(onBack);
                }
            }
        });
    }

    function save(activity, pending, name) {
        var list = load();
        var entry = { name: name, summary: pending.summary, state: pending.state, url: activity.url, source: activity.source };
        var same = list.findIndex(function (f) { return f.name === name; });
        if (same >= 0) list[same] = entry; // same name = update, new name = clone
        else list.push(entry);
        store(list);
        editingName = '';
        Lampa.Noty.show(t(same >= 0 ? 'saved_filters_updated' : 'saved_filters_saved'));
    }

    // Ask before the search starts: once the results page loads it takes the remote, and a dialog opened after that is stuck.
    function askName(done) {
        Lampa.Input.edit({ title: t('saved_filters_name'), value: editingName, free: true, nosave: true }, done);
    }

    // ---- hooks into Lampa ----------------------------------------------------

    function isFilterMenu(params) {
        return params && params.title === t('title_filter') && params.items &&
            params.items.some(function (i) { return i.search; });
    }

    function isFilterActivity(a) {
        return a && a.component === 'category_full' && typeof a.url === 'string' &&
            (a.url.indexOf('discover') === 0 || a.url.indexOf('?cat=') === 0);
    }

    function patchSelect() {
        var origShow = Lampa.Select.show;

        Lampa.Select.show = function (params) {
            if (isFilterMenu(params) && !params.saved_filters) {
                extraGroups.forEach(function (g) {
                    g.title = t(g.lang);
                    g.items.forEach(function (i) { if (i.lang) i.title = t(i.lang); });
                    if (!g.tmdb || Lampa.Storage.field('source') !== 'cub') params.items.push(g);
                });
                var groups = groupsOf(params.items);

                if (pendingRestore) {
                    var before = kind(groups);
                    extraGroups.forEach(function (g) { g.items.forEach(function (i) { i.selected = i.checked = false; }); }); // older saves lack them
                    apply(groups, pendingRestore.state);
                    // Type switched movie<->tv: the menu was built with the other genre list, rebuild it.
                    if (kind(groups) !== before && openFilterMenu()) return;
                    editingName = pendingRestore.name;
                    pendingRestore = null;
                }
                extraGroups.forEach(function (g) {
                    if (!g.items.some(function (i) { return i.selected || i.checkbox; })) g.items[0].selected = true;
                });
                refreshSubtitles(groups);

                var origOnSelect = params.onSelect;
                var count = load().length;
                var at = params.items.findIndex(function (i) { return i.search; }) + 1;

                params.saved_filters = true;
                params.items.splice(at, 0,
                    { title: t('saved_filters_save'), subtitle: editingName ? t('saved_filters_editing') + ': ' + editingName : '', sf_save: true },
                    { title: t('saved_filters_title'), subtitle: count ? String(count) : t('saved_filters_none'), sf_list: true }
                );
                params.onSelect = function (a) {
                    if (a.search || a.sf_save) {
                        pendingQuery = extraQuery();
                        pendingSort = sortGroup.items.find(function (i) { return i.selected; }).sort;
                    }
                    if (a.sf_save) {
                        askName(function (name) {
                            if (!name) return origShow.call(Lampa.Select, params);
                            pendingSave = { name: name, summary: summarize(groups), state: snapshot(groups) };
                            origOnSelect({ search: true });
                        });
                    }
                    else if (a.sf_list) showList(function () { origShow.call(Lampa.Select, params); });
                    else origOnSelect(a);
                };
            }
            return origShow.apply(this, arguments);
        };
    }

    // Catch the activity the filter's search() pushes/replaces, when we asked to save it.
    function patchActivity() {
        ['push', 'replace'].forEach(function (method) {
            var orig = Lampa.Activity[method];
            Lampa.Activity[method] = function (object) {
                // shortcut: TMDB only; the CUB source ('?cat=') has no keyword/provider parameters we know of.
                if (pendingSort && isFilterActivity(object) && object.url.indexOf('discover') === 0) {
                    object.url += pendingQuery + sortQuery(object.url, pendingSort);
                }
                if (isFilterActivity(object)) pendingQuery = pendingSort = '';
                var result = orig.apply(this, arguments);
                if (pendingSave && isFilterActivity(object)) {
                    var pending = pendingSave;
                    pendingSave = null;
                    save(object, pending, pending.name);
                }
                return result;
            };
        });
    }

    function addMenuItem() {
        var button = $('<li class="menu__item selector">' +
            '<div class="menu__ico">' + ICON + '</div>' +
            '<div class="menu__text">' + t('saved_filters_title') + '</div>' +
            '</li>');

        button.on('hover:enter', function () {
            showList(function () { Lampa.Controller.toggle('menu'); });
        });

        var builtin = $('.menu .menu__item[data-action="filter"]');
        if (builtin.length) builtin.eq(0).after(button);
        else $('.menu .menu__list').eq(0).append(button);
    }

    function start() {
        if (window.saved_filters_plugin) return;
        window.saved_filters_plugin = true;

        Lampa.Lang.add({
            saved_filters_title:     { ru: 'Мои фильтры', en: 'Saved filters', uk: 'Мої фільтри' },
            saved_filters_save:      { ru: 'Сохранить и искать', en: 'Save & search', uk: 'Зберегти і шукати' },
            saved_filters_name:      { ru: 'Название фильтра', en: 'Filter name', uk: 'Назва фільтра' },
            saved_filters_saved:     { ru: 'Фильтр сохранён', en: 'Filter saved', uk: 'Фільтр збережено' },
            saved_filters_updated:   { ru: 'Фильтр обновлён', en: 'Filter updated', uk: 'Фільтр оновлено' },
            saved_filters_deleted:   { ru: 'Фильтр удалён', en: 'Filter deleted', uk: 'Фільтр видалено' },
            saved_filters_open:      { ru: 'Открыть', en: 'Open', uk: 'Відкрити' },
            saved_filters_edit:      { ru: 'Изменить / копировать', en: 'Edit / copy', uk: 'Змінити / копіювати' },
            saved_filters_edit_hint: { ru: 'Новое имя — копия, то же имя — обновить', en: 'New name = copy, same name = update', uk: 'Нова назва — копія, та сама — оновити' },
            saved_filters_editing:   { ru: 'Редактируется', en: 'Editing', uk: 'Редагується' },
            saved_filters_old:       { ru: 'Сохранён старой версией — пересохраните, чтобы изменять', en: 'Saved by an old version — re-save it to edit', uk: 'Збережено старою версією — перезбережіть, щоб змінювати' },
            saved_filters_keyword:   { ru: 'Ключевое слово', en: 'Keyword', uk: 'Ключове слово' },
            saved_filters_match:     { ru: 'Ключевые слова: совпадение', en: 'Keywords: match', uk: 'Ключові слова: збіг' },
            saved_filters_match_all: { ru: 'Все отмеченные (И)', en: 'All ticked (AND)', uk: 'Усі позначені (І)' },
            saved_filters_match_any: { ru: 'Любое из отмеченных (ИЛИ)', en: 'Any ticked (OR)', uk: 'Будь-яке з позначених (АБО)' },
            saved_filters_sort:      { ru: 'Сортировка', en: 'Sort', uk: 'Сортування' },
            saved_filters_sort_new:  { ru: 'Сначала новые', en: 'Newest first', uk: 'Спочатку нові' },
            saved_filters_sort_old:  { ru: 'Сначала старые', en: 'Oldest first', uk: 'Спочатку старі' },
            saved_filters_sort_popular: { ru: 'По популярности', en: 'Most popular', uk: 'За популярністю' },
            saved_filters_streaming: { ru: 'Стриминг (США)', en: 'Streaming (US)', uk: 'Стрімінг (США)' },
            saved_filters_delete:    { ru: 'Удалить', en: 'Delete', uk: 'Видалити' },
            saved_filters_empty:     { ru: 'Нет сохранённых фильтров', en: 'No saved filters', uk: 'Немає збережених фільтрів' },
            saved_filters_none:      { ru: 'Пусто', en: 'Empty', uk: 'Порожньо' },
            saved_filters_no_menu:   { ru: 'Пункт «Фильтр» не найден в меню', en: 'Filter item not found in menu', uk: 'Пункт «Фільтр» не знайдено в меню' },
            saved_filters_hint:      { ru: 'Фильтр → выберите параметры → «Сохранить и искать». Удерживайте OK на фильтре для действий', en: 'Filter → pick options → “Save & search”. Hold OK on a filter for actions', uk: 'Фільтр → оберіть параметри → «Зберегти і шукати». Утримуйте OK на фільтрі для дій' }
        });

        patchSelect();
        patchActivity();

        if (window.appready) addMenuItem();
        else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') addMenuItem(); });
    }

    start();
})();
